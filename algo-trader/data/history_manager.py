# algo-trader/data/history_manager.py
import logging
import os
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from pathlib import Path

# Optional dependencies
try:
    import duckdb
except ImportError:
    duckdb = None

try:
    import yfinance as yf
except ImportError:
    yf = None

from core.config import settings

logger = logging.getLogger(__name__)

# Standard DB path for OpenAlgo architecture (Unified with Historify Service)
from data.historify_db import HISTORIFY_DB_PATH, get_connection
import data.historify_db as hdb

class HistoryManager:
    """
    Manages historical OHLCV data storage and retrieval.
    Adapts the "Historify" pattern from OpenAlgo.
    """

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or Path(HISTORIFY_DB_PATH)
        # Note: Directory is ensured by historify_db.init_database() called in service

    def get_candles(
        self,
        symbol: str,
        interval: str = "1m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves candles from local DuckDB cache or fetches from external providers.
        """
        # 1. Try local DuckDB first
        logger.info(f"Checking Historify DB for {symbol} ({start_date} to {end_date})")
        local_data = self._read_from_duckdb(symbol, start_date, end_date)
        if local_data:
            logger.info(f"Historify CACHE HIT: Retrieved {len(local_data)} rows for {symbol}.")
            return local_data

        # 2. Fallback to yfinance (Secondary Provider)
        logger.info(f"OpenAlgo data unavailable for {symbol}. Falling back to yfinance...")
        yf_data = self._fetch_from_yfinance(symbol, interval, start_date, end_date)
        if yf_data:
            self._save_to_duckdb(symbol, yf_data, interval=interval)
            return yf_data

        logger.warning(f"No historical data found for {symbol} from any provider.")
        return []

    def get_candles_df(
        self,
        symbol: str,
        interval: str = "1m",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100000
    ) -> pd.DataFrame:
        """
        Retrieves candles as a Pandas DataFrame.
        Prioritizes direct DuckDB-to-DataFrame conversion for speed.
        """
        # 1. Try local DuckDB first (Optimized)
        if self.db_path.exists():
            try:
                # We assume NSE for now
                exchange = "NSE"
                df = hdb.get_ohlcv_dataframe(symbol, exchange, interval, limit)
                if not df.empty:
                    logger.info(f"Historify VECTOR HIT: Retrieved {len(df)} rows for {symbol}.")
                    return df
            except Exception:
                logger.warning("Historify Vector Read failed", exc_info=True)

        # 2. Fallback to list-based retrieval if DuckDB is empty or fails
        candles = self.get_candles(symbol, interval, start_date, end_date)
        if not candles:
            return pd.DataFrame()

        return pd.DataFrame(candles)

    def _read_from_duckdb(self, symbol: str, start: str, end: str) -> List[Dict[str, Any]]:
        """Reads OHLCV data from DuckDB using unified Historify data layer."""
        if not self.db_path.exists():
            return []

        try:
            # We use the service's get_records logic via hdb wrapper eventually,
            # but for now we'll do a simple query to maintain compatibility with BacktestEngine
            with get_connection() as conn:
                # Table columns: symbol, exchange, interval, timestamp, open, high, low, close, volume, oi
                # BacktestEngine expects numeric interval like '1' for '1m'
                oa_interval = "1" if "1m" in str(symbol) else "5" # Heuristic/Fallback

                # Try to determine interval from context or use default
                query = "SELECT timestamp, open, high, low, close, volume, oi FROM market_data WHERE symbol = ? ORDER BY timestamp ASC"
                res = conn.execute(query, (symbol.upper(),)).fetchall()

                if not res:
                    return []

                # Convert to backtest format
                return [
                    {
                        "time": int(r[0]),
                        "open": float(r[1]),
                        "high": float(r[2]),
                        "low": float(r[3]),
                        "close": float(r[4]),
                        "volume": int(r[5]),
                        "oi": int(r[6])
                    } for r in res
                ]
        except Exception:
            logger.error("DuckDB Read Error", exc_info=True)
            return []

    def _save_to_duckdb(self, symbol: str, candles: List[Dict[str, Any]], interval: str = "1m"):
        """Saves OHLCV data to DuckDB using unified Historify data layer."""
        try:
            df = pd.DataFrame(candles)
            if df.empty: return

            # Use Historify's robust upsert logic
            # exchange defaults to NSE for unified storage
            hdb.upsert_market_data(df, symbol, "NSE", interval)
            logger.info(f"Saved {len(candles)} rows for {symbol} to Historify market_data.")
        except Exception:
            logger.error("DuckDB Save Error", exc_info=True)


    def _fetch_from_yfinance(self, symbol: str, interval: str, start: str, end: str) -> List[Dict[str, Any]]:
        if not yf:
            return []

        try:
            # yfinance symbol normalization
            # 1. Handle common indices
            index_map = {
                "NIFTY": "^NSEI",
                "BANKNIFTY": "^NSEBANK",
                "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
                "CNXIT": "^CNXIT",
                "NIFTYIT": "^CNXIT",
                "SENSEX": "^BSESN"
            }

            upper_symbol = symbol.upper()
            if upper_symbol in index_map:
                yf_symbol = index_map[upper_symbol]
            else:
                # 2. Handle equity symbols
                yf_symbol = symbol.split("-")[0] # Strip -EQ or other suffixes
                if not yf_symbol.endswith(".NS") and not yf_symbol.endswith(".BO") and len(yf_symbol) <= 10:
                    yf_symbol = f"{yf_symbol}.NS"

            # Normalize interval for yfinance
            yf_interval = interval
            if interval.upper() in ["D", "1D", "DAILY"]:
                yf_interval = "1d"
            elif interval.lower() == "1h":
                yf_interval = "1h"
            elif interval.lower() == "1m":
                yf_interval = "1m"
            # yfinance supports: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo

            # Fetch
            logger.info(f"Calling yfinance for {yf_symbol} (interval={yf_interval}) | Range: {start} to {end}")
            ticker = yf.Ticker(yf_symbol)
            df = ticker.history(start=start, end=end, interval=yf_interval)
            logger.info(f"yfinance result for {yf_symbol}: {len(df)} rows. Columns: {list(df.columns)}")

            if df.empty:
                logger.warning(f"yfinance returned EMPTY dataframe for {yf_symbol}")
                return []

            # Normalize columns
            df = df.reset_index()
            # Standard yfinance columns: Date/Datetime, Open, High, Low, Close, Volume
            df.columns = [c.lower() for c in df.columns]
            logger.debug(f"yfinance normalized columns: {list(df.columns)}")

            # Map date/datetime to timestamp
            # If interval < 1d, it has 'datetime' index. If >= 1d, it has 'date' index.
            date_col = None
            for col in ['date', 'datetime', 'index']:
                if col in df.columns:
                    date_col = col
                    break

            if not date_col:
                logger.error(f"yfinance date column not found in: {list(df.columns)}")
                return []

            # Convert to epoch
            try:
                df['time'] = pd.to_datetime(df[date_col], utc=True).astype('int64') // 10**9
                df['timestamp'] = df['time']
            except Exception:
                logger.error("Timestamp conversion error for %s", yf_symbol, exc_info=True)
                return []

            # Required fields
            if 'oi' not in df.columns:
                df['oi'] = 0

            return df[['timestamp', 'time', 'open', 'high', 'low', 'close', 'volume', 'oi']].to_dict('records')
        except Exception:
            logger.error("yfinance Fetch Error for %s", symbol, exc_info=True)
            return []
