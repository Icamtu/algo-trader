import sqlite3
import duckdb
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SQLITE_DB = "/home/ubuntu/trading-workspace/openalgo/db/trades.db"
DUCKDB_FILE = "/home/ubuntu/trading-workspace/openalgo/db/historify.duckdb"

def run_etl():
    """Sync trades from SQLite to DuckDB analytics store."""
    if not os.path.exists(SQLITE_DB):
        logger.error(f"Source SQLite DB not found: {SQLITE_DB}")
        return

    logger.info(f"Starting ETL from {SQLITE_DB} to {DUCKDB_FILE}")
    
    try:
        # Connect to DuckDB
        con = duckdb.connect(DUCKDB_FILE)
        
        # Create table if not exists
        con.execute("""
        CREATE TABLE IF NOT EXISTS trades_analytical (
            id INTEGER,
            timestamp TIMESTAMP,
            strategy VARCHAR,
            symbol VARCHAR,
            side VARCHAR,
            quantity INTEGER,
            price DOUBLE,
            status VARCHAR,
            order_id VARCHAR,
            pnl DOUBLE,
            created_at TIMESTAMP
        )
        """)
        
        # Attach SQLite and sync
        # DuckDB can directly query SQLite files
        con.execute(f"INSTALL sqlite_scanner; LOAD sqlite_scanner;")
        con.execute(f"CALL sqlite_attach('{SQLITE_DB}');")
        
        # Insert new records (based on ID or timestamp)
        # Assuming ID is unique and incremental
        con.execute("""
        INSERT INTO trades_analytical
        SELECT * FROM trades
        WHERE id NOT IN (SELECT id FROM trades_analytical)
        """)
        
        # Calculate some session summary stats
        logger.info("ETL sync completed. Running session summary...")
        summary = con.execute("SELECT COUNT(*), SUM(pnl) FROM trades_analytical").fetchone()
        logger.info(f"Total Trades: {summary[0]} | Total P&L: {summary[1]}")
        
        con.close()
    except Exception as e:
        logger.error(f"ETL failed: {e}")

if __name__ == "__main__":
    run_etl()
