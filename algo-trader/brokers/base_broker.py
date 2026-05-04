import abc
import logging
from typing import List, Dict, Any, Optional
from .models import NormalizedOrder, NormalizedPosition, OrderAction, OrderType, ProductType

logger = logging.getLogger(__name__)

class BaseBroker(abc.ABC):
    """
    Abstract Base Class for AetherBridge Native Broker Adapters.
    Ensures zero-latency native connectivity with normalized data models.
    """

    def __init__(self, broker_id: str, config: Dict[str, Any]):
        self.broker_id = broker_id
        self.config = config
        self.is_connected = False

    @abc.abstractmethod
    async def login(self) -> bool:
        """Authenticates with the broker API."""
        pass

    @abc.abstractmethod
    async def logout(self) -> bool:
        """Terminates the broker session."""
        pass

    @abc.abstractmethod
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
        """Places an order and returns a normalized response."""
        pass

    @abc.abstractmethod
    async def cancel_order(self, broker_order_id: str) -> bool:
        """Cancels an existing order."""
        pass

    @abc.abstractmethod
    async def get_orders(self) -> List[NormalizedOrder]:
        """Retrieves current order book."""
        pass

    @abc.abstractmethod
    async def get_positions(self) -> List[NormalizedPosition]:
        """Retrieves currently open positions."""
        pass

    @abc.abstractmethod
    async def get_margins(self) -> Dict[str, float]:
        """Retrieves available funds and margin utilization."""
        pass

    @abc.abstractmethod
    async def subscribe_ticks(self, symbols: List[str]):
        """Subscribes to real-time market data ticks."""
        pass

    @abc.abstractmethod
    async def get_quote(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """Fetches a real-time quote for a single symbol."""
        pass

    async def get_multi_quotes(self, symbols: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Fetches real-time quotes for multiple symbols.
        Default implementation uses concurrent get_quote calls.
        """
        import asyncio
        tasks = []
        for item in symbols:
            if isinstance(item, dict):
                sym = item.get("symbol")
                exch = item.get("exchange", "NSE")
            else:
                sym = item
                exch = "NSE"

            if sym:
                tasks.append(self.get_quote(sym, exch))

        if not tasks:
            return {}

        quotes = await asyncio.gather(*tasks, return_exceptions=True)
        results = {}
        for i, q in enumerate(quotes):
            if isinstance(q, dict) and q:
                symbol = symbols[i].get("symbol")
                if symbol:
                    results[symbol] = q
        return results

    def register_tick_callback(self, callback: Any):
        """Registers a callback for incoming market data ticks."""
        self.tick_callback = callback

    def _format_error(self, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Utility for standardized error logging."""
        error_info = {"broker": self.broker_id, "message": message}
        if context:
            error_info.update(context)
        logger.error("Broker Error: %s | %s", message, context)
        return error_info
