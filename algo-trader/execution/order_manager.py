"""
execution/order_manager.py
Centralised order routing with risk checks and position tracking.

Flow for every order:
  1. RiskManager.validate_order() — reject immediately if any limit is breached
  2. Call broker (OpenAlgoClient) via asyncio.to_thread
  3. Log trade to SQLite via TradeLogger
  4. Update in-memory PositionManager
  5. Record the fill in RiskManager (daily counters)
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Optional, Dict

# OpenTelemetry
from opentelemetry import trace
tracer = trace.get_tracer(__name__)

from core.config import settings
from database.trade_logger import get_trade_logger
from risk.risk_manager import RiskManager
from execution.position_manager import PositionManager
from utils.throttling import AsyncTokenBucket
from data.timescale_logger import ts_logger
from services.charges_service import get_charges_service
from utils.latency_tracker import latency_tracker
from services.dlq_service import dlq_service
from services.sor_service import SmartOrderRouter
from brokers.models import OrderStatus

logger = logging.getLogger(__name__)


class OrderManager:
    """
    Handles order execution, risk gating, position tracking, and trade logging.
    """

    def __init__(
        self,
        mode: str = "live",
        risk_manager: Optional[RiskManager] = None,
        position_manager: Optional[PositionManager] = None,
        telemetry_callback: Optional[Any] = None,
        action_manager: Optional[Any] = None,
    ):
        self.mode = mode.lower()
        self.trade_logger = get_trade_logger()
        self.risk_manager = risk_manager or RiskManager()
        self.telemetry_callback = telemetry_callback
        self.action_manager = action_manager

        # AetherBridge: Native Execution Core (Phase 6)
        self.native_broker = None
        self.shadow_mode = settings.get("aetherbridge", {}).get("shadow_mode", False)

        if settings.get("aetherbridge", {}).get("enabled", False):
            from brokers.factory import BrokerFactory
            broker_name = settings.get("aetherbridge", {}).get("active_broker", "paper")

            # Merge with DB config
            db_config = self.trade_logger.get_broker_config().get(broker_name, {})
            broker_config = settings.get("aetherbridge", {}).get("brokers", {}).get(broker_name, {}).copy()
            broker_config.update(db_config)

            # Pass shadow_mode as dry_run to the native broker
            if self.shadow_mode:
                broker_config["dry_run"] = True

            try:
                self.native_broker = BrokerFactory.get_broker(broker_name, broker_config)
                logger.info("AetherBridge: Native Broker [%s] initialized (Shadow Mode: %s)",
                            broker_name.upper(), self.shadow_mode)
            except Exception:
                logger.error("AetherBridge: Failed to initialize native broker", exc_info=True)

        # Position Management Delegates (Phase 16: Separate state tracks)
        self.live_position_manager = (position_manager if self.mode == "live" else None) or PositionManager()
        self.sandbox_position_manager = (position_manager if self.mode != "live" else None) or PositionManager()

        # AetherBridge Sandbox Kernel (Always initialized for isolation)
        from brokers.paper_broker import PaperBroker
        self.paper_broker = PaperBroker("paper", {"initial_funds": 1000000.0})
        asyncio.create_task(self.paper_broker.login())

        _sor_adapters = {}
        if self.native_broker:
            _sor_adapters[self.native_broker.broker_id] = self.native_broker
        _sor_adapters["paper"] = self.paper_broker
        self.sor = SmartOrderRouter(_sor_adapters)

        asyncio.create_task(dlq_service.start_processor(self))

        # Rate Limiting (Phase 16: Institutional Throttling)
        self.limiter = AsyncTokenBucket(5, 5)

        self.risk_dispatcher = None

        logger.info("OrderManager initialised in %s mode.", self.mode.upper())

    def set_risk_dispatcher(self, dispatcher):
        """Sets the risk dispatcher for broadcasting updates."""
        self.risk_dispatcher = dispatcher

    def get_position_manager(self, mode: Optional[str] = None) -> PositionManager:
        """Get the specific position manager for a mode."""
        effective_mode = (mode or self.mode).lower()
        if effective_mode == "live":
            return self.live_position_manager
        return self.sandbox_position_manager

    @property
    def position_manager(self) -> PositionManager:
        """Get the active position manager based on the default system mode."""
        return self.get_position_manager()

    def set_mode(self, mode: str):
        """Switch the system mode between 'live' and 'sandbox'."""
        self.mode = mode.lower()
        logger.info("OrderManager mode switched to %s.", self.mode.upper())

    # ------------------------------------------------------------------
    # Core order placement
    # ------------------------------------------------------------------

    async def place_order(
        self,
        strategy_name: str,
        symbol: str,
        action: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
        mode: Optional[str] = None,
        retry_from_dlq: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Place an order with full risk check, broker call, position update,
        latency tracking, and trade logging.
        """
        with tracer.start_as_current_span("place_order") as span:
            span.set_attribute("symbol", symbol)
            span.set_attribute("action", action)
            span.set_attribute("strategy", strategy_name)

            async with await latency_tracker.measure_async(f"OrderExecution:{symbol}", threshold_ms=10.0):
                action = action.upper()
                effective_mode = (mode or self.mode).lower()
                pm = self.get_position_manager(effective_mode)

                # 1. Risk check
                current_pos = pm.get_quantity(symbol)
                risk_result = self.risk_manager.validate_order(
                    symbol=symbol,
                    action=action,
                    quantity=quantity,
                    price=price,
                    current_position=current_pos,
                    strategy_id=strategy_name,
                    product=product,
                    mode=effective_mode,
                )
                if not risk_result.allowed:
                    logger.warning(
                        "[%s] ORDER BLOCKED by risk: %s", strategy_name, risk_result.reason
                    )
                    asyncio.create_task(self.trade_logger.log_trade(
                        strategy=strategy_name,
                        symbol=symbol,
                        side=action,
                        quantity=quantity,
                        price=price,
                        status="blocked",
                        ai_reasoning=ai_reasoning,
                        conviction=conviction,
                    ))
                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("order_rejected", {
                            "strategy": strategy_name, "symbol": symbol, "action": action, "reason": risk_result.reason
                        }))
                    return {"status": "blocked", "reason": risk_result.reason}

                logger.info(
                    "[%s] >> %s %d %s @ %s [%s/%s]",
                    strategy_name, action, quantity, symbol, order_type, product, exchange,
                )

                # 1.5 Semi-Auto Gateway Diversion
                am = self.action_manager
                if not am:
                    from execution.action_manager import get_action_manager
                    am = get_action_manager()

                if getattr(self, 'force_semi_auto', False) or kwargs.get('human_approval') == True:
                    logger.info("[%s] Diverting order to Action Center for approval: %s", strategy_name, symbol)
                    am.queue_for_approval({
                        "strategy": strategy_name,
                        "symbol": symbol,
                        "action": action,
                        "quantity": quantity,
                        "price": price,
                        "price_type": order_type,
                        "product": product,
                        "exchange": exchange,
                        "api_type": "Diverted",
                        "ai_reasoning": ai_reasoning,
                        "conviction": conviction,
                    })
                    return {"status": "success", "message": "Order queued for human approval", "location": "action_center"}

                # 2. Call broker (WITH RATE LIMITING)
                start_broker = time.perf_counter()
                processed_natively = False
                native_latency = 0
                native_order_id = None
                response = None

                try:
                    # Wait for token before calling broker for Live orders
                    if effective_mode == "live":
                        await self.limiter.wait()

                    with tracer.start_as_current_span("broker_api_call") as broker_span:
                        broker_span.set_attribute("broker_mode", effective_mode)

                        # AETHERBRIDGE ROUTE (Native First)
                        if effective_mode == "sandbox":
                            active_broker = self.paper_broker
                        elif self.native_broker:
                            try:
                                best_id = await self.sor.get_best_execution_broker(symbol, action, quantity)
                                active_broker = self.sor.adapters.get(best_id, self.native_broker)
                            except Exception:
                                active_broker = self.native_broker
                        else:
                            active_broker = None

                        if active_broker:
                            try:
                                from brokers.models import OrderAction, OrderType, ProductType
                                n_action = OrderAction.BUY if action == "BUY" else OrderAction.SELL
                                try:
                                    n_type = getattr(OrderType, order_type.upper(), OrderType.MARKET)
                                except:
                                    n_type = OrderType.MARKET
                                try:
                                    n_product = getattr(ProductType, product.upper(), ProductType.MIS)
                                except:
                                    n_product = ProductType.MIS
                                try:
                                    n_exchange = exchange.upper()
                                except:
                                    n_exchange = "NSE"

                                start_native = time.perf_counter()
                                native_order = await active_broker.place_order(
                                    symbol=symbol,
                                    action=n_action,
                                    quantity=quantity,
                                    order_type=n_type,
                                    price=price,
                                    product=n_product,
                                    exchange=n_exchange,
                                    strategy=strategy_name,
                                    **kwargs
                                )
                                native_latency = (time.perf_counter() - start_native) * 1000
                                native_order_id = native_order.order_id
                                logger.info("[AETHERBRIDGE] %s Execution: %s ms | OrderID: %s", effective_mode.upper(), f"{native_latency:.2f}", native_order_id)

                                response = {
                                    "status": "success",
                                    "order_id": native_order_id,
                                    "price": native_order.price,
                                    "message": "Executed via AetherBridge Native"
                                }
                            except Exception:
                                logger.error("Native broker execution failed", exc_info=True)
                                raise

                        if not response:
                            logger.error("AetherBridge native execution failed to provide a response for %s", symbol)
                            raise Exception(f"Native execution failed for {symbol}")

                        if response:
                            broker_span.set_attribute("broker_status", response.get("status", "unknown"))
                            broker_span.set_attribute("order_id", str(response.get("order_id", "N/A")))

                    broker_latency = (time.perf_counter() - start_broker) * 1000
                    logger.info("[AUDIT] Broker Latency for %s %s: %s ms", symbol, action, f"{broker_latency:.2f}")
                    # Prometheus metrics
                    try:
                        from fastapi_app import ORDER_COUNTER, LATENCY_HISTOGRAM
                        ORDER_COUNTER.labels(symbol=symbol, action=action, strategy=strategy_name).inc()
                        LATENCY_HISTOGRAM.labels(operation="order_execution").observe(broker_latency / 1000)
                    except Exception:
                        pass
                except Exception:
                    logger.error("[%s] Broker call failed for %s", strategy_name, symbol, exc_info=True)
                    asyncio.create_task(self.trade_logger.log_trade(
                        strategy=strategy_name,
                        symbol=symbol,
                        side=action,
                        quantity=quantity,
                        price=price,
                        status="rejected",
                        mode=effective_mode,
                        ai_reasoning=ai_reasoning,
                        conviction=conviction,
                    ))
                    if effective_mode == "live" and not retry_from_dlq:
                        dlq_service.enqueue({
                            "strategy_name": strategy_name,
                            "symbol": symbol,
                            "action": action,
                            "quantity": quantity,
                            "order_type": order_type,
                            "price": price,
                            "product": product,
                            "exchange": exchange,
                            "ai_reasoning": ai_reasoning,
                            "conviction": conviction,
                        }, "Internal execution error")
                    return {"status": "error", "message": "Broker execution failed"}

                logger.info("[%s] << Response: %s", strategy_name, response)

                # Determine execution outcome
                if response and not isinstance(response, dict):
                    # Handle Pydantic model (AetherBridge Native)
                    resp_status = getattr(response, 'status', OrderStatus.COMPLETE)
                    if hasattr(resp_status, 'value'):
                        resp_status = resp_status.value
                    resp_status = str(resp_status).lower()
                    execution_price = float(getattr(response, 'price', price) or price)
                    order_id = getattr(response, 'order_id', None)
                else:
                    # Handle dictionary (Legacy OpenAlgo)
                    resp_status = (response or {}).get("status", "filled") if response else "rejected"
                    execution_price = price
                    if response and isinstance(response, dict):
                        execution_price = float(response.get("price", price) or price)
                    order_id = (response or {}).get("order_id") if response else None

                is_filled = resp_status not in {"error", "rejected", "blocked"}

                # Phase 16: Ensure Pricing Integrity
                if is_filled and execution_price == 0.0:
                    try:
                        quote = await self.get_quote(symbol, exchange)
                        if quote and isinstance(quote, dict):
                            broker_ltp = float(quote.get("last_price") or quote.get("lp") or 0.0)
                            if broker_ltp > 0:
                                execution_price = broker_ltp
                                logger.info("[%s] Fallback pricing triggered for %s: %s", strategy_name, symbol, execution_price)
                    except Exception:
                         logger.warning("PLACE_ORDER_PRICING_FALLBACK_FAULT", exc_info=True)

                # Calculate charges
                est_charges = 0.0
                if is_filled:
                    try:
                        asset_type = "OPTIONS" if any(idx in symbol for idx in ["NIFTY", "BANKNIFTY", "FINNIFTY"]) and any(c.isdigit() for c in symbol) else "EQUITY"
                        from services.charges_service import get_charges_service
                        charges_service = get_charges_service()
                        charge_data = charges_service.calculate(
                            symbol=symbol,
                            side=action, quantity=quantity, price=execution_price, product=product, asset_type=asset_type
                        )
                        est_charges = charge_data["total"]
                    except Exception:
                        logger.warning("CHARGE_CALC_FAULT", exc_info=True)

                # 3. Log to database
                asyncio.create_task(self.trade_logger.log_trade(
                    strategy=strategy_name,
                    symbol=symbol,
                    side=action,
                    quantity=quantity,
                    price=execution_price,
                    status=resp_status if is_filled else "rejected",
                    order_id=str(order_id) if order_id else None,
                    charges=est_charges,
                    mode=effective_mode,
                    ai_reasoning=ai_reasoning,
                    conviction=conviction,
                ))

                # 4. Update in-memory position
                if is_filled:
                    pm.update(symbol, action, quantity, execution_price)
                    open_positions = sum(1 for p in pm.all_positions().values() if p.quantity != 0)
                    self.risk_manager.update_open_positions(open_positions)
                    self.risk_manager.record_trade(pnl=0.0, charges=est_charges)

                    if self.telemetry_callback:
                        telemetry_payload = {
                            "type": "ORDER_UPDATE",
                            "status": "filled",
                            "strategy": strategy_name,
                            "symbol": symbol,
                            "action": action,
                            "quantity": quantity,
                            "price": execution_price,
                            "order_id": order_id,
                            "timestamp": datetime.now().isoformat(),
                            "meta": {"broker_latency_ms": round(broker_latency, 2)}
                        }
                        asyncio.create_task(self.telemetry_callback("trade_filled", telemetry_payload))
                        asyncio.create_task(self.telemetry_callback("risk_update", self.risk_manager.get_status()))

                        if self.risk_dispatcher:
                            self.risk_dispatcher.broadcast_risk(self.risk_manager.get_status())

                return response

    async def place_smart_order(
        self,
        strategy_name: str,
        symbol: str,
        action: str,
        quantity: int,
        position_size: int = 0,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
    ):
        """Smart order — calculates net quantity to reach target position."""
        with tracer.start_as_current_span("place_smart_order") as span:
            span.set_attribute("symbol", symbol)
            span.set_attribute("action", action)
            span.set_attribute("strategy", strategy_name)

            action = action.upper()
            logger.info(
                "[%s] SmartOrder >> %s %s qty=%d pos_size=%d",
                strategy_name, action, symbol, quantity, position_size,
            )
            try:
                # Calculate required quantity
                current_qty = self.position_manager.get_quantity(symbol)
                target_qty = position_size if action == "BUY" else -position_size
                required_qty = target_qty - current_qty
                
                if required_qty == 0:
                    return {"status": "success", "message": "Position already at target"}
                    
                exec_action = "BUY" if required_qty > 0 else "SELL"
                exec_qty = abs(required_qty)
                
                return await self.place_order(
                    strategy_name=strategy_name,
                    symbol=symbol,
                    action=exec_action,
                    quantity=exec_qty,
                    order_type=order_type,
                    price=price,
                    product=product,
                    exchange=exchange
                )
            except Exception:
                logger.error("[%s] SmartOrder failed", strategy_name, exc_info=True)
                return {"status": "error", "message": "Smart order calculation failed"}

    async def place_basket_order(self, strategy_name: str, orders: list):
        """Send multiple orders sequentially (AetherBridge bulk processing)."""
        with tracer.start_as_current_span("place_basket_order") as span:
            span.set_attribute("order_count", len(orders))
            span.set_attribute("strategy", strategy_name)

            logger.info("[%s] BasketOrder >> %d orders", strategy_name, len(orders))
            results = []
            for o in orders:
                res = await self.place_order(strategy_name=strategy_name, **o)
                results.append(res)
            return {"status": "success", "results": results}

    async def modify_order(
        self,
        order_id: str,
        symbol: str,
        action: str,
        quantity: int,
        price: float,
        order_type: str = "LIMIT",
        product: str = "MIS",
        exchange: str = "NSE",
    ):
        logger.info("ModifyOrder %s \u2192 qty=%d price=%s", order_id, quantity, price)
        try:
            await self.limiter.wait()
            active_broker = self.native_broker if self.mode == "live" else self.paper_broker
            if not active_broker: return None
            
            from brokers.models import OrderAction, OrderType, ProductType
            n_action = OrderAction.BUY if action == "BUY" else OrderAction.SELL
            n_type = getattr(OrderType, order_type.upper(), OrderType.LIMIT)
            n_product = getattr(ProductType, product.upper(), ProductType.MIS)
            
            return await active_broker.modify_order(
                order_id=order_id,
                symbol=symbol,
                action=n_action,
                quantity=quantity,
                price=price,
                order_type=n_type,
                product=n_product,
                exchange=exchange
            )
        except Exception:
            logger.error("ModifyOrder failed", exc_info=True)
            return None

    async def cancel_order(self, order_id: str):
        logger.info("CancelOrder \u2192 %s", order_id)
        try:
            await self.limiter.wait()
            active_broker = self.native_broker if self.mode == "live" else self.paper_broker
            if not active_broker: return None
            return await active_broker.cancel_order(order_id)
        except Exception:
            logger.error("CancelOrder failed", exc_info=True)
            return None

    async def cancel_all_orders(self):
        logger.info("CancelAllOrders")
        try:
            active_broker = self.native_broker if self.mode == "live" else self.paper_broker
            if not active_broker: return None
            # Paper broker doesn't have cancel_all, so we loop
            if hasattr(active_broker, 'cancel_all_orders'):
                return await active_broker.cancel_all_orders()
            else:
                orders = await self.get_orders()
                tasks = [active_broker.cancel_order(o["order_id"]) for o in orders if o["status"] in ["OPEN", "PENDING", "MODIFY_PENDING"]]
                if tasks: await asyncio.gather(*tasks)
                return {"status": "success", "message": "All orders cancelled"}
        except Exception:
            logger.error("CancelAllOrders failed", exc_info=True)
            return None

    async def square_off_all(self):
        """
        Emergency Kill-Switch:
        1. Globally halt all strategies in RiskManager.
        2. Cancel all pending orders.
        3. Close all open positions with market orders.
        """
        with tracer.start_as_current_span("emergency_square_off") as span:
            logger.warning("!!! EMERGENCY SQUARE-OFF ALL INITIATED [%s] !!!", self.mode.upper())
            try:
                # 1. Global Halt
                self.risk_manager.global_halt = True

                # 2. Cancel orders
                await self.cancel_all_orders()

                # 2. Get active positions
                positions = self.position_manager.all_positions()
                active_symbols = [s for s, p in positions.items() if p.quantity != 0]
                span.set_attribute("active_positions_count", len(active_symbols))

                if not active_symbols:
                    logger.info("No active positions to square off.")
                    return {"status": "success", "message": "No positions to square off."}

                tasks = []
                for symbol in active_symbols:
                    pos = positions[symbol]
                    action = "SELL" if pos.quantity > 0 else "BUY"
                    qty = abs(pos.quantity)

                    logger.info("Squaring off %s: %s %d", symbol, action, qty)
                    tasks.append(self.place_order(
                        strategy_name="EMERGENCY_PANIC",
                        symbol=symbol,
                        action=action,
                        quantity=qty,
                        order_type="MARKET"
                    ))

                results = await asyncio.gather(*tasks)
                return {"status": "success", "results": results}
            except Exception:
                logger.error("EMERGENCY_SQUARE_OFF_FAULT", exc_info=True)
                return {"status": "error", "message": "Emergency square-off failed"}

    async def liquidate_strategy(self, strategy_id: str):
        """
        Targeted Kill-Switch for a specific strategy node.
        1. Halt the strategy in RiskManager to block new orders.
        2. Identify and square off all positions with this strategy metadata.
        """
        logger.warning("!!! TARGETED LIQUIDATION INITIATED: %s !!!", strategy_id)
        try:
            # 1. Block further orders
            self.risk_manager.halt_strategy(strategy_id)

            # 2. Get active positions for THIS strategy
            positions = self.position_manager.all_positions()

            squared_count = 0
            tasks = []
            for symbol, pos in positions.items():
                if pos.quantity != 0:
                    # Check if this position belongs to the target strategy
                    if getattr(pos, 'metadata', {}).get('strategy_id') == strategy_id or \
                       getattr(pos, 'metadata', {}).get('strategy') == strategy_id:

                        action = "SELL" if pos.quantity > 0 else "BUY"
                        qty = abs(pos.quantity)
                        logger.warning("Liquidating %s -> %s %s %s", strategy_id, symbol, action, qty)
                        tasks.append(self.place_order(
                            strategy_name=f"KILL_{strategy_id}",
                            symbol=symbol,
                            action=action,
                            quantity=qty,
                            order_type="MARKET"
                        ))
                        squared_count += 1

            if tasks:
                results = await asyncio.gather(*tasks)
                return {"status": "success", "liquidated_count": squared_count, "details": results}

            return {"status": "success", "message": "No positions found for this strategy."}

        except Exception:
            logger.error(f"Targeted liquidation for {strategy_id} failed", exc_info=True)
            return {"status": "error", "message": "Strategy liquidation failed"}

    async def get_order_status(self, order_id: str):
        return await asyncio.to_thread(self.client.get_order_status, order_id)

    # ------------------------------------------------------------------
    # Data queries (delegate to broker client)
    # ------------------------------------------------------------------

    async def get_positions(self):
        """Fetches active positions from the broker."""
        # Use native broker if configured (and not in sandbox mode, or if shadow mode is active)
        if self.native_broker and (self.mode != "sandbox" or self.shadow_mode):
            try:
                positions = await self.native_broker.get_positions()
                return [p.model_dump() if hasattr(p, "model_dump") else (p.dict() if hasattr(p, "dict") else p) for p in positions]
            except Exception:
                logger.error("Native get_positions failed", exc_info=True)
                if not self.shadow_mode: return []

        # Fallback to paper broker for sandbox or as secondary source
        try:
            positions = await self.paper_broker.get_positions()
            return [p.model_dump() if hasattr(p, "model_dump") else (p.dict() if hasattr(p, "dict") else p) for p in positions]
        except Exception:
            logger.error("Paper get_positions failed", exc_info=True)
            return []

    async def get_open_positions_dict(self) -> Dict[str, int]:
        """
        Fetch broker positions and return as a flat symbol-to-quantity map.
        Useful for drift detection and dashboard summaries.
        """
        resp = await self.get_positions()
        pos_dict = {}

        # OpenAlgo response format handling
        data = resp.get("data", []) if isinstance(resp, dict) else resp
        if not isinstance(data, list):
            data = []

        for pos in data:
            symbol = pos.get("symbol")
            # OpenAlgo uses 'netqty' or 'quantity'
            qty_str = pos.get("netqty") or pos.get("quantity") or "0"
            try:
                qty = int(float(qty_str))
            except (ValueError, TypeError):
                qty = 0

            if symbol:
                pos_dict[symbol] = pos_dict.get(symbol, 0) + qty

        return pos_dict

    async def get_holdings(self):
        return []

    async def get_orders(self):
        """Fetches order book from the broker or paper broker."""
        try:
            active_broker = self.native_broker if (self.mode == "live" or self.shadow_mode) else self.paper_broker
            if not active_broker: return []
            
            orders = await active_broker.get_orders()
            # Use model_dump() for V2, dict() for V1 fallback
            return [o.model_dump() if hasattr(o, "model_dump") else (o.dict() if hasattr(o, "dict") else o) for o in orders]
        except Exception:
            logger.error("GetOrders failed", exc_info=True)
            return []

    async def get_trades(self):
        return []

    async def get_funds(self):
        """Fetches available funds/margins from the broker."""
        try:
            active_broker = self.native_broker if (self.mode == "live" or self.shadow_mode) else self.paper_broker
            if not active_broker:
                return {"status": "error", "message": "No active broker available"}
                
            funds = await active_broker.get_funds()
            return funds.model_dump() if hasattr(funds, "model_dump") else (funds.dict() if hasattr(funds, "dict") else funds)
        except Exception:
            logger.error("GetFunds failed", exc_info=True)
            return {"status": "error", "message": "Failed to fetch funds"}

    async def get_history(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: str = "1",
        start_date: str = "",
        end_date: str = "",
    ):
        """Fetches historical candles via the active broker."""
        try:
            active_broker = self.native_broker if (self.mode == "live" or self.shadow_mode) else self.paper_broker
            if not active_broker: return []
            
            # Internal normalization for string dates to ISO if needed
            def _normalize_date(d: str) -> str:
                if not d: return ""
                try:
                    from datetime import datetime
                    if "T" in d:
                        dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
                        return dt.strftime("%Y-%m-%d")
                    return d
                except:
                    return d

            n_start = _normalize_date(start_date)
            n_end = _normalize_date(end_date)
            
            return await active_broker.get_historical_candles(
                symbol=symbol,
                exchange=exchange,
                interval=interval,
                start_time=n_start,
                end_time=n_end
            )
        except Exception:
            logger.error("GetHistory failed", exc_info=True)
            return []

    async def toggle_analyzer(self, state: bool):
        return {"status": "success", "message": "Analyzer decommissioned"}

    async def get_analyzer_status(self):
        return {"status": "success", "analyzer_mode": False}

    async def get_quote(self, symbol: str, exchange: str = "NSE"):
        """
        Institutional Gateway for fetching a single real-time quote.
        """
        active_broker = self.native_broker if self.mode == "live" else self.paper_broker
        if not active_broker:
             return {"status": "error", "message": "No active broker for quote"}

        try:
            quote = await active_broker.get_quote(symbol, exchange)
            return {"status": "success", "data": quote}
        except Exception:
            logger.error("Quote fetch failure", exc_info=True)
            return {"status": "error", "message": "Failed to fetch market data"}

    async def get_multi_quotes(self, symbols: list):
        """
        Institutional Gateway for fetching real-time quotes in bulk.
        Delegates to the active broker based on current trading mode.
        """
        active_broker = self.native_broker if self.mode == "live" else self.paper_broker

        if not active_broker:
            return {"status": "error", "message": "No active broker for quotes"}

        try:
            # Delegate to the broker's native (or default concurrent) get_multi_quotes
            results = await active_broker.get_multi_quotes(symbols)
            return {"status": "success", "data": results}
        except Exception:
            logger.error("Bulk quote fetch failed", exc_info=True)
            return {"status": "error", "message": "Bulk quote fetch failed"}

    # ------------------------------------------------------------------
    # Synchronization & Reconciliation
    # ------------------------------------------------------------------

    async def check_drift(self) -> bool:
        """
        Lightweight check to see if local state matches broker state.
        Returns True if drift detected, False otherwise.
        """
        try:
            broker_positions = await self.get_positions()
            if isinstance(broker_positions, dict):
                broker_positions = broker_positions.get("data", [])

            # Simple check: do we have the same symbols and quantities?
            for pos in (broker_positions or []):
                # Handle both dict and Pydantic models/objects
                if isinstance(pos, dict):
                    symbol = pos.get("symbol")
                    if not symbol: continue
                    net_qty = int(float(pos.get("quantity") or pos.get("netqty") or 0))
                else:
                    # Assume it's an object/model
                    symbol = getattr(pos, "symbol", None)
                    if not symbol: continue
                    net_qty = int(float(getattr(pos, "quantity", 0) or 0))
                
                local_qty = self.position_manager.get_quantity(symbol)
                if local_qty != net_qty:
                    logger.info("Drift detected for %s: local=%d, broker=%d", symbol, local_qty, net_qty)
                    return True

            # Also check if we have local positions that don't exist in broker
            local_snapshot = self.position_manager.all_positions()
            broker_symbols = set()
            for p in (broker_positions or []):
                s = getattr(p, "symbol", None) if not isinstance(p, dict) else p.get("symbol")
                if s: broker_symbols.add(s)
                
            for symbol, pos in local_snapshot.items():
                if pos.quantity != 0 and symbol not in broker_symbols:
                    logger.info("Drift detected: local position %s not in broker", symbol)
                    return True

            return False
        except Exception:
            logger.error("Drift check failed", exc_info=True)
            return False


    async def sync_with_broker(self):
        """
        Force-synchronize the local PositionManager with the actual broker state.
        This handles cases where the local state might drift (e.g. restarts).
        """
        logger.info("Starting broker reconciliation loop...")
        try:
            # Phase 8: Session Health Check
            from services.session_service import get_session_service
            ss = get_session_service(self)

            is_healthy = await ss.check_health()
            if not is_healthy:
                logger.warning("Broker session unhealthy. Attempting auto-recovery...")
                success = await ss.run_reauth_flow()
                if not success:
                    logger.error("Auto-recovery failed. Skipping reconciliation.")
                    return

            broker_positions = await self.get_positions()
            if not isinstance(broker_positions, list):
                # Handle dictionary response from OpenAlgo
                broker_positions = broker_positions.get("data", []) if isinstance(broker_positions, dict) else []

            # 1. Track symbols seen in broker
            broker_symbols = set()
            pm = self.position_manager

            # Full snapshot for audit log
            local_snapshot = pm.all_positions()
            local_map = {}
            for i, (s, p) in enumerate(local_snapshot.items()):
                if i >= 500: break # Hard limit on snapshot size
                local_map[s] = p.quantity
            snapshot_data = {
                "local": local_map,
                "broker": {}
            }

            for pos in broker_positions:
                symbol = pos.get("symbol")
                if not symbol: continue

                net_qty = int(float(pos.get("quantity") or pos.get("netqty") or 0))
                avg_price = float(pos.get("avg_price") or pos.get("lp") or 0.0)

                broker_symbols.add(symbol)
                snapshot_data["broker"][symbol] = net_qty

                local_qty = pm.get_quantity(symbol)
                if local_qty != net_qty:
                    drift_type = "MISMATCH"
                    action = "AUTO_ALIGN_LOCAL"

                    logger.warning(
                        "Reconciliation Drift detected for %s! Local: %d | Broker: %d. Aligning...",
                        symbol, local_qty, net_qty
                    )

                    # Persistent Audit Log
                    asyncio.create_task(self.trade_logger.log_drift_event(
                        symbol=symbol,
                        local_qty=local_qty,
                        broker_qty=net_qty,
                        drift_type=drift_type,
                        action=action,
                        snapshot=snapshot_data
                    ))

                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("drift_detected", {
                            "symbol": symbol,
                            "local_qty": local_qty,
                            "broker_qty": net_qty,
                            "action": action
                        }))
                    pm.set_position(symbol, net_qty, avg_price)

            # 2. Check for Orphaned Local Positions (in local but not in broker)
            for symbol, pos in local_snapshot.items():
                if pos.quantity != 0 and symbol not in broker_symbols:
                    logger.warning(f"Orphaned local position detected for {symbol} (Qty: {pos.quantity})! Broker reports 0. Purging local state...")

                    snapshot_data["broker"][symbol] = 0

                    asyncio.create_task(self.trade_logger.log_drift_event(
                        symbol=symbol,
                        local_qty=pos.quantity,
                        broker_qty=0,
                        drift_type="ORPHAN",
                        action="PURGE_LOCAL",
                        snapshot=snapshot_data
                    ))

                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("drift_detected", {
                            "symbol": symbol,
                            "local_qty": pos.quantity,
                            "broker_qty": 0,
                            "action": "PURGE_LOCAL"
                        }))
                    pm.set_position(symbol, 0, 0.0)

            logger.info("Broker reconciliation complete.")
        except Exception:
            logger.error("Error during broker reconciliation", exc_info=True)
