from fastapi import APIRouter, HTTPException, Query, Body, Request
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging
import os
import re
import time
import asyncio
import jwt
from services.market_data_service import MarketDataService
from services.analytics_engine import AnalyticsEngine
from services.historify_service import historify_service

from services.correlation_engine import correlation_engine
from services.fill_analytics import fill_analytics

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analytics"])

JWT_SECRET = os.environ.get("JWT_SECRET", "")

_EXPIRY_RE = re.compile(r"^\d{2}[A-Z]{3}\d{2}$")
_SYMBOL_RE = re.compile(r"^[A-Z0-9&_\-]{1,30}$")
_VALID_EXCHANGES = {"NSE", "BSE", "NFO", "BFO", "MCX", "CDS"}

# --- WebSocket Configuration ---
@router.get("/api/websocket/config")
async def get_websocket_config(request: Request):
    """
    Returns the WebSocket configuration for the frontend MarketDataManager.
    Maps to the unified AetherDesk FastAPI relay.
    """
    host = request.headers.get("host", "localhost")
    protocol = "wss" if request.url.scheme == "https" else "ws"

    # Nginx path mapping: /algo-ws -> algo_engine:18788/ws
    ws_url = f"{protocol}://{host}/algo-ws"

    return {
        "status": "success",
        "websocket_url": ws_url,
        "engine": "AetherDesk Prime FastAPI",
        "version": "1.2.0"
    }

@router.post("/api/websocket/apikey")
@router.get("/api/websocket/apikey")
async def get_websocket_apikey(request: Request):
    """
    Returns an API key for WebSocket authentication.
    Exchanges a valid Supabase token for a unified engine key.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()

    # If the token is valid, we just return it as the apikey.
    # The WebSocket handler will verify it using the same JWT_SECRET.
    try:
        # Check if it's already a valid JWT for our engine
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        return {"status": "success", "api_key": token}
    except Exception:
        # If not a valid JWT for us (e.g. Supabase token signed with different secret),
        # we issue a new one signed with our JWT_SECRET if the user is authenticated.
        # For now, we'll just return the token and let the WS handler deal with it,
        # or we can issue a 'test-token' if in paper mode.
        if os.getenv("TRADING_MODE", "paper") == "paper":
            return {"status": "success", "api_key": "test-token"}

        # Fallback: return the token as is, maybe it's valid for the WS handler
        return {"status": "success", "api_key": token}

def _validate_option_params(underlying: str, exchange: str, expiry_date: str):
    if not _SYMBOL_RE.match(underlying.upper()):
        raise HTTPException(status_code=422, detail="Invalid underlying symbol")
    if exchange.upper() not in _VALID_EXCHANGES:
        raise HTTPException(status_code=422, detail=f"Invalid exchange. Allowed: {', '.join(sorted(_VALID_EXCHANGES))}")
    if not _EXPIRY_RE.match(expiry_date.upper()):
        raise HTTPException(status_code=422, detail="Invalid expiry_date format — expected DDMMMYY (e.g. 27APR25)")

# Delete rate limit: 10 deletes/minute per IP
_delete_rate: Dict[str, tuple] = {}

def _check_delete_rate(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    count, window_start = _delete_rate.get(client_ip, (0, now))
    if now - window_start > 60:
        count, window_start = 0, now
    if count >= 10:
        raise HTTPException(status_code=429, detail="Rate limit: max 10 deletes per minute")
    _delete_rate[client_ip] = (count + 1, window_start)

def _get_user_id(request: Request) -> Optional[str]:
    """Extract user email from JWT Bearer token, returns None if absent/invalid."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        return payload.get("email") or payload.get("sub")
    except Exception:
        return None

# Global instances (initialized via app context - simplified for migration)
_analytics_engine = AnalyticsEngine()
_data_service = None # Will be initialized via a helper
from database.trade_logger import get_trade_logger
from execution.decision_agent import DecisionAgent
from core.context import app_context

def get_data_service():
    global _data_service
    if _data_service is None:
        order_manager = app_context.get("order_manager")
        if order_manager:
            _data_service = MarketDataService(order_manager)
        else:
            # Fallback if context not yet populated
            from execution.order_manager import OrderManager
            _data_service = MarketDataService(OrderManager())
    return _data_service

def _estimate_history_limit(interval: str, days: int) -> int:
    bars_per_day = {
        "1m": 400,
        "3m": 150,
        "5m": 100,
        "10m": 50,
        "15m": 35,
        "30m": 20,
        "1h": 10,
        "D": 1,
    }
    normalized = historify_service._normalize_interval(interval)
    return max(50, bars_per_day.get(normalized, 100) * max(days, 1))

def _get_history_rows(symbol: str, exchange: str, interval: str, days: int) -> List[Dict[str, Any]]:
    normalized = historify_service._normalize_interval(interval)
    limit = _estimate_history_limit(normalized, days)
    return historify_service.get_records(symbol, exchange, normalized, limit) or []

@router.get("/search/api/underlyings")
async def get_underlyings(exchange: str = "NSE"):
    """Fetch all unique underlying names for an exchange."""
    try:
        ds = get_data_service()
        data = await ds.get_available_underlyings(exchange)
        return {
            "status": "success",
            "underlyings": data, # Frontend compatibility
            "data": data
        }
    except Exception:
        logger.error("Error fetching underlyings", exc_info=True)
        return {"status": "error", "message": "Failed to fetch underlyings"}

@router.get("/search/api/expiries")
async def get_expiries(underlying: str, exchange: str = "NSE"):
    """Fetch available unique expiry dates for an underlying."""
    try:
        ds = get_data_service()
        data = await ds.get_available_expiries(underlying, exchange)
        return {
            "status": "success",
            "expiries": data, # Frontend compatibility
            "data": data
        }
    except Exception:
        logger.error("Error fetching expiries", exc_info=True)
        return {"status": "error", "message": "Failed to fetch expiries"}

@router.post("/gex/api/gex-data")
@router.get("/oi-tracker/api/data")
@router.post("/oiprofile/api/profile-data")
@router.post("/max-pain/api/pain-data")
@router.post("/analytics/gex")
async def get_gex_and_oi_data(request: Request):
    """
    Unified endpoint for GEX, OI Profile, and Max Pain data.
    Supports both legacy /analytics/gex and modern institutional paths.
    """
    try:
        if request.method == "POST":
            try:
                data = await request.json()
            except:
                data = {}
        else:
            data = dict(request.query_params)

        underlying = data.get("underlying") or data.get("symbol")
        expiry = data.get("expiry") or data.get("expiry_date")
        exchange = data.get("exchange", "NSE")

        if not underlying or not expiry:
             return {"status": "error", "message": "Missing symbol or expiry"}

        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry)

        if chain.get("status") == "error":
            # Return 200 with error status instead of 500 to avoid UI crashes
            return {"status": "error", "message": chain.get("message")}

        # GEX calculation
        results = _analytics_engine.calculate_gex(chain)

        # Max Pain calculation
        pain_results = _analytics_engine.calculate_max_pain(chain)

        # Merge for unified response
        results["max_pain"] = pain_results.get("max_pain_strike")
        results["max_pain_strike"] = pain_results.get("max_pain_strike")
        results["pain_data"] = pain_results.get("pain_data")

        return results

    except Exception:
        logger.error("GEX/OI API Critical Error", exc_info=True)
        return {"status": "error", "message": "Internal analytical failure"}

@router.post("/iv-smile/smile-data")
async def get_iv_smile(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...)
):
    _validate_option_params(underlying, exchange, expiry_date)
    try:
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        results = _analytics_engine.calculate_iv_smile(chain)
        return results
    except Exception:
        logger.error("IV Smile Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/vol-surface/api/surface-data")
async def get_vol_surface_data(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_dates: List[str] = Body(...),
    strike_count: int = Body(30),
):
    try:
        ds = get_data_service()

        async def fetch_chain(expiry):
            try:
                _validate_option_params(underlying, exchange, expiry)
                chain = await ds.get_option_chain(underlying, exchange, expiry, strike_count=strike_count)
                if chain.get("status") != "success":
                    return None
                smile = _analytics_engine.calculate_iv_smile(chain)
                return {
                    "expiry_date": expiry,
                    "spot_price": smile.get("spot_price", chain.get("spot_price", 0)),
                    "atm_strike": smile.get("atm_strike", chain.get("atm_strike", 0)),
                    "chain": smile.get("chain", []),
                }
            except Exception:
                logger.warning("Failed to fetch chain for expiry", exc_info=True)
                return None

        # Fetch all chains in parallel for institutional performance (Phase 16 Sync)
        tasks = [fetch_chain(expiry) for expiry in expiry_dates]
        results = await asyncio.gather(*tasks)

        surfaces = [r for r in results if r is not None]
        if not surfaces:
             return {"status": "error", "message": "No valid option data found for selected expiries.", "data": []}

        return _analytics_engine.calculate_vol_surface(surfaces)
    except Exception:
        logger.error("Vol Surface API Error", exc_info=True)
        return {"status": "error", "message": "Failed to calculate vol surface", "data": []}

@router.post("/iv-chart/api/chart-data")
async def get_iv_chart_data(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...),
    interval: str = Body("5m"),
    days: int = Body(1),
):
    try:
        _validate_option_params(underlying, exchange, expiry_date)
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        if chain.get("status") != "success":
            return {"status": "error", "message": chain.get("message", "Failed to load option chain"), "data": []}
        history_rows = _get_history_rows(underlying, exchange, interval, days)
        return _analytics_engine.calculate_iv_chart(chain, history_rows)
    except Exception:
        logger.error("IV Chart API Error", exc_info=True)
        return {"status": "error", "message": "Failed to generate IV chart", "data": []}

@router.post("/straddle-chart/api/data")
async def get_straddle_chart_data(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...),
    interval: str = Body("5m"),
    days: int = Body(1),
):
    try:
        _validate_option_params(underlying, exchange, expiry_date)
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        if chain.get("status") != "success":
            return {"status": "error", "message": chain.get("message", "Failed to load option chain"), "data": []}
        history_rows = _get_history_rows(underlying, exchange, interval, days)
        return _analytics_engine.calculate_straddle_chart(chain, history_rows)
    except Exception:
        logger.error("Straddle Chart API Error", exc_info=True)
        return {"status": "error", "message": "Failed to generate straddle chart", "data": []}

@router.post("/analytics/greeks")
async def get_chain_greeks(
    underlying: str = Body(...),
    exchange: str = Body("NSE"),
    expiry_date: str = Body(...)
):
    """
    Calculate full Greeks (Delta, Gamma, Theta, Vega, Rho) for an option chain.
    """
    _validate_option_params(underlying, exchange, expiry_date)
    try:
        ds = get_data_service()
        chain = await ds.get_option_chain(underlying, exchange, expiry_date)
        if chain.get("status") == "error":
            raise HTTPException(status_code=500, detail=chain.get("message"))

        results = _analytics_engine.calculate_chain_greeks(chain)
        return results
    except Exception:
        logger.error("Greeks API Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

@router.get("/historify/watchlist")
def get_watchlist(request: Request):
    user_id = _get_user_id(request)
    data = historify_service.get_watchlist()
    # Filter by user_id when present so each user sees only their own entries
    if user_id and isinstance(data, list):
        data = [item for item in data if item.get("user_id") in (user_id, None, "")]
    return {"status": "success", "data": data}

@router.post("/historify/watchlist")
def add_watchlist(
    request: Request,
    symbol: Optional[str] = Body(None),
    symbols: Optional[List[str]] = Body(None),
    exchange: str = Body("NSE")
):
    user_id = _get_user_id(request)
    if symbols:
        res = historify_service.bulk_add_to_watchlist(symbols, exchange)
    elif symbol:
        res = historify_service.add_to_watchlist(symbol, exchange)
    else:
        raise HTTPException(status_code=400, detail="Either 'symbol' or 'symbols' must be provided.")
    return res

@router.delete("/historify/watchlist")
def remove_watchlist(
    request: Request,
    symbol: Optional[str] = Body(None),
    symbols: Optional[List[str]] = Body(None),
    exchange: str = Body("NSE")
):
    _check_delete_rate(request)
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
def delete_historify_catalog(request: Request, req: PurgeRequest):
    """Purge historical data for a specific symbol/interval."""
    _check_delete_rate(request)
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
    except Exception:
        logger.error("Error fetching Historify stats", exc_info=True)
        return {"status": "error", "message": "Failed to fetch stats"}

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
    except Exception:
        logger.error("Error fetching Historify symbols", exc_info=True)
        return {"status": "error", "message": "Internal error"}

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
    except Exception:
        logger.error("Error cancelling job", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
@router.post("/optionchain")
@router.get("/optionchain")
async def get_standard_option_chain(
    request: Request,
    underlying: Optional[str] = Query(None),
    exchange: str = Query("NSE"),
    expiry_date: Optional[str] = Query(None),
    expiry: Optional[str] = Query(None), # Support alias used by some client hooks
    strike_count: int = Query(15),
    apikey: Optional[str] = Query(None)
):
    """
    Standard Option Chain endpoint for AetherDesk Prime.
    Supports both GET (polling/debug) and POST (institutional standard).
    """
    # 1. Parameter Normalization
    if request.method == "POST":
        try:
            payload = await request.json()
            if payload:
                underlying = payload.get("underlying", underlying)
                exchange = payload.get("exchange", exchange)
                # Support both expiry and expiry_date in payload
                expiry_date = payload.get("expiry_date", payload.get("expiry", expiry_date))
                strike_count = payload.get("strike_count", strike_count)
                apikey = payload.get("apikey", payload.get("api_key", apikey))
        except Exception:
            # Fallback to query params if JSON decode fails or body empty
            pass

    # Normalize expiry alias
    if not expiry_date and expiry:
        expiry_date = expiry

    if not underlying or not expiry_date:
        return {
            "status": "error",
            "message": "Missing required parameters: underlying and expiry_date (or expiry)"
        }

    """
    Standard Option Chain endpoint for AetherDesk Prime.
    Used by OptionChainPage (Tactical_Strike_Matrix).
    """
    try:
        _validate_option_params(underlying, exchange, expiry_date)
        ds = get_data_service()

        # 1. Fetch raw chain
        chain_data = await ds.get_option_chain(underlying, exchange, expiry_date, strike_count=strike_count)
        if chain_data.get("status") == "error":
            return chain_data

        spot_price = chain_data.get("spot_price", 0)
        chain = chain_data.get("chain", [])
        T = _analytics_engine._get_time_to_expiry(expiry_date)

        atm_strike = chain_data.get("atm_strike", 0)

        # 2. Enrich with Greeks and metadata
        enriched_chain = []
        for item in chain:
            strike = item["strike"]
            ce = item.get("ce", {})
            pe = item.get("pe", {})

            # Labels
            ce_label = "ATM" if strike == atm_strike else ("ITM" if strike < spot_price else "OTM")
            pe_label = "ATM" if strike == atm_strike else ("ITM" if strike > spot_price else "OTM")

            # CE Enrichment
            ce.update({
                "label": ce_label,
                "tick_size": 0.05, # Standard
            })
            if ce.get("ltp", 0) > 0:
                iv = _analytics_engine.bs_engine.estimate_iv(ce["ltp"], spot_price, strike, T, _analytics_engine.rf_rate, "CE")
                greeks = _analytics_engine.bs_engine.calculate_greeks(spot_price, strike, T, _analytics_engine.rf_rate, iv, "CE")
                ce.update({
                    "iv": round(iv * 100, 2),
                    "delta": round(greeks["delta"], 4),
                    "gamma": round(greeks["gamma"], 6),
                    "theta": round(greeks["theta"], 4),
                    "vega": round(greeks["vega"], 4),
                    "rho": round(greeks["rho"], 4)
                })
            else:
                ce.update({"iv": 0, "delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0})

            # PE Enrichment
            pe.update({
                "label": pe_label,
                "tick_size": 0.05, # Standard
            })
            if pe.get("ltp", 0) > 0:
                iv = _analytics_engine.bs_engine.estimate_iv(pe["ltp"], spot_price, strike, T, _analytics_engine.rf_rate, "PE")
                greeks = _analytics_engine.bs_engine.calculate_greeks(spot_price, strike, T, _analytics_engine.rf_rate, iv, "PE")
                pe.update({
                    "iv": round(iv * 100, 2),
                    "delta": round(greeks["delta"], 4),
                    "gamma": round(greeks["gamma"], 6),
                    "theta": round(greeks["theta"], 4),
                    "vega": round(greeks["vega"], 4),
                    "rho": round(greeks["rho"], 4)
                })
            else:
                pe.update({"iv": 0, "delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0})

            enriched_chain.append({
                "strike": strike,
                "ce": ce,
                "pe": pe
            })

        # 3. Final response structure
        return {
            "status": "success",
            "underlying": underlying,
            "underlying_ltp": spot_price,
            "underlying_prev_close": chain_data.get("underlying_prev_close", spot_price), # Fallback to spot
            "expiry_date": expiry_date,
            "atm_strike": chain_data.get("atm_strike", 0),
            "chain": enriched_chain,
            "timestamp": datetime.now().isoformat()
        }

    except Exception:
        logger.error("OptionChain Critical Error", exc_info=True)
        return {"status": "error", "message": "Internal error"}

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
    except Exception:
        logger.error("Error getting analyzer status", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
    except Exception:
        logger.error("Fill Quality API Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")
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
    except Exception:
        logger.error("Correlation API Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")

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
    except Exception:
        logger.error("Convergence API Error", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error")
