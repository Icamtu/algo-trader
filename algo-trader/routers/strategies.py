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
from services.versioning_service import versioning_service
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["Strategies"])

# --- Models ---
class StrategyHaltRequest(BaseModel):
    strategy: str

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
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/strategies/status")
async def get_all_strategies_status():
    strategy_runner = app_context.get("strategy_runner")
    if not strategy_runner:
        raise HTTPException(status_code=503, detail="Strategy runner not initialized")
    try:
        return strategy_runner.get_strategy_matrix()
    except Exception as e:
        logger.error(f"Strategy Status Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/strategies/halt")
async def halt_strategy(request: StrategyHaltRequest):
    strategy_runner = app_context.get("strategy_runner")
    if not strategy_runner:
        raise HTTPException(status_code=503, detail="Strategy runner not initialized")
    success = strategy_runner.halt_strategy(request.strategy)
    return {"status": "success" if success else "failed"}

@router.post("/strategies/unhalt")
async def unhalt_strategy(request: StrategyHaltRequest):
    strategy_runner = app_context.get("strategy_runner")
    if not strategy_runner:
        raise HTTPException(status_code=503, detail="Strategy runner not initialized")
    success = strategy_runner.unhalt_strategy(request.strategy)
    return {"status": "success" if success else "failed"}

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
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/strategies/liquidate")
async def liquidate_strategy(request: StrategyHaltRequest):
    order_manager = app_context.get("order_manager")
    if not order_manager:
        raise HTTPException(status_code=503, detail="Order manager not initialized")
    try:
        result = await order_manager.liquidate_strategy(request.strategy)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/strategies/files/{filename}")
async def get_strategy_file(filename: str):
    strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
    filename = filename.replace(":", "/")
    file_path = os.path.join(strat_dir, filename)
    if not os.path.exists(file_path):
        if not any(filename.endswith(ext) for ext in (".py", ".json", ".yaml", ".yml")):
            file_path += ".py"

    if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
        raise HTTPException(status_code=403, detail="Forbidden path")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(file_path, "r") as f:
        content = f.read()
    return {"filename": filename, "content": content}

@router.put("/strategies/files/{filename}")
async def save_strategy_file(filename: str, request: FileSaveRequest):
    strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
    filename = filename.replace(":", "/")
    if not any(filename.endswith(ext) for ext in (".py", ".json", ".yaml", ".yml")):
        filename += ".py"
    file_path = os.path.join(strat_dir, filename)

    if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
        raise HTTPException(status_code=403, detail="Forbidden path")

    with open(file_path, "w") as f:
        f.write(request.content)

    # Versioning via Git
    try:
        strategy_id = filename.replace(".py", "")
        versioning_service.commit_strategy(strategy_id, request.message)
    except Exception as e:
        logger.warning(f"Git versioning failed for {filename}: {e}")

    return {"status": "success", "message": f"Strategy {filename} saved"}

@router.delete("/strategies/files/{filename}")
async def delete_strategy_file(filename: str):
    strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "strategies"))
    filename = filename.replace(":", "/")
    file_path = os.path.join(strat_dir, filename)
    if not os.path.exists(file_path) and not filename.endswith(".py"):
        file_path += ".py"

    if not os.path.abspath(file_path).startswith(os.path.abspath(strat_dir)):
        raise HTTPException(status_code=403, detail="Forbidden path")
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"status": "success", "message": f"Strategy {filename} deleted"}
    raise HTTPException(status_code=404, detail="File not found")

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
