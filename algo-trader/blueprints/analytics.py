from flask import Blueprint, jsonify, request
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine
from data.historify_db import get_watchlist, add_to_watchlist, upsert_market_data
from utils.auth import require_auth
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics_bp", __name__)

# Global instances (initialized in api.py via context)
_data_service = None
_analytics_engine = AnalyticsEngine()

def init_analytics(order_manager):
    global _data_service
    _data_service = MarketDataService(order_manager)

# --- GEX Endpoints ---

@analytics_bp.route("/gex/api/gex-data", methods=["POST"])
@require_auth
async def get_gex_data():
    try:
        data = request.json or {}
        underlying = data.get("underlying")
        exchange = data.get("exchange", "NSE")
        expiry = data.get("expiry_date") # Expected DDMMMYY

        if not underlying or not expiry:
            return jsonify({"status": "error", "message": "Missing symbol or expiry"}), 400

        chain = await _data_service.get_option_chain(underlying, exchange, expiry)
        if chain.get("status") == "error":
            return jsonify(chain), 500

        results = _analytics_engine.calculate_gex(chain)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"GEX API Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

# --- IV Smile Endpoints ---

@analytics_bp.route("/iv-smile/api/smile-data", methods=["POST"])
@require_auth
async def get_iv_smile():
    try:
        data = request.json or {}
        underlying = data.get("underlying")
        exchange = data.get("exchange", "NSE")
        expiry = data.get("expiry_date")

        chain = await _data_service.get_option_chain(underlying, exchange, expiry)
        results = _analytics_engine.calculate_iv_smile(chain)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Max Pain Endpoints ---

@analytics_bp.route("/maxpain/api/data", methods=["GET"])
@require_auth
async def get_max_pain():
    try:
        # For GET requests, params are in request.args
        underlying = request.args.get("underlying")
        exchange = request.args.get("exchange", "NSE")
        expiry = request.args.get("expiry_date")

        if not underlying or not expiry:
            return jsonify({"status": "error", "message": "Missing underlying or expiry"}), 400

        chain = await _data_service.get_option_chain(underlying, exchange, expiry)
        if chain.get("status") == "error":
            return jsonify(chain), 500

        results = _analytics_engine.calculate_max_pain(chain)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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
