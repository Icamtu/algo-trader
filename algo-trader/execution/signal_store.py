import os
import json
import logging
import redis
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

class SignalStore:
    """
    A persistent store for HITL signals that bridges Redis (Fast Access)
    and SQLite (Audit Log/Persistence).
    Optimized for institutional scaling (100+ concurrent symbols).
    """

    def __init__(self):
        self.sqlite = get_trade_logger()

        # Redis Configuration
        self.redis_host = os.getenv("REDIS_HOST", "redis")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_password = os.getenv("REDIS_PASSWORD", "SpeedySecret456")

        try:
            # Institutional Scaling: Explicit Connection Pooling
            self.pool = redis.ConnectionPool(
                host=self.redis_host,
                port=self.redis_port,
                password=self.redis_password,
                decode_responses=True,
                max_connections=50,
                socket_timeout=5
            )
            self.redis = redis.Redis(connection_pool=self.pool)

            # Connectivity Ping
            self.redis.ping()
            self.redis_active = True
            logger.info(f"Connected to Redis pool at {self.redis_host} (Max: 50)")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Falling back to SQLite-only mode.")
            self.redis_active = False
            self.redis = None

        self.PENDING_KEY = "aether:hitl:pending"

    def _safe_redis(self, func, *args, **kwargs):
        """Wrapper to handle Redis failures gracefully."""
        if not self.redis_active:
            return None
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Redis Operation Failed: {e}")
            # Do not deactivate permanently on transient errors for institutional scale
            return None

    def _sqlite_retry(self, func, *args, **kwargs):
        """Retries SQLite operations if the database is locked during high-concurrency bursts."""
        max_retries = 5
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if "locked" in str(e).lower() and i < max_retries - 1:
                    wait_time = (i + 1) * 0.1
                    logger.warning(f"SQLite locked. Retrying in {wait_time}s... ({i+1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
                raise e

    def save_signal(self, order_data: dict) -> Optional[int]:
        """
        Saves a signal to SQLite first (SoT) and then pushes to Redis for fast access.
        """
        # 1. Write to SQLite with retry logic
        try:
            order_id = self._sqlite_retry(self.sqlite.queue_order_for_approval, order_data)
        except Exception as e:
            logger.error(f"Failed to save signal to SQLite after retries: {e}")
            return None

        if order_id:
            # 2. Add to Redis Pending List
            signal_payload = {
                "id": order_id,
                "timestamp": datetime.utcnow().isoformat(),
                **order_data
            }
            self._safe_redis(self.redis.hset, self.PENDING_KEY, str(order_id), json.dumps(signal_payload))

        return order_id

    def get_pending(self) -> List[dict]:
        """
        Retrieves all pending signals. Prefers Redis, falls back to SQLite.
        """
        # Try Redis first
        pending_raw = self._safe_redis(self.redis.hgetall, self.PENDING_KEY)
        if pending_raw:
            return [json.loads(v) for v in pending_raw.values()]

        # Fallback to SQLite
        logger.info("Falling back to SQLite for pending queue.")
        return self.sqlite.get_action_queue(status='pending')

    def resolve_signal(self, order_id: int, status: str, reason: Optional[str] = None) -> bool:
        """
        Finalizes a signal (Approved/Rejected) in both stores.
        """
        # 1. Update SQLite
        try:
            success = self._sqlite_retry(self.sqlite.update_action_order_status, order_id, status, reason=reason)
        except Exception as e:
            logger.error(f"Failed to resolve signal in SQLite: {e}")
            success = False

        # 2. Remove from Redis Pending
        if success:
            self._safe_redis(self.redis.hdel, self.PENDING_KEY, str(order_id))

        return success

    def sync(self):
        """
        Re-populates Redis from SQLite pending state. (Recovery)
        """
        if not self.redis_active: return

        pending_sqlite = self.sqlite.get_action_queue(status='pending')
        # Clear current pending in Redis
        self.redis.delete(self.PENDING_KEY)

        pipe = self.redis.pipeline()
        for p in pending_sqlite:
            pipe.hset(self.PENDING_KEY, str(p['id']), json.dumps(p))
        pipe.execute()

        logger.info(f"Synchronized {len(pending_sqlite)} pending signals from SQLite to Redis using pipeline.")

_global_store: Optional[SignalStore] = None

def get_signal_store() -> SignalStore:
    global _global_store
    if _global_store is None:
        _global_store = SignalStore()
    return _global_store
