import sqlite3
import numpy as np
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import os
import json
import asyncio
from database.timescale_logger import get_timescale_logger

logger = logging.getLogger(__name__)

# Default to /app/storage/ in production (Docker volume), fall back to local database/ in workspace
DEFAULT_DB_PATH = "/app/storage/trades.db"
DB_FILE = os.getenv("TRADES_DB_PATH", DEFAULT_DB_PATH)

# Ensure the directory exists or fallback to script directory
db_dir = os.path.dirname(DB_FILE)
if not db_dir or not os.path.exists(db_dir):
    try:
        os.makedirs(db_dir, exist_ok=True)
    except Exception:
        # Fallback to local workspace if we can't create the primary path
        DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trades.db")

@dataclass
class Trade:
    """Represents a single trade execution."""
    id: Optional[int] = None
    timestamp: str = ""
    strategy: str = ""
    symbol: str = ""
    side: str = ""  # BUY or SELL
    quantity: int = 0
    price: float = 0.0
    status: str = "filled"  # filled, pending, rejected
    order_id: Optional[str] = None
    pnl: Optional[float] = None
    charges: Optional[float] = 0.0
    mode: str = "sandbox"
    ai_reasoning: Optional[str] = None
    conviction: Optional[float] = None
    created_at: Optional[str] = None

    def to_dict(self):
        return asdict(self)


class TradeLogger:
    """Manages trade logging and retrieval from SQLite."""

    def __init__(self, db_file: str = DB_FILE):
        self.db_file = db_file
        self.init_db()

    def init_db(self):
        """Initialize database schema."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            # Enable WAL mode for high-concurrency support
            cursor.execute("PRAGMA journal_mode=WAL;")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                strategy TEXT NOT NULL,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                status TEXT DEFAULT 'filled',
                order_id TEXT,
                pnl REAL,
                charges REAL DEFAULT 0.0,
                mode TEXT DEFAULT 'sandbox',
                ai_reasoning TEXT,
                conviction REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS risk_settings (
                key TEXT PRIMARY KEY,
                value REAL NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("PRAGMA table_info(trades)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'mode' not in columns:
                cursor.execute("ALTER TABLE trades ADD COLUMN mode TEXT DEFAULT 'sandbox'")
            if 'charges' not in columns:
                cursor.execute("ALTER TABLE trades ADD COLUMN charges REAL DEFAULT 0.0")
            if 'ai_reasoning' not in columns:
                cursor.execute("ALTER TABLE trades ADD COLUMN ai_reasoning TEXT")
            if 'conviction' not in columns:
                cursor.execute("ALTER TABLE trades ADD COLUMN conviction REAL")

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbol_timestamp ON trades(symbol, timestamp DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_strategy ON trades(strategy, timestamp DESC)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                symbol TEXT NOT NULL,
                condition TEXT NOT NULL,
                value REAL NOT NULL,
                channel TEXT DEFAULT 'telegram',
                is_active INTEGER DEFAULT 1,
                message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_type TEXT NOT NULL,
                request_data TEXT,
                response_data TEXT,
                strategy TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                strategy TEXT NOT NULL,
                api_type TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                action TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL,
                price_type TEXT NOT NULL,
                product_type TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                rejection_reason TEXT,
                raw_order_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS strategy_safeguards (
                strategy_id TEXT PRIMARY KEY,
                max_drawdown_pct REAL DEFAULT 15.0,
                max_loss_inr REAL DEFAULT 0.0,
                is_armed INTEGER DEFAULT 1,
                last_breach_at TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS strategy_personality (
                strategy_id TEXT PRIMARY KEY,
                confidence_score REAL DEFAULT 0.5,
                regime_preference TEXT,
                learning_rate REAL DEFAULT 0.01,
                total_profit_factor REAL DEFAULT 1.0,
                last_failure_reason TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS backtest_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                strategy_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                days INTEGER NOT NULL,
                interval TEXT NOT NULL,
                metrics TEXT NOT NULL,
                trades TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS decision_episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id INTEGER,
                market_regime TEXT,
                conviction_at_entry REAL,
                expected_pnl REAL,
                actual_pnl_normalized REAL,
                semantic_lessons TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(trade_id) REFERENCES trades(id)
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS drift_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                symbol TEXT NOT NULL,
                local_qty INTEGER NOT NULL,
                broker_qty INTEGER NOT NULL,
                drift_type TEXT NOT NULL,
                action_taken TEXT NOT NULL,
                snapshot_json TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

            conn.commit()
            conn.close()
            logger.info(f"Trade database initialized at {self.db_file}")
        except Exception as e:
            logger.error(f"Error initializing trade database: {e}", exc_info=True)

    async def log_trade(self, strategy, symbol, side, quantity, price, status="filled", order_id=None, pnl=None, charges=0.0, mode="sandbox", ai_reasoning=None, conviction=None):
        try:
            timestamp = datetime.utcnow().isoformat()

            def _sqlite_log():
                conn = sqlite3.connect(self.db_file)
                cursor = conn.cursor()
                cursor.execute("""
                INSERT INTO trades (timestamp, strategy, symbol, side, quantity, price, status, order_id, pnl, charges, mode, ai_reasoning, conviction)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, strategy, symbol, side.upper(), quantity, price, status, order_id, pnl, charges, mode, ai_reasoning, conviction))
                conn.commit()
                tid = cursor.lastrowid
                conn.close()
                return tid

            # Run SQLite insert in a thread to keep the event loop free
            trade_id = await asyncio.to_thread(_sqlite_log)

            # Sync to TimescaleDB
            try:
                from database.timescale_logger import get_timescale_logger
                ts_logger = await get_timescale_logger()
                await ts_logger.log_trade(
                    trade_id=trade_id,
                    strategy_id=strategy,
                    symbol=symbol,
                    side=side.upper(),
                    quantity=quantity,
                    price=price,
                    charges=charges,
                    pnl=pnl or 0.0,
                    mode=mode
                )
            except Exception as ts_err:
                logger.warning(f"Failed to sync trade to TimescaleDB: {ts_err}")

            return trade_id
        except Exception as e:
            logger.error(f"Error logging trade: {e}")
            return None

    async def log_drift_event(self, symbol: str, local_qty: int, broker_qty: int, drift_type: str, action: str, snapshot: Dict[str, Any]):
        """Logs a state reconciliation drift event for institutional audit."""
        try:
            timestamp = datetime.utcnow().isoformat()

            def _sqlite_log():
                conn = sqlite3.connect(self.db_file)
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO drift_events (timestamp, symbol, local_qty, broker_qty, drift_type, action_taken, snapshot_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (timestamp, symbol, local_qty, broker_qty, drift_type, action, json.dumps(snapshot)))
                conn.commit()
                conn.close()

            await asyncio.to_thread(_sqlite_log)
            logger.warning(f"DRIFT_AUDIT: {symbol} | Local: {local_qty} | Broker: {broker_qty} | Action: {action}")
        except Exception as e:
            logger.error(f"Failed to log drift event: {e}")

    def rotate_logs(self, max_days: int = 30):
        """SQLite trade log rotation: keeps only the last N days of api_logs and trades to prevent bloat."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            # Rotate api_logs
            cursor.execute(
                "DELETE FROM api_logs WHERE created_at < datetime('now', ?)",
                (f'-{max_days} days',)
            )
            api_logs_deleted = cursor.rowcount

            # Rotate pending or completed action queue
            cursor.execute(
                "DELETE FROM action_queue WHERE created_at < datetime('now', ?)",
                (f'-{max_days} days',)
            )
            queue_deleted = cursor.rowcount

            # Rotate trades (optional, if we want to keep them all in Timescale and not SQLite)
            # cursor.execute(
            #     "DELETE FROM trades WHERE created_at < datetime('now', ?)",
            #     (f'-{max_days} days',)
            # )
            # trades_deleted = cursor.rowcount

            conn.commit()
            cursor.execute("VACUUM")
            conn.close()

            logger.info(f"Log Rotation Complete: Removed {api_logs_deleted} old api_logs, {queue_deleted} old queue entries.")
        except Exception as e:
            logger.error(f"Error during SQLite log rotation: {e}")

    async def log_signal(self, strategy_id: str, symbol: str, signal_type: str, price: float, indicators: Dict[str, Any] = {}, ai_reasoning: str = "", conviction: float = 0.0):
        """Audit strategy decision signals in TimescaleDB."""
        try:
            ts_logger = await get_timescale_logger()
            await ts_logger.log_signal(
                strategy_id=strategy_id,
                symbol=symbol,
                signal_type=signal_type,
                price=price,
                indicators=indicators,
                ai_reasoning=ai_reasoning or "",
                conviction=conviction
            )
        except Exception as e:
            logger.warning(f"Failed to log signal to TimescaleDB: {e}")

    def get_all_trades(self, limit=100):
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            return [Trade(**dict(row)) for row in rows]
        except: return []

    async def get_all_trades_async(self, limit=100):
        return await asyncio.to_thread(self.get_all_trades, limit)

    def get_strategy_metrics(self, strategy: str) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT pnl, charges FROM trades WHERE strategy = ? AND status = 'filled' AND pnl IS NOT NULL ORDER BY timestamp ASC", (strategy,))
            rows = cursor.fetchall()
            conn.close()
            if not rows: return {"total_trades": 0, "net_pnl": 0.0}

            pnls = np.array([row['pnl'] for row in rows])
            charges = np.array([row['charges'] or 0.0 for row in rows])
            net_pnls = pnls - charges

            wins = net_pnls[net_pnls > 0]
            win_rate = (len(wins) / len(net_pnls)) * 100
            return {
                "win_rate": round(win_rate, 1),
                "total_trades": len(net_pnls),
                "gross_pnl": round(float(np.sum(pnls)), 2),
                "total_charges": round(float(np.sum(charges)), 2),
                "net_pnl": round(float(np.sum(net_pnls)), 2)
            }
        except Exception as e: return {"error": str(e)}

    async def get_strategy_metrics_async(self, strategy: str) -> Dict[str, Any]:
        return await asyncio.to_thread(self.get_strategy_metrics, strategy)

    def get_system_settings(self) -> Dict[str, str]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_settings")
            rows = cursor.fetchall()
            conn.close()
            return {row[0]: row[1] for row in rows}
        except: return {}

    def update_system_setting(self, key: str, value: str) -> bool:
        """Persist a system-level setting (key/value) into system_settings table."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            now = datetime.utcnow().isoformat()
            cursor.execute("""
                INSERT INTO system_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """, (key, str(value), now))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error updating system setting {key}: {e}")
            return False

    def get_risk_settings(self) -> Dict[str, Any]:
        """Fetch all risk limits from the database."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM risk_settings")
            rows = cursor.fetchall()
            conn.close()
            return {row[0]: row[1] for row in rows}
        except Exception as e:
            logger.error(f"Error fetching risk settings: {e}")
            return {}

    def update_risk_setting(self, key: str, value: Any):
        """Persist a specific risk limit to the database."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            now = datetime.utcnow().isoformat()
            cursor.execute("""
                INSERT OR REPLACE INTO risk_settings (key, value, updated_at)
                VALUES (?, ?, ?)
            """, (key, float(value), now))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error updating risk setting {key}: {e}")

    def get_trades_by_symbol(self, symbol: str, limit: int = 50) -> List[Trade]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE symbol = ? ORDER BY timestamp DESC LIMIT ?", (symbol, limit))
            rows = cursor.fetchall()
            conn.close()
            return [Trade(**dict(row)) for row in rows]
        except: return []

    def get_trades_by_strategy(self, strategy: str, limit: int = 100) -> List[Trade]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM trades"
            params = []
            if strategy != "all":
                query += " WHERE strategy = ?"
                params.append(strategy)
            query += " ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            return [Trade(**dict(row)) for row in rows]
        except: return []

    def get_daily_charges(self) -> float:
        """Sum charges for all trades executed today."""
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            today = datetime.utcnow().strftime('%Y-%m-%d')
            cursor.execute("SELECT SUM(charges) FROM trades WHERE timestamp LIKE ? AND status = 'filled'", (f"{today}%",))
            res = cursor.fetchone()
            conn.close()
            return round(float(res[0] or 0.0), 2)
        except Exception as e:
            logger.error(f"Error getting daily charges: {e}")
            return 0.0

    def get_symbol_pnl(self, symbol: str) -> Dict[str, float]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT SUM(pnl) FROM trades WHERE symbol = ? AND pnl IS NOT NULL", (symbol,))
            pnl = cursor.fetchone()[0] or 0.0
            conn.close()
            return {"symbol": symbol, "pnl": round(float(pnl), 2)}
        except: return {"symbol": symbol, "pnl": 0.0}

    def get_strategy_pnl(self, strategy: str) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            query = "SELECT SUM(pnl), COUNT(*) FROM trades WHERE pnl IS NOT NULL"
            params = []
            if strategy != "all":
                query += " AND strategy = ?"
                params.append(strategy)
            cursor.execute(query, params)
            row = cursor.fetchone()
            pnl = row[0] or 0.0
            count = row[1] or 0
            conn.close()
            return {"strategy": strategy, "pnl": round(float(pnl), 2), "trade_count": count}
        except: return {"strategy": strategy, "pnl": 0.0, "trade_count": 0}

    def get_open_positions(self) -> Dict[str, int]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            # Group by symbol and sum quantity (Buy+, Sell-)
            cursor.execute("""
                SELECT symbol, SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as net_qty
                FROM trades
                WHERE status = 'filled'
                GROUP BY symbol
                HAVING net_qty != 0
            """)
            rows = cursor.fetchall()
            conn.close()
            return {row[0]: row[1] for row in rows}
        except: return {}

    def reconcile_positions(self, symbol: str, target_qty: int, strategy: str = "System"):
        """Aligns local engine state with broker target_qty by injecting a correction trade."""
        try:
            current_qty = self.get_open_positions().get(symbol, 0)
            diff = target_qty - current_qty
            if diff == 0:
                logger.info(f"Symbol {symbol} already in sync at {target_qty}.")
                return True

            side = "BUY" if diff > 0 else "SELL"
            abs_qty = abs(diff)

            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            timestamp = datetime.utcnow().isoformat()
            cursor.execute("""
                INSERT INTO trades (timestamp, strategy, symbol, side, quantity, price, status, mode, ai_reasoning)
                VALUES (?, ?, ?, ?, ?, ?, 'filled', 'live', ?)
            """, (timestamp, strategy, symbol, side, abs_qty, 0.0, f"Auto-reconciliation to match broker qty: {target_qty}"))
            conn.commit()
            tid = cursor.lastrowid
            conn.close()
            logger.info(f"Reconciled {symbol}: current={current_qty}, target={target_qty}, injected_{side}={abs_qty} (ID: {tid})")
            return True
        except Exception as e:
            logger.error(f"Error reconciling positions for {symbol}: {e}")
            return False

    def reset_positions(self, symbol: str = None):
        """Clears positions by injecting offsetting trades (sets net to 0)."""
        if symbol:
            return self.reconcile_positions(symbol, 0, "System_Reset")
        else:
            positions = self.get_open_positions()
            success = True
            for sym in positions:
                if not self.reconcile_positions(sym, 0, "System_Reset"):
                    success = False
            return success

    async def reconcile_positions_async(self, symbol: str, target_qty: int, strategy: str = "System"):
        return await asyncio.to_thread(self.reconcile_positions, symbol, target_qty, strategy)

    async def reset_positions_async(self, symbol: str = None):
        return await asyncio.to_thread(self.reset_positions, symbol)

    # Cognitive Memory System (L4/L5)
    def get_strategy_personality(self, strategy_id: str) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM strategy_personality WHERE strategy_id = ?", (strategy_id,))
            row = cursor.fetchone()
            conn.close()
            if row: return dict(row)
            return {"strategy_id": strategy_id, "confidence_score": 0.5, "regime_preference": "UNKNOWN"}
        except: return {}

    def update_strategy_personality(self, strategy_id: str, updates: Dict[str, Any]):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            now = datetime.utcnow().isoformat()
            # Strict whitelist of allowabled columns for dynamic query construction
            ALLOWED_COLS = {
                "confidence_score",
                "regime_preference",
                "learning_rate",
                "total_profit_factor",
                "last_failure_reason"
            }
            # Filter updates to only include allowed columns
            valid_updates = {k: v for k, v in updates.items() if k in ALLOWED_COLS}
            if not valid_updates:
                return

            # Building queries dynamically for columns requires string formatting as SQLite
            # doesn't support parameterizing identifiers. Security is ensured via ALLOWED_COLS whitelist.
            upd_str = ", ".join([f"{k} = ?" for k in valid_updates.keys()])
            params = list(valid_updates.values()) + [now, strategy_id]
            # bandit: ignore B608 (SQL injection) as column names are from a strict whitelist
            cursor.execute(f"UPDATE strategy_personality SET {upd_str}, updated_at = ? WHERE strategy_id = ?", params) # nosec

            if cursor.rowcount == 0:
                keys = ["strategy_id", "updated_at"] + list(valid_updates.keys())
                vals = [strategy_id, now] + list(valid_updates.values())
                placeholders = ", ".join(["?" for _ in vals])
                # bandit: ignore B608 (SQL injection) as column names are from a strict whitelist
                cursor.execute(f"INSERT INTO strategy_personality ({', '.join(keys)}) VALUES ({placeholders})", vals) # nosec
            conn.commit()
            conn.close()
        except Exception as e: logger.error(f"Error updating personality: {e}")

    def record_decision_episode(self, trade_id: int, episode_data: Dict[str, Any]):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO decision_episodes (trade_id, market_regime, conviction_at_entry, expected_pnl, actual_pnl_normalized, semantic_lessons)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (trade_id, episode_data.get('market_regime'), episode_data.get('conviction_at_entry'), episode_data.get('expected_pnl'), episode_data.get('actual_pnl_normalized'), episode_data.get('semantic_lessons')))
            conn.commit()
            conn.close()
        except Exception as e: logger.error(f"Error recording episode: {e}")

    def get_recent_episodes(self, strategy_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT e.*, t.strategy, t.symbol, t.side, t.price FROM decision_episodes e JOIN trades t ON e.trade_id = t.id"
            params = []
            if strategy_id:
                query += " WHERE t.strategy = ?"
                params.append(strategy_id)
            query += " ORDER BY e.created_at DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except: return []

    # --- Strategy Safeguard & Personality Management ---

    def get_strategy_safeguards(self, strategy_id: str) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM strategy_safeguards WHERE strategy_id = ?", (strategy_id,))
            row = cursor.fetchone()
            conn.close()
            if row: return dict(row)
            return {
                "strategy_id": strategy_id,
                "max_drawdown_pct": 15.0,
                "max_loss_inr": 0.0,
                "is_armed": 1
            }
        except: return {}

    def get_all_strategy_safeguards(self) -> List[Dict[str, Any]]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM strategy_safeguards")
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except: return []

    def update_strategy_safeguard(self, strategy_id: str, updates: Dict[str, Any]):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            now = datetime.utcnow().isoformat()

            ALLOWED_COLS = {"max_drawdown_pct", "max_loss_inr", "is_armed", "last_breach_at"}
            valid_updates = {k: v for k, v in updates.items() if k in ALLOWED_COLS}

            if not valid_updates: return

            upd_str = ", ".join([f"{k} = ?" for k in valid_updates.keys()])
            params = list(valid_updates.values()) + [now, strategy_id]

            cursor.execute(f"UPDATE strategy_safeguards SET {upd_str}, updated_at = ? WHERE strategy_id = ?", params)  # nosec

            if cursor.rowcount == 0:
                keys = ["strategy_id", "updated_at"] + list(valid_updates.keys())
                vals = [strategy_id, now] + list(valid_updates.values())
                placeholders = ", ".join(["?" for _ in vals])
                cursor.execute(f"INSERT INTO strategy_safeguards ({', '.join(keys)}) VALUES ({placeholders})", vals)  # nosec

            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error updating safeguard: {e}")

    def get_all_strategy_personalities(self) -> List[Dict[str, Any]]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM strategy_personality")
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except: return []

    def log_api_call(self, api_type, request_data, response_data, strategy="System"):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("INSERT INTO api_logs (api_type, request_data, response_data, strategy) VALUES (?, ?, ?, ?)",
                           (api_type, json.dumps(request_data), json.dumps(response_data), strategy))
            conn.commit()
            conn.close()
        except Exception: # nosec B110
            pass

    def get_api_logs(self, limit=50, search=""):
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM api_logs"
            params = []
            if search:
                query += " WHERE api_type LIKE ? OR strategy LIKE ? OR request_data LIKE ?"
                term = f"%{search}%"
                params = [term, term, term]
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            return [ {**dict(r), "request_data": json.loads(r["request_data"]), "response_data": json.loads(r["response_data"])} for r in rows ]
        except Exception as e:
            logger.error(f"Error fetching API logs: {e}")
            return []

    async def get_pnl_summary(self, unrealized_pnl: float = 0.0) -> Dict[str, Any]:
        """Calculates institutional-grade PnL summaries across timeframes."""
        return await asyncio.to_thread(self._get_pnl_summary_sync, unrealized_pnl)

    def _get_pnl_summary_sync(self, unrealized_pnl: float = 0.0) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            # Helper for time-based PnL
            def _get_period_pnl(days: int):
                # ISO8601 comparison
                cursor.execute("""
                    SELECT SUM(pnl), SUM(charges)
                    FROM trades
                    WHERE status = 'filled' AND pnl IS NOT NULL
                    AND timestamp >= datetime('now', ?)
                """, (f'-{days} days',))
                row = cursor.fetchone()
                return round(float(row[0] or 0.0), 2), round(float(row[1] or 0.0), 2)

            all_time_pnl, all_time_charges = _get_period_pnl(3650) # Approx 10 years
            monthly_pnl, monthly_charges = _get_period_pnl(30)
            weekly_pnl, weekly_charges = _get_period_pnl(7)
            daily_pnl, daily_charges = _get_period_pnl(1)

            # Cumulative PnL curve for charts
            cursor.execute("""
                SELECT timestamp, SUM(pnl - COALESCE(charges, 0)) OVER (ORDER BY timestamp) as cumulative_pnl
                FROM trades
                WHERE status = 'filled' AND pnl IS NOT NULL
                ORDER BY timestamp ASC
            """)
            curve = [{"time": r[0], "value": round(r[1], 2)} for r in cursor.fetchall()]

            conn.close()
            return {
                "all_time": {
                    "pnl": all_time_pnl,
                    "charges": all_time_charges,
                    "net": round(all_time_pnl - all_time_charges + unrealized_pnl, 2),
                    "unrealized": unrealized_pnl
                },
                "monthly": {"pnl": monthly_pnl, "charges": monthly_charges, "net": round(monthly_pnl - monthly_charges + unrealized_pnl, 2)},
                "weekly": {"pnl": weekly_pnl, "charges": weekly_charges, "net": round(weekly_pnl - weekly_charges + unrealized_pnl, 2)},
                "daily": {"pnl": daily_pnl, "charges": daily_charges, "net": round(daily_pnl - daily_charges + unrealized_pnl, 2)},
                "equity_curve": curve
            }
        except Exception as e:
            logger.error(f"Error generating PnL summary: {e}")
            return {"error": str(e)}

    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Calculates risk ratios (Sharpe, Sortino, Drawdown)."""
        return await asyncio.to_thread(self._get_performance_metrics_sync)

    def _get_performance_metrics_sync(self) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT pnl - COALESCE(charges, 0)
                FROM trades
                WHERE status = 'filled' AND pnl IS NOT NULL
                ORDER BY timestamp ASC
            """)
            returns = [r[0] for r in cursor.fetchall()]
            conn.close()

            if not returns:
                return {"sharpe": 0.0, "sortino": 0.0, "max_drawdown": 0.0, "profit_factor": 0.0}

            returns = np.array(returns)

            # Simple daily/per-trade risk metrics
            mean_ret = np.mean(returns)
            std_ret = np.std(returns)

            # 1. Sharpe Ratio (assuming risk-free = 0 for simplicity, non-annualized)
            sharpe = (mean_ret / std_ret) * np.sqrt(252) if std_ret > 0 else 0.0

            # 2. Sortino Ratio
            downside_rets = returns[returns < 0]
            downside_std = np.std(downside_rets) if len(downside_rets) > 0 else 0.0
            sortino = (mean_ret / downside_std) * np.sqrt(252) if downside_std > 0 else 0.0

            # 3. Max Drawdown
            cumulative = np.cumsum(returns)
            peak = np.maximum.accumulate(cumulative)
            drawdown = peak - cumulative
            max_drawdown = np.max(drawdown) if len(drawdown) > 0 else 0.0

            # 4. Profit Factor
            gross_profits = np.sum(returns[returns > 0])
            gross_losses = abs(np.sum(returns[returns < 0]))
            profit_factor = gross_profits / gross_losses if gross_losses > 0 else float('inf')

            return {
                "sharpe": round(float(sharpe), 2),
                "sortino": round(float(sortino), 2),
                "max_drawdown": round(float(max_drawdown), 2),
                "profit_factor": round(float(profit_factor), 2),
                "total_trades": len(returns)
            }
        except Exception as e:
            logger.error(f"Error generating performance metrics: {e}")
            return {"error": str(e)}

    # --- HITL Action Center Methods ---

    def queue_order_for_approval(self, order_data: dict) -> Optional[int]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            strategy = order_data.get("strategy") or order_data.get("strategy_id") or \
                       order_data.get("strategy_name") or "System"

            cursor.execute("""
                INSERT INTO action_queue (
                    strategy, api_type, symbol, exchange, action,
                    quantity, price, price_type, product_type,
                    status, raw_order_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (
                strategy,
                order_data.get("api_type", "ORDER"),
                order_data.get("symbol"),
                order_data.get("exchange", "NSE"),
                order_data.get("action"),
                order_data.get("quantity"),
                order_data.get("price"),
                order_data.get("price_type", "MARKET"),
                order_data.get("product_type", "MIS"),
                json.dumps(order_data)
            ))
            conn.commit()
            order_id = cursor.lastrowid
            conn.close()
            return order_id
        except Exception as e:
            logger.error(f"Error queuing order for approval: {e}")
            return None

    def get_action_queue(self, status: str = 'pending', limit: int = 100) -> List[dict]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM action_queue
                WHERE status = ?
                ORDER BY created_at DESC
                LIMIT ?
            """, (status, limit))
            rows = cursor.fetchall()
            conn.close()

            result = []
            for row in rows:
                r = dict(row)
                if r.get('raw_order_data'):
                    try:
                        r['raw_order_data'] = json.loads(r['raw_order_data'])
                    except json.JSONDecodeError:
                        pass
                result.append(r)
            return result
        except Exception as e:
            logger.error(f"Error fetching action queue: {e}")
            return []

    def get_action_order(self, order_id: int) -> Optional[dict]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM action_queue WHERE id = ?", (order_id,))
            row = cursor.fetchone()
            conn.close()

            if not row:
                return None

            r = dict(row)
            if r.get('raw_order_data'):
                try:
                    r['raw_order_data'] = json.loads(r['raw_order_data'])
                except json.JSONDecodeError:
                    pass
            return r
        except Exception as e:
            logger.error(f"Error fetching action order {order_id}: {e}")
            return None

    def update_action_order_status(self, order_id: int, status: str, reason: Optional[str] = None) -> bool:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE action_queue
                SET status = ?, rejection_reason = ?
                WHERE id = ?
            """, (status, reason, order_id))
            conn.commit()
            success = cursor.rowcount > 0
            conn.close()
            return success
        except Exception as e:
            logger.error(f"Error updating action order status: {e}")
            return False

    def delete_action_order(self, order_id: int) -> bool:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM action_queue WHERE id = ?", (order_id,))
            conn.commit()
            success = cursor.rowcount > 0
            conn.close()
            return success
        except: return False

    def get_action_center_stats(self) -> dict:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
                FROM action_queue
            """)
            row = cursor.fetchone()
            conn.close()
            return {
                "pending": row[0],
                "approved": row[1],
                "rejected": row[2],
                "health": "healthy",
                "persistence": "SQLite/WAL",
                "db_path": os.path.basename(self.db_file)
            }
        except Exception as e:
            logger.error(f"Error fetching action center stats: {e}")
            return {"pending": 0, "approved": 0, "rejected": 0, "health": "error", "persistence": "Disconnected"}


    # --- Alert Management Methods ---

    def get_alerts(self, limit: int = 100) -> List[Dict[str, Any]]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error fetching alerts: {e}")
            return []

    def create_alert(self, alert_type: str, symbol: str, condition: str, value: float, channel: str = "telegram", message: str = "") -> Optional[int]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO alerts (type, symbol, condition, value, channel, message)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (alert_type, symbol, condition, value, channel, message))
            conn.commit()
            alert_id = cursor.lastrowid
            conn.close()
            return alert_id
        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            return None

    def delete_alert(self, alert_id: int) -> bool:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
            conn.commit()
            success = cursor.rowcount > 0
            conn.close()
            return success
        except Exception as e:
            logger.error(f"Error deleting alert: {e}")
            return False

    # --- Backtest Results Methods ---

    def save_backtest_run(self, strategy_id: str, symbol: str, days: int, interval: str, metrics: dict, trades: list) -> Optional[int]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO backtest_runs (strategy_id, symbol, days, interval, metrics, trades)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (strategy_id, symbol, days, interval, json.dumps(metrics), json.dumps(trades)))
            conn.commit()
            run_id = cursor.lastrowid
            conn.close()
            return run_id
        except Exception as e:
            logger.error(f"Error saving backtest run: {e}")
            return None

    def get_latest_backtest_run(self, strategy_id: Optional[str] = None) -> Optional[dict]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            query = "SELECT * FROM backtest_runs"
            params = []
            if strategy_id:
                query += " WHERE strategy_id = ?"
                params.append(strategy_id)
            query += " ORDER BY created_at DESC LIMIT 1"
            cursor.execute(query, params)
            row = cursor.fetchone()
            conn.close()

            if not row: return None

            r = dict(row)
            r["metrics"] = json.loads(r["metrics"])
            r["trades"] = json.loads(r["trades"])
            return r
        except Exception as e:
            logger.error(f"Error fetching latest backtest run: {e}")
            return None

    async def save_backtest_run_async(self, strategy_id: str, symbol: str, days: int, interval: str, metrics: dict, trades: list):
        return await asyncio.to_thread(self.save_backtest_run, strategy_id, symbol, days, interval, metrics, trades)

    async def get_latest_backtest_run_async(self, strategy_id: Optional[str] = None):
        return await asyncio.to_thread(self.get_latest_backtest_run, strategy_id)

    def get_drift_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves recent state reconciliation drift events."""
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM drift_events ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            conn.close()
            return [ {**dict(r), "snapshot": json.loads(r["snapshot_json"]) if r["snapshot_json"] else {}} for r in rows ]
        except Exception as e:
            logger.error(f"Error fetching drift events: {e}")
            return []

    async def get_drift_events_async(self, limit: int = 50) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self.get_drift_events, limit)

# Global singleton instance
_trade_logger: Optional[TradeLogger] = None

def get_trade_logger() -> TradeLogger:
    global _trade_logger
    if _trade_logger is None: _trade_logger = TradeLogger()
    return _trade_logger

def log_api_call(api_type, request_data, response_data, strategy="System"):
    get_trade_logger().log_api_call(api_type, request_data, response_data, strategy)

def get_api_logs(limit=50, search=""):
    return get_trade_logger().get_api_logs(limit, search)
