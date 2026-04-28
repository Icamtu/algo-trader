from flask import Blueprint, jsonify, request, redirect
import logging
import os
from datetime import datetime
from core.context import app_context
from utils.auth import require_auth
from database.trade_logger import get_trade_logger
from utils.get_shoonya_token import get_shoonya_auth_code
from utils.finalize_shoonya_auth import finalize_shoonya_session

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth_bp', __name__)

class CONFIG:
    UI_BASE_URL = os.getenv("AETHERDESK_UI_URL", "http://127.0.0.1:3001")

@auth_bp.route("/auth/csrf-token", methods=["GET"])
def get_csrf_token():
    """Returns a dummy CSRF token for frontend compatibility."""
    return jsonify({"csrf_token": "aether-core-session-token-v1"}), 200 # nosec B105

@auth_bp.route("/auth/broker-config", methods=["GET"])
@require_auth
def get_broker_config():
    """Returns the current broker configuration."""
    try:
        db_logger = get_trade_logger()
        config = db_logger.get_broker_config()
        return jsonify(config), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/api/v1/brokers/shoonya/auth", methods=["POST"])
@require_auth
def shoonya_auth_init():
    """Initializes Shoonya authentication flow."""
    try:
        # 1. Get Redirect URI from Shoonya flow
        # In a real scenario, this might involve generating a URL for the user to visit
        redirect_uri = f"http://{request.host}/api/auth/callback/shoonya"
        auth_url = get_shoonya_auth_code(redirect_uri)
        return jsonify({"status": "success", "auth_url": auth_url}), 200
    except Exception as e:
        logger.error(f"Shoonya Auth Init Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@auth_bp.route("/api/auth/callback/shoonya", methods=["GET"])
def shoonya_callback():
    """Callback for Shoonya authentication."""
    code = request.args.get("code")
    if not code:
        return redirect(f"{CONFIG.UI_BASE_URL}/openalgo/broker?status=error&message=missing_code")

    try:
        success = finalize_shoonya_session(code)
        if success:
            return redirect(f"{CONFIG.UI_BASE_URL}/openalgo/broker?status=success&message=shoonya_linked")
        else:
            return redirect(f"{CONFIG.UI_BASE_URL}/openalgo/broker?status=error&message=auth_failed")
    except Exception as e:
        logger.error(f"Critical failure in Shoonya callback: {e}")
        return redirect(f"{CONFIG.UI_BASE_URL}/openalgo/broker?status=error&message=internal_error")
