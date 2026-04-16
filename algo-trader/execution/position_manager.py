from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class Position:
    """Simple in-memory view of one symbol position."""

    symbol: str
    quantity: int = 0
    average_price: float = 0.0
    metadata: Dict[str, Any] = None


class PositionManager:
    """
    Tracks open positions locally.

    This is a basic in-memory manager that is useful for paper trading,
    simulation, and strategy-side sanity checks.
    """

    def __init__(self):
        self._positions: Dict[str, Position] = {}

    def get(self, symbol: str) -> Position:
        if symbol not in self._positions:
            self._positions[symbol] = Position(symbol=symbol, metadata={})
        return self._positions[symbol]

    def get_quantity(self, symbol: str) -> int:
        return self.get(symbol).quantity

    def update(self, symbol: str, action: str, quantity: int, price: float) -> Position:
        """
        Apply a filled order to the local position state.
        """
        position = self.get(symbol)
        action = action.upper()

        if action == "BUY":
            new_total_qty = position.quantity + quantity
            if new_total_qty <= 0:
                position.quantity = 0
                position.average_price = 0.0
                return position

            total_cost = (position.average_price * position.quantity) + (price * quantity)
            position.quantity = new_total_qty
            position.average_price = total_cost / new_total_qty
            return position

        if action == "SELL":
            position.quantity = max(0, position.quantity - quantity)
            if position.quantity == 0:
                position.average_price = 0.0
            return position

        raise ValueError(f"Unsupported action: {action}")

    def all_positions(self) -> Dict[str, Position]:
        return dict(self._positions)

    def total_exposure(self, latest_prices: Dict[str, float]) -> float:
        exposure = 0.0
        for symbol, position in self._positions.items():
            exposure += position.quantity * latest_prices.get(symbol, position.average_price)
        return exposure
