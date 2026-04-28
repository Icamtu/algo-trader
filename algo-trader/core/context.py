from typing import Dict, Any, List
from datetime import datetime
from collections import deque
import logging

# Global context for sharing objects between Strategy Engine and FastAPI
app_context: Dict[str, Any] = {}

# System globals
SYSTEM_START_TIME = datetime.now()
_heartbeat_data: Dict[str, Any] = {
    "status": "HEALTHY",
    "checks": {
        "algo_engine": {"status": "HEALTHY", "latency": 0},
        "broker": {"status": "HEALTHY", "latency": 0},
        "redis": {"status": "HEALTHY"}
    },
    "timestamp": datetime.now().isoformat()
}

# --- In-memory log buffer for the UI ---
class MemoryLogHandler(logging.Handler):
    def __init__(self, capacity=100):
        super().__init__()
        self.log_buffer = deque(maxlen=capacity)

    def emit(self, record):
        log_entry = {
            "time": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "module": record.module.upper(),
            "msg": self.format(record)
        }
        self.log_buffer.append(log_entry)

    def get_logs(self):
        return list(self.log_buffer)

_memory_log_handler = MemoryLogHandler()
_memory_log_handler.setFormatter(logging.Formatter('%(message)s'))
logging.getLogger().addHandler(_memory_log_handler)
