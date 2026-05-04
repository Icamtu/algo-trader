import sqlite3
import shutil
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("HistorifySync")

LEGACY_ROOT = "./openalgo/db"
NATIVE_ROOT = "/home/ubuntu/trading-workspace/algo-trader/database"

def sync_data():
    logger.info("--- Phase 9: Historify Data Sync Started ---")

    # 1. Ensure Native Directory Exists
    if not os.path.exists(NATIVE_ROOT):
        os.makedirs(NATIVE_ROOT)
        logger.info(f"Created native directory: {NATIVE_ROOT}")

    # 2. Migrate DuckDB (Columnar Data)
    legacy_duck = os.path.join(LEGACY_ROOT, "historify.duckdb")
    native_duck = os.path.join(NATIVE_ROOT, "historify.duckdb")

    if os.path.exists(legacy_duck):
        logger.info(f"Migrating DuckDB from {legacy_duck}...")
        shutil.copy2(legacy_duck, native_duck)
        logger.info("DuckDB migration complete.")
    else:
        logger.warning("No legacy historify.duckdb found.")

    # 3. Migrate Metadata (SQLite)
    legacy_sqlite = os.path.join(LEGACY_ROOT, "openalgo.db")
    native_sqlite = os.path.join(NATIVE_ROOT, "openalgo.db")

    if os.path.exists(legacy_sqlite):
        logger.info(f"Syncing Metadata from {legacy_sqlite}...")

        # If native sqlite doesn't exist, just copy it
        if not os.path.exists(native_sqlite):
            shutil.copy2(legacy_sqlite, native_sqlite)
            logger.info("Native openalgo.db initialized from legacy.")
        else:
            # Merge logic for specific tables if needed
            # For now, we prioritize the existing native one but copy over missing auths
            conn_leg = sqlite3.connect(legacy_sqlite)
            conn_nat = sqlite3.connect(native_sqlite)

            try:
                # Sync Auth Table
                logger.info("Merging Auth sessions...")
                leg_auths = conn_leg.execute("SELECT name, auth, broker, user_id, is_revoked FROM auth").fetchall()
                for row in leg_auths:
                    conn_nat.execute("INSERT OR IGNORE INTO auth (name, auth, broker, user_id, is_revoked) VALUES (?, ?, ?, ?, ?)", row)

                # Sync Historify Jobs
                logger.info("Merging Historify metadata...")
                # Check if table exists in native
                table_check = conn_nat.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='historify_apscheduler_jobs'").fetchone()
                if table_check:
                    leg_jobs = conn_leg.execute("SELECT * FROM historify_apscheduler_jobs").fetchall()
                    # We might need schema mapping here, but usually it's identical
                    for row in leg_jobs:
                        placeholders = ",".join(["?" for _ in range(len(row))])
                        conn_nat.execute(f"INSERT OR IGNORE INTO historify_apscheduler_jobs VALUES ({placeholders})", row)

                conn_nat.commit()
                logger.info("Metadata merge complete.")
            except Exception:
                logger.error("Metadata merge failed", exc_info=True)
            finally:
                conn_leg.close()
                conn_nat.close()
    else:
        logger.error("Legacy openalgo.db not found for sync.")

    logger.info("--- Sync Operation Finalized ---")

if __name__ == "__main__":
    sync_data()
