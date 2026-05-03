from flask import Blueprint, jsonify, request
import os
import json
import logging
import asyncio
import importlib.util
import inspect
import re
from datetime import datetime
from typing import Any, Dict, Optional, Type
from core.context import app_context
from utils.auth import require_auth
from database.trade_logger import get_trade_logger
from services.versioning_service import versioning_service

logger = logging.getLogger(__name__)
strategies_bp = Blueprint('strategies_bp', __name__)

# --- Helper functions ---

def _extract_strategy_params(strategy: Any) -> Dict[str, Any]:
    """Dynamically extract primitive attributes as strategy parameters."""
    params = {}
    # Basic types we want to expose to the UI
    allowed_types = (int, float, str, bool)
    # Exclude internal framework attributes
    excluded = {"name", "symbols", "is_active", "order_manager", "portfolio_manager", "positions"}

    for attr in dir(strategy):
        if attr.startswith("_") or attr in excluded:
            continue
        value = getattr(strategy, attr)
        if isinstance(value, allowed_types) and not callable(value):
            params[attr] = value
    return params

def _load_strategy_class(strategy_id: str) -> Optional[Type]:
    """Dynamically loads a strategy class from the strategies directory."""
    try:
        # Normalize name: aether-scalper -> aether_scalper, AetherScalper -> aether_scalper
        # Convert CamelCase to snake_case
        filename = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', strategy_id)
        filename = re.sub('([a-z0-9])([A-Z])', r'\1_\2', filename).lower()
        filename = filename.replace("-", "_")

        if not filename.endswith(".py"):
            filename += ".py"

        # Correct path for strategies
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
        filename = os.path.basename(os.path.normpath(filename.replace(":", "/")))
        file_path = os.path.join(strat_dir, filename)

        if not os.path.exists(file_path):
            return None

        # Import module
        module_name = f"strategies.{filename[:-3]}"
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find Strategy class
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if obj.__module__ == module_name and name != "BaseStrategy":
                return obj

        return None
    except Exception as e:
        logger.error(f"Error loading strategy class {strategy_id}: {e}")
        return None

def _find_strategy_by_id(strategy_runner, strategy_id: str):
    """Find strategy by ID (normalized name)."""
    for strategy in strategy_runner.strategies:
        if strategy.name.lower().replace(" ", "-") == strategy_id.lower():
            return strategy
    return None

def _infer_strategy_mode(strategy_name: str) -> str:
    """Infer strategy mode from name."""
    name_lower = strategy_name.lower()
    if "intraday" in name_lower or "scalp" in name_lower:
        return "Scalping"
    elif "swing" in name_lower or "trend" in name_lower:
        return "Trend Capture"
    elif "long" in name_lower or "position" in name_lower:
        return "Position"
    else:
        return "Custom"

def _get_strategy_description(strategy_name: str) -> str:
    """Get strategy description from name."""
    name_lower = strategy_name.lower()
    if "intraday" in name_lower:
        return "Fast threshold-based strategy tuned for rapid session reversals."
    elif "swing" in name_lower:
        return "EMA-based trend tracker for multi-session directional continuation."
    elif "long" in name_lower:
        return "Trend plus RSI confirmation for lower-frequency conviction entries."
    elif "sample" in name_lower:
        return "Sample strategy for testing and development."
    else:
        return "User-defined trading strategy."

# --- Security Helpers ---

STRAT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))

def _get_safe_path(filename: str) -> str:
    """Ensures the filename is safe and stays within the strategy directory."""
    # Normalize path and extract only the filename part to prevent ../ traversal
    safe_filename = os.path.basename(os.path.normpath(filename.replace(":", "/")))
    
    # Re-check extension for safety
    if not any(safe_filename.endswith(ext) for ext in (".py", ".json", ".yaml", ".yml")):
         # Default to .py if no extension
         if "." not in safe_filename:
             safe_filename += ".py"
             
    target_path = os.path.abspath(os.path.join(STRAT_DIR, safe_filename))
    
    # Final check: Must start with STRAT_DIR
    if not target_path.startswith(STRAT_DIR):
        raise PermissionError("Path Traversal Attempt Detected")
        
    return target_path


# --- Routes ---

@strategies_bp.route("/api/v1/strategies/files", methods=["GET"])
@require_auth
def list_strategy_files():
    """Returns list of strategy files in the strategies directory."""
    try:
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
        allowed_exts = (".py", ".json", ".yaml", ".yml")
        files = []
        for root, _, filenames in os.walk(strat_dir):
            for f in filenames:
                if f.endswith(allowed_exts) and f != "__init__.py":
                    rel_path = os.path.relpath(os.path.join(root, f), strat_dir)
                    files.append(rel_path)
        return jsonify({"files": files}), 200
    except Exception as e:
        logger.error(f"Error listing strategy files: {e}")
        return jsonify({"error": "Failed to list strategy files"}), 500

@strategies_bp.route("/api/v1/strategies/files/<filename>", methods=["GET"])
@require_auth
def get_strategy_file(filename):
    """Returns the content of a specific strategy file."""
    try:
        file_path = _get_safe_path(filename)
        if not os.path.exists(file_path):
            return jsonify({"status": "error", "message": "File not found"}), 404
            
        with open(file_path, "r") as f:
            content = f.read()
        return jsonify({"filename": os.path.basename(file_path), "content": content})
    except PermissionError as e:
        return jsonify({"status": "error", "message": "Access denied"}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": "Internal error"}), 500

@strategies_bp.route("/api/v1/strategies/status", methods=["GET"])
@require_auth
def get_all_strategies_status():
    """Returns the initialization and halt status of all strategy kernels."""
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            return jsonify({"error": "Strategy runner not initialized"}), 503

        status_map = strategy_runner.get_strategy_matrix()
        return jsonify(status_map), 200
    except Exception as e:
        logger.error(f"Strategy Status Error: {e}")
        return jsonify({"error": "Strategy status unavailable"}), 500

@strategies_bp.route("/api/v1/strategies/halt", methods=["POST"])
@require_auth
async def halt_strategy():
    try:
        data = request.json or {}
        strategy_name = data.get("strategy")
        if not strategy_name:
            return jsonify({"error": "Missing strategy name"}), 400

        strategy_runner = app_context.get("strategy_runner")
        success = await strategy_runner.halt_strategy(strategy_name)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/unhalt", methods=["POST"])
@require_auth
async def unhalt_strategy():
    try:
        data = request.json or {}
        strategy_name = data.get("strategy")
        if not strategy_name:
            return jsonify({"error": "Missing strategy name"}), 400

        strategy_runner = app_context.get("strategy_runner")
        success = await strategy_runner.unhalt_strategy(strategy_name)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/initialize", methods=["POST"])
@require_auth
def initialize_strategy():
    try:
        data = request.json or {}
        strategy_name = data.get("strategy")
        if not strategy_name:
            return jsonify({"error": "Missing strategy name"}), 400

        strategy_runner = app_context.get("strategy_runner")
        success = strategy_runner.initialize_strategy(strategy_name)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/liquidate", methods=["POST"])
@require_auth
async def liquidate_strategy():
    try:
        data = request.json or {}
        strategy_name = data.get("strategy")
        if not strategy_name:
            return jsonify({"error": "Missing strategy name"}), 400

        order_manager = app_context.get("order_manager")
        success = await order_manager.liquidate_strategy(strategy_name)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/safeguards/<strategy_id>", methods=["GET", "POST"])
@require_auth
def manage_strategy_safeguards(strategy_id):
    db_logger = get_trade_logger()
    if request.method == "GET":
        safeguards = db_logger.get_strategy_safeguards(strategy_id)
        return jsonify(safeguards), 200

    data = request.json or {}
    db_logger.update_strategy_safeguard(strategy_id, data)
    return jsonify({"status": "success"}), 200

@strategies_bp.route("/api/v1/strategies/files/<filename>", methods=["POST", "PUT"])
@require_auth
def save_strategy_file(filename):
    data = request.json
    content = data.get("content", "")
    message = data.get("message", "Update via Trading UI")
    
    try:
        file_path = _get_safe_path(filename)
        with open(file_path, "w") as f:
            f.write(content)
            
        # Versioning
        try:
            strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
            versions_dir = os.path.join(strat_dir, ".versions", filename)
            os.makedirs(versions_dir, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            with open(os.path.join(versions_dir, f"{timestamp}.txt"), "w") as vf:
                vf.write(content)
        except Exception as e:
            logger.warning(f"Backup versioning failed for {filename}: {e}")
            
        return jsonify({"status": "success", "message": f"Strategy {filename} saved successfully"}), 200
    except PermissionError as e:
        return jsonify({"status": "error", "message": "Access denied"}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": "Internal error"}), 500

@strategies_bp.route("/api/v1/strategies/files/<filename>", methods=["DELETE"])
@require_auth
def delete_strategy_file(filename):
    try:
        file_path = _get_safe_path(filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"status": "success", "message": f"Strategy {filename} deleted"})
        return jsonify({"status": "error", "message": "File not found"}), 404
    except PermissionError as e:
        return jsonify({"status": "error", "message": "Access denied"}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": "Internal error"}), 500

@strategies_bp.route("/api/v1/strategies", methods=["GET"])
@require_auth
def list_strategies():
    """Returns list of all available strategies with their current state."""
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            return jsonify({"error": "Strategy runner not initialized"}), 503

        discovered = getattr(strategy_runner, "_definitions_by_key", {})
        active = getattr(strategy_runner, "_strategies_by_key", {})

        try:
            trade_logger = get_trade_logger()
        except Exception:
            trade_logger = None

        strategies = []
        for key, definition in discovered.items():
            instance = active.get(key)
            is_active = instance is not None

            pnl = 0.0
            if trade_logger:
                try:
                    pnl_data = trade_logger.get_strategy_pnl(definition.class_name)
                    pnl = pnl_data.get("total_pnl", 0.0) if isinstance(pnl_data, dict) else 0.0
                except Exception:
                    pnl = 0.0

            strategies.append({
                "id": key,
                "name": definition.class_name,
                "symbols": instance.symbols if is_active else [],
                "is_active": is_active,
                "mode": _infer_strategy_mode(definition.class_name),
                "description": getattr(definition, "description", ""),
                "params": _extract_strategy_params(instance) if instance else {},
                "pnl": pnl,
            })

        return jsonify({"strategies": strategies, "count": len(strategies)}), 200
    except Exception as e:
        logger.error(f"Error listing strategies: {e}", exc_info=True)
        return jsonify({"error": "Strategy discovery failed"}), 500

@strategies_bp.route("/api/v1/strategies/<strategy_id>/performance", methods=["GET"])
def get_strategy_performance_bp(strategy_id):
    """GET /api/v1/strategies/<id>/performance - Returns granular metrics."""
    try:
        from database.trade_logger import get_trade_logger
        trade_logger = get_trade_logger()
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        metrics = loop.run_until_complete(trade_logger.get_strategy_metrics_async(strategy_id))
        loop.close()
        return jsonify({"status": "success", "strategy": strategy_id, "metrics": metrics})
    except Exception as e:
        logger.error(f"Blueprint error fetching performance for {strategy_id}: {e}")
        return jsonify({"status": "success", "strategy": strategy_id, "metrics": {"net_pnl": 0.0, "total_trades": 0}})

@strategies_bp.route("/api/v1/strategies/<strategy_id>/orders", methods=["GET"])
def get_strategy_orders_bp(strategy_id):
    """GET /api/v1/strategies/<id>/orders - Returns order history."""
    try:
        from database.trade_logger import get_trade_logger
        trade_logger = get_trade_logger()
        limit = request.args.get('limit', 100, type=int)
        trades = trade_logger.get_trades_by_strategy(strategy_id, limit)
        return jsonify({
            "status": "success",
            "strategy": strategy_id,
            "orders": [t.to_dict() for t in trades],
            "count": len(trades)
        })
    except Exception as e:
        logger.error(f"Blueprint error fetching orders for {strategy_id}: {e}")
        return jsonify({"status": "success", "orders": [], "count": 0})

@strategies_bp.route("/api/v1/strategies/<strategy_id>", methods=["GET"])
@require_auth
def get_strategy_details(strategy_id):
    """Returns detailed information about a specific strategy."""
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            return jsonify({"error": "Strategy runner not initialized"}), 503

        strategy = _find_strategy_by_id(strategy_runner, strategy_id)
        if not strategy:
            return jsonify({"error": f"Strategy {strategy_id} not found"}), 404

        return jsonify({
            "id": strategy_id,
            "name": strategy.name,
            "symbols": strategy.symbols,
            "params": _extract_strategy_params(strategy),
            "is_active": True # If it's in the strategies list, it's active
        }), 200
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/<strategy_id>/start", methods=["POST"])
@require_auth
def start_strategy(strategy_id):
    """Starts a specific strategy."""
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            return jsonify({"error": "Strategy runner not initialized"}), 503

        success = strategy_runner.initialize_strategy(strategy_id)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/strategies/<strategy_id>/stop", methods=["POST"])
@require_auth
def stop_strategy(strategy_id):
    """Stops a specific strategy."""
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            return jsonify({"error": "Strategy runner not initialized"}), 503

        success = strategy_runner.halt_strategy(strategy_id)
        return jsonify({"status": "success" if success else "failed"}), 200 if success else 500
    except Exception as e:
        logger.error(f"Internal Kernel Error: {e}"); return jsonify({"error": "Internal kernel exception"}), 500

@strategies_bp.route("/api/v1/backtest/run", methods=["POST"])
@require_auth
async def run_backtest():
    """Runs a backtest for a specific strategy and symbol."""
    try:
        from core.backtest_engine import BacktestEngine
        data = request.json or {}
        strategy_id = data.get("strategy_id") or data.get("strategy_key")
        symbol = data.get("symbol")
        days = int(data.get("days", 7))
        interval = data.get("interval", "1m")
        params = data.get("params", {})
        initial_cash = float(data.get("initial_cash", 1000000.0))
        slippage = float(data.get("slippage", 0.0005))

        if not strategy_id or not symbol:
            return jsonify({"status": "error", "message": "Missing strategy_id or symbol"}), 400

        strat_class = _load_strategy_class(strategy_id)
        if not strat_class:
            return jsonify({"status": "error", "message": f"Strategy {strategy_id} not found"}), 404

        engine = BacktestEngine(
            strategy_class=strat_class,
            symbol=symbol,
            days=days,
            interval=interval,
            params=params,
            initial_cash=initial_cash,
            slippage=slippage
        )

        result = await engine.run()
        return jsonify({"status": "success", "result": result}), 200
    except Exception as e:
        logger.error(f"Backtest Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Backtest execution failed"}), 500
@strategies_bp.route("/api/v1/strategies/files/<filename>/versions", methods=["GET"])
@require_auth
def get_strategy_versions(filename):
    """Returns the version history of a specific strategy file."""
    try:
        allowed_exts = (".py", ".json", ".yaml", ".yml")
        if not filename.endswith(allowed_exts):
            filename += ".py"
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
        filename = os.path.basename(os.path.normpath(filename.replace(":", "/")))
        versions_dir = os.path.normpath(os.path.join(strat_dir, ".versions", filename))

        if not versions_dir.startswith(strat_dir):
            return jsonify({"error": "Forbidden path"}), 403

        versions = []
        if os.path.exists(versions_dir):
            for f in os.listdir(versions_dir):
                if f.endswith(".txt"):
                    with open(os.path.join(versions_dir, f), "r") as vfile:
                        content = vfile.read()
                    versions.append({
                        "timestamp": f.replace(".txt", ""),
                        "content": content
                    })

        # sort by timestamp descending
        versions.sort(key=lambda x: x["timestamp"], reverse=True)
        return jsonify({"versions": versions}), 200
    except Exception as e:
        logger.error(f"Error fetching strategy versions for {filename}: {e}")
        return jsonify({"error": "Version history unavailable"}), 500

@strategies_bp.route("/api/v1/strategies/files/<filename>/rename", methods=["POST"])
@require_auth
def rename_strategy_file(filename):
    """Renames a specific strategy file."""
    try:
        file_path = _get_safe_path(filename)
        
        data = request.json or {}
        new_filename = data.get("new_filename")
        if not new_filename:
            return jsonify({"error": "No new_filename provided"}), 400

        new_file_path = _get_safe_path(new_filename)

        if not os.path.exists(file_path):
            return jsonify({"error": "Source file not found"}), 404

        if os.path.exists(new_file_path):
            return jsonify({"error": "Destination file already exists"}), 400

        os.rename(file_path, new_file_path)
        return jsonify({"status": "success", "message": f"Strategy renamed successfully"}), 200
    except PermissionError:
        return jsonify({"error": "Access denied"}), 403
    except Exception as e:
        logger.error(f"Error renaming strategy file {filename}: {e}")
        return jsonify({"error": "Rename operation failed"}), 500

@strategies_bp.route("/api/v1/strategies", methods=["POST"])
@require_auth
def create_strategy():
    """
    POST /api/strategies
    Creates a new strategy instance (file).
    """
    try:
        data = request.json or {}
        name = data.get("name")
        template = data.get("template", "aether_scalper")

        if not name:
            return jsonify({"error": "Strategy name required"}), 400

        file_path = _get_safe_path(name)
        if os.path.exists(file_path):
            return jsonify({"error": "Strategy already exists"}), 400

        # Load template safely
        template_path = _get_safe_path(template)
        if not os.path.exists(template_path):
            template_path = os.path.join(STRAT_DIR, "aether_scalper.py")

        with open(template_path, "r") as f:
            content = f.read()

        # Simple template replacement
        safe_class_name = re.sub(r'[^a-zA-Z0-9]', '', name.title())
        content = content.replace("AetherScalper", safe_class_name)

        with open(file_path, "w") as f:
            f.write(content)

        return jsonify({
            "status": "success",
            "message": "Strategy created",
            "id": os.path.basename(file_path).replace(".py", "")
        }), 201
    except PermissionError:
        return jsonify({"error": "Access denied"}), 403
    except Exception as e:
        logger.error(f"Error creating strategy: {e}", exc_info=True)
        return jsonify({"error": "Strategy creation failed"}), 500

@strategies_bp.route("/api/v1/strategies/<strategy_id>", methods=["DELETE"])
@require_auth
def delete_strategy(strategy_id):
    """
    DELETE /api/strategies/{strategy_id}
    Deletes a specific strategy file.
    """
    try:
        # First stop the strategy if it's running
        strategy_runner = app_context.get("strategy_runner")
        if strategy_runner:
            strategy = _find_strategy_by_id(strategy_runner, strategy_id)
            if strategy and hasattr(strategy, "stop"):
                strategy.stop()

        # Find and delete the file safely
        file_path = _get_safe_path(strategy_id)

        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted strategy file: {file_path}")
            return jsonify({"status": "success", "message": "Strategy deleted"}), 200

        return jsonify({"error": "Strategy file not found"}), 404
    except PermissionError:
        return jsonify({"error": "Access denied"}), 403
    except Exception as e:
        logger.error(f"Error deleting strategy {strategy_id}: {e}", exc_info=True)
        return jsonify({"error": "Delete operation failed"}), 500

@strategies_bp.route("/api/v1/strategies/optimize", methods=["POST"])
@require_auth
async def optimize_strategy():
    """
    POST /api/v1/strategies/optimize
    Runs a grid search optimization for a strategy.
    """
    try:
        from core.optimizer import GridSearchOptimizer
        data = request.json or {}
        strategy_id = data.get("strategy_id")
        symbol = data.get("symbol")
        param_grid = data.get("param_grid") # e.g. {"rsi_period": [10, 14, 20]}
        days = int(data.get("days", 7))
        target_metric = data.get("target_metric", "profit_factor")

        if not strategy_id or not symbol or not param_grid:
            return jsonify({"status": "error", "message": "Missing required fields"}), 400

        strat_class = _load_strategy_class(strategy_id)
        if not strat_class:
            return jsonify({"status": "error", "message": f"Strategy {strategy_id} not found"}), 404

        optimizer = GridSearchOptimizer(strat_class, symbol, param_grid, days=days)
        results = await optimizer.run(target_metric=target_metric)

        return jsonify({
            "status": "success",
            "strategy_id": strategy_id,
            "symbol": symbol,
            "results": results[:20] # Return top 20 combinations
        }), 200
    except Exception as e:
        logger.error(f"Optimization API Error: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Optimization failed to start"}), 500
