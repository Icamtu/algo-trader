import time
import functools
import logging
import sqlite3
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

LATENCY_DB = "/data/db/latency.db"

def init_latency_db(db_file: str = LATENCY_DB):
    """Initialize the latency tracking database."""
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS latency_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_name TEXT NOT NULL,
            packet_time TEXT,
            process_time TEXT NOT NULL,
            delta_ms REAL NOT NULL
        )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Error initializing latency database", exc_info=True)

def log_latency(event_name: str, packet_time_str: Optional[str], db_file: str = LATENCY_DB):
    """Log a single latency measurement."""
    try:
        process_time = datetime.utcnow()
        packet_time = None
        delta_ms = 0.0

        if packet_time_str:
            # Shoonya time format varies, usually 'ft' is a timestamp or HH:MM:SS
            # Adjust parsing as needed based on actual tick format
            try:
                # Assuming 'ft' is a unix timestamp for now, or HH:MM:SS
                if ":" in packet_time_str:
                    # Example: 10:15:01
                    today = datetime.utcnow().date()
                    packet_time = datetime.strptime(f"{today} {packet_time_str}", "%Y-%m-%d %H:%M:%S")
                else:
                    packet_time = datetime.utcfromtimestamp(float(packet_time_str))

                delta_ms = (process_time - packet_time).total_seconds() * 1000
            except:
                pass

        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO latency_logs (timestamp, event_name, packet_time, process_time, delta_ms)
        VALUES (?, ?, ?, ?, ?)
        """, (process_time.isoformat(), event_name, packet_time_str, process_time.isoformat(), delta_ms))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error("Error logging latency", exc_info=True)

def latency_profile(event_name: str):
    """Decorator to profile execution latency for event-driven functions."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # For Shoonya, 'ft' is usually in the data dict
            data = args[1] if len(args) > 1 else kwargs.get('data', {})
            packet_time_str = None
            if isinstance(data, dict):
                packet_time_str = data.get('ft') or data.get('exch_tm')

            start_time = time.perf_counter()
            result = func(*args, **kwargs)
            end_time = time.perf_counter()

            # Internal processing latency
            proc_latency = (end_time - start_time) * 1000

            # External tick-to-trace latency
            log_latency(event_name, packet_time_str)

            return result
        return wrapper
    return decorator
