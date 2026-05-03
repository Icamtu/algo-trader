
from flask import Blueprint, jsonify, request
import os
import json
import logging
from datetime import datetime
from utils.auth import require_auth
from core.autoresearch_agent import run_iteration_api
from execution.action_manager import get_action_manager
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)
autoresearch_bp = Blueprint('autoresearch_bp', __name__)

def _get_task(tid):
    return get_trade_logger().get_ar_task(tid)

def _set_task(tid, status, result=None, error=None):
    get_trade_logger().update_ar_task(tid, status, result=result, error=error)

def _check_cancel(tid):
    task = _get_task(tid)
    return task is not None and task.get("status") == "cancelled"

@autoresearch_bp.route("/api/v1/autoresearch/iteration", methods=["POST"])
@require_auth
def api_autoresearch_iteration():
    import uuid
    import threading
    import asyncio

    data = request.json or {}
    task_id = str(uuid.uuid4())
    get_trade_logger().create_ar_task(task_id)

    def run_in_bg(tid, req_data):
        logger.info(f"Autoresearch task {tid} started in background thread.")

        def update_status(payload):
            if payload.get("status"):
                _set_task(tid, payload["status"], result=payload.get("result"), error=payload.get("error"))

        async def _run():
            try:
                result = await run_iteration_api(
                    code=req_data.get("code"),
                    strategy_name=req_data.get("strategy_name"),
                    symbol=req_data.get("symbol", "RELIANCE"),
                    targets=req_data.get("targets", {}),
                    timeframe=req_data.get("timeframe", "1m"),
                    days=req_data.get("days", 7),
                    model=req_data.get("model", "deepseek-coder:1.3b"),
                    task_callback=update_status,
                    check_cancel=lambda: _check_cancel(tid)
                )
                if not _check_cancel(tid):
                    _set_task(tid, "completed", result=result)
            except Exception as e:
                logger.error(f"Autoresearch API background error: {e}", exc_info=True)
                _set_task(tid, "error", error=str(e))

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_run())
        loop.close()

    threading.Thread(target=run_in_bg, args=(task_id, data), daemon=True).start()
    return jsonify({"status": "processing", "task_id": task_id}), 202

@autoresearch_bp.route("/api/v1/autoresearch/stop", methods=["POST"])
@require_auth
def api_autoresearch_stop():
    data = request.json or {}
    task_id = data.get("taskId")
    task = _get_task(task_id)
    if task:
        _set_task(task_id, "cancelled")
        return jsonify({"status": "success", "message": "Research task cancellation requested."}), 200
    return jsonify({"status": "error", "message": "Task not found."}), 404

@autoresearch_bp.route("/api/v1/autoresearch/status/<task_id>", methods=["GET"])
@require_auth
def api_autoresearch_status(task_id):
    task = _get_task(task_id)
    if task is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task), 200

@autoresearch_bp.route("/api/v1/autoresearch/history", methods=["GET"])
@require_auth
def api_autoresearch_history():
    import math
    def sanitize(obj):
        """Recursively replace NaN/Inf with None for JSON safety, and drop heavy curve arrays."""
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items() if k not in ('equity_curve', 'benchmark_curve', 'returns')}
        if isinstance(obj, list):
            # Drop large arrays (>50 items) that are backtest curves
            if len(obj) > 50:
                return None
            return [sanitize(i) for i in obj]
        return obj

    try:
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'strategies'))
        research_dir = os.path.join(strat_dir, 'autoresearch_history')
        if not os.path.exists(research_dir):
            os.makedirs(research_dir, exist_ok=True)
            return jsonify({"history": []}), 200

        history = []
        for f in os.listdir(research_dir):
            if f.endswith(".json"):
                try:
                    with open(os.path.join(research_dir, f), 'r') as jf:
                        meta = json.load(jf)
                        clean = sanitize(meta)
                        clean['id'] = f.replace('.json', '')
                        history.append(clean)
                except Exception as fe:
                    logger.warning(f"Skipping corrupt history file {f}: {fe}")
                    continue

        # Sort by timestamp in ID (base_name_YYYYMMDD_HHMMSS)
        history.sort(key=lambda x: x['id'].split('_')[-2] + x['id'].split('_')[-1], reverse=True)
        return jsonify({"history": history}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@autoresearch_bp.route("/api/v1/autoresearch/history/<id>", methods=["GET"])
@require_auth
def api_autoresearch_get_iteration(id):
    try:
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'strategies'))
        research_dir = os.path.join(strat_dir, 'autoresearch_history')
        safe_id = os.path.basename(os.path.normpath(id))
        py_path = os.path.join(research_dir, f"{safe_id}.py")
        json_path = os.path.join(research_dir, f"{safe_id}.json")

        if not os.path.exists(py_path):
            return jsonify({"error": "Iteration not found"}), 404

        with open(py_path, 'r') as f:
            code = f.read()

        meta = {}
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                meta = json.load(f)

        return jsonify({"code": code, "metrics": meta.get("metrics"), "metadata": meta}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@autoresearch_bp.route("/api/v1/autoresearch/deploy", methods=["POST"])
@require_auth
def api_autoresearch_deploy():
    """
    Deploys researched code as a new active strategy.
    """
    try:
        data = request.json or {}
        strategy_name = data.get("name")
        code = data.get("code")
        metrics = data.get("metrics")

        if not strategy_name or not code:
            return jsonify({"error": "Missing name or code"}), 400

        # User Request: convert existing file name to <old_file_name>_Autoresearch.py
        base_name = strategy_name.replace(".py", "")
        filename = f"{base_name}_Autoresearch.py"

        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'strategies', 'AutoResearch'))
        if not os.path.exists(strat_dir): os.makedirs(strat_dir, exist_ok=True)
        filename = os.path.basename(os.path.normpath(filename.replace(":", "/")))
        file_path = os.path.join(strat_dir, filename)

        # Security check
        if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
            return jsonify({"error": "Forbidden path"}), 403

        # Inject metrics into docstring as requested
        metrics_str = "N/A"
        if metrics:
            metrics_str = "\n".join([f"    # {k.upper()}: {v}" for k, v in metrics.items()])

        header = f'\"\"\"\nStrategy Optimized via AutoResearch Lab\n'
        header += f'Performance Metrics (Real-Market Tracking Enabled):\n'
        if metrics:
            header += metrics_str + "\n"
        header += f'Date Deployed: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n'
        header += '\"\"\"\n\n'

        # Prepend header to code
        final_code = header + code

        # HITL REFACTOR: Queue for approval instead of direct write
        signal_data = {
            "symbol": "RES", # Research Asset
            "action": "DEPLOY",
            "strategy": "AutoResearch",
            "action_type": "DEPLOY_STRATEGY",
            "ai_reasoning": f"Strategy optimized via AutoResearch. Targets: {metrics}",
            "conviction": 1.0,
            "raw_order_data": json.dumps({
                "filename": filename,
                "code": final_code
            })
        }

        order_id = get_action_manager().queue_for_approval(signal_data)

        return jsonify({
            "status": "success",
            "message": f"Strategy deployment for {filename} queued for approval (ID: {order_id})",
            "id": order_id,
            "hitl_required": True
        }), 200
    except Exception as e:
        logger.error(f"Deployment queue fault: {e}", exc_info=True)
        return jsonify({"error": "Internal error"}), 500

@autoresearch_bp.route("/api/v1/autoresearch/base-code", methods=["GET"])
@require_auth
def api_autoresearch_base_code():
    """
    Returns the source code of a strategy file by name.
    Used to display the base strategy in the Evolution panel before research starts.
    """
    try:
        strategy_name = request.args.get("name", "")
        if not strategy_name:
            return jsonify({"error": "Missing strategy name"}), 400

        base_name = os.path.basename(os.path.normpath(strategy_name.replace(".py", "")))
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'strategies', 'AutoResearch'))
        if not os.path.exists(strat_dir): os.makedirs(strat_dir, exist_ok=True)
        file_path = os.path.join(strat_dir, f"{base_name}.py")

        # Security check
        if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
            return jsonify({"error": "Forbidden path"}), 403

        if not os.path.exists(file_path):
            return jsonify({"status": "not_found", "code": None, "message": f"Strategy file {base_name}.py not found"}), 200

        with open(file_path, 'r') as f:
            code = f.read()

        return jsonify({"status": "success", "code": code, "name": base_name}), 200
    except Exception as e:
        return jsonify({"error": "Internal error"}), 500

@autoresearch_bp.route("/api/v1/autoresearch/save-version", methods=["POST"])
@require_auth
def api_autoresearch_save_version():
    """
    Saves current iteration as a named _autoresearch version file.
    Does NOT require HITL — this is just a file save, not a live deployment.
    """
    try:
        data = request.json or {}
        strategy_name = data.get("name", "")
        code = data.get("code", "")
        metrics = data.get("metrics")
        label = data.get("label", "")

        if not strategy_name or not code:
            return jsonify({"error": "Missing name or code"}), 400

        base_name = strategy_name.replace(".py", "").replace("_autoresearch", "")
        label_suffix = f"_{label}" if label else ""
        filename = f"{base_name}_autoresearch{label_suffix}.py"

        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'strategies', 'AutoResearch'))
        if not os.path.exists(strat_dir): os.makedirs(strat_dir, exist_ok=True)
        filename = os.path.basename(os.path.normpath(filename.replace(":", "/")))
        file_path = os.path.join(strat_dir, filename)

        # Security check
        if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
            return jsonify({"error": "Forbidden path"}), 403

        # Build header
        metrics_lines = ""
        if metrics:
            metrics_lines = "\n".join([f"    # {k.upper()}: {v}" for k, v in metrics.items()])

        header = f'"""\nAutoResearch Lab — Saved Version\n'
        header += f'Base Strategy: {base_name}\n'
        header += f'Label: {label or "v1"}\n'
        if metrics:
            header += f'Performance Metrics:\n{metrics_lines}\n'
        header += f'Saved: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n"""\n\n'

        final_code = header + code

        with open(file_path, 'w') as f:
            f.write(final_code)

        return jsonify({
            "status": "success",
            "message": f"Strategy saved as {filename}",
            "filename": filename
        }), 200
    except Exception as e:
        logger.error(f"Save-version fault: {e}", exc_info=True)
        return jsonify({"error": "Internal error"}), 500
