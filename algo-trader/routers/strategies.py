from fastapi import APIRouter, Request, HTTPException, Depends, Query, Body
import os
import json
import logging
import asyncio
import importlib.util
import inspect
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Type
from core.context import app_context
from database.trade_logger import get_trade_logger
from services.versioning_service import versioning_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Strategies"])

# --- Models ---
class StrategyHaltRequest(BaseModel):
    strategy: Optional[str] = None

class StrategyCreateRequest(BaseModel):
    name: str
    template: Optional[str] = "aether_scalper"

class FileSaveRequest(BaseModel):
    content: str
    message: Optional[str] = "Update via Trading UI"

# --- Helpers (Ported from Blueprint) ---

def _extract_strategy_params(strategy: Any) -> Dict[str, Any]:
    params = {}
    allowed_types = (int, float, str, bool)
    excluded = {"name", "symbols", "is_active", "order_manager", "portfolio_manager", "positions"}
    for attr in dir(strategy):
        if attr.startswith("_") or attr in excluded:
            continue
        try:
            value = getattr(strategy, attr)
            if isinstance(value, allowed_types) and not callable(value):
                params[attr] = value
        except Exception:
            continue
    return params

def _infer_strategy_mode(strategy_name: str) -> str:
    name_lower = strategy_name.lower()
    if "intraday" in name_lower or "scalp" in name_lower: return "Scalping"
    if "swing" in name_lower or "trend" in name_lower: return "Trend Capture"
    if "long" in name_lower or "position" in name_lower: return "Position"
    return "Custom"

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
        raise HTTPException(status_code=403, detail="Path Traversal Attempt Detected")
        
    return target_path

# --- Routes ---

@router.get("/strategies/files")
async def list_strategy_files():
    try:
        strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
        allowed_exts = (".py", ".json", ".yaml", ".yml")
        files = []
        for root, _, filenames in os.walk(strat_dir):
            for f in filenames:
                if f.endswith(allowed_exts) and f != "__init__.py":
                    rel_path = os.path.relpath(os.path.join(root, f), strat_dir)
                    files.append(rel_path)
        return {"files": files}
    except Exception as e:
        logger.error(f"Error listing strategy files: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/strategies/status")
async def get_all_strategies_status():
    strategy_runner = app_context.get("strategy_runner")
    if not strategy_runner:
        raise HTTPException(status_code=503, detail="Strategy runner not initialized")
    try:
        return strategy_runner.get_strategy_matrix()
    except Exception as e:
        logger.error(f"Strategy Status Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/strategies/halt")
@router.post("/strategies/{strategy_id}/halt")
@router.post("/strategies/{strategy_id}/stop")
async def halt_strategy(request: Optional[StrategyHaltRequest] = Body(None), strategy_id: Optional[str] = None):
    try:
        logger.info(f"API CALL >> halt_strategy | ID: {strategy_id} | Body: {request}")
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            logger.error("halt_strategy: Strategy runner not initialized")
            raise HTTPException(status_code=503, detail="Strategy runner not initialized")

        target_strategy = strategy_id or (request.strategy if request else None)
        if not target_strategy:
            logger.error("halt_strategy: Strategy ID missing")
            raise HTTPException(status_code=400, detail="Strategy ID required")

        logger.info(f"HALTING strategy: {target_strategy}")
        success = await strategy_runner.halt_strategy(target_strategy)
        logger.info(f"HALT result for {target_strategy}: {success}")
        return {"status": "success" if success else "failed"}
    except Exception as e:
        logger.error(f"FATAL ERROR in halt_strategy: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/strategies/unhalt")
@router.post("/strategies/{strategy_id}/unhalt")
@router.post("/strategies/{strategy_id}/start")
async def unhalt_strategy(request: Optional[StrategyHaltRequest] = Body(None), strategy_id: Optional[str] = None):
    try:
        logger.info(f"API CALL >> unhalt_strategy | ID: {strategy_id} | Body: {request}")
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            logger.error("unhalt_strategy: Strategy runner not initialized")
            raise HTTPException(status_code=503, detail="Strategy runner not initialized")

        target_strategy = strategy_id or (request.strategy if request else None)
        if not target_strategy:
            logger.error("unhalt_strategy: Strategy ID missing")
            raise HTTPException(status_code=400, detail="Strategy ID required")

        logger.info(f"UNHALTING strategy: {target_strategy}")
        success = await strategy_runner.unhalt_strategy(target_strategy)
        logger.info(f"UNHALT result for {target_strategy}: {success}")
        return {"status": "success" if success else "failed"}
    except Exception as e:
        logger.error(f"FATAL ERROR in unhalt_strategy: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/strategies")
async def list_strategies():
    try:
        strategy_runner = app_context.get("strategy_runner")
        if not strategy_runner:
            raise HTTPException(status_code=503, detail="Strategy runner not initialized")

        discovered = getattr(strategy_runner, "_definitions_by_key", {})
        active = getattr(strategy_runner, "_strategies_by_key", {})

        from database.trade_logger import get_trade_logger
        trade_logger = get_trade_logger()

        strategies = []
        for key, definition in discovered.items():
            instance = active.get(key)
            is_active = instance is not None
            pnl = 0.0
            if trade_logger:
                try:
                    pnl_data = trade_logger.get_strategy_pnl(definition.class_name)
                    pnl = pnl_data.get("total_pnl", 0.0) if isinstance(pnl_data, dict) else 0.0
                except Exception: pass

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
        return {"strategies": strategies, "count": len(strategies)}
    except Exception as e:
        logger.error(f"Error listing strategies: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/strategies/{strategy_id}/performance")
async def get_strategy_performance(strategy_id: str):
    """GET /api/v1/strategies/{id}/performance - Returns granular PnL and trade metrics."""
    try:
        trade_logger = get_trade_logger()
        # Strategy ID might be normalized (snake_case) or display name
        metrics = await trade_logger.get_strategy_metrics_async(strategy_id)

        # If no metrics found for snake_case, try class_name if possible
        if metrics.get("total_trades", 0) == 0:
            # Simple heuristic for class name conversion
            class_name = "".join(x.capitalize() for x in strategy_id.replace("-", "_").split("_"))
            alt_metrics = await trade_logger.get_strategy_metrics_async(class_name)
            if alt_metrics.get("total_trades", 0) > 0:
                metrics = alt_metrics

        return {
            "status": "success",
            "strategy": strategy_id,
            "metrics": metrics
        }
    except Exception as e:
        logger.error(f"Error fetching strategy performance for {strategy_id}: {e}")
        return {"status": "success", "strategy": strategy_id, "metrics": {"net_pnl": 0.0, "total_trades": 0}}

@router.get("/strategies/{strategy_id}/orders")
async def get_strategy_orders(strategy_id: str, limit: int = Query(100)):
    """GET /api/v1/strategies/{id}/orders - Returns recent order history for a strategy."""
    try:
        trade_logger = get_trade_logger()
        trades = await asyncio.to_thread(trade_logger.get_trades_by_strategy, strategy_id, limit)

        # If no trades found for snake_case, try class_name
        if not trades:
            class_name = "".join(x.capitalize() for x in strategy_id.replace("-", "_").split("_"))
            trades = await asyncio.to_thread(trade_logger.get_trades_by_strategy, class_name, limit)

        return {
            "status": "success",
            "strategy": strategy_id,
            "orders": [t.to_dict() for t in trades],
            "count": len(trades)
        }
    except Exception as e:
        logger.error(f"Error fetching strategy orders for {strategy_id}: {e}")
        return {"status": "success", "orders": [], "count": 0}

@router.post("/strategies/liquidate")
@router.post("/strategies/{strategy_id}/liquidate")
async def liquidate_strategy(request: Optional[StrategyHaltRequest] = Body(None), strategy_id: Optional[str] = None):
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")

    target_strategy = strategy_id or (request.strategy if request else None)
    if not target_strategy:
        raise HTTPException(status_code=400, detail="Strategy ID required")

    try:
        result = await order_manager.liquidate_strategy(target_strategy)
        return result
    except Exception as e:
        logger.error(f"Liquidate strategy failure: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/strategies/files/{filename}")
async def get_strategy_file(filename: str):
    try:
        file_path = _get_safe_path(filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        with open(file_path, "r") as f:
            content = f.read()
        return {"filename": os.path.basename(file_path), "content": content}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error reading strategy file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.put("/strategies/files/{filename}")
async def save_strategy_file(filename: str, request: FileSaveRequest):
    try:
        file_path = _get_safe_path(filename)
        with open(file_path, "w") as f:
            f.write(request.content)

        # Versioning via Git
        try:
            strategy_id = os.path.basename(file_path).replace(".py", "")
            versioning_service.commit_strategy(strategy_id, request.message)
        except Exception as e:
            logger.warning(f"Git versioning failed for {filename}: {e}")

        return {"status": "success", "message": f"Strategy {filename} saved"}
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error saving strategy file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.delete("/strategies/files/{filename}")
async def delete_strategy_file(filename: str):
    try:
        file_path = _get_safe_path(filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return {"status": "success", "message": f"Strategy {filename} deleted"}
        raise HTTPException(status_code=404, detail="File not found")
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error deleting strategy file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/strategies/history/{strategy_id}")
async def get_strategy_version_history(strategy_id: str):
    """Fetch git-based version history for a strategy."""
    history = versioning_service.get_strategy_history(strategy_id)
    return {"status": "success", "history": history}

@router.get("/strategies/diff/{strategy_id}")
async def get_strategy_version_diff(
    strategy_id: str,
    hash_a: str = Query(...),
    hash_b: str = Query("HEAD")
):
    """Fetch diff between two versions of a strategy."""
    diff = versioning_service.get_strategy_diff(strategy_id, hash_a, hash_b)
    return {"status": "success", "diff": diff}
