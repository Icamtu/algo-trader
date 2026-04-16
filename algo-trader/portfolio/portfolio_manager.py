from dataclasses import dataclass
from typing import Optional


@dataclass
class PositionSizePlan:
    """Represents a suggested trade size."""

    symbol: str
    quantity: int
    price: float
    capital_to_use: float


class PortfolioManager:
    """
    Basic position sizing helper.

    It answers one question: given account size, risk preference, and price,
    how many units should this trade use?
    """

    def __init__(self, account_capital: float = 100000.0, max_capital_per_trade_pct: float = 10.0):
        self.account_capital = float(account_capital)
        self.max_capital_per_trade_pct = float(max_capital_per_trade_pct)

    def capital_per_trade(self) -> float:
        return self.account_capital * (self.max_capital_per_trade_pct / 100)

    def calculate_quantity(
        self,
        symbol: str,
        price: float,
        risk_budget: Optional[float] = None,
    ) -> PositionSizePlan:
        """
        Create a basic quantity plan from current account settings.
        """
        if price <= 0:
            raise ValueError("Price must be greater than zero")

        capital_to_use = risk_budget if risk_budget is not None else self.capital_per_trade()
        quantity = max(1, int(capital_to_use // price))

        return PositionSizePlan(
            symbol=symbol,
            quantity=quantity,
            price=price,
            capital_to_use=capital_to_use,
        )

    def calculate_risk_weighted_quantity(
        self,
        symbol: str,
        price: float,
        stop_loss_dist: float,
        risk_amount: float = 500.0,
    ) -> PositionSizePlan:
        """
        Calculates quantity based on Risk-per-Trade model.
        Qty = Risk_Amount / Stop_Loss_Distance
        """
        if price <= 0:
            raise ValueError("Price must be greater than zero")
        if stop_loss_dist <= 0:
            # Fallback to 2% of price if SL dist is zero/invalid
            stop_loss_dist = price * 0.02

        # 1. Theoretical Risk-Based Quantity
        raw_qty = risk_amount / stop_loss_dist

        # 2. Capital Constraint (Max Notional allowed for this trade)
        max_notional = self.capital_per_trade()
        max_qty_by_capital = max_notional / price

        # Final Quantity is the lesser of the two
        quantity = max(1, int(min(raw_qty, max_qty_by_capital)))
        capital_to_use = quantity * price

        return PositionSizePlan(
            symbol=symbol,
            quantity=quantity,
            price=price,
            capital_to_use=capital_to_use,
        )
