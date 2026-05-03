"""
risk/risk_manager.py
Enhanced risk guardrails for algo-trader.

Checks applied before every order:
  - Basic per-order quantity / notional caps
  - Per-symbol position concentration
  - Daily trade count limit
  - Daily realised-loss circuit-breaker (daily loss limit)
  - Maximum simultaneous open positions across all symbols
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Dict, Any
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)


@dataclass
class RiskCheckResult:
    """Result returned by a risk validation call."""

    allowed: bool
    reason: str = "approved"


class RiskManager:
    """
    Applies order-level and portfolio-level guardrails before any order is sent.

    Configuration is read from environment variables so it can be tuned
    without rebuilding the container.

    Environment variables (all optional, sensible defaults):
        RISK_MAX_ORDER_QTY            — max shares per order (default 500)
        RISK_MAX_NOTIONAL             — max ₹ value per order (default 500000)
        RISK_MAX_POSITION_QTY         — max shares held per symbol (default 2000)
        RISK_MAX_OPEN_POSITIONS       — max distinct symbols held (default 10)
        RISK_MAX_DAILY_TRADES         — max total orders per day (default 200)
        RISK_MAX_DAILY_LOSS           — circuit-breaker on daily ₹ loss (default 50000)
        RISK_PER_TRADE_INR            — target ₹ risk per trade for dynamic sizing (default 500)
    """

    def __init__(
        self,
        max_order_quantity: int = None,
        max_order_notional: float = None,
        max_position_quantity_per_symbol: int = None,
        max_open_positions: int = None,
        max_daily_trades: int = None,
        max_daily_loss: float = None,
        risk_per_trade: float = None,
    ):
        # 1. Start with defaults (Priority 1: Environment Variables)
        self.max_order_quantity = int(
            max_order_quantity or os.getenv("RISK_MAX_ORDER_QTY", 500)
        )
        self.max_order_notional = float(
            max_order_notional or os.getenv("RISK_MAX_NOTIONAL", 500_000)
        )
        self.max_position_quantity_per_symbol = int(
            max_position_quantity_per_symbol
            or os.getenv("RISK_MAX_POSITION_QTY", 2000)
        )
        self.max_open_positions = int(
            max_open_positions or os.getenv("RISK_MAX_OPEN_POSITIONS", 10)
        )
        self.max_daily_trades = int(
            max_daily_trades or os.getenv("RISK_MAX_DAILY_TRADES", 200)
        )
        self.max_daily_loss = float(
            max_daily_loss or os.getenv("RISK_MAX_DAILY_LOSS", 50_000)
        )
        self.risk_per_trade_inr = float(
            risk_per_trade or os.getenv("RISK_PER_TRADE_INR", 500)
        )
        self.strategy_max_daily_loss = float(
            os.getenv("RISK_STRATEGY_DAILY_LOSS", 10_000)
        )
        self.max_symbol_notional = float(
            os.getenv("RISK_MAX_SYMBOL_NOTIONAL", 200_000)
        )

        # 2. Override with persistent settings from DB (Priority 2: User Settings)
        try:
            self._db = get_trade_logger()
            self._db.execute("""
                CREATE TABLE IF NOT EXISTS risk_audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    changed_at TEXT NOT NULL,
                    changes TEXT NOT NULL
                )
            """)
            persistent = self._db.get_risk_settings()
            if "max_order_quantity" in persistent: self.max_order_quantity = int(persistent["max_order_quantity"])
            if "max_order_notional" in persistent: self.max_order_notional = float(persistent["max_order_notional"])
            if "max_position_qty" in persistent: self.max_position_quantity_per_symbol = int(persistent["max_position_qty"])
            if "max_open_positions" in persistent: self.max_open_positions = int(persistent["max_open_positions"])
            if "max_daily_trades" in persistent: self.max_daily_trades = int(persistent["max_daily_trades"])
            if "max_daily_loss" in persistent: self.max_daily_loss = float(persistent["max_daily_loss"])
            if "risk_per_trade_inr" in persistent: self.risk_per_trade_inr = float(persistent["risk_per_trade_inr"])
            if "strategy_max_daily_loss" in persistent: self.strategy_max_daily_loss = float(persistent["strategy_max_daily_loss"])
            if "max_symbol_notional" in persistent: self.max_symbol_notional = float(persistent["max_symbol_notional"])
        except Exception as e:
            logger.error(f"RiskManager: Could not load persistent settings: {e}")

        # Daily counters — reset automatically when date changes
        self._today: date = date.today()
        self._daily_trades: int = 0
        self._daily_realised_loss: float = 0.0
        self._strategy_daily_realised_loss: Dict[str, float] = {}
        self._daily_charges: float = 0.0
        self._open_symbol_count: int = 0  # updated externally via update_state()
        self._breached_strategies: set = set() # Track strategies that hit kill-switches
        self.global_halt: bool = False # Portfolio-wide emergency freeze

        logger.info(
            "RiskManager initialised — max_qty=%d max_notional=%.0f max_pos_qty=%d "
            "max_positions=%d max_daily_trades=%d max_daily_loss=%.0f strategy_max_loss=%.0f",
            self.max_order_quantity,
            self.max_order_notional,
            self.max_position_quantity_per_symbol,
            self.max_open_positions,
            self.max_daily_trades,
            self.max_daily_loss,
            self.strategy_max_daily_loss
        )

    # ------------------------------------------------------------------
    # State management
    # ------------------------------------------------------------------

    def _maybe_reset_daily(self):
        today = date.today()
        if today != self._today:
            logger.info("RiskManager: new trading day — resetting daily counters.")
            self._today = today
            self._daily_trades = 0
            self._daily_realised_loss = 0.0
            self._strategy_daily_realised_loss = {}
            self._daily_charges = 0.0

    def record_trade(self, strategy_id: str = "default", pnl: float = 0.0, charges: float = 0.0):
        """Call after every filled order to maintain daily counters."""
        self._maybe_reset_daily()
        self._daily_trades += 1
        self._daily_charges += charges
        if pnl < 0:
            loss = abs(pnl)
            self._daily_realised_loss += loss

            # Strategy-level loss tracking
            if strategy_id not in self._strategy_daily_realised_loss:
                self._strategy_daily_realised_loss[strategy_id] = 0.0
            self._strategy_daily_realised_loss[strategy_id] += loss

    def update_open_positions(self, count: int):
        """Sync the number of distinct open position symbols."""
        self._open_symbol_count = count

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def is_mis_allowed(self) -> bool:
        """Check if MIS orders are currently allowed based on Indian market hours."""
        import pytz
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.now(ist)

        # Market opens at 9:15 AM, MIS usually blocked after 3:15 PM
        # We'll be conservative and use 9:00 AM to 3:10 PM
        start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)
        end_time = now.replace(hour=15, minute=10, second=0, microsecond=0)

        # Check if it's a weekday (0-4 are Monday-Friday)
        if now.weekday() > 4:
            return False

        return start_time <= now <= end_time

    def validate_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        price: float,
        current_position: int = 0,
        strategy_id: str = "default",
        product: str = "MIS",
        mode: str = "live"
    ) -> RiskCheckResult:
        """
        Validate an order against all risk rules.
        Returns RiskCheckResult(allowed=True) if the order should proceed.
        """
        self._maybe_reset_daily()

        # Phase 16: Sandbox Bypass
        # In sandbox mode, we relax almost all rules to allow testing at any time.
        is_sandbox = mode.lower() == "sandbox"

        # 0. Global Halt Check (Bypassed by EMERGENCY_PANIC)
        if self.global_halt and strategy_id != "EMERGENCY_PANIC":
            return RiskCheckResult(False, "PORTFOLIO-WIDE GLOBAL HALT ACTIVE. All trading is frozen.")

        # 0.5 Strategy Safeguard Check (Bypassed by EMERGENCY_PANIC or Sandbox)
        if not is_sandbox and strategy_id in self._breached_strategies and strategy_id != "EMERGENCY_PANIC":
            return RiskCheckResult(False, f"strategy '{strategy_id}' is HALTED due to risk breach or manual stop.")

        # 1. Basic sanity
        if quantity <= 0:
            return RiskCheckResult(False, "quantity must be greater than zero")

        if price < 0:
            return RiskCheckResult(False, "price cannot be negative")

        # 2. Per-order quantity cap
        if not is_sandbox and quantity > self.max_order_quantity:
            return RiskCheckResult(
                False,
                f"order qty {quantity} exceeds max_order_quantity {self.max_order_quantity}",
            )

        # 3. Per-order notional cap (skip for MARKET orders where price==0)
        if not is_sandbox and price > 0 and quantity * price > self.max_order_notional:
            return RiskCheckResult(
                False,
                f"order notional ₹{quantity * price:,.0f} exceeds max_order_notional "
                f"₹{self.max_order_notional:,.0f}",
            )

        # 4. Per-symbol position concentration
        projected = (
            current_position + quantity
            if action.upper() == "BUY"
            else max(0, current_position - quantity)
        )
        if not is_sandbox and projected > self.max_position_quantity_per_symbol:
            return RiskCheckResult(
                False,
                f"projected position {projected} for {symbol} exceeds "
                f"max_position_qty {self.max_position_quantity_per_symbol}",
            )

        # 5. Max simultaneous open positions (only block new BUY into a new symbol)
        if not is_sandbox and action.upper() == "BUY" and current_position == 0:
            if self._open_symbol_count >= self.max_open_positions:
                return RiskCheckResult(
                    False,
                    f"open positions ({self._open_symbol_count}) at max "
                    f"({self.max_open_positions}); cannot open new position in {symbol}",
                )

        # 6. Daily trade count
        if not is_sandbox and self._daily_trades >= self.max_daily_trades:
            return RiskCheckResult(
                False,
                f"daily trade limit {self.max_daily_trades} reached",
            )

        # 7. Daily loss circuit-breaker
        if not is_sandbox and self._daily_realised_loss >= self.max_daily_loss:
            return RiskCheckResult(
                False,
                f"daily loss circuit-breaker triggered — loss ₹{self._daily_realised_loss:,.0f} "
                f">= limit ₹{self.max_daily_loss:,.0f}",
            )

        # 7.5 Strategy-specific Daily Loss check
        if not is_sandbox:
            strategy_loss = self._strategy_daily_realised_loss.get(strategy_id, 0.0)
            if strategy_loss >= self.strategy_max_daily_loss:
                return RiskCheckResult(
                    False,
                    f"strategy '{strategy_id}' daily loss limit reached (₹{strategy_loss:,.0f} >= ₹{self.strategy_max_daily_loss:,.0f})"
                )

        # 7.6 Symbol Notional Concentration check
        if not is_sandbox and price > 0:
            new_notional = projected * price
            if new_notional > self.max_symbol_notional:
                return RiskCheckResult(
                    False,
                    f"symbol concentration breach: {symbol} projected notional ₹{new_notional:,.0f} exceeds max ₹{self.max_symbol_notional:,.0f}"
                )

        # 8. MIS Time Check (Bypassed in Sandbox)
        if not is_sandbox and product.upper() == "MIS" and not self.is_mis_allowed():
            return RiskCheckResult(
                False,
                "MIS orders are not allowed outside market hours (09:15 - 15:15 IST). Please use CNC or NRML."
            )

        return RiskCheckResult(True, "approved")

    def get_status(self) -> Dict:
        """Return a snapshot of current risk counters for dashboard/API use."""
        self._maybe_reset_daily()
        return {
            "daily_trades": self._daily_trades,
            "max_daily_trades": self.max_daily_trades,
            "daily_realised_loss": round(self._daily_realised_loss, 2),
            "max_daily_loss": self.max_daily_loss,
            "open_positions": self._open_symbol_count,
            "max_open_positions": self.max_open_positions,
            "max_order_quantity": self.max_order_quantity,
            "max_order_notional": self.max_order_notional,
            "max_position_qty": self.max_position_quantity_per_symbol,
            "global_halt": self.global_halt,
            "strategy_max_loss": self.strategy_max_daily_loss,
            "max_symbol_notional": self.max_symbol_notional,
            "daily_loss_pct": (
                round(self._daily_realised_loss / self.max_daily_loss * 100, 1)
                if self.max_daily_loss
                else 0
            ),
            "daily_charges": round(self._daily_charges, 2),
        }

    def update_limits(self, updates: Dict[str, Any]):
        """Update risk limits, persist to database, and write audit log entry."""
        try:
            old_snapshot = {
                "max_order_quantity": self.max_order_quantity,
                "max_order_notional": self.max_order_notional,
                "max_position_qty": self.max_position_quantity_per_symbol,
                "max_open_positions": self.max_open_positions,
                "max_daily_trades": self.max_daily_trades,
                "max_daily_loss": self.max_daily_loss,
            }

            db = get_trade_logger()
            if "max_order_quantity" in updates:
                self.max_order_quantity = int(updates["max_order_quantity"])
                db.update_risk_setting("max_order_quantity", self.max_order_quantity)

            if "max_order_notional" in updates:
                self.max_order_notional = float(updates["max_order_notional"])
                db.update_risk_setting("max_order_notional", self.max_order_notional)

            if "max_position_qty" in updates:
                self.max_position_quantity_per_symbol = int(updates["max_position_qty"])
                db.update_risk_setting("max_position_qty", self.max_position_quantity_per_symbol)

            if "max_open_positions" in updates:
                self.max_open_positions = int(updates["max_open_positions"])
                db.update_risk_setting("max_open_positions", self.max_open_positions)

            if "max_daily_trades" in updates:
                self.max_daily_trades = int(updates["max_daily_trades"])
                db.update_risk_setting("max_daily_trades", self.max_daily_trades)

            if "max_daily_loss" in updates:
                self.max_daily_loss = float(updates["max_daily_loss"])
                db.update_risk_setting("max_daily_loss", self.max_daily_loss)

            self._log_risk_change(old_snapshot, updates)
            logger.info(f"RiskManager: Updated limits - {updates}")
        except Exception as e:
            logger.error(f"RiskManager: Error updating limits: {e}")
            raise e

    def _log_risk_change(self, old: Dict[str, Any], new: Dict[str, Any]):
        """Persist a risk limit change record to the audit log table."""
        try:
            changes = {k: {"from": old.get(k), "to": v} for k, v in new.items() if str(old.get(k)) != str(v)}
            if not changes:
                return
            self._db.execute(
                "INSERT INTO risk_audit_log (changed_at, changes) VALUES (?, ?)",
                [datetime.utcnow().isoformat(), json.dumps(changes)]
            )
        except Exception as e:
            logger.warning(f"Risk audit log write failed: {e}")

    def is_circuit_broken(self) -> bool:
        """
        Detect if any portfolio-wide risk limit has been breached.
        """
        self._maybe_reset_daily()

        # 1. Daily Realised Loss Limit
        if self._daily_realised_loss >= self.max_daily_loss:
            logger.critical("Portfolio circuit breaker: Daily loss limit breached!")
            return True

        # 2. Daily Trade Count Limit
        if self._daily_trades >= self.max_daily_trades:
            logger.warning("Portfolio circuit breaker: Daily trade limit reached.")
            return True

        return False

    def check_strategy_safeguards(self, strategy_id: str) -> Dict[str, Any]:
        """
        Proactively check if a strategy has breached its institutional safeguards.
        If breached, it adds the strategy to _breached_strategies.
        """
        try:
            safeguards = self._db.get_strategy_safeguards(strategy_id)
            if not safeguards or not safeguards.get("is_armed"):
                return {"status": "safe", "reason": "not_armed"}

            metrics = self._db.get_strategy_metrics(strategy_id)

            # Breach 1: Max Drawdown
            max_dd_limit = safeguards.get("max_drawdown_pct", 15.0)
            current_dd = metrics.get("max_drawdown", 0.0)

            if current_dd >= max_dd_limit:
                self._breached_strategies.add(strategy_id)
                self._db.update_strategy_safeguard(strategy_id, {"last_breach_at": datetime.utcnow().isoformat()})
                logger.critical(f"Strategy {strategy_id} BREACHED Safeguard: Max Drawdown ({current_dd:.2f}%) hit the limit ({max_dd_limit:.2f}%)")
                return {"status": "breached", "reason": f"Max Drawdown ({current_dd:.2f}%) hit/exceeded the {max_dd_limit:.2f}% limit"}

            # Breach 2: Net Loss INR
            max_loss_limit = safeguards.get("max_loss_inr", 0.0)
            net_pnl = metrics.get("net_pnl", 0.0)

            if max_loss_limit > 0 and net_pnl <= -max_loss_limit:
                self._breached_strategies.add(strategy_id)
                self._db.update_strategy_safeguard(strategy_id, {"last_breach_at": datetime.utcnow().isoformat()})
                logger.critical(f"Strategy {strategy_id} BREACHED Safeguard: Net Loss (₹{abs(net_pnl):,.2f}) hit the limit (₹{max_loss_limit:,.2f})")
                return {"status": "breached", "reason": f"Net Loss (₹{abs(net_pnl):,.2f}) has reached/exceeded the ₹{max_loss_limit:,.2f} safeguard limit"}

            return {"status": "safe", "metrics": metrics}
        except Exception as e:
            logger.error(f"Error checking safeguards for {strategy_id}: {e}")
            return {"status": "error", "reason": "Internal error"}

    def halt_strategy(self, strategy_id: str):
        """Manually halt a strategy by adding it to the breach list."""
        self._breached_strategies.add(strategy_id)

    def resume_strategy(self, strategy_id: str):
        """Clear a manual or automated breach to allow trading again."""
        if strategy_id in self._breached_strategies:
            self._breached_strategies.remove(strategy_id)
            logger.info(f"Strategy {strategy_id} risk breach cleared. Trading resumed.")
