import logging
import asyncio
import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from database.trade_logger import get_trade_logger
from execution.signal_store import get_signal_store
from utils.latency_tracker import latency_tracker

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
        self.loop = None
        self.auto_execute = False # Phase 13: Allow toggling auto-route vs hitl
        self.risk_lock = False    # Phase 13: System-wide execution lock
        self.last_audit_ts = datetime.utcnow().isoformat()
        try:
            self.loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

    def set_order_manager(self, order_manager):
        self.order_manager = order_manager

    def set_auto_execute(self, enabled: bool):
        self.auto_execute = enabled
        logger.info(f"AUDIT_PROTOCOL: Auto-Execution {'ENABLED' if enabled else 'DISABLED'}")

    def set_risk_lock(self, locked: bool):
        self.risk_lock = locked
        logger.info(f"AUDIT_PROTOCOL: System-wide Risk Lock {'ARMED' if locked else 'DISARMED'}")

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

        # Risk Lock Check - Institutional Override
        if self.risk_lock:
            logger.warning(f"INSTITUTIONAL_LOCK_ACTIVE: Rejecting order for {order_data.get('symbol')}")
            order_data['status'] = 'rejected'
            order_data['reason'] = 'System-wide Risk Lock'
            self.sqlite.save_signal(order_data)
            return None

        order_id = self.store.save_signal(order_data)
        if not order_id:
            return None

        # Telemetry Broadcast
        if self.telemetry_callback:
            payload = {"id": order_id, **order_data}
            if self.loop and self.loop.is_running():
                self.loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(self.telemetry_callback("hitl_signal", payload))
                )

        # Auto-Execution Mode
        if self.auto_execute:
            logger.info(f"AUTO_EXECUTE_ACTIVE: Auto-approving signal {order_id}")
            if self.loop and self.loop.is_running():
                self.loop.call_soon_threadsafe(
                    lambda: asyncio.create_task(self.approve_order(order_id))
                )
            else:
                asyncio.run(self.approve_order(order_id))

        return order_id

    def get_pending_queue(self) -> list:
        """Retrieves and cleans the pending signal queue."""
        self.cleanup_old_signals()
        return self.store.get_pending()

    def get_audit_log(self, status: str = 'approved') -> list:
        """Returns history of approved or rejected orders from SQLite."""
        return self.get_action_queue(status=status)

    def get_statistics(self) -> dict:
        """Returns deep stats including audit integrity and system health."""
        stats = self.sqlite.get_action_center_stats()

        # Institutional Integrity Check
        redis_healthy = self.store.redis_active
        pending_redis = self.store.get_pending()
        pending_sqlite = self.sqlite.get_action_queue(status='pending')

        # Calculate Integrity Score
        # (Redis should ideally match SQLite for all pending items)
        integrity_score = 100.0
        if redis_healthy:
            redis_ids = {str(o.get('id')) for o in pending_redis}
            sqlite_ids = {str(o.get('id')) for o in pending_sqlite}

            if sqlite_ids:
                matches = redis_ids.intersection(sqlite_ids)
                integrity_score = (len(matches) / len(sqlite_ids)) * 100.0
        else:
            integrity_score = 0.0 # Critical fallback: Redis disconnected

        stats["audit"] = {
            "integrity": round(integrity_score, 1),
            "redis_status": "Connected" if redis_healthy else "Disconnected",
            "persistence_mode": "Hybrid (L1:Redis/L2:SQLite)",
            "audit_protocol": "Aether-HITL-v2",
            "latency_ms": round(latency_tracker.get_avg_latency("ActionApproval") or 2, 2),
            "engine_latency_ms": round(latency_tracker.get_avg_latency("OrderExecution") or 5, 2),
            "last_audit_ts": datetime.utcnow().isoformat(),
            "auto_execute": self.auto_execute,
            "risk_lock": self.risk_lock
        }

        return stats


    async def approve_order(self, order_id: Any) -> bool:
        """
        Approves a queued order and routes it to the OrderManager for execution.
        """
        try:
            order_id = int(order_id)
        except (ValueError, TypeError):
            logger.error(f"Approval failed: Invalid order ID format: {order_id}")
            return False

        start_time = time.perf_counter()
        queue = self.store.get_pending()
        order = next((o for o in queue if o['id'] == order_id), None)

        if not order:
            logger.error(f"Approval failed: Order ID {order_id} not found in pending queue")
            return False

        logger.info(f"Human Approval Received: ID {order_id} | {order['symbol']} {order['action']}")

        # Route to OrderManager or Handle Action
        try:
            # Measure routing and execution latency
            latency_tracker._record("ActionApproval", (time.perf_counter() - start_time) * 1000)

            # Reconstruct the payload
            if isinstance(order.get('raw_order_data'), str):
                import json
                payload = json.loads(order['raw_order_data'])
            else:
                payload = order.get('raw_order_data', {})

            # Check for special action types
            action_type = order.get('action_type', 'ORDER')

            success = False
            error_msg = None

            if action_type == 'DEPLOY_STRATEGY':
                success = await self._handle_strategy_deployment(order, payload)
            else:
                # Default: Order Execution
                # Robust strategy extraction
                base_strategy = order.get('strategy') or payload.get('strategy') or \
                                payload.get('strategy_name') or order.get('strategy_name') or 'Manual'
                strategy = f"{base_strategy}-Approved"

                # Price Normalization (Phase 16: Ensure Pricing Integrity)
                order_type = order.get('price_type', 'MARKET')
                price = float(order.get('price', 0.0)) if order.get('price') else 0.0

                # Fetch fresh LTP for Market orders to ensure logs/risk are accurate
                if order_type == 'MARKET' and price == 0.0:
                    try:
                        quote = await self.order_manager.get_quote(order["symbol"])
                        if quote and isinstance(quote, dict):
                            # Handle different response formats from broker
                            price = float(quote.get("last_price") or quote.get("lp") or price)
                            logger.info(f"Updated MARKET order price with fresh LTP: {price}")
                    except Exception as qe:
                        logger.warning(f"LTP_FETCH_FAULT for {order['symbol']}: {qe}")

                result = await self.order_manager.place_order(
                    strategy_name=strategy,
                    symbol=order["symbol"],
                    action=order["action"],
                    quantity=int(order.get('quantity', 0)),
                    order_type=order_type,
                    price=price,
                    product=order.get('product_type', 'MIS'),
                    exchange=order.get('exchange', 'NSE'),
                    ai_reasoning=order.get('ai_reasoning'),
                    conviction=order.get('conviction'),
                    human_approval=False # Critical: bypass hitl check for approved orders
                )
                if result.get("status") == "success":
                    success = True
                    logger.info(f"Approved order routed successfully: {order_id} (Strategy: {strategy})")
                else:
                    success = False
                    error_msg = result.get('message', 'Broker rejection')
                    logger.error(f"Execution failed for approved order {order_id}: {error_msg}")

            if success:
                # Mark as approved in SignalStore only if execution succeeded
                self.store.resolve_signal(order_id, 'approved')

                # Broadcast approval event
                if self.telemetry_callback:
                    asyncio.create_task(self.telemetry_callback("hitl_update", {
                        "id": order_id,
                        "status": "approved",
                        "symbol": order['symbol']
                    }))
                return True
            else:
                # MARK AS FAILED - Keep in pending or move to failed state
                # For now, we move to 'failed' so it doesn't stay in the 'pending' list in Redis
                # but stays in SQL audit log as failed.
                self.store.resolve_signal(order_id, 'failed', reason=error_msg)

                if self.telemetry_callback:
                    asyncio.create_task(self.telemetry_callback("hitl_update", {
                        "id": order_id,
                        "status": "failed",
                        "reason": error_msg,
                        "symbol": order['symbol']
                    }))
                return False

        except Exception as e:
            logger.error(f"Error executing approved order {order_id}: {e}", exc_info=True)
            # Revert state or mark as critical error
            self.store.resolve_signal(order_id, 'exec_error', reason=str(e))
            return False

    async def _handle_strategy_deployment(self, order: dict, payload: dict) -> bool:
        """Handles the actual file writing for a strategy deployment action."""
        try:
            filename = payload.get("filename")
            code = payload.get("code")

            if not filename or not code:
                logger.error(f"Deployment action failed: Missing filename or code in payload")
                return False

            strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'strategies'))
            file_path = os.path.join(strat_dir, filename)

            # Security check
            if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
                logger.error(f"Forbidden deployment path: {file_path}")
                return False

            with open(file_path, "w") as f:
                f.write(code)

            logger.info(f"Strategy deployed successfully via HITL Approval: {filename}")
            return True
        except Exception as e:
            logger.error(f"Strategy deployment fault: {e}")
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

    def reject_order(self, order_id: Any, reason: Optional[str] = None) -> bool:
        """Rejects a queued order and broadcasts rejection."""
        try:
            order_id = int(order_id)
        except (ValueError, TypeError):
            logger.error(f"Rejection failed: Invalid order ID format: {order_id}")
            return False

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

    def retry_order(self, order_id: int) -> Optional[int]:
        """
        Retries a failed or rejected order by re-queuing it for approval.
        Creates a new audit record to maintain a clean history.
        """
        order = self.sqlite.get_action_order(order_id)
        if not order:
            logger.error(f"Retry failed: Order ID {order_id} not found in database")
            return None

        # Get the original order data
        payload = order.get('raw_order_data')
        if not payload:
            logger.error(f"Retry failed: No payload found for order {order_id}")
            return None

        logger.info(f"Retrying Order {order_id}: {order['symbol']} {order['action']}")

        # Add a note that it's a retry
        if isinstance(payload, dict):
            payload['is_retry'] = True
            payload['retry_from'] = order_id

        # Re-queue for approval
        new_id = self.queue_for_approval(payload)
        return new_id

# Global singleton
_action_manager: Optional[ActionManager] = None

def get_action_manager(telemetry_callback=None) -> ActionManager:
    global _action_manager
    if _action_manager is None:
        _action_manager = ActionManager(telemetry_callback=telemetry_callback)
    elif telemetry_callback:
        _action_manager.telemetry_callback = telemetry_callback
    return _action_manager
