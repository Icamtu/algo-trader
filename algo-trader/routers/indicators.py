from fastapi import APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
import logging
import pandas as pd
from services.indicator_service import indicator_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/list")
async def list_indicators():
    """List all custom indicators."""
    return {"status": "success", "indicators": indicator_service.get_indicators()}

@router.post("/save")
async def save_indicator(
    name: str = Body(...),
    code: str = Body(...)
):
    """Save a new custom indicator."""
    try:
        path = indicator_service.save_indicator(name, code)
        return {"status": "success", "path": path}
    except Exception:
        logger.error("Save Indicator Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/calculate")
async def calculate_indicator(
    name: str = Body(...),
    candles: List[Dict[str, Any]] = Body(...),
    params: Dict[str, Any] = Body({})
):
    """Calculate a custom indicator on provided candles."""
    try:
        df = pd.DataFrame(candles)
        if df.empty:
            raise HTTPException(status_code=400, detail="Empty candle data")

        result = indicator_service.calculate(name, df, params)

        # Convert Series to list for JSON response
        if isinstance(result, pd.Series):
            res_list = result.tolist()
        elif isinstance(result, pd.DataFrame):
            res_list = result.to_dict(orient='records')
        else:
            res_list = list(result)

        return {"status": "success", "result": res_list}
    except Exception:
        logger.error("Calculate Indicator Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")
