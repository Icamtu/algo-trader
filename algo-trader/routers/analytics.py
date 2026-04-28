from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine
from services.historify_service import historify_service

from services.correlation_engine import correlation_engine
from services.fill_analytics import fill_analytics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analytics"])

# Global instances (initialized via app context - simplified for migration)
_analytics_engine = AnalyticsEngine()
_data_service = None # Will be initialized via a helper
from database.trade_logger import get_trade_logger
from execution.decision_agent import DecisionAgent
from core.context import app_context

def get_data_service():
    global _data_service
    if _data_service is None:
        # For simplicity, we create it here or inject it
        from execution.order_manager import get_order_manager
        _data_service = MarketDataService(get_order_manager())
    return _data_service

@router.get("/analytics/gex")
async def get_gex_analysis(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...)
):
    try:
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        if chain.get("status") == "error":
            raise HTTPException(status_code=500, detail=chain.get("message"))

        results = _analytics_engine.calculate_gex(chain)
        return results
    except Exception as e:
        logger.error(f"GEX API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/iv-smile/smile-data")
async def get_iv_smile(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...)
):
    try:
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        results = _analytics_engine.calculate_iv_smile(chain)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analytics/greeks")
async def get_chain_greeks(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...)
):
    """
    Calculate full Greeks (Delta, Gamma, Theta, Vega, Rho) for an option chain.
    """
    try:
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        if chain.get("status") == "error":
            raise HTTPException(status_code=500, detail=chain.get("message"))

        results = _analytics_engine.calculate_chain_greeks(chain)
        return results
    except Exception as e:
        logger.error(f"Greeks API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historify/watchlist")
def get_watchlist():
    return {"status": "success", "data": historify_service.get_watchlist()}

@router.post("/historify/watchlist")
def add_watchlist(
    symbol: Optional[str] = Body(None),
    symbols: Optional[List[str]] = Body(None),
    exchange: str = Body("NSE")
):
    if symbols:
        res = historify_service.bulk_add_to_watchlist(symbols, exchange)
    elif symbol:
        res = historify_service.add_to_watchlist(symbol, exchange)
    else:
        raise HTTPException(status_code=400, detail="Either 'symbol' or 'symbols' must be provided.")
    return res

@router.delete("/historify/watchlist")
def remove_watchlist(
    symbol: Optional[str] = Body(None),
    symbols: Optional[List[str]] = Body(None),
    exchange: str = Body("NSE")
):
    if symbols:
        res = historify_service.bulk_remove_from_watchlist(symbols, exchange)
    elif symbol:
        res = historify_service.remove_from_watchlist(symbol, exchange)
    else:
        raise HTTPException(status_code=400, detail="Either 'symbol' or 'symbols' must be provided.")
    return res

@router.get("/historify/catalog")
def get_historify_catalog(interval: str = Query("5m")):
    catalog = historify_service.get_catalog(interval)
    return {"status": "success", "data": catalog}

class PurgeRequest(BaseModel):
    symbol: str
    exchange: str = "NSE"
    interval: str = "5m"

@router.delete("/historify/catalog")
def delete_historify_catalog(req: PurgeRequest):
    """Purge historical data for a specific symbol/interval."""
    res = historify_service.delete_catalog_entry(req.symbol, req.exchange, req.interval)
    if res.get("status") == "error":
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res

@router.get("/analytics/historify")
async def get_historify_ohlcv(
    symbol: str = Query(...),
    exchange: str = Query("NSE"),
    interval: str = Query("5m"),
    limit: int = Query(1000)
):
    ohlcv = historify_service.get_records(symbol, exchange, interval, limit)
    return {
        "status": "success",
        "symbol": symbol,
        "exchange": exchange,
        "interval": interval,
        "data": ohlcv
    }

@router.get("/historify/jobs")
def get_historify_jobs(limit: int = Query(50)):
    """Fetch all historical ingestion jobs from DuckDB."""
    jobs = historify_service.get_all_jobs()
    return {"status": "success", "data": jobs[:limit]}

@router.get("/historify/breadth")
def get_historify_breadth(interval: str = Query("5m")):
    """Calculate market breadth metrics from stored OHLCV data."""
    result = historify_service.get_breadth(interval)
    return {"status": "success", "data": result}

@router.get("/historify/stats")
async def get_historify_stats():
    """Get high-level statistics about the Historify database."""
    try:
        stats = historify_service.get_stats()
        return {"status": "success", "data": stats}
    except Exception as e:
        logger.error(f"Error fetching Historify stats: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/historify/symbols")
async def get_historify_symbols():
    """Returns a list of unique symbols available in Historify DuckDB."""
    try:
        catalog = historify_service.get_catalog(interval=None) # Get all
        # Group by symbol
        symbols = {}
        for item in catalog:
            sym = item["symbol"]
            if sym not in symbols:
                symbols[sym] = {
                    "symbol": sym,
                    "exchange": item["exchange"],
                    "intervals": [],
                    "records": 0
                }
            symbols[sym]["intervals"].append(item["interval"])
            symbols[sym]["records"] += item["record_count"]

        return {"status": "success", "data": list(symbols.values())}
    except Exception as e:
        logger.error(f"Error fetching Historify symbols: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/historify/records")
def get_historify_records(
    symbol: str = Query(...),
    exchange: str = Query("NSE"),
    interval: str = Query("5m"),
    limit: int = Query(1000)
):
    """Fetch OHLCV records for a specific symbol from DuckDB."""
    records = historify_service.get_records(symbol, exchange, interval, limit)
    return {"status": "success", "data": records}

@router.get("/historify/schedules")
def get_historify_schedules():
    """Fetch active ingestion scheduler configuration."""
    schedules = historify_service.get_schedules()
    return {"status": "success", "data": schedules}

@router.post("/historify/run-historify")
async def run_historify(
    symbols: Any = Body(...),
    exchange: str = Body("NSE"),
    interval: str = Body("1"),
    from_date: str = Body(...),
    to_date: str = Body(...),
    is_incremental: bool = Body(False)
):
    if isinstance(symbols, str):
        symbol_list = [symbols]
    else:
        symbol_list = symbols

    res = historify_service.trigger_download(symbol_list, exchange, interval, from_date, to_date, is_incremental=is_incremental)
    return res

@router.delete("/historify/jobs/{job_id}")
def cancel_historify_job(job_id: str):
    """Cancel a running or pending historify job by marking it as CANCELLED."""
    from data.historify_db import upsert_job
    try:
        upsert_job(job_id, "CANCELLED")
        return {"status": "success", "message": f"Job {job_id} cancelled."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/historify/export")
def export_historify_data(
    symbol: str = Query(...),
    exchange: str = Query("NSE"),
    interval: str = Query("5m"),
    limit: int = Query(10000)
):
    """Export OHLCV data as JSON for download."""
    records = historify_service.get_records(symbol, exchange, interval, limit)
    return {
        "status": "success",
        "symbol": symbol,
        "exchange": exchange,
        "interval": interval,
        "record_count": len(records),
        "data": records
    }
@router.get("/status")
@router.get("/analyzerstatus")
async def get_analyzer_status():
    """GET /api/v1/analytics/analyzerstatus (aliased to /api/v1/analyzerstatus)"""
    try:
        db_logger = get_trade_logger()
        settings = db_logger.get_system_settings()
        state = settings.get("agent_enabled", "false") == "true"

        runner = app_context.get("strategy_runner")
        telemetry = runner.get_telemetry() if runner else {}

        return {
            "status": "success",
            "state": state,
            "consecutive_failures": getattr(DecisionAgent, "CONSECUTIVE_FAILURES", 0),
            "last_error": getattr(DecisionAgent, "LAST_ERROR", ""),
            "regime": telemetry.get("market_regime", "NEUTRAL"),
            "bias": telemetry.get("bias", "NEUTRAL"),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting analyzer status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/fill-quality")
async def get_fill_quality(
    strategy: str = Query("all"),
    limit: int = Query(1000)
):
    """
    Generate an execution slippage and fill-quality report.
    """
    try:
        results = await fill_analytics.get_fill_quality_report(strategy, limit)
        return results
    except Exception as e:
        logger.error(f"Fill Quality API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/analytics/correlation")
async def get_correlation_matrix(
    symbols: List[str] = Body(...),
    interval: str = Body("D"),
    days: int = Body(30)
):
    """
    Calculate asset correlation matrix for portfolio diversification analysis.
    """
    try:
        results = await correlation_engine.get_asset_correlation_matrix(symbols, interval, days)
        if results.get("status") == "error":
            raise HTTPException(status_code=500, detail=results.get("message"))
        return results
    except Exception as e:
        logger.error(f"Correlation API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analytics/convergence")
async def get_signal_convergence(
    multi_tf_signals: Dict[str, str] = Body(...)
):
    """
    Determine trend strength by analyzing signal convergence across timeframes.
    Input format: {"1m": "BUY", "5m": "BUY", "15m": "NEUTRAL"}
    """
    try:
        results = correlation_engine.analyze_signal_convergence(multi_tf_signals)
        return results
    except Exception as e:
        logger.error(f"Convergence API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
