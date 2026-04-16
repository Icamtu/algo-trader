import logging
import asyncio
from typing import Dict, List, Optional
from database.trade_logger import get_trade_logger
from execution.signal_store import get_signal_store

logger = logging.getLogger(__name__)

class ActionManager:
    """
    Manages the Semi-Auto gateway (Action Center).
    Allows queuing orders for human approval before broker execution.
    """

    def __init__(self, telemetry_callback=None):
        self.sqlite = get_trade_logger()
        self.store = get_signal_store()
        self.order_manager = None
        self.telemetry_callback = telemetry_callback

    def set_order_manager(self, order_manager):
        self.order_manager = order_manager

    def get_action_queue(self, status='pending', limit=100) -> list:
        """Proxies store call to fetch queued orders by status."""
        self.cleanup_old_signals()
        if status == 'pending':
            return self.store.get_pending()
        return self.sqlite.get_action_queue(status=status, limit=limit)

    def cleanup_old_signals(self, expiry_minutes: int = 30):
        """Removes pending signals that have expired without approval."""
        try:
            pending = self.store.get_pending()
            from datetime import datetime, timedelta
            now = datetime.utcnow()

            expired_ids = []
            for order in pending:
                ts_str = order.get('timestamp')
                if not ts_str: continue

                try:
                    ts = datetime.fromisoformat(ts_str)
                    if now - ts > timedelta(minutes=expiry_minutes):
                        expired_ids.append(order['id'])
                except ValueError:
                    continue

            for oid in expired_ids:
                logger.info(f"Signal {oid} expired after {expiry_minutes}m. Auto-rejecting.")
                self.reject_order(oid, reason=f"Signal Expired ({expiry_minutes}m)")

        except Exception as e:
            logger.error(f"Signal cleanup error: {e}")

    def queue_for_approval(self, order_data: dict) -> Optional[int]:
        """Queues an order for human approval and broadcasts via telemetry."""
        from datetime import datetime
        if 'timestamp' not in order_data:
            order_data['timestamp'] = datetime.utcnow().isoformat()

        order_id = self.store.save_signal(order_data)
        if order_id and self.telemetry_callback:
            # Broadcast the new signal event
            asyncio.create_task(self.telemetry_callback("hitl_signal", {
                "id": order_id,
                **order_data
            }))
        return order_id

    def get_pending_queue(self) -> list:
        """Returns all orders awaiting approval from the cache store."""
        return self.store.get_pending()

    def get_audit_log(self, status: str = 'approved') -> list:
        """Returns history of approved or rejected orders from SQLite."""
        return self.get_action_queue(status=status)

    def get_statistics(self) -> dict:
        """Returns stats for the Action Center UI."""
        return self.sqlite.get_action_center_stats()

    async def approve_order(self, order_id: int) -> bool:
        """
        Approves a queued order and routes it to the OrderManager for execution.
        """
        queue = self.store.get_pending()
        order = next((o for o in queue if o['id'] == order_id), None)

        if not order:
            logger.error(f"Approval failed: Order ID {order_id} not found in pending queue")
            return False

        logger.info(f"Human Approval Received: ID {order_id} | {order['symbol']} {order['action']}")

        # Mark as approved in SignalStore (Updates both SQL and Redis)
        self.store.resolve_signal(order_id, 'approved')

        # Broadcast approval event
        if self.telemetry_callback:
            asyncio.create_task(self.telemetry_callback("hitl_update", {
                "id": order_id,
                "status": "approved",
                "symbol": order['symbol']
            }))

        # Route to OrderManager
        try:
            # Reconstruct the order payload
            # Note: order['raw_order_data'] is a JSON string in SQLite, but we'll handle it
            if isinstance(order.get('raw_order_data'), str):
                import json
                payload = json.loads(order['raw_order_data'])
            else:
                payload = order.get('raw_order_data', {})

            strategy = f"{order.get('strategy', 'Manual')}-Approved"

            result = await self.order_manager.place_order(
                strategy_name=strategy,
                symbol=order["symbol"],
                action=order["action"],
                quantity=int(order.get('quantity', 0)),
                order_type=order.get('price_type', 'MARKET'),
                price=float(order.get('price', 0.0)) if order.get('price') else 0.0,
                product=order.get('product_type', 'MIS'),
                exchange=order.get('exchange', 'NSE'),
                ai_reasoning=order.get('ai_reasoning'),
                conviction=order.get('conviction'),
                human_approval=False # Critical: bypass hitl check for approved orders
            )
            if result.get("status") == "success":
                logger.info(f"Approved order routed successfully: {order_id}")
                return True
            else:
                logger.error(f"Execution failed for approved order {order_id}: {result.get('message')}")
                return False
        except Exception as e:
            logger.error(f"Error executing approved order {order_id}: {e}", exc_info=True)
            return False

    async def approve_all_pending(self) -> int:
        """Approves all pending orders in the queue."""
        pending = self.get_pending_queue()
        count = 0
        for order in pending:
            if await self.approve_order(order['id']):
                count += 1
        return count

    async def approve_selected(self, order_ids: List[int]) -> Dict[str, int]:
        """Approves a specific list of order IDs in parallel."""
        tasks = [self.approve_order(oid) for oid in order_ids]
        results = await asyncio.gather(*tasks)
        success_count = sum(1 for r in results if r)
        return {"total": len(order_ids), "success": success_count, "failed": len(order_ids) - success_count}

    def reject_order(self, order_id: int, reason: Optional[str] = None) -> bool:
        """Rejects a queued order and broadcasts rejection."""
        logger.info(f"Human Rejection Received: ID {order_id} | Reason: {reason or 'No reason provided'}")
        success = self.store.resolve_signal(order_id, 'rejected', reason=reason)

        if success and self.telemetry_callback:
            asyncio.create_task(self.telemetry_callback("hitl_update", {
                "id": order_id,
                "status": "rejected",
                "reason": reason
            }))
        return success

    def reject_selected(self, order_ids: List[int], reason: Optional[str] = None) -> Dict[str, int]:
        """Rejects a specific list of order IDs."""
        success_count = 0
        for oid in order_ids:
            if self.reject_order(oid, reason=reason):
                success_count += 1
        return {"total": len(order_ids), "success": success_count, "failed": len(order_ids) - success_count}

    def delete_order(self, order_id: int) -> bool:
        """Deletes an order from the audit log."""
        return self.sqlite.delete_action_order(order_id)

# Global singleton
_action_manager: Optional[ActionManager] = None

def get_action_manager(telemetry_callback=None) -> ActionManager:
    global _action_manager
    if _action_manager is None:
        _action_manager = ActionManager(telemetry_callback=telemetry_callback)
    elif telemetry_callback:
        _action_manager.telemetry_callback = telemetry_callback
    return _action_manager
