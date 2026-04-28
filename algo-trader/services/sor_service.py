import logging
import asyncio
from typing import List, Dict, Any, Optional
from execution.broker_adapter import BrokerAdapter

logger = logging.getLogger(__name__)

class SmartOrderRouter:
    """
    Institutional Smart Order Router (SOR).
    Automatically routes orders to the broker providing the best execution quality,
    lowest latency, or specific fee optimizations.
    """

    def __init__(self, adapters: Dict[str, BrokerAdapter]):
        self.adapters = adapters
        self.preferred_broker = None

    def set_preferred_broker(self, broker_id: str):
        if broker_id in self.adapters:
            self.preferred_broker = broker_id

    async def get_best_execution_broker(self, symbol: str, action: str, quantity: int) -> str:
        """
        Logic to determine the best broker for a given trade.
        In Phase 3, this focuses on availability and user preference.
        In Phase 4, this will include real-time spread comparison.
        """
        connected_brokers = [bid for bid, adapter in self.adapters.items() if adapter.is_connected]

        if not connected_brokers:
            raise Exception("No brokers connected for execution")

        # 1. If preferred broker is connected, use it
        if self.preferred_broker in connected_brokers:
            return self.preferred_broker

        # 2. Simple Round Robin or Latency-based routing (placeholder)
        # For now, return the first connected broker
        return connected_brokers[0]

    async def route_and_execute(self, order_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Determines the best broker and executes the order.
        """
        symbol = order_params.get("symbol")
        action = order_params.get("action")
        quantity = order_params.get("quantity")

        try:
            broker_id = await self.get_best_execution_broker(symbol, action, quantity)
            adapter = self.adapters.get(broker_id)

            logger.info(f"SOR routing {symbol} {action} order to {broker_id}")

            result = await adapter.place_order(**order_params)
            return {
                "status": "success",
                "routed_to": broker_id,
                "execution_result": result
            }
        except Exception as e:
            logger.error(f"SOR execution failed: {e}")
            return {"status": "error", "message": str(e)}

# Note: This service is typically initialized by the OrderManager
# with all available broker adapters.
