import logging
import os
import sqlite3
import time
import uuid
import threading
import pandas as pd
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import data.historify_db as hdb
from data.history_manager import HistoryManager

logger = logging.getLogger(__name__)


class HistorifyService:
    """
    Service layer for Historify data management.
    Handles background ingestion and local DuckDB synchronization.
    """

    def __init__(self):
        self.broadcast_callback = None
        self.history_manager = HistoryManager()
        self.order_manager = None
        self.start_time = time.time()

    def set_broadcast_callback(self, callback):
        """Injects a callback for real-time progress broadcasting."""
        self.broadcast_callback = callback

    def set_order_manager(self, order_manager):
        """Injects the order manager for native broker access."""
        self.order_manager = order_manager

    def _get_openalgo_db_path(self) -> Optional[str]:
        candidates = [
            os.getenv("OPENALGO_DB_PATH"),
            "/app/storage/symbols.db",
            "/app/db/symbols.db",
            "/home/ubuntu/trading-workspace/openalgo/db/symbols.db",
        ]
        for path in candidates:
            if path and os.path.exists(path):
                return path
        return None

    def _validate_watchlist_symbol(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        normalized_symbol = str(symbol or "").strip().upper()
        normalized_exchange = str(exchange or "NSE").strip().upper()

        if not normalized_symbol:
            return {"status": "error", "message": "Symbol is required."}

        if normalized_symbol in hdb.KNOWN_INVALID_WATCHLIST_SYMBOLS:
            return {
                "status": "error",
                "message": f"Symbol {normalized_symbol} is blocked for Historify in this environment."
            }

        db_path = self._get_openalgo_db_path()
        if db_path:
            try:
                conn = sqlite3.connect(db_path)
                row = conn.execute(
                    """
                    SELECT symbol
                    FROM symtoken
                    WHERE UPPER(symbol) = ? AND UPPER(exchange) = ?
                    LIMIT 1
                    """,
                    (normalized_symbol, normalized_exchange),
                ).fetchone()
                conn.close()
                if row:
                    return {"status": "success", "symbol": normalized_symbol, "exchange": normalized_exchange}
                return {
                    "status": "error",
                    "message": f"Symbol {normalized_symbol} is not present in the OpenAlgo master contract for {normalized_exchange}."
                }
            except Exception as e:
                logger.warning(f"Historify symbol validation via master contract failed: {e}")

        # Phase 6: OpenAlgo quote validation is decommissioned.
        # We rely on local contract master or just attempt the fetch.
        logger.warning(f"Historify: Skipping legacy quote validation for {normalized_symbol}")
        return {"status": "success", "symbol": normalized_symbol, "exchange": normalized_exchange}

    def _normalize_interval(self, interval: str) -> str:
        """Standardizes interval names to OpenAlgo/DuckDB storage format (1m, 5m, 1h, D)."""
        if interval is None:
            return None
        if not interval:
            return "5m"

        s = str(interval).lower()
        interval_map = {
            "1": "1m", "1m": "1m", "1minute": "1m", "min": "1m", "minute": "1m",
            "3": "3m", "3m": "3m", "3minute": "3m",
            "5": "5m", "5m": "5m", "5minute": "5m",
            "10": "10m", "10m": "10m", "10minute": "10m",
            "15": "15m", "15m": "15m", "15minute": "15m",
            "30": "30m", "30m": "30m", "30minute": "30m",
            "45": "45m", "45m": "45m", "45minute": "45m",
            "60": "1h", "1h": "1h", "1hour": "1h", "60m": "1h",
            "120": "2h", "2h": "2h", "2hour": "2h",
            "180": "3h", "3h": "3h", "3hour": "3h",
            "d": "D", "1d": "D", "day": "D", "daily": "D"
        }
        return interval_map.get(s, s)

    def _normalize_date(self, date_str: str) -> str:
        """Ensures date is in YYYY-MM-DD format for OpenAlgo compatibility."""
        if not date_str:
            return datetime.now().strftime("%Y-%m-%d")
        try:
            # Standardize using pandas then format
            import pandas as pd
            dt = pd.to_datetime(date_str)
            return dt.strftime("%Y-%m-%d")
        except:
            return date_str

    def _map_to_api_interval(self, normalized_interval: str) -> str:
        """Maps normalized storage intervals to the canonical OpenAlgo history API format."""
        # OpenAlgo's current history endpoint expects canonical strings like
        # `1m`, `5m`, `1h`, and `D` rather than legacy numeric aliases.
        return normalized_interval

    def reconcile_jobs(self, timeout_minutes: int = 15):
        """Service-level trigger to clean up stale ingestion jobs."""
        try:
            logger.info(f"Historify Service: Running job reconciliation (timeout={timeout_minutes}m)...")
            hdb.cleanup_stale_jobs(timeout_minutes=timeout_minutes)
        except Exception as e:
            logger.error(f"Historify Service: Job reconciliation failed: {e}")

    def trigger_download(
        self,
        symbols: List[str],
        exchange: str,
        interval: str,
        from_date: str,
        to_date: str,
        is_incremental: bool = False,
        operator: str = "System"
    ) -> Dict[str, Any]:
        """
        Trigger a background download job inside the engine for one or more symbols.
        Uses standard OpenAlgo history endpoint for data retrieval.
        When is_incremental=True, overrides from_date per-symbol using last stored timestamp.
        """
        if isinstance(symbols, str):
            symbols = [symbols]

        normalized_interval = self._normalize_interval(interval)
        normalized_from = self._normalize_date(from_date)
        normalized_to = self._normalize_date(to_date)

        # Ensure name is URL safe for job IDs
        # For bulk, we use the first symbol as a prefix
        prefix = symbols[0].split(":")[-1].replace(" ", "_").upper() if symbols else "BULK"
        job_id = f"JOB_{prefix}_{normalized_interval.upper()}_{str(uuid.uuid4())[:4].upper()}"

        logger.info(f"Triggering Historify download for {len(symbols)} symbols ({normalized_from} to {normalized_to}) interval={normalized_interval} incremental={is_incremental} JobID={job_id}")

        # Create job record
        hdb.upsert_job(job_id, "RUNNING", total_symbols=len(symbols), completed_symbols=0, operator=operator, interval=normalized_interval, start_date=normalized_from, end_date=normalized_to)

        # Spawn background process
        thread = threading.Thread(
            target=self._run_ingestion_job,
            args=(job_id, symbols, exchange, interval, from_date, to_date),
            kwargs={"is_incremental": is_incremental, "operator": operator}
        )
        thread.daemon = True
        thread.start()

        return {
            "status": "success",
            "job_id": job_id,
            "message": f"Historical ingestion for {len(symbols)} symbols started (ID: {job_id})"
        }

    def _run_ingestion_job(self, job_id, symbols, exchange, interval, from_date, to_date, is_incremental=False, operator="System"):
        """Worker function for background ingestion."""
        import asyncio
        loop = None
        try:
            # Try to get existing loop for broadcasting if needed
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                pass

            total = len(symbols)
            completed = 0

            logger.info(f"Starting background ingestion task {job_id} for {total} symbols (incremental={is_incremental}) by {operator}...")

            # Initial job record creation
            hdb.upsert_job(job_id, "RUNNING", total_symbols=total, completed_symbols=0, operator=operator, interval=interval, start_date=from_date, end_date=to_date)

            for symbol in symbols:
                current_exchange = exchange
                current_symbol = symbol

                # Support EXCHANGE:SYMBOL format
                if ":" in symbol:
                    current_exchange, current_symbol = symbol.split(":", 1)

                # If incremental, override from_date with last stored timestamp
                effective_from = from_date
                if is_incremental:
                    last_ts = hdb.get_last_timestamp(current_symbol, current_exchange, interval)
                    if last_ts:
                        from datetime import datetime as dt
                        effective_from = dt.fromtimestamp(last_ts).strftime("%Y-%m-%d")
                        logger.info(f"Incremental: {current_symbol} resuming from {effective_from}")

                try:
                    # Map standardized interval (e.g. '1m') to API expected format (e.g. '1')
                    api_interval = self._map_to_api_interval(interval)

                    # Ensure dates are in YYYY-MM-DD for OpenAlgo
                    api_start = self._normalize_date(effective_from)
                    api_end = self._normalize_date(to_date)

                    logger.info(f"Historify Request: {current_symbol} | {api_interval} | {api_start} -> {api_end}")

                    # Phase 6: AetherBridge Native First, then yfinance fallback.
                    data_list = []
                    provider = "NONE"

                    # 1. Native Broker (Shoonya)
                    if self.order_manager and self.order_manager.native_broker:
                        try:
                            logger.info(f"Historify Triggered (Native: {self.order_manager.native_broker.broker_id}) for {current_symbol}")
                            # Need to handle async call from thread
                            from datetime import datetime as dt_class
                            start_dt = dt_class.strptime(api_start, "%Y-%m-%d")
                            end_dt = dt_class.strptime(api_end, "%Y-%m-%d")

                            # Bridging async to sync in thread
                            import asyncio
                            native_candles = asyncio.run(self.order_manager.native_broker.get_historical_candles(
                                symbol=current_symbol,
                                exchange=current_exchange,
                                interval=interval,
                                start_time=start_dt,
                                end_time=end_dt
                            ))

                            if native_candles:
                                data_list = native_candles
                                provider = f"Native:{self.order_manager.native_broker.broker_id}"
                                logger.info(f"Historify Native SUCCESS: {current_symbol} | Records: {len(data_list)}")
                        except Exception as ne:
                            logger.error(f"Historify Native FAILED for {current_symbol}: {ne}")

                    # 2. yfinance Fallback
                    if not data_list:
                        logger.info(f"Historify Triggered (yfinance) for {current_symbol}")
                        data_list = self.history_manager._fetch_from_yfinance(
                            current_symbol,
                            interval=interval,
                            start=api_start,
                            end=api_end
                        )
                        if data_list:
                            logger.info(f"Historify Fallback SUCCESS: {current_symbol} | Records: {len(data_list)}")
                            provider = "YahooFinance"
                        else:
                            logger.error(f"Historify Fallback FAILED for {current_symbol}")
                            provider = "FAILED"

                    if data_list:
                        # Convert to DataFrame
                        df = pd.DataFrame(data_list)

                        # Standard OpenAlgo date mapping to epoch
                        if 'timestamp' not in df.columns:
                            if 'datetime' in df.columns:
                                df['timestamp'] = pd.to_datetime(df['datetime']).astype('int64') // 10**9
                            elif 'date' in df.columns:
                                df['timestamp'] = pd.to_datetime(df['date']).astype('int64') // 10**9

                        # Save to DuckDB
                        inserted = hdb.upsert_market_data(df, current_symbol, current_exchange, interval)
                        if inserted > 0:
                            logger.info(f"Historify Upsert Complete: {current_symbol} | Rows: {inserted}")
                        else:
                            logger.error(f"Historify Upsert Failed: {current_symbol} | No rows persisted")
                    else:
                        logger.warning(f"Historify: No data available for {current_symbol} after all providers attempted.")

                    completed += 1
                    # Update progress in DB
                    hdb.upsert_job(job_id, "RUNNING", total_symbols=total, completed_symbols=completed, last_symbol=current_symbol, last_provider=provider, operator=operator, interval=interval, start_date=from_date, end_date=to_date)

                    # Broadcast progress through injected callback
                    if self.broadcast_callback:
                        progress_data = {
                            "job_id": job_id,
                            "total": total,
                            "completed": completed,
                            "percent": round((completed / total) * 100, 1),
                            "last_symbol": current_symbol,
                            "last_provider": provider,
                            "operator": operator
                        }

                        # Handle async callback from thread
                        if asyncio.iscoroutinefunction(self.broadcast_callback):
                            if loop and loop.is_running():
                                asyncio.run_coroutine_threadsafe(
                                    self.broadcast_callback("historify_progress", progress_data),
                                    loop
                                )
                        else:
                            self.broadcast_callback("historify_progress", progress_data)

                except Exception as e:
                    logger.error(f"Error ingesting {symbol} in job {job_id}: {e}")
                    # Continue with next symbol
                    completed += 1

            logger.info(f"Ingestion {job_id} task finished. {completed}/{total} symbols processed.")
            hdb.upsert_job(job_id, "COMPLETED", total_symbols=total, completed_symbols=completed, interval=interval, start_date=from_date, end_date=to_date)

            # Final event — broadcast BOTH event names for frontend compatibility
            if self.broadcast_callback:
                final_data = {"job_id": job_id, "status": "COMPLETED", "total": total, "completed": completed}
                if asyncio.iscoroutinefunction(self.broadcast_callback) and loop and loop.is_running():
                    asyncio.run_coroutine_threadsafe(self.broadcast_callback("historify_completed", final_data), loop)
                    asyncio.run_coroutine_threadsafe(self.broadcast_callback("historify_job_complete", final_data), loop)
                elif not asyncio.iscoroutinefunction(self.broadcast_callback):
                    self.broadcast_callback("historify_completed", final_data)
                    self.broadcast_callback("historify_job_complete", final_data)

        except Exception as e:
            logger.error(f"Critical Ingestion Error {job_id}: {e}", exc_info=True)
            hdb.upsert_job(job_id, "FAILED", total_symbols=len(symbols), completed_symbols=0, error_message=str(e), interval=interval, start_date=from_date, end_date=to_date)

            # Broadcast failure event
            if self.broadcast_callback:
                fail_data = {"job_id": job_id, "status": "FAILED", "error": str(e)}
                if asyncio.iscoroutinefunction(self.broadcast_callback) and loop and loop.is_running():
                    asyncio.run_coroutine_threadsafe(self.broadcast_callback("historify_job_failed", fail_data), loop)
                elif not asyncio.iscoroutinefunction(self.broadcast_callback):
                    self.broadcast_callback("historify_job_failed", fail_data)

    def get_all_jobs(self) -> List[Dict[str, Any]]:
        """Fetch all historical ingestion jobs from local DuckDB."""
        return hdb.get_all_jobs()

    def check_and_wait_for_data(
        self,
        symbol: str,
        exchange: str,
        interval: str,
        from_date: str,
        to_date: str,
        timeout_seconds: int = 300
    ) -> bool:
        """
        Checks if data is available for a given range.
        If not, triggers a download and waits for it to complete.
        Used by BacktestEngine for Auto-Sync.
        """
        # 1. Trigger download
        res = self.trigger_download(symbol, exchange, interval, from_date, to_date)
        if res.get("status") == "error":
            logger.error(f"Failed to trigger Historify download: {res.get('message')}")
            return False

        job_id = res.get("job_id")
        if not job_id:
            return True

        # 2. Poll for completion
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            job = hdb.get_job(job_id)
            if not job:
                time.sleep(2)
                continue

            status = job.get("status", "").upper()
            if status == "COMPLETED":
                return True
            elif status in ["FAILED", "ERROR"]:
                logger.error(f"Historify job {job_id} failed: {job.get('error_message')}")
                return False

            time.sleep(2)

        logger.error(f"Historify job {job_id} timed out after {timeout_seconds}s.")
        return False

    def get_watchlist(self) -> List[Dict[str, Any]]:
        """Fetch watchlist from local DuckDB."""
        return hdb.get_watchlist()

    def get_schedules(self) -> List[Dict[str, Any]]:
        """Fetch active ingestion schedules."""
        # Current scheduler implementation is a single background thread
        # In a more complex system, this would query a database of Cron jobs
        return [
            {
                "id": "INGESTION_SCHEDULER_CORE",
                "name": "Global 30m Ingestion",
                "intervals": ["1m", "5m"],
                "frequency": "1800s",
                "status": "active",
                "last_run": datetime.now().strftime("%Y-%m-%d %H:%M:%S") # Mock for now
            }
        ]

    def add_to_watchlist(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """Add symbol to local DuckDB watchlist."""
        try:
            validation = self._validate_watchlist_symbol(symbol, exchange)
            if validation.get("status") != "success":
                return validation

            normalized_symbol = validation["symbol"]
            normalized_exchange = validation["exchange"]
            hdb.add_to_watchlist(normalized_symbol, normalized_exchange)
            return {"status": "success", "message": f"Symbol {normalized_symbol} added to watchlist."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def bulk_add_to_watchlist(self, symbols: List[str], exchange: str = "NSE") -> Dict[str, Any]:
        """Add multiple symbols to local DuckDB watchlist."""
        added = []
        errors = []
        for symbol in symbols:
            res = self.add_to_watchlist(symbol, exchange)
            if res.get("status") == "success":
                added.append(symbol)
            else:
                errors.append({"symbol": symbol, "message": res.get("message")})

        return {
            "status": "success" if added else "error",
            "message": f"Added {len(added)} symbols. {len(errors)} errors.",
            "added": added,
            "errors": errors
        }

    def remove_from_watchlist(self, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """Remove symbol from local DuckDB watchlist."""
        try:
            hdb.remove_from_watchlist(symbol, exchange)
            return {"status": "success", "message": f"Symbol {symbol} removed from watchlist."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def bulk_remove_from_watchlist(self, symbols: List[str], exchange: str = None) -> Dict[str, Any]:
        """Remove multiple symbols from local DuckDB watchlist."""
        removed = []
        for symbol in symbols:
            res = self.remove_from_watchlist(symbol, exchange)
            if res.get("status") == "success":
                removed.append(symbol)

        return {
            "status": "success",
            "message": f"Removed {len(removed)} symbols.",
            "removed": removed
        }

    def get_catalog(self, interval: Optional[str] = "5m") -> List[Dict[str, Any]]:
        """Fetch the list of stored symbols and record counts from DuckDB."""
        normalized_interval = self._normalize_interval(interval) if interval else None
        return hdb.list_ohlcv_catalog(normalized_interval)

    def delete_catalog_entry(self, symbol: str, exchange: str = "NSE", interval: str = "5m") -> Dict[str, Any]:
        """Delete historical candles for a specific symbol/exchange/interval from DuckDB."""
        try:
            normalized_interval = self._normalize_interval(interval)
            hdb.delete_catalog_entry(symbol, exchange, normalized_interval)
            return {"status": "success", "message": f"Historical data for {symbol} ({interval}) deleted."}
        except Exception as e:
            logger.error(f"Failed to delete catalog entry: {e}")
            return {"status": "error", "message": str(e)}

    def seed_and_ingest(self, intervals: List[str] = ["5m", "D"]) -> Dict[str, Any]:
        """Seeds the watchlist and triggers an immediate ingestion for seeded symbols."""
        try:
            # 1. Ensure seeded in DB
            hdb.seed_default_watchlist()

            # 2. Get current watchlist
            watchlist = self.get_watchlist()
            if not watchlist:
                return {"status": "error", "message": "Failed to seed or watchlist is still empty."}

            # 3. Trigger ingestion for each symbol/interval
            symbols = [f"{item['exchange']}:{item['symbol']}" for item in watchlist]

            # Use 3 days of historical data for the seed catch-up
            from_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
            to_date = datetime.now().strftime("%Y-%m-%d")

            results = []
            for interval in intervals:
                res = self.trigger_download(
                    symbols=symbols,
                    exchange="NSE", # Default fallback
                    interval=interval,
                    from_date=from_date,
                    to_date=to_date,
                    is_incremental=False
                )
                results.append(res)

            return {
                "status": "success",
                "message": f"Seeding complete. {len(intervals)} ingestion jobs triggered for {len(symbols)} symbols.",
                "jobs": [r.get("job_id") for r in results]
            }
        except Exception as e:
            logger.error(f"Historify: Seed and ingest failed: {e}")
            return {"status": "error", "message": str(e)}

    def get_stats(self) -> Dict[str, Any]:
        """Fetch database statistics with enhanced service metadata."""
        stats = hdb.get_db_stats()
        stats["uptime_seconds"] = int(time.time() - self.start_time)
        return stats

    def compact_db(self) -> Dict[str, Any]:
        """Triggers a manual CHECKPOINT and VACUUM on DuckDB."""
        return hdb.compact_database()

    def purge_old_data(self, days: int = 30) -> Dict[str, Any]:
        """Enforces retention policy by deleting records older than X days."""
        try:
            hdb.enforce_retention_policy(max_days=days)
            return {"status": "success", "message": f"Data older than {days} days purged."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_records(
        self,
        symbol: str,
        exchange: str = "NSE",
        interval: str = "5m",
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Fetch historical OHLCV records from DuckDB."""
        normalized_interval = self._normalize_interval(interval)
        return hdb.get_ohlcv_data(symbol=symbol, exchange=exchange, interval=normalized_interval, limit=limit)

    def get_records_csv(self, symbol: str, exchange: str = "NSE", interval: str = "5m", limit: int = 100000) -> str:
        """Fetch historical records and return as CSV string with readable dates."""
        import io
        import csv
        from datetime import datetime as dt

        records = self.get_records(symbol, exchange, interval, limit)
        if not records:
            return "datetime,timestamp,open,high,low,close,volume,oi\n"

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["datetime", "timestamp", "open", "high", "low", "close", "volume", "oi"])
        writer.writeheader()

        for r in records:
            row = {
                "datetime": dt.fromtimestamp(r["time"]).strftime('%Y-%m-%d %H:%M:%S'),
                "timestamp": r["time"],
                "open": r["open"],
                "high": r["high"],
                "low": r["low"],
                "close": r["close"],
                "volume": r["volume"],
                "oi": r["oi"]
            }
            writer.writerow(row)

        return output.getvalue()


    def get_breadth(self, interval: str = "5m") -> Dict[str, Any]:
        """Fetch market breadth metrics from DuckDB."""
        normalized_interval = self._normalize_interval(interval)
        return hdb.get_market_breadth(normalized_interval)

    def trigger_scheduled_ingestion(self, intervals: List[str] = ["1m", "5m"], symbols: Optional[List[str]] = None):
        """
        Coordinates incremental updates for all symbols in the watchlist.
        Used by IngestionScheduler and main engine loop.
        """
        if symbols:
            # Manually provided symbols
            watchlist = [{"symbol": s, "exchange": "NSE"} for s in symbols]
        else:
            # DuckDB stored watchlist
            watchlist = self.get_watchlist()

        if not watchlist:
            logger.info("Historify: No symbols provided or found in watchlist. Skipping scheduled ingestion.")
            return

        logger.info(f"Historify: Starting scheduled ingestion for {len(watchlist)} symbols across {intervals} intervals.")

        for item in watchlist:
            symbol = item.get("symbol")
            exchange = item.get("exchange", "NSE")

            for interval in intervals:
                try:
                    # 1. Get last stored timestamp
                    last_ts = hdb.get_last_timestamp(symbol, exchange, interval)

                    # 2. Determine range (last stored to now)
                    # If nothing stored, start from 3 days ago by default
                    if last_ts:
                        from_date = datetime.fromtimestamp(last_ts).strftime("%Y-%m-%d")
                    else:
                        from_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")

                    to_date = datetime.now().strftime("%Y-%m-%d")

                    # 3. Trigger background download
                    # We don't wait for completion here as this is scheduled
                    self.trigger_download(
                        symbols=[symbol],
                        exchange=exchange,
                        interval=interval,
                        from_date=from_date,
                        to_date=to_date
                    )
                except Exception as e:
                    logger.error(f"Historify: Failed to schedule ingestion for {symbol} ({interval}): {e}")


# Singleton
historify_service = HistorifyService()
