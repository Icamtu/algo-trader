from flask import Blueprint, jsonify, request
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine
from data.historify_db import get_watchlist, add_to_watchlist, upsert_market_data
from utils.auth import require_auth
import logging

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

@analytics_bp.route("/historify/api/watchlist", methods=["GET", "POST"])
@require_auth
def handle_watchlist():
    if request.method == "GET":
        return jsonify({"status": "success", "data": get_watchlist()})

    data = request.json
    add_to_watchlist(data.get("symbol"), data.get("exchange"), data.get("name"))
    return jsonify({"status": "success", "message": "Added to watchlist"})

@analytics_bp.route("/historify/api/run-historify", methods=["POST"])
@require_auth
async def run_historify():
    # Placeholder for non-blocking task runner
    return jsonify({"status": "success", "message": "Historify job queued", "job_id": "job_001"})

@analytics_bp.route("/historify/api/catalog", methods=["GET"])
@require_auth
def get_historify_catalog():
    from data.historify_db import list_ohlcv_catalog
    catalog = list_ohlcv_catalog()
    return jsonify({"status": "success", "data": catalog})

@analytics_bp.route("/historify/api/jobs", methods=["GET"])
@require_auth
def get_historify_jobs():
    # In AetherDesk, we don't have a separate job queue yet, returns empty list
    return jsonify({"status": "success", "data": []})

@analytics_bp.route("/historify/api/schedules", methods=["GET"])
@require_auth
def get_historify_schedules():
    return jsonify({"status": "success", "data": []})
