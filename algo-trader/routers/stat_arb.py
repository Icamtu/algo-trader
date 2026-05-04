from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from services.stat_arb_engine import stat_arb_engine

router = APIRouter()

@router.get("/cointegration")
async def get_cointegration(
    symbol1: str = Query(..., description="First symbol"),
    symbol2: str = Query(..., description="Second symbol"),
    interval: str = Query("1h", description="Time interval (e.g., 1h, 1d)"),
    limit: int = Query(500, description="Data points to analyze")
):
    """Check cointegration between two symbols."""
    result = await stat_arb_engine.check_cointegration(symbol1, symbol2, interval, limit)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.get("/zscore")
async def get_zscore(
    symbol1: str = Query(..., description="First symbol"),
    symbol2: str = Query(..., description="Second symbol"),
    window: int = Query(20, description="Lookback window for Z-score"),
    interval: str = Query("1h", description="Time interval")
):
    """Calculate current Z-score of the spread."""
    result = await stat_arb_engine.calculate_current_zscore(symbol1, symbol2, window, interval)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.post("/scan")
async def scan_pairs(
    universe: List[str] = Body(..., description="List of symbols to scan"),
    interval: str = Query("1h", description="Time interval")
):
    """Scan a universe of symbols for cointegrated pairs."""
    if len(universe) > 20:
        raise HTTPException(status_code=400, detail="Universe too large for real-time scan (max 20)")

    result = await stat_arb_engine.scan_market_for_pairs(universe, interval)
    return result
