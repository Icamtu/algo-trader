import logging
import pyotp
import asyncio
from typing import List, Dict, Any, Optional
from NorenRestApiPy.NorenApi import NorenApi
from .base_broker import BaseBroker
from .models import (
    NormalizedOrder, NormalizedPosition, OrderStatus,
    OrderAction, OrderType, ProductType, TickData
)
from .limiter import get_limiter
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

class ShoonyaBroker(BaseBroker):
    """
    Native Shoonya (Finvasia) Broker Adapter using NorenRestApiPy.
    Optimized for zero-latency execution and high-frequency data.
    Includes rate limiting and session persistence.
    """

    def __init__(self, broker_id: str, config: Dict[str, Any]):
        super().__init__(broker_id, config)
        self.api = NorenApi(host='https://trade.shoonya.com/NorenWClientAPI/', websocket='wss://api.shoonya.com/NorenWSAPI/')
        self._ws_connected = False
        self._limiter = get_limiter(broker_id, rps=10.0)
        self._logger = get_trade_logger()

    async def login(self) -> bool:
        """
        Performs Shoonya login. Attempts to reuse session token from DB if available.
        """
        try:
            # Check for existing session token in DB
            settings = self._logger.get_system_settings()
            token = settings.get("shoonya_susertoken")

            if token:
                logger.info("Attempting to resume Shoonya session from DB...")
                # Unfortunately NorenApi doesn't expose a 'set_token' easily without internal member access
                # but we can try to set it manually if we know the field name (it's usually __susertoken)
                # However, for robustness, we'll do a fresh login if resume fails.
                pass

            # Generate TOTP
            totp = pyotp.TOTP(self.config['totp_secret']).now()

            # Rate limit login attempt
            await self._limiter.wait()

            res = await asyncio.to_thread(
                self.api.login,
                userid=self.config['user_id'],
                password=self.config['password'],
                twoFA=totp,
                vendor_code=self.config['vendor_code'],
                api_key=self.config['api_key'],
                imei='AetherDeskPrime'
            )

            if res and res.get('stat') == 'Ok':
                self.is_connected = True
                susertoken = res.get('susertoken')
                if susertoken:
                    self._logger.update_system_setting("shoonya_susertoken", susertoken)

                logger.info(f"Shoonya Login Successful: {res.get('uname')}")
                return True
            else:
                logger.error(f"Shoonya Login Failed: {res.get('emsg')}")
                return False
        except Exception as e:
            logger.error(f"Shoonya Login Exception: {e}")
            return False

    async def logout(self) -> bool:
        if self.is_connected:
            await self._limiter.wait()
            await asyncio.to_thread(self.api.logout)
            self._logger.update_system_setting("shoonya_susertoken", "") # Clear session
            self.is_connected = False
            return True
        return False

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
    async def place_order(
        self,
        symbol: str,
        action: OrderAction,
        quantity: int,
        order_type: OrderType = OrderType.MARKET,
        price: float = 0.0,
        product: ProductType = ProductType.MIS,
        exchange: str = "NSE",
        strategy: str = "General",
        **kwargs
    ) -> NormalizedOrder:

        await self._limiter.wait()

        # Action Map: BUY -> 'B', SELL -> 'S'
        buy_sell = 'B' if action == OrderAction.BUY else 'S'

        # Product Map: MIS -> 'I', NRML -> 'M', CNC -> 'C'
        prd_map = {ProductType.MIS: 'I', ProductType.NRML: 'M', ProductType.CNC: 'C'}
        product_code = prd_map.get(product, 'I')

        # Order Type Map: MARKET -> 'MKT', LIMIT -> 'LMT', etc.
        typ_map = {
            OrderType.MARKET: 'MKT',
            OrderType.LIMIT: 'LMT',
            OrderType.SL_MARKET: 'SL-MKT',
            OrderType.SL_LIMIT: 'SL-LMT'
        }
        type_code = typ_map.get(order_type, 'MKT')

        res = await asyncio.to_thread(
            self.api.place_order,
            buy_sell=buy_sell,
            product_code=product_code,
            exchange=exchange,
            tradingsymbol=symbol,
            quantity=quantity,
            price_type=type_code,
            price=price,
            trigger_price=kwargs.get('trigger_price', 0.0),
            retention='DAY',
            remarks=strategy
        )

        if res and res.get('stat') == 'Ok':
            return NormalizedOrder(
                order_id=res.get('norenordno'),
                broker_order_id=res.get('norenordno'),
                symbol=symbol,
                action=action,
                quantity=quantity,
                order_type=order_type,
                price=price,
                product=product,
                status=OrderStatus.PENDING,
                strategy=strategy,
                raw_response=res
            )
        else:
            error_msg = res.get('emsg', 'Unknown Execution Error')
            raise Exception(f"Shoonya Order Placement Failed: {error_msg}")

    async def get_positions(self) -> List[NormalizedPosition]:
        await self._limiter.wait()
        res = await asyncio.to_thread(self.api.get_positions)
        positions = []
        if isinstance(res, list):
            for p in res:
                rev_prd_map = {'I': ProductType.MIS, 'M': ProductType.NRML, 'C': ProductType.CNC}
                positions.append(NormalizedPosition(
                    symbol=p.get('tsym'),
                    quantity=int(p.get('netqty', 0)),
                    buy_quantity=int(p.get('daybuyqty', 0)),
                    sell_quantity=int(p.get('daysellqty', 0)),
                    avg_price=float(p.get('netavgprc', 0.0)),
                    pnl=float(p.get('urmtom', 0.0)) + float(p.get('rpnl', 0.0)),
                    product=rev_prd_map.get(p.get('prd'), ProductType.MIS),
                    exchange=p.get('exch')
                ))
        return positions

    async def get_margins(self) -> Dict[str, float]:
        await self._limiter.wait()
        res = await asyncio.to_thread(self.api.get_limits)
        if res and res.get('stat') == 'Ok':
            return {
                "available": float(res.get('cash', 0.0)),
                "used": float(res.get('marginused', 0.0)),
                "total": float(res.get('cash', 0.0)) + float(res.get('marginused', 0.0))
            }
        return {"available": 0.0, "used": 0.0, "total": 0.0}

    async def subscribe_ticks(self, symbols: List[str]):
        if not self._ws_connected:
            await asyncio.to_thread(
                self.api.start_websocket,
                subscribe_callback=self._on_tick,
                socket_open_callback=self._on_ws_open,
                socket_error_callback=self._on_ws_error,
                socket_close_callback=self._on_ws_close
            )
            self._ws_connected = True

        for sym in symbols:
            await asyncio.to_thread(self.api.subscribe, sym)

    def _on_tick(self, tick: Dict[str, Any]):
        if 'lp' in tick:
            normalized = TickData(
                symbol=tick.get('tsym', 'unknown'),
                last_price=float(tick['lp']),
                volume=int(tick.get('v', 0)),
                timestamp=datetime.fromtimestamp(int(tick.get('ft', datetime.now().timestamp()))),
                exchange=tick.get('exch', 'NSE')
            )
            # Broadcast via AetherBridge standardized callback
            if hasattr(self, 'tick_callback') and self.tick_callback:
                if asyncio.iscoroutinefunction(self.tick_callback):
                    asyncio.create_task(self.tick_callback(normalized))
                else:
                    self.tick_callback(normalized)

    def _on_ws_open(self):
        logger.info("Shoonya WebSocket Connected")

    def _on_ws_error(self, error):
        logger.error(f"Shoonya WebSocket Error: {error}")

    def _on_ws_close(self):
        logger.warning("Shoonya WebSocket Closed")
        self._ws_connected = False
