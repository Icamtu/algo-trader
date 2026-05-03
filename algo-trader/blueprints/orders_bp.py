from flask import Blueprint, jsonify, request
import logging
import asyncio
from functools import wraps
from core.context import app_context
from utils.auth import require_auth

logger = logging.getLogger(__name__)
orders_bp = Blueprint('orders_bp', __name__)

def trading_mode_gate(f):
    """
    Decorator to ensure trading requests respect the current mode.
    Injects the mode into the request context if needed.
    """
    if asyncio.iscoroutinefunction(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            mode_header = request.headers.get("X-Trading-Mode")
            order_manager = app_context.get("order_manager")

            if mode_header and order_manager:
                mode_header = mode_header.lower()
                if mode_header in {"sandbox", "live"} and order_manager.mode != mode_header:
                    logger.warning(
                        "UI Mode (%s) differs from Engine Mode (%s). Overriding for this request.",
                        mode_header, order_manager.mode
                    )
                    kwargs["mode_override"] = mode_header

            return await f(*args, **kwargs)
        return decorated_function
    else:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            mode_header = request.headers.get("X-Trading-Mode")
            order_manager = app_context.get("order_manager")

            if mode_header and order_manager:
                mode_header = mode_header.lower()
                if mode_header in {"sandbox", "live"} and order_manager.mode != mode_header:
                    logger.warning(
                        "UI Mode (%s) differs from Engine Mode (%s). Overriding for this request.",
                        mode_header, order_manager.mode
                    )
                    kwargs["mode_override"] = mode_header

            return f(*args, **kwargs)
        return decorated_function

@orders_bp.route("/api/v1/placeorder", methods=["POST"])
@require_auth
@trading_mode_gate
async def api_place_order(mode_override=None):
    """POST /api/v1/placeorder - Standard order proxy."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"error": "Order manager not initialized"}), 503

        data = request.json
        if not data:
            return jsonify({"error": "Request body required"}), 400

        try:
            result = await order_manager.place_order(
                strategy_name=data.get("strategy", "UI_MANUAL"),
                symbol=data["symbol"],
                action=data["action"],
                quantity=int(data["quantity"]),
                order_type=data.get("pricetype", "MARKET"),
                price=float(data.get("price", 0.0)),
                product=data.get("product", "MIS"),
                exchange=data.get("exchange", "NSE"),
                human_approval=data.get("human_approval", False),
                ai_reasoning=data.get("ai_reasoning"),
                conviction=data.get("conviction"),
                mode=mode_override
            )
            return jsonify(result), 200
        except Exception as e:
            logger.error(f"API order placement failed: {e}")
            return jsonify({"status": "error", "message": "Internal error"}), 500

    except Exception as e:
        logger.error(f"PlaceOrder failed: {e}", exc_info=True)
        return jsonify({"error": "Internal error"}), 500

@orders_bp.route("/api/v1/placesmartorder", methods=["POST"])
@require_auth
@trading_mode_gate
async def api_place_smart_order(mode_override=None):
    """POST /api/v1/placesmartorder - Smart order proxy."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"error": "Order manager not initialized"}), 503

        data = request.json
        result = await order_manager.place_smart_order(
            strategy_name=data.get("strategy", "UI_SMART"),
            symbol=data["symbol"],
            action=data["action"],
            quantity=int(data["quantity"]),
            position_size=int(data.get("position_size", 0)),
            order_type=data.get("pricetype", "MARKET"),
            price=float(data.get("price", 0.0)),
            product=data.get("product", "MIS"),
            exchange=data.get("exchange", "NSE"),
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@orders_bp.route("/api/v1/orders", methods=["GET"])
@require_auth
async def get_orders():
    """GET /api/v1/orders - Proxy to Real Broker Orders."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"status": "error", "message": "Order manager not initialized"}), 503

        orders = await order_manager.get_orders()
        return jsonify(orders), 200
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        return jsonify({"status": "error", "message": "Internal error"}), 500

@orders_bp.route("/api/v1/orders/<order_id>/cancel", methods=["POST"])
@require_auth
async def cancel_order(order_id):
    """POST /api/v1/orders/{id}/cancel - Proxy to Real Broker Cancel."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"status": "error", "message": "Order manager not initialized"}), 503

        result = await order_manager.cancel_order(order_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error cancelling order {order_id}: {e}")
        return jsonify({"status": "error", "message": "Internal error"}), 500
