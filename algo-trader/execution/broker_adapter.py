import abc
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class BrokerAdapter(abc.ABC):
    """
    Abstract base class for all broker integrations.
    Ensures a unified interface for the OrderManager regardless of the underlying broker.
    """

    def __init__(self, broker_name: str, config: Dict[str, Any]):
        self.broker_name = broker_name
        self.config = config
        self.is_connected = False

    @abc.abstractmethod
    async def connect(self) -> bool:
        """Establishes connection/session with the broker."""
        pass

    @abc.abstractmethod
    async def place_order(
        self,
        symbol: str,
        action: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        strategy: str = "General",
        **kwargs
    ) -> Dict[str, Any]:
        """Places an order with the broker."""
        pass

    @abc.abstractmethod
    async def modify_order(self, order_id: str, **kwargs) -> Dict[str, Any]:
        """Modifies an existing order."""
        pass

    @abc.abstractmethod
    async def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """Cancels an existing order."""
        pass

    @abc.abstractmethod
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Retrieves current status of an order."""
        pass

    @abc.abstractmethod
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Retrieves current open positions."""
        pass

    @abc.abstractmethod
    async def get_holdings(self) -> List[Dict[str, Any]]:
        """Retrieves current investment holdings."""
        pass

    @abc.abstractmethod
    async def get_funds(self) -> Dict[str, Any]:
        """Retrieves available funds/margin."""
        pass

    def _format_standard_response(self, status: str, order_id: Optional[str] = None, message: str = "", raw: Any = None) -> Dict[str, Any]:
        """Utility to format a consistent response across all adapters."""
        return {
            "status": status,
            "order_id": order_id,
            "message": message,
            "broker": self.broker_name,
            "timestamp": datetime.now().isoformat(),
            "raw": raw
        }
