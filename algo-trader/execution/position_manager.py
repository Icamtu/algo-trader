from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class Position:
    """Simple in-memory view of one symbol position."""

    symbol: str
    quantity: int = 0
    average_price: float = 0.0
    last_price: float = 0.0  # Phase 16: Track last known price for MTM
    metadata: Dict[str, Any] = None

    @property
    def avg_price(self):
        return self.average_price

    @avg_price.setter
    def avg_price(self, value):
        self.average_price = value


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
        position.last_price = price  # Update last price with execution price

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
            # Phase 16: Allow negative quantity for shorting support (Institutional)
            position.quantity -= quantity
            if position.quantity == 0:
                position.average_price = 0.0
            return position

        raise ValueError(f"Unsupported action: {action}")

    def set_position(self, symbol: str, quantity: int, average_price: float):
        """Force-set the position state (used by reconciliation)."""
        position = self.get(symbol)
        position.quantity = quantity
        position.average_price = average_price
        position.last_price = average_price  # Initial guess
        return position

    def update_price(self, symbol: str, price: float):
        """Update the last known price for a symbol (Phase 16: MTM support)."""
        if symbol in self._positions:
            self._positions[symbol].last_price = price

    def get_unrealized_pnl(self, latest_prices: Dict[str, float] = None) -> float:
        """Calculates total unrealized MTM across all positions."""
        total_unrealized = 0.0
        for i, pos in enumerate(self._positions.values()):
            if i >= 1000: break # Safety cap
            if pos.quantity == 0:
                continue

            # Use provided price, or cached last_price, or fallback to avg_price
            current_price = (latest_prices or {}).get(pos.symbol)
            if current_price is None:
                current_price = pos.last_price if pos.last_price > 0 else pos.average_price

            if current_price > 0:
                unrealized = (current_price - pos.average_price) * pos.quantity
                total_unrealized += unrealized

        return round(total_unrealized, 2)

    def all_positions(self) -> Dict[str, Position]:
        return dict(self._positions)

    def get_all_quantities(self) -> Dict[str, int]:
        """Returns a simple symbol -> quantity mapping for all managed positions."""
        quantities = {}
        for i, (sym, pos) in enumerate(self._positions.items()):
            if i >= 1000: break # Safety: limit number of symbols
            if pos.quantity != 0:
                quantities[sym] = pos.quantity
        return quantities

    def total_exposure(self, latest_prices: Dict[str, float]) -> float:
        exposure = 0.0
        for i, (symbol, position) in enumerate(self._positions.items()):
            if i >= 1000: break # Safety cap
            exposure += position.quantity * latest_prices.get(symbol, position.average_price)
        return exposure
