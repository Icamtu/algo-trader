import os
import logging
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# TimescaleDB connection params
TS_DB_HOST = os.getenv("TS_DB_HOST", "timescaledb")
TS_DB_NAME = os.getenv("TS_DB_NAME", "postgres")
TS_DB_USER = os.getenv("TS_DB_USER", "postgres")
TS_DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgres")
TS_DB_PORT = os.getenv("TS_DB_PORT", "5432")

class TimeScaleLogger:
    """
    High-performance logger for TimescaleDB.
    Handles market ticks, strategy signals, and trade execution auditing.
    """

    def __init__(self):
        self.conn_params = {
            "host": TS_DB_HOST,
            "database": TS_DB_NAME,
            "user": TS_DB_USER,
            "password": TS_DB_PASS,
            "port": TS_DB_PORT
        }
        self._batch_ticks = []
        self._tick_batch_size = 100

    def _get_connection(self):
        return psycopg2.connect(**self.conn_params)

    def log_tick(self, symbol: str, price: float, quantity: int = 0, side: str = "TRADE"):
        """
        Logs a single market tick. Batches internally if needed.
        """
        try:
            self._batch_ticks.append((datetime.utcnow(), symbol, price, quantity, side))
            if len(self._batch_ticks) >= self._tick_batch_size:
                self.flush_ticks()
        except Exception as e:
            logger.error(f"Error buffering tick: {e}")

    def flush_ticks(self):
        if not self._batch_ticks:
            return

        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    execute_values(cur,
                        "INSERT INTO market_ticks (timestamp, symbol, price, quantity, side) VALUES %s",
                        self._batch_ticks
                    )
                conn.commit()
            self._batch_ticks = []
        except Exception as e:
            logger.error(f"Error flushing ticks to TimescaleDB: {e}")

    def log_signal(self, strategy_id: str, symbol: str, signal_type: str, price: float, indicators: Dict[str, Any] = {}, ai_reasoning: str = "", conviction: float = 0.0):
        try:
            import json
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO strategy_signals (timestamp, strategy_id, symbol, signal_type, price, indicators, ai_reasoning, conviction) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                        (datetime.utcnow(), strategy_id, symbol, signal_type, price, json.dumps(indicators), ai_reasoning, conviction)
                    )
                conn.commit()
        except Exception as e:
            logger.error(f"Error logging signal to TimescaleDB: {e}")

    def log_trade(self, trade_id: int, strategy_id: str, symbol: str, side: str, quantity: int, price: float, pnl: float = 0.0, mode: str = "sandbox"):
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO trade_registry (timestamp, trade_id, strategy_id, symbol, side, quantity, price, pnl, mode) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (datetime.utcnow(), trade_id, strategy_id, symbol, side, quantity, price, pnl, mode)
                    )
                conn.commit()
        except Exception as e:
            logger.error(f"Error logging trade to TimescaleDB: {e}")

# Singleton
_timescale_logger = None

def get_timescale_logger() -> TimeScaleLogger:
    global _timescale_logger
    if _timescale_logger is None:
        _timescale_logger = TimeScaleLogger()
    return _timescale_logger
