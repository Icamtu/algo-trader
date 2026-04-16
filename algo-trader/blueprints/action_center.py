from flask import Blueprint, jsonify, request
import logging
from execution.action_manager import get_action_manager
from utils.auth import require_auth

logger = logging.getLogger(__name__)

action_center_bp = Blueprint("action_center_bp", __name__)
action_manager = get_action_manager()

@action_center_bp.route("/api/v1/actioncenter", methods=["GET"])
@action_center_bp.route("/action-center/api/data", methods=["GET"])
@require_auth
def get_action_center_data():
    try:
        status = request.args.get("status", "pending")
        limit = int(request.args.get("limit", 100))

        orders = action_manager.get_action_queue(status=status)
        stats = action_manager.get_statistics()

        return jsonify({
            "status": "success",
            "data": {
                "orders": orders,
                "statistics": stats
            }
        }), 200
    except Exception as e:
        logger.error(f"ActionCenter GET Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

@action_center_bp.route("/api/v1/actioncenter/approve", methods=["POST"])
@action_center_bp.route("/action-center/approve/<int:id>", methods=["POST"])
@require_auth
async def approve_order(id=None):
    try:
        data = request.json or {}
        order_id = id or data.get("id")

        if not order_id:
            # Check for batch approve
            if data.get("batch") == "all":
                count = await action_manager.approve_all_pending()
                return jsonify({"status": "success", "message": f"Approved {count} orders"}), 200
            return jsonify({"status": "error", "message": "Missing order ID"}), 400

        success = await action_manager.approve_order(int(order_id))
        if success:
            return jsonify({"status": "success", "message": "Order approved and routed"}), 200
        else:
            return jsonify({"status": "error", "message": "Approval failed or execution error"}), 500
    except Exception as e:
        logger.error(f"ActionCenter Approval Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

@action_center_bp.route("/api/v1/actioncenter/reject", methods=["POST"])
@action_center_bp.route("/action-center/reject/<int:id>", methods=["POST"])
@require_auth
def reject_order(id=None):
    try:
        data = request.json or {}
        order_id = id or data.get("id")
        reason = data.get("reason")

        if not order_id:
            return jsonify({"status": "error", "message": "Missing order ID"}), 400

        success = action_manager.reject_order(int(order_id), reason=reason)
        if success:
            return jsonify({"status": "success", "message": "Order rejected"}), 200
        else:
            return jsonify({"status": "error", "message": "Rejection failed"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@action_center_bp.route("/api/v1/actioncenter/delete", methods=["DELETE", "POST"])
@action_center_bp.route("/action-center/delete/<int:id>", methods=["DELETE", "POST"])
@require_auth
def delete_order(id=None):
    """Delete an audit record (supports POST for easier proxying)."""
    try:
        data = request.json or {}
        order_id = id or data.get("id")

        if not order_id:
            return jsonify({"status": "error", "message": "Missing order ID"}), 400

        success = action_manager.delete_order(int(order_id))
        if success:
            return jsonify({"status": "success", "message": "Order deleted from audit log"}), 200
        else:
            return jsonify({"status": "error", "message": "Deletion failed"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@action_center_bp.route("/action-center/approve-all", methods=["POST"])
@require_auth
async def approve_all_orders():
    try:
        count = await action_manager.approve_all_pending()
        return jsonify({"status": "success", "message": f"Approved {count} orders"}), 200
    except Exception as e:
        logger.error(f"ActionCenter Batch Approval Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500
