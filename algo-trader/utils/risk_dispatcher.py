import json
import logging
from datetime import datetime
import redis

logger = logging.getLogger(__name__)

class RiskDispatcher:
    """
    Handles real-time broadcasting of risk metrics and strategy operational status.
    Publishes to Redis for WebSocket consumption by the frontend.
    """
    def __init__(self, redis_host='redis', redis_port=6379, redis_password=None):
        try:
            self.redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                decode_responses=True
            )
            logger.info(f"RiskDispatcher: Connected to Redis at {redis_host}:{redis_port}")
        except Exception as e:
            logger.error(f"RiskDispatcher: Redis connection failed: {e}")
            self.redis_client = None

    def broadcast_risk(self, risk_data: dict):
        """Emits a 'risk_update' event."""
        self._send_payload('risk_update', risk_data)

    def broadcast_matrix(self, matrix_data: list):
        """Emits a 'matrix_update' event."""
        self._send_payload('matrix_update', matrix_data)

    def _send_payload(self, topic: str, payload: dict):
        if not self.redis_client:
            return

        try:
            # Wrap in structured envelope
            envelope = {
                "topic": topic,
                "payload": payload,
                "timestamp": datetime.now().isoformat()
            }
            self.redis_client.publish(topic, json.dumps(envelope))
            logger.debug(f"Broadcasting {topic} update")
        except Exception as e:
            logger.error(f"RiskDispatcher: Publish failed for {topic}: {e}")
