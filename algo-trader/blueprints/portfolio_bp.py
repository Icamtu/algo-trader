from flask import Blueprint, jsonify, request
import logging
from core.context import app_context
from utils.auth import require_auth
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)
portfolio_bp = Blueprint('portfolio_bp', __name__)

@portfolio_bp.route("/api/v1/engine/positions", methods=["GET"])
@require_auth
def get_engine_positions():
    """Returns mode-specific open positions from the internal engine."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"status": "error", "message": "Order manager not initialized"}), 503

        positions = order_manager.position_manager.all_positions()
        # Convert to list for JSON response
        pos_list = []
        for symbol, pos in positions.items():
            pos_list.append({
                "symbol": symbol,
                "quantity": pos.quantity,
                "avg_price": pos.avg_price,
                "pnl": pos.pnl if hasattr(pos, "pnl") else 0.0,
                "metadata": getattr(pos, "metadata", {})
            })

        return jsonify({
            "status": "success",
            "positions": pos_list,
            "count": len(pos_list)
        }), 200
    except Exception as e:
        logger.error(f"Error fetching engine positions: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@portfolio_bp.route("/api/v1/broker/positions", methods=["GET"])
@require_auth
async def get_broker_positions():
    """Returns live positions from the broker."""
    try:
        order_manager = app_context.get("order_manager")
        if not order_manager:
            return jsonify({"status": "error", "message": "Order manager not initialized"}), 503

        positions = await order_manager.get_positions()
        return jsonify(positions), 200
    except Exception as e:
        logger.error(f"Error fetching broker positions: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@portfolio_bp.route("/api/v1/system/reconcile", methods=["POST"])
@require_auth
async def system_reconcile():
    """Triggers a manual reconciliation between Broker and Engine positions."""
    try:
        order_manager = app_context.get("order_manager")
        db_logger = get_trade_logger()
        if not order_manager:
            return jsonify({"status": "error", "message": "Services not initialized"}), 503

        # Fetch fresh positions from broker
        broker_pos = await order_manager.get_positions()

        # Reconciliation logic (Simplified)
        if isinstance(broker_pos, list):
            for pos in broker_pos:
                symbol = pos.get("symbol")
                qty = int(pos.get("quantity", 0))
                if symbol:
                    await db_logger.reconcile_positions_async(symbol, qty)

        return jsonify({
            "status": "success",
            "message": "Reconciliation triggered",
            "positions": broker_pos
        }), 200
    except Exception as e:
        logger.error(f"Reconcile failure: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@portfolio_bp.route("/api/v1/system/reset-positions", methods=["POST"])
@require_auth
async def system_reset_positions():
    """Emergency reset: Force all local positions to ZERO."""
    try:
        db_logger = get_trade_logger()
        order_manager = app_context.get("order_manager")

        await db_logger.reset_positions_async()

        if order_manager and order_manager.position_manager:
            order_manager.position_manager.positions = {}

        return jsonify({"status": "success", "message": "All local positions reset to zero"}), 200
    except Exception as e:
        logger.error(f"Reset positions failure: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
