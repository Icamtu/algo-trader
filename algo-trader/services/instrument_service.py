import os
import logging
import io
import requests
import pandas as pd
import duckdb
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class InstrumentService:
    """
    Handles instrument mapping (tradingsymbol -> instrument_token) for brokers like Zerodha.
    Uses DuckDB for persistent, high-speed lookups.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.getenv("HISTORIFY_DB_PATH", "/app/storage/historify.duckdb")
        self._init_db()

    def _init_db(self):
        try:
            db_dir = os.path.dirname(self.db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)

            with duckdb.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS instrument_master (
                        instrument_token INTEGER PRIMARY KEY,
                        exchange_token INTEGER,
                        tradingsymbol VARCHAR,
                        name VARCHAR,
                        last_price DOUBLE,
                        expiry VARCHAR,
                        strike DOUBLE,
                        tick_size DOUBLE,
                        lot_size INTEGER,
                        instrument_type VARCHAR,
                        segment VARCHAR,
                        exchange VARCHAR,
                        updated_at TIMESTAMP DEFAULT current_timestamp
                    )
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_inst_symbol ON instrument_master (tradingsymbol, exchange)")
        except Exception as e:
            logger.error(f"Failed to initialize instrument database: {e}")

    def sync_zerodha_instruments(self) -> bool:
        """Downloads the latest instrument master from Zerodha."""
        url = "https://api.kite.trade/instruments"
        logger.info("Downloading Zerodha instrument master...")
        try:
            response = requests.get(url, timeout=60)
            if response.status_code != 200:
                logger.error(f"Failed to download instruments: {response.status_code}")
                return False

            df = pd.read_csv(io.StringIO(response.text))

            # Zerodha CSV columns match our table schema mostly
            # instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange

            with duckdb.connect(self.db_path) as conn:
                conn.execute("DELETE FROM instrument_master")
                # Insert from pandas dataframe
                conn.execute("INSERT INTO instrument_master SELECT *, current_timestamp FROM df")
                count = conn.execute("SELECT COUNT(*) FROM instrument_master").fetchone()[0]
                logger.info(f"✅ Synced {count} instruments from Zerodha.")

            return True
        except Exception as e:
            logger.error(f"Critical failure in instrument sync: {e}")
            return False

    def resolve_token(self, symbol: str, exchange: str = "NSE") -> Optional[int]:
        """Resolves a tradingsymbol to an instrument_token."""
        try:
            with duckdb.connect(self.db_path) as conn:
                res = conn.execute(
                    "SELECT instrument_token FROM instrument_master WHERE tradingsymbol = ? AND exchange = ? LIMIT 1",
                    (symbol.upper(), exchange.upper())
                ).fetchone()
                return res[0] if res else None
        except Exception as e:
            logger.error(f"Error resolving token for {symbol}: {e}")
            return None

    def resolve_symbols(self, tokens: List[int]) -> Dict[int, str]:
        """Batch resolves tokens back to tradingsymbols."""
        if not tokens: return {}
        try:
            with duckdb.connect(self.db_path) as conn:
                placeholder = ",".join(["?"] * len(tokens))
                res = conn.execute(
                    f"SELECT instrument_token, tradingsymbol FROM instrument_master WHERE instrument_token IN ({placeholder})",
                    tokens
                ).fetchall()
                return {r[0]: r[1] for r in res}
        except Exception as e:
            logger.error(f"Error resolving symbols for tokens: {e}")
            return {}

# Global singleton
_instrument_service = None

def get_instrument_service() -> InstrumentService:
    global _instrument_service
    if _instrument_service is None:
        _instrument_service = InstrumentService()
    return _instrument_service
