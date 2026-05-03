from fastapi import APIRouter, HTTPException, Query, Body, Path
from typing import List, Dict, Any, Optional
import logging
from execution.action_manager import get_action_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["action_center"])
action_manager = get_action_manager()

@router.get("/")
@router.get("/signals")
@router.get("/hitl/signals")
async def get_action_center_data(
    status: str = Query("pending"),
    limit: int = Query(100)
):
    try:
        orders = action_manager.get_action_queue(status=status)
        stats = action_manager.get_statistics()

        return {
            "status": "success",
            "data": {
                "orders": orders,
                "statistics": stats
            }
        }
    except Exception as e:
        logger.error(f"ActionCenter GET Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/approve")
@router.post("/approve/{order_id}")
@router.post("/hitl/approve")
@router.post("/hitl/approve/{order_id}")
async def approve_order(
    order_id: Optional[int] = None,
    ids: Optional[List[int]] = Body(None),
    batch: Optional[str] = Body(None)
):
    try:
        if batch == "all":
            count = await action_manager.approve_all_pending()
            return {"status": "success", "message": f"Approved {count} signals"}

        if ids:
            result = await action_manager.approve_selected(ids)
            return {"status": "success", "data": result}

        if order_id:
            success = await action_manager.approve_order(order_id)
            if success:
                return {"status": "success", "message": "Signal approved and routed"}
            else:
                raise HTTPException(status_code=500, detail="Kernel approval fail or route error")

        raise HTTPException(status_code=400, detail="Missing order ID or batch IDs")
    except Exception as e:
        logger.error(f"ActionCenter Approval Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/reject")
@router.post("/reject/{order_id}")
@router.post("/hitl/reject")
@router.post("/hitl/reject/{order_id}")
async def reject_order(
    order_id: Optional[int] = None,
    ids: Optional[List[int]] = Body(None),
    reason: Optional[str] = Body(None)
):
    try:
        if ids:
            result = action_manager.reject_selected(ids, reason=reason)
            return {"status": "success", "data": result}

        if order_id:
            success = action_manager.reject_order(order_id, reason=reason)
            if success:
                return {"status": "success", "message": "Signal purged from buffer"}
            else:
                raise HTTPException(status_code=500, detail="Purge operation failed")

        raise HTTPException(status_code=400, detail="Missing order ID or batch IDs")
    except Exception as e:
        logger.error(f"ActionCenter Reject Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/auto")
def toggle_auto_execution(enabled: bool = Body(..., embed=True)):
    """Toggles global auto-execution mode."""
    try:
        action_manager.set_auto_execute(enabled)
        return {"status": "success", "auto_execute": action_manager.auto_execute}
    except Exception as e:
        logger.error(f"ActionCenter Auto-Execution Toggle Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/lock")
def toggle_risk_lock(locked: bool = Body(..., embed=True)):
    """Toggles the global risk-execution lock."""
    try:
        action_manager.set_risk_lock(locked)
        return {"status": "success", "risk_lock": action_manager.risk_lock}
    except Exception as e:
        logger.error(f"ActionCenter Risk-Lock Toggle Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/drift")
async def get_drift_audit(limit: int = Query(50)):
    """Retrieves recent state reconciliation drift events."""
    try:
        events = await action_manager.sqlite.get_drift_events_async(limit=limit)
        return {"status": "success", "data": events}
    except Exception as e:
        logger.error(f"ActionCenter Drift Audit Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
