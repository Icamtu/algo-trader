import duckdb
import time
import random
from datetime import datetime
import os
import sys
import pandas as pd

# Use a separate file for stress testing
DB_PATH = "/app/storage/stress_test_benchmark.duckdb"

def stress_test_v3():
    print(f"[*] Starting DuckDB Professional Stress Test (v3 - Optimized) on {DB_PATH}...", flush=True)

    # Ensure directory exists
    db_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    # Cleanup previous benchmark file if it exists
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    try:
        print(f"[*] Connecting to DuckDB...", flush=True)
        con = duckdb.connect(DB_PATH)
        print(f"[+] Connected successfully.", flush=True)
    except Exception as e:
        print(f"[!] Connection failed: {e}", flush=True)
        return

    # Ensure table exists
    con.execute("""
    CREATE TABLE IF NOT EXISTS ticks (
        symbol VARCHAR,
        timestamp TIMESTAMP,
        ltp DOUBLE,
        volume INTEGER
    )
    """)

    num_symbols = 150 # Requirement: 100+
    ticks_per_symbol = 2000 # 300,000 total ticks
    total_ticks = num_symbols * ticks_per_symbol

    symbols = [f"SYMBOL_{i}" for i in range(num_symbols)]

    print(f"[*] Preparing {total_ticks} ticks for {num_symbols} symbols...", flush=True)

    data = []
    current_time = datetime.now()
    for sym in symbols:
        for _ in range(ticks_per_symbol):
            data.append((sym, current_time, random.uniform(100, 50000), random.randint(1, 500)))

    # Convert to DataFrame for ultra-fast DuckDB ingestion
    df = pd.DataFrame(data, columns=['symbol', 'timestamp', 'ltp', 'volume'])

    print(f"[*] Start Optimized Ingestion of {total_ticks} ticks via Pandas...", flush=True)
    start_time = time.time()

    # DuckDB can directly query the local 'df' variable
    con.execute("INSERT INTO ticks SELECT * FROM df")

    end_time = time.time()
    insertion_time = end_time - start_time
    throughput = total_ticks / insertion_time

    print(f"[+] Ingestion Complete!", flush=True)
    print(f"    - Total Ticks: {total_ticks}")
    print(f"    - Time Taken: {insertion_time:.4f}s")
    print(f"    - Throughput: {throughput:.2f} ticks/sec")

    print("[*] Testing Aggregation Performance...", flush=True)
    query_start = time.time()
    res = con.execute("""
        SELECT symbol, AVG(ltp), MAX(ltp), MIN(ltp), SUM(volume)
        FROM ticks
        GROUP BY symbol
    """).fetchall()
    query_end = time.time()

    print(f"[+] Multi-symbol aggregation for {len(res)} symbols took: {(query_end - query_start)*1000:.2f}ms")

    print("[*] Creating Index on symbol...", flush=True)
    idx_start = time.time()
    con.execute("CREATE INDEX idx_symbol ON ticks (symbol)")
    idx_end = time.time()
    print(f"[+] Index creation took: {(idx_end - idx_start)*1000:.2f}ms")

    con.close()

    size_mb = os.path.getsize(DB_PATH) / (1024 * 1024)
    print(f"[+] Benchmark DB Size: {size_mb:.2f} MB")
    print("[*] Done.", flush=True)

if __name__ == "__main__":
    stress_test_v3()
