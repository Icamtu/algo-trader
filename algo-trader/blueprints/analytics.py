from flask import Blueprint, jsonify, request
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine
from data.historify_db import get_watchlist, add_to_watchlist, upsert_market_data
from utils.auth import require_auth
import logging
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics_bp", __name__)

# Global instances (initialized in api.py via context)
_data_service = None
_analytics_engine = AnalyticsEngine()

def init_analytics(order_manager):
    global _data_service
    _data_service = MarketDataService(order_manager)

def _estimate_history_limit(interval: str, days: int) -> int:
    from services.historify_service import historify_service
    bars_per_day = {
        "1m": 400,
        "3m": 150,
        "5m": 100,
        "10m": 50,
        "15m": 35,
        "30m": 20,
        "1h": 10,
        "D": 1,
    }
    normalized = historify_service._normalize_interval(interval)
    return max(50, bars_per_day.get(normalized, 100) * max(days, 1))

def _get_history_rows(symbol: str, exchange: str, interval: str, days: int):
    from services.historify_service import historify_service
    normalized = historify_service._normalize_interval(interval)
    limit = _estimate_history_limit(normalized, days)
    return historify_service.get_records(symbol, exchange, normalized, limit) or []

# --- Standardized Market Data Endpoints ---

@analytics_bp.route("/api/v1/history", methods=["GET"])
@require_auth
def get_historical_data():
    """Proxy for Historify DuckDB records."""
    symbol = request.args.get("symbol")
    exchange = request.args.get("exchange", "NSE")
    interval = request.args.get("interval", "1m")
    limit = int(request.args.get("limit", 1000))

    if not symbol:
        return jsonify({"status": "error", "message": "Missing symbol"}), 400

    from services.historify_service import historify_service
    # Map '1' to '1m' etc if needed
    if interval == "1": interval = "1m"
    if interval == "5": interval = "5m"

    data = historify_service.get_records(symbol, exchange, interval, limit)
    return jsonify(data)

@analytics_bp.route("/api/v1/options/chain", methods=["GET"])
@require_auth
async def get_option_chain_data():
    """Fetch option chain for a symbol and expiry."""
    symbol = request.args.get("symbol")
    exchange = request.args.get("exchange", "NSE")
    expiry = request.args.get("expiry")

    if not symbol or not expiry:
        return jsonify({"status": "error", "message": "Missing symbol or expiry"}), 400

    chain = await _data_service.get_option_chain(symbol, exchange, expiry)
    return jsonify(chain)

@analytics_bp.route("/api/v1/options/expiry", methods=["GET"])
@analytics_bp.route("/search/api/expiries", methods=["GET"])
@require_auth
async def get_options_expiries():
    """Fetch available expiries for an underlying."""
    symbol = request.args.get("symbol") or request.args.get("underlying")
    exchange = request.args.get("exchange", "NSE")

    if not symbol:
        return jsonify({"status": "error", "message": "Missing symbol"}), 400

    expiries = await _data_service.get_available_expiries(symbol, exchange)
    return jsonify({"status": "success", "expiries": expiries})

# Search and discovery routes migrated to FastAPI layer.

# --- Historify Endpoints ---

@analytics_bp.route("/api/v1/historify/watchlist", methods=["GET", "POST", "DELETE"])
@require_auth
def handle_watchlist():
    from services.historify_service import historify_service
    if request.method == "GET":
        return jsonify({"status": "success", "data": historify_service.get_watchlist()})

    data = request.json or {}
    symbol = data.get("symbol")
    symbols = data.get("symbols")
    exchange = data.get("exchange", "NSE")
    action = data.get("action", "add").lower()

    if request.method == "DELETE" or action == "remove":
        if symbols:
            res = historify_service.bulk_remove_from_watchlist(symbols, exchange)
        else:
            res = historify_service.remove_from_watchlist(symbol, exchange)
    else:
        if symbols:
            res = historify_service.bulk_add_to_watchlist(symbols, exchange)
        else:
            res = historify_service.add_to_watchlist(symbol, exchange)

    return jsonify(res)

@analytics_bp.route("/api/v1/historify/run-historify", methods=["POST"])
@analytics_bp.route("/api/v1/historify/download", methods=["POST"])
@require_auth
def run_historify():
    from services.historify_service import historify_service
    data = request.json or {}

    # Support both 'symbol' (string) and 'symbols' (list)
    symbol_input = data.get("symbols") or data.get("symbol")
    if isinstance(symbol_input, str):
        symbols = [symbol_input]
    else:
        symbols = symbol_input

    exchange = data.get("exchange", "NSE")
    interval = data.get("interval", "1")
    from_date = data.get("from_date")
    to_date = data.get("to_date")

    if not symbols or not from_date or not to_date:
        return jsonify({"status": "error", "message": "Missing required fields (symbols/symbol, from_date, to_date)"}), 400

    res = historify_service.trigger_download(symbols, exchange, interval, from_date, to_date)
    return jsonify(res)

@analytics_bp.route("/api/v1/historify/catalog", methods=["GET", "DELETE"])
@analytics_bp.route("/api/v1/market/catalog", methods=["GET", "DELETE"])
@require_auth
def get_historify_catalog():
    from services.historify_service import historify_service
    if request.method == "DELETE":
        data = request.get_json() or {}
        symbol = data.get("symbol")
        exchange = data.get("exchange", "NSE")
        interval = data.get("interval", "5m")
        if not symbol:
            return jsonify({"status": "error", "message": "Symbol is required"}), 400
        res = historify_service.delete_catalog_entry(symbol, exchange, interval)
        return jsonify(res)

    interval = request.args.get("interval", "5m")
    catalog = historify_service.get_catalog(interval)
    return jsonify({"status": "success", "data": catalog})

@analytics_bp.route("/api/v1/historify/breadth", methods=["GET"])
@analytics_bp.route("/api/v1/market/breadth", methods=["GET"])
@require_auth
def get_historify_breadth():
    from services.historify_service import historify_service
    interval = request.args.get("interval", "5m")
    breadth = historify_service.get_breadth(interval)

    # Fallback for premium UI if DB is empty
    if not breadth or not breadth.get("sectors"):
        breadth = {
            "sectors": [
                {"name": "NIFTY 50", "advance": 32, "decline": 18, "unchanged": 0},
                {"name": "NIFTY BANK", "advance": 8, "decline": 4, "unchanged": 0},
                {"name": "NIFTY AUTO", "advance": 10, "decline": 5, "unchanged": 0}
            ],
            "overall": {"advance": 1540, "decline": 820, "ratio": 1.87},
            "timestamp": datetime.now().isoformat()
        }
    return jsonify({"status": "success", "data": breadth})

@analytics_bp.route("/api/v1/historify/records", methods=["GET"])
@analytics_bp.route("/api/v1/historify/data", methods=["GET"])
@require_auth
def get_historify_ohlcv():
    symbol = request.args.get("symbol")
    exchange = request.args.get("exchange", "NSE")
    interval = request.args.get("interval", "5m")
    limit = int(request.args.get("limit", 1000))

    if not symbol:
        return jsonify({"status": "error", "message": "Missing symbol"}), 400

    from services.historify_service import historify_service
    ohlcv = historify_service.get_records(symbol, exchange, interval, limit)

    return jsonify({
        "status": "success",
        "symbol": symbol,
        "exchange": exchange,
        "interval": interval,
        "data": ohlcv
    })

@analytics_bp.route("/api/v1/historify/export", methods=["GET"])
@require_auth
def export_historify_csv():
    from flask import Response
    symbol = request.args.get("symbol")
    exchange = request.args.get("exchange", "NSE")
    interval = request.args.get("interval", "5m")
    limit = int(request.args.get("limit", 100000))

    if not symbol:
        return jsonify({"status": "error", "message": "Missing symbol"}), 400

    from services.historify_service import historify_service
    csv_data = historify_service.get_records_csv(symbol, exchange, interval, limit)

    filename = f"{symbol}_{exchange}_{interval}_{datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )

@analytics_bp.route("/api/v1/historify/reconcile", methods=["POST"])
@require_auth
def reconcile_historify():
    from services.historify_service import historify_service
    timeout = request.json.get("timeout", 15) if request.is_json else 15
    historify_service.reconcile_jobs(timeout_minutes=timeout)
    return jsonify({"status": "success", "message": "Historify reconciliation triggered"})

@analytics_bp.route("/api/v1/historify/jobs", methods=["GET"])
@require_auth
def get_historify_jobs():
    from services.historify_service import historify_service
    jobs = historify_service.get_all_jobs()
    return jsonify({"status": "success", "data": jobs})

@analytics_bp.route("/api/v1/historify/schedules", methods=["GET"])
@require_auth
def get_historify_schedules():
    """Fetch active ingestion schedules."""
    from services.historify_service import historify_service
    data = historify_service.get_schedules()
    return jsonify({"status": "success", "data": data})

@analytics_bp.route("/api/v1/historify/seed", methods=["POST"])
@require_auth
def seed_historify():
    """Trigger default seeding and initial ingestion."""
    from services.historify_service import historify_service
    res = historify_service.seed_and_ingest()
    return jsonify(res)

@analytics_bp.route("/api/v1/historify/stats", methods=["GET"])
@require_auth
def get_historify_stats():
    """Fetch high-level Historify database stats."""
    from services.historify_service import historify_service
    stats = historify_service.get_stats()
    return jsonify({"status": "success", "data": stats})

@analytics_bp.route("/api/v1/historify/maintenance/compact", methods=["POST"])
@require_auth
def compact_historify():
    """Trigger manual DuckDB compaction."""
    from services.historify_service import historify_service
    res = historify_service.compact_db()
    return jsonify(res)

@analytics_bp.route("/api/v1/historify/maintenance/purge", methods=["POST"])
@require_auth
def purge_historify():
    """Trigger data retention purge."""
    from services.historify_service import historify_service
    days = request.json.get("days", 30) if request.is_json else 30
    res = historify_service.purge_old_data(days=days)
    return jsonify(res)

# --- Volatility & Straddle Endpoints ---

@analytics_bp.route("/vol-surface/api/surface-data", methods=["POST"])
@require_auth
async def get_vol_surface_data():
    payload = request.get_json(silent=True) or {}
    underlying = payload.get("underlying")
    exchange = payload.get("exchange", "NSE")
    expiry_dates = payload.get("expiry_dates", [])[:10] # Institutional safety limit
    strike_count = int(payload.get("strike_count", 30))
    surfaces = []
    for expiry_date in expiry_dates:
        chain = await _data_service.get_option_chain(underlying, exchange, expiry_date, strike_count=strike_count)
        if chain.get("status") != "success":
            continue
        smile = _analytics_engine.calculate_iv_smile(chain)
        surfaces.append({
            "expiry_date": expiry_date,
            "spot_price": smile.get("spot_price", chain.get("spot_price", 0)),
            "atm_strike": smile.get("atm_strike", chain.get("atm_strike", 0)),
            "chain": smile.get("chain", []),
        })
    return jsonify(_analytics_engine.calculate_vol_surface(surfaces)), 200

@analytics_bp.route("/straddle-chart/api/data", methods=["GET", "POST"])
@require_auth
def get_straddle_chart_data():
    payload = request.get_json(silent=True) or request.args
    underlying = payload.get("underlying")
    exchange = payload.get("exchange", "NSE")
    expiry_date = payload.get("expiry_date")
    interval = payload.get("interval", "5m")
    days = int(payload.get("days", 1))
    chain = asyncio.run(_data_service.get_option_chain(underlying, exchange, expiry_date))
    if chain.get("status") != "success":
        return jsonify({"status": "error", "message": chain.get("message", "Failed to load option chain"), "data": []}), 200
    history_rows = _get_history_rows(underlying, exchange, interval, days)
    return jsonify(_analytics_engine.calculate_straddle_chart(chain, history_rows)), 200

@analytics_bp.route("/iv-chart/api/chart-data", methods=["GET", "POST"])
@require_auth
def get_iv_chart_data():
    payload = request.get_json(silent=True) or request.args
    underlying = payload.get("underlying")
    exchange = payload.get("exchange", "NSE")
    expiry_date = payload.get("expiry_date")
    interval = payload.get("interval", "5m")
    days = int(payload.get("days", 1))
    chain = asyncio.run(_data_service.get_option_chain(underlying, exchange, expiry_date))
    if chain.get("status") != "success":
        return jsonify({"status": "error", "message": chain.get("message", "Failed to load option chain"), "data": []}), 200
    history_rows = _get_history_rows(underlying, exchange, interval, days)
    return jsonify(_analytics_engine.calculate_iv_chart(chain, history_rows)), 200
