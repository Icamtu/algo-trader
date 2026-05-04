import os
import logging
import asyncio
import asyncpg
import json
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
    High-performance ASYNC logger and query engine for TimescaleDB.
    Handles market ticks, strategy signals, and trade execution auditing.
    """

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._batch_ticks = []
        self._tick_batch_size = 100
        self._lock: Optional[asyncio.Lock] = None
        self._running = False
        self._flush_task = None

    @property
    def lock(self) -> asyncio.Lock:
        """Lazy loader for the lock to ensure it is created within a running event loop."""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self):
        """Initialize the connection pool."""
        try:
            if self.pool is None:
                self.pool = await asyncpg.create_pool(
                    host=TS_DB_HOST,
                    database=TS_DB_NAME,
                    user=TS_DB_USER,
                    password=TS_DB_PASS,
                    port=int(TS_DB_PORT),
                    min_size=2,
                    max_size=20
                )
                self._running = True
                self._flush_task = asyncio.create_task(self._periodic_flush())
                logger.info("[TimeScaleLogger] Connected to TimescaleDB pool.")
        except Exception:
            logger.error("[TimeScaleLogger] Connection error", exc_info=True)

    async def disconnect(self):
        """Close the connection pool."""
        self._running = False
        if self._flush_task:
            self._flush_task.cancel()
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("[TimeScaleLogger] Disconnected from TimescaleDB.")

    async def _periodic_flush(self):
        """Background task to ensure ticks are flushed even if batch size isn't reached."""
        while self._running:
            await asyncio.sleep(5)
            await self.flush_ticks()

    async def log_tick(self, symbol: str, price: float, quantity: int = 0, side: str = "TRADE"):
        """Logs a single market tick silently in the background or batches it."""
        try:
            async with self.lock:
                self._batch_ticks.append((datetime.utcnow(), symbol, float(price), int(quantity), side))
                if len(self._batch_ticks) >= self._tick_batch_size:
                    asyncio.create_task(self.flush_ticks())
        except Exception:
            logger.error("Error buffering tick", exc_info=True)

    async def flush_ticks(self):
        """Flush buffered ticks using high-performance binary copy."""
        if not self._batch_ticks or not self.pool:
            return

        async with self.lock:
            ticks_to_flush = list(self._batch_ticks)
            self._batch_ticks = []

        try:
            async with self.pool.acquire() as conn:
                await conn.copy_records_to_table(
                    'market_ticks',
                    records=ticks_to_flush,
                    columns=('timestamp', 'symbol', 'price', 'quantity', 'side')
                )
        except Exception:
            logger.error("Error flushing ticks to TimescaleDB", exc_info=True)

    async def log_signal(self, strategy_id: str, symbol: str, signal_type: str, price: float, indicators: Dict[str, Any] = {}, ai_reasoning: str = "", conviction: float = 0.0):
        """Log a strategy signal with non-blocking JSONB support."""
        if not self.pool: await self.connect()
        if not self.pool: return

        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO strategy_signals (timestamp, strategy_id, symbol, signal_type, price, indicators, ai_reasoning, conviction)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    datetime.utcnow(), strategy_id, symbol, signal_type, float(price), json.dumps(indicators), ai_reasoning, float(conviction)
                )
        except Exception:
            logger.error("Error logging signal to TimescaleDB", exc_info=True)

    async def log_trade(self, trade_id: int, strategy_id: str, symbol: str, side: str, quantity: int, price: float, charges: float = 0.0, pnl: float = 0.0, mode: str = "sandbox"):
        """Canonical execution log sync."""
        if not self.pool: await self.connect()
        if not self.pool: return

        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO trade_registry (timestamp, trade_id, strategy_id, symbol, side, quantity, price, charges, pnl, mode)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    """,
                    datetime.utcnow(), trade_id, strategy_id, symbol, side, int(quantity), float(price), float(charges), float(pnl), mode
                )
        except Exception:
            logger.error("Error logging trade to TimescaleDB", exc_info=True)

    # --- ANALYTIC QUERY METHODS (For UI Context) ---

    async def get_trade_history(self, mode: str = 'sandbox', limit: int = 100):
        if not self.pool: await self.connect()
        if not self.pool: return []
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM trade_registry WHERE mode = $1 ORDER BY timestamp DESC LIMIT $2",
                mode, limit
            )
            return [dict(r) for r in rows]

    async def get_tick_history(self, symbol: str, interval: str = '1 minute', limit: int = 500):
        if not self.pool: await self.connect()
        if not self.pool: return []
        query = """
            SELECT time_bucket($1, timestamp) AS bucket,
                   symbol,
                   first(price, timestamp) as open,
                   max(price) as high,
                   min(price) as low,
                   last(price, timestamp) as close,
                   sum(quantity) as volume
            FROM market_ticks
            WHERE symbol = $2
            GROUP BY bucket, symbol
            ORDER BY bucket DESC
            LIMIT $3
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, interval, symbol, limit)
            return [dict(r) for r in rows]

    async def get_historical_signals(self, symbol: str = None, limit: int = 100):
        if not self.pool: await self.connect()
        if not self.pool: return []
        query = "SELECT * FROM strategy_signals "
        params = []
        if symbol:
            query += "WHERE symbol = $1 "
            params.append(symbol)
        query += f"ORDER BY timestamp DESC LIMIT ${len(params) + 1}"
        params.append(limit)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(r) for r in rows]

    # --- SYNCHRONOUS AUDIT METHODS (For Threaded API Compatibility) ---

    def _get_sync_conn(self):
        import psycopg2
        return psycopg2.connect(
            host=TS_DB_HOST,
            database=TS_DB_NAME,
            user=TS_DB_USER,
            password=TS_DB_PASS,
            port=int(TS_DB_PORT)
        )

    def get_historical_signals_sync(self, symbol: str = None, limit: int = 100):
        import psycopg2.extras
        conn = self._get_sync_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if symbol:
                    cur.execute("SELECT * FROM strategy_signals WHERE symbol = %s ORDER BY timestamp DESC LIMIT %s", (symbol, limit))
                else:
                    cur.execute("SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT %s", (limit,))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_trade_history_sync(self, mode: str = 'sandbox', limit: int = 100):
        import psycopg2.extras
        conn = self._get_sync_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM trade_registry WHERE mode = %s ORDER BY timestamp DESC LIMIT %s", (mode, limit))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

    def get_tick_history_sync(self, symbol: str, interval: str = '1 minute', limit: int = 100):
        import psycopg2.extras
        conn = self._get_sync_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Use standard SQL for time_bucket if possible, or just raw fetch for audit
                query = """
                    SELECT time_bucket(%s, timestamp) AS bucket,
                           symbol,
                           first(price, timestamp) as open,
                           max(price) as high,
                           min(price) as low,
                           last(price, timestamp) as close,
                           sum(quantity) as volume
                    FROM market_ticks
                    WHERE symbol = %s
                    GROUP BY bucket, symbol
                    ORDER BY bucket DESC
                    LIMIT %s
                """
                cur.execute(query, (interval, symbol, limit))
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()

# Singleton
ts_logger = TimeScaleLogger()

async def get_timescale_logger() -> TimeScaleLogger:
    if not ts_logger.pool:
        await ts_logger.connect()
    return ts_logger
