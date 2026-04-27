import logging
import uuid
import time
from typing import Any, Dict, Optional
from execution.order_manager import OrderManager

logger = logging.getLogger(__name__)

class SimulatedOrderManager(OrderManager):
    """
    Mock OrderManager that simulates fills without API calls.
    Used for Backtesting and Paper Trading.
    """

    def __init__(self, risk_manager: Any = None, mode: str = "paper", slippage_pct: float = 0.0005):
        # Initialize basic attributes
        self.client = None
        self.mode = mode.lower()
        self.risk_manager = risk_manager

        from core.charges import nse_charger
        from execution.position_manager import PositionManager
        self.live_position_manager = PositionManager()
        self.sandbox_position_manager = PositionManager()

        self.active_orders: Dict[str, Dict] = {}
        self.trade_journal: list = []
        self.slippage_pct = slippage_pct # Configurable slippage
        self.current_sim_time: Optional[float] = None

    def set_sim_time(self, timestamp: float):
        self.current_sim_time = timestamp

    @property
    def position_manager(self):
        # In Paper/Sim mode, always use sandbox manager to protect live state
        return self.sandbox_position_manager

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
        human_approval: bool = False,
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Simulate an order fill at the provided 'price' (current tick price).
        """
        # 1. Validation (Optional Risk check)
        if self.risk_manager:
            current_pos = self.position_manager.get_quantity(symbol)
            risk_result = self.risk_manager.validate_order(
                symbol=symbol,
                action=action,
                quantity=quantity,
                price=price,
                current_position=current_pos
            )
            if not risk_result.allowed:
                logger.warning(f"[SIM_ORDER] Order REJECTED by RiskManager: {risk_result.reason}")
                return {"status": "error", "message": risk_result.reason}

        # 2. Simulate Slippage & Charges
        from core.charges import nse_charger
        fill_price = price
        if action == "BUY":
            fill_price *= (1 + self.slippage_pct)
        else:
            fill_price *= (1 - self.slippage_pct)

        charge_details = nse_charger.calculate(action, quantity, fill_price)

        # 3. Update Position & Journal
        order_id = f"PAPER_{uuid.uuid4().hex[:8].upper()}"
        self.position_manager.update(symbol, action, quantity, fill_price)

        trade_time = self.current_sim_time if self.current_sim_time else time.time()

        trade_record = {
            "order_id": order_id,
            "strategy": strategy_name,
            "symbol": symbol,
            "action": action,
            "quantity": quantity,
            "price": fill_price,
            "time": trade_time,
            "charges": charge_details["total"],
            "charge_details": charge_details,
            "ai_reasoning": ai_reasoning,
            "conviction": conviction,
            "status": "filled",
            "mode": self.mode
        }
        self.trade_journal.append(trade_record)

        logger.info(f"[{self.mode.upper()}_FILL] {action} {quantity} {symbol} @ ₹{fill_price:.2f} (Charges: ₹{charge_details['total']:.2f})")

        # Standardize response to match OpenAlgo/OrderManager expectations
        return {
            "status": "success",
            "order_id": order_id,
            "price": fill_price,
            "charges": charge_details["total"],
            "message": "SIMULATED_FILL_SUCCESS"
        }

    def get_positions(self):
        return self.position_manager.all_positions()

    def get_trade_log(self):
        return self.trade_journal
