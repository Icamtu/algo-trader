from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List

from strategies.intraday_strategy import generate_signal as intraday_signal
from strategies.longterm_strategy import generate_signal as longterm_signal
from strategies.swing_strategy import generate_signal as swing_signal


SignalGenerator = Callable[[Dict[str, Any]], str]


@dataclass
class StrategySignal:
    """Normalized signal payload shared across the app."""

    strategy_name: str
    symbol: str
    signal: str
    price: float
    meta: Dict[str, Any] = field(default_factory=dict)


class SignalEngine:
    """
    Routes market data to strategy-specific signal generators and can combine
    multiple signals into one final decision.
    """

    def __init__(self):
        self._strategies: Dict[str, SignalGenerator] = {
            "intraday": intraday_signal,
            "swing": swing_signal,
            "longterm": longterm_signal,
        }

    def get_signal(self, strategy_type: str, data: Dict[str, Any]) -> StrategySignal:
        """Run one signal model and return a normalized result."""
        normalized_type = strategy_type.strip().lower()
        if normalized_type not in self._strategies:
            raise ValueError(f"Unsupported strategy type: {strategy_type}")

        signal = self._strategies[normalized_type](data)
        return StrategySignal(
            strategy_name=normalized_type,
            symbol=data.get("symbol", "UNKNOWN"),
            signal=signal,
            price=float(data.get("ltp", 0.0)),
            meta=data,
        )

    def aggregate(self, signals: Iterable[StrategySignal]) -> str:
        """
        Combine multiple strategy outputs using a simple majority vote.

        If there is no clear majority, stay conservative and return HOLD.
        """
        counts = {"BUY": 0, "SELL": 0, "HOLD": 0}
        for item in signals:
            signal = item.signal.upper()
            counts[signal] = counts.get(signal, 0) + 1

        if counts["BUY"] > counts["SELL"] and counts["BUY"] > counts["HOLD"]:
            return "BUY"
        if counts["SELL"] > counts["BUY"] and counts["SELL"] > counts["HOLD"]:
            return "SELL"
        return "HOLD"


def get_signal(data: Dict[str, Any], strategy_type: str = "intraday") -> str:
    """
    Backward-compatible helper for older code that expects just a string.
    """
    return SignalEngine().get_signal(strategy_type=strategy_type, data=data).signal
