import sqlite3
import numpy as np
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import os
import json
from database.timescale_logger import get_timescale_logger

logger = logging.getLogger(__name__)

# Default to /data/db/ in production, fall back to local database/ in workspace
DEFAULT_DB_PATH = "/data/db/trades.db"
DB_FILE = os.getenv("TRADES_DB_PATH", DEFAULT_DB_PATH)

if not os.path.exists(os.path.dirname(DB_FILE)):
    # Fallback to local workspace
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

            conn.commit()
            conn.close()
            logger.info(f"Trade database initialized at {self.db_file}")
        except Exception as e:
            logger.error(f"Error initializing trade database: {e}", exc_info=True)

    def log_trade(self, strategy, symbol, side, quantity, price, status="filled", order_id=None, pnl=None, mode="sandbox", ai_reasoning=None, conviction=None):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            timestamp = datetime.utcnow().isoformat()
            cursor.execute("""
            INSERT INTO trades (timestamp, strategy, symbol, side, quantity, price, status, order_id, pnl, mode, ai_reasoning, conviction)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (timestamp, strategy, symbol, side.upper(), quantity, price, status, order_id, pnl, mode, ai_reasoning, conviction))
            conn.commit()
            trade_id = cursor.lastrowid
            conn.close()

            # Sync to TimescaleDB
            try:
                ts_logger = get_timescale_logger()
                ts_logger.log_trade(
                    trade_id=trade_id,
                    strategy_id=strategy,
                    symbol=symbol,
                    side=side.upper(),
                    quantity=quantity,
                    price=price,
                    pnl=pnl or 0.0,
                    mode=mode
                )
            except Exception as ts_err:
                logger.warning(f"Failed to sync trade to TimescaleDB: {ts_err}")

            return trade_id
        except Exception as e:
            logger.error(f"Error logging trade: {e}")
            return None

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

    def get_strategy_metrics(self, strategy: str) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(self.db_file)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT pnl FROM trades WHERE strategy = ? AND status = 'filled' AND pnl IS NOT NULL ORDER BY timestamp ASC", (strategy,))
            rows = cursor.fetchall()
            conn.close()
            if not rows: return {"total_trades": 0, "net_pnl": 0.0}
            pnls = np.array([row['pnl'] for row in rows])
            wins = pnls[pnls > 0]
            win_rate = (len(wins) / len(pnls)) * 100
            return {"win_rate": round(win_rate, 1), "total_trades": len(pnls), "net_pnl": round(float(np.sum(pnls)), 2)}
        except Exception as e: return {"error": str(e)}

    def get_system_settings(self) -> Dict[str, str]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM system_settings")
            rows = cursor.fetchall()
            conn.close()
            return {row[0]: row[1] for row in rows}
        except: return {}

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
            cols = ["confidence_score", "regime_preference", "learning_rate", "total_profit_factor", "last_failure_reason"]
            valid_updates = {k: v for k, v in updates.items() if k in cols}
            if not valid_updates: return
            upd_str = ", ".join([f"{k} = ?" for k in valid_updates.keys()])
            params = list(valid_updates.values()) + [now, strategy_id]
            cursor.execute(f"UPDATE strategy_personality SET {upd_str}, updated_at = ? WHERE strategy_id = ?", params)
            if cursor.rowcount == 0:
                keys = ["strategy_id", "updated_at"] + list(valid_updates.keys())
                vals = [strategy_id, now] + list(valid_updates.values())
                cursor.execute(f"INSERT INTO strategy_personality ({', '.join(keys)}) VALUES ({', '.join(['?' for _ in vals])})", vals)
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

    def log_api_call(self, api_type, request_data, response_data, strategy="System"):
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()
            cursor.execute("INSERT INTO api_logs (api_type, request_data, response_data, strategy) VALUES (?, ?, ?, ?)",
                           (api_type, json.dumps(request_data), json.dumps(response_data), strategy))
            conn.commit()
            conn.close()
        except: pass

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
        except: return []

    # --- HITL Action Center Methods ---

    def queue_order_for_approval(self, order_data: dict) -> Optional[int]:
        try:
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO action_queue (
                    strategy, api_type, symbol, exchange, action,
                    quantity, price, price_type, product_type,
                    status, raw_order_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """, (
                order_data.get("strategy", "System"),
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
                    except: pass
                result.append(r)
            return result
        except: return []

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
            return {"pending": row[0], "approved": row[1], "rejected": row[2]}
        except: return {"pending": 0, "approved": 0, "rejected": 0}

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
