import os
import time
import logging
import threading
import duckdb
import pandas as pd
import numpy as np
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_PATH = "/app/storage/historify.duckdb"
HISTORIFY_DB_PATH = os.getenv("HISTORIFY_DB_PATH", DEFAULT_PATH)

DEFAULT_WATCHLIST_SYMBOLS = [
    {"symbol": "NIFTY", "exchange": "NSE_INDEX", "name": "NIFTY 50"},
    {"symbol": "BANKNIFTY", "exchange": "NSE_INDEX", "name": "NIFTY BANK"},
    {"symbol": "SENSEX", "exchange": "BSE_INDEX", "name": "SENSEX"},
    {"symbol": "RELIANCE", "exchange": "NSE", "name": "RELIANCE"},
    {"symbol": "HDFCBANK", "exchange": "NSE", "name": "HDFCBANK"},
    {"symbol": "INFY", "exchange": "NSE", "name": "INFY"},
    {"symbol": "TCS", "exchange": "NSE", "name": "TCS"},
]

_thread_local = threading.local()

def _get_persistent_conn():
    if not hasattr(_thread_local, "conn") or _thread_local.conn is None:
        db_dir = os.path.dirname(HISTORIFY_DB_PATH)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        try:
            _thread_local.conn = duckdb.connect(HISTORIFY_DB_PATH, read_only=False)
            _thread_local.conn.execute("SET threads=2;")
        except Exception as e:
            logger.error(f"DuckDB Connect Error: {e}")
            raise
    return _thread_local.conn

@contextmanager
def get_duckdb_conn():
    try:
        conn = _get_persistent_conn()
        yield conn
    except Exception as e:
        logger.error(f"DuckDB Session Error: {e}")
        _thread_local.conn = None
        raise

get_connection = get_duckdb_conn

def init_database():
    with get_connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS market_data (symbol VARCHAR, exchange VARCHAR, interval VARCHAR, timestamp BIGINT, open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE, volume BIGINT, oi BIGINT DEFAULT 0, created_at TIMESTAMP DEFAULT current_timestamp, PRIMARY KEY (symbol, exchange, interval, timestamp))")
        conn.execute("CREATE TABLE IF NOT EXISTS watchlist (symbol VARCHAR, exchange VARCHAR, display_name VARCHAR, added_at TIMESTAMP DEFAULT current_timestamp, PRIMARY KEY (symbol, exchange))")
        conn.execute("CREATE TABLE IF NOT EXISTS download_jobs (id VARCHAR PRIMARY KEY, status VARCHAR, total_symbols INTEGER, completed_symbols INTEGER, last_symbol VARCHAR DEFAULT '', last_provider VARCHAR DEFAULT '', operator VARCHAR DEFAULT '', error_message VARCHAR, interval VARCHAR DEFAULT '', start_date VARCHAR DEFAULT '', end_date VARCHAR DEFAULT '', created_at TIMESTAMP DEFAULT current_timestamp)")
        
        # Migrations
        for col in ['interval', 'start_date', 'end_date', 'last_symbol', 'last_provider', 'operator']:
            try: conn.execute(f"ALTER TABLE download_jobs ADD COLUMN {col} VARCHAR DEFAULT ''")
            except: pass

        conn.execute("CREATE INDEX IF NOT EXISTS idx_market_data_ts ON market_data (interval, timestamp DESC)")
        seed_default_watchlist()

def upsert_market_data(data, symbol, exchange, interval):
    """Upsert OHLCV data into DuckDB."""
    with get_connection() as conn:
        try:
            if isinstance(data, pd.DataFrame):
                # Ensure columns match expected schema
                df = data.copy()
                if 'oi' not in df.columns:
                    df['oi'] = 0
                
                # We use the 'data' name in the query because DuckDB can query local variables
                conn.execute("INSERT OR REPLACE INTO market_data (symbol, exchange, interval, timestamp, open, high, low, close, volume, oi) SELECT ? as symbol, ? as exchange, ? as interval, timestamp, open, high, low, close, volume, oi FROM df", (symbol.upper(), exchange.upper(), interval))
                return len(df)
            elif isinstance(data, list):
                for row in data:
                    conn.execute("INSERT OR REPLACE INTO market_data (symbol, exchange, interval, timestamp, open, high, low, close, volume, oi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                 (symbol.upper(), exchange.upper(), interval, row['timestamp'], row['open'], row['high'], row['low'], row['close'], row['volume'], row.get('oi', 0)))
                return len(data)
        except Exception as e:
            logger.error(f"upsert_market_data error: {e}")
            return 0
    return 0

def seed_default_watchlist():
    with get_connection() as conn:
        if conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0] == 0:
            for item in DEFAULT_WATCHLIST_SYMBOLS:
                conn.execute("INSERT OR IGNORE INTO watchlist (symbol, exchange, display_name) VALUES (?, ?, ?)", (item["symbol"], item["exchange"], item["name"]))

def get_watchlist():
    with get_connection() as conn:
        res = conn.execute("SELECT * FROM watchlist ORDER BY added_at ASC").fetchall()
        return [{"id": i+1, "symbol": r[0], "exchange": r[1], "display_name": r[2], "added_at": r[3]} for i, r in enumerate(res)]

def add_to_watchlist(symbol, exchange, name=None):
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO watchlist (symbol, exchange, display_name) VALUES (?, ?, ?)", (symbol.upper(), exchange.upper(), name))

def remove_from_watchlist(symbol, exchange=None):
    with get_connection() as conn:
        if exchange: conn.execute("DELETE FROM watchlist WHERE symbol=? AND exchange=?", (symbol.upper(), exchange.upper()))
        else: conn.execute("DELETE FROM watchlist WHERE symbol=?", (symbol.upper(),))

def upsert_job(job_id, status, total_symbols=0, completed_symbols=0, last_symbol='', last_provider='', operator='', error_message=None, interval='', start_date='', end_date=''):
    with get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO download_jobs (id, status, total_symbols, completed_symbols, last_symbol, last_provider, operator, error_message, interval, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                     (job_id, status, total_symbols, completed_symbols, last_symbol, last_provider, operator, error_message, interval, start_date, end_date))

def get_job(job_id):
    with get_connection() as conn:
        r = conn.execute("SELECT id, status, total_symbols, completed_symbols, last_symbol, last_provider, operator, error_message, interval, start_date, end_date, created_at FROM download_jobs WHERE id=?", (job_id,)).fetchone()
        return {
            "id": r[0], "status": r[1], "total_symbols": r[2], "completed_symbols": r[3], 
            "last_symbol": r[4], "last_provider": r[5], "operator": r[6],
            "error_message": r[7], "interval": r[8], "start_date": r[9], "end_date": r[10], "created_at": r[11]
        } if r else None

def get_all_jobs():
    with get_connection() as conn:
        res = conn.execute("SELECT id, status, total_symbols, completed_symbols, last_symbol, last_provider, operator, error_message, interval, start_date, end_date, created_at FROM download_jobs ORDER BY created_at DESC").fetchall()
        return [{
            "id": r[0], "status": r[1], "total_symbols": r[2], "completed_symbols": r[3], 
            "last_symbol": r[4], "last_provider": r[5], "operator": r[6],
            "error_message": r[7], "interval": r[8], "start_date": r[9], "end_date": r[10], "created_at": r[11]
        } for r in res]


def list_ohlcv_catalog(interval=None):
    from datetime import datetime as dt
    def safe_fromtimestamp(ts):
        if not ts: return ''
        try:
            # Handle milliseconds
            if ts > 200000000000: # Clearly ms
                ts = ts / 1000
            return dt.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M')
        except Exception as e:
            return f"Error: {str(ts)[:10]}"

    with get_connection() as conn:
        q = "SELECT symbol, exchange, interval, COUNT(*), MIN(timestamp), MAX(timestamp) FROM market_data"
        if interval: res = conn.execute(q + " WHERE interval=? GROUP BY 1,2,3", (interval,)).fetchall()
        else: res = conn.execute(q + " GROUP BY 1,2,3").fetchall()
        return [{
            "symbol": r[0], "exchange": r[1], "interval": r[2], "record_count": r[3],
            "first_date": safe_fromtimestamp(r[4]),
            "last_date": safe_fromtimestamp(r[5]),
            "first_ts": r[4], "last_ts": r[5]
        } for r in res]

def get_ohlcv_data(symbol, exchange, interval, limit=1000):
    with get_connection() as conn:
        res = conn.execute("SELECT timestamp, open, high, low, close, volume, oi FROM market_data WHERE symbol=? AND exchange=? AND interval=? ORDER BY timestamp DESC LIMIT ?", (symbol.upper(), exchange.upper(), interval, limit)).fetchall()
        res.reverse()
        return [{"time": int(r[0]), "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5], "oi": r[6]} for r in res]

def get_ohlcv_dataframe(symbol, exchange, interval, limit=1000):
    with get_connection() as conn:
        return conn.execute("SELECT timestamp, open, high, low, close, volume, oi FROM market_data WHERE symbol=? AND exchange=? AND interval=? ORDER BY timestamp ASC LIMIT ?", (symbol.upper(), exchange.upper(), interval, limit)).df()

def get_db_stats():
    from datetime import datetime
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM market_data").fetchone()[0]
        unique_symbols = conn.execute("SELECT COUNT(DISTINCT symbol) FROM market_data").fetchone()[0]
        
        # Calculate date span with millisecond safety
        date_res = conn.execute("SELECT MIN(timestamp), MAX(timestamp) FROM market_data").fetchone()
        date_span = "N/A"
        first_unix = None
        last_unix = None
        
        if date_res and date_res[0] and date_res[1]:
            t1 = date_res[0]
            t2 = date_res[1]
            # Millisecond safety
            if t1 > 200000000000: t1 = t1 / 1000
            if t2 > 200000000000: t2 = t2 / 1000
            
            first_unix = t1
            last_unix = t2
            first = datetime.fromtimestamp(t1).strftime('%Y-%m-%d')
            last = datetime.fromtimestamp(t2).strftime('%Y-%m-%d')
            date_span = f"{first} to {last}"
            
        # Calculate last ingest
        ingest_res = conn.execute("SELECT MAX(created_at) FROM market_data").fetchone()
        last_ingested_at = "N/A"
        if ingest_res and ingest_res[0]:
            last_ingested_at = ingest_res[0].strftime('%Y-%m-%d %H:%M:%S')

        size = os.path.getsize(HISTORIFY_DB_PATH) / (1024*1024) if os.path.exists(HISTORIFY_DB_PATH) else 0
        return {
            "status": "HEALTHY", 
            "market_records": count, 
            "total_candles": count, 
            "unique_symbols": unique_symbols,
            "date_span": date_span,
            "first_date_unix": first_unix,
            "last_date_unix": last_unix,
            "last_ingested_at": last_ingested_at,
            "db_size_mb": round(size, 2),
            "storage_path": HISTORIFY_DB_PATH
        }

def enforce_retention_policy(max_days=30):
    cutoff = int(time.time()) - (max_days * 86400)
    protected = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'NIFTY 50']
    try:
        with get_connection() as conn:
            conn.execute(f"DELETE FROM market_data WHERE timestamp < ? AND interval NOT IN ('D', '1h') AND symbol NOT IN ({','.join(['?']*len(protected))})", [cutoff] + protected) # nosec: B608
    except: pass

def sanitize_watchlist():
    # Simple implementation: ensure all watchlist items are valid strings
    with get_connection() as conn:
        conn.execute("DELETE FROM watchlist WHERE symbol IS NULL OR symbol = ''")
    return 0

def fetch_historify_symbols():
    with get_connection() as conn:
        res = conn.execute("SELECT DISTINCT symbol FROM market_data").fetchall()
        return [r[0] for r in res]

def get_last_timestamp(symbol, exchange, interval):
    with get_connection() as conn:
        res = conn.execute("SELECT MAX(timestamp) FROM market_data WHERE symbol=? AND exchange=? AND interval=?", (symbol.upper(), exchange.upper(), interval)).fetchone()
        return res[0] if res and res[0] else 0

def delete_catalog_entry(symbol, exchange, interval):
    with get_connection() as conn:
        conn.execute("DELETE FROM market_data WHERE symbol=? AND exchange=? AND interval=?", (symbol.upper(), exchange.upper(), interval))

def compact_database():
    with get_connection() as conn:
        conn.execute("CHECKPOINT")
        conn.execute("VACUUM")
    return {"status": "success", "message": "Database compacted."}

def get_market_breadth(interval):
    try:
        with get_connection() as conn:
            # Simple breadth: based on change from previous candle in the database
            # This is a rough estimation for the distribution matrix
            res = conn.execute("""
                WITH latest_data AS (
                    SELECT symbol, close, 
                           LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp) as prev_close
                    FROM market_data
                    WHERE interval = ?
                    QUALIFY row_number() OVER (PARTITION BY symbol ORDER BY timestamp DESC) = 1
                )
                SELECT 
                    COUNT(CASE WHEN close > prev_close THEN 1 END) as advances,
                    COUNT(CASE WHEN close < prev_close THEN 1 END) as declines,
                    COUNT(CASE WHEN close = prev_close THEN 1 END) as unchanged
                FROM latest_data
            """, (interval,)).fetchone()
            
            adv = res[0] or 0
            dec = res[1] or 0
            unc = res[2] or 0
            total = adv + dec + unc
            ratio = adv / total if total > 0 else 0.5
            
            return {
                "advances": adv,
                "declines": dec,
                "unchanged": unc,
                "ratio": ratio
            }
    except Exception as e:
        logger.error(f"Error getting market breadth: {e}")
        return {"advances": 0, "declines": 0, "unchanged": 0, "ratio": 0.5}

def cleanup_stale_jobs(timeout_minutes=15):
    with get_connection() as conn:
        # Use parameter binding for the timeout interval to prevent SQL injection
        conn.execute("UPDATE download_jobs SET status='FAILED', error_message='Job timed out' WHERE status='RUNNING' AND created_at < CAST(current_timestamp AS TIMESTAMP) - CAST(? || ' minutes' AS INTERVAL)", (str(timeout_minutes),))
