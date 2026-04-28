from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import RedirectResponse
import logging
import os
from core.context import app_context
from database.trade_logger import get_trade_logger
from utils.get_shoonya_token import get_shoonya_auth_code
from utils.finalize_shoonya_auth import finalize_shoonya_session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Auth"])

UI_BASE_URL = os.getenv("AETHERDESK_UI_URL", "http://127.0.0.1:3001")

@router.get("/auth/csrf-token")
async def get_csrf_token():
    """FastAPI port of /auth/csrf-token."""
    return {"csrf_token": "aether-core-session-token-v1"}

@router.get("/auth/broker-config")
async def get_broker_config():
    """FastAPI port of /auth/broker-config."""
    try:
        db_logger = get_trade_logger()
        config = db_logger.get_broker_config()
        return config
    except Exception as e:
        logger.error(f"Broker config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/v1/brokers/shoonya/auth")
async def shoonya_auth_init(request: Request):
    """FastAPI port of /api/v1/brokers/shoonya/auth."""
    try:
        host = request.headers.get("host", "localhost")
        redirect_uri = f"http://{host}/api/auth/callback/shoonya"
        auth_url = get_shoonya_auth_code(redirect_uri)
        return {"status": "success", "auth_url": auth_url}
    except Exception as e:
        logger.error(f"Shoonya Auth Init Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/auth/callback/shoonya")
async def shoonya_callback(code: str = Query(None)):
    """FastAPI port of /api/auth/callback/shoonya."""
    if not code:
        return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=missing_code")

    try:
        success = finalize_shoonya_session(code)
        if success:
            return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=success&message=shoonya_linked")
        else:
            return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=auth_failed")
    except Exception as e:
        logger.error(f"Critical failure in Shoonya callback: {e}")
        return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=internal_error")

@router.post("/api/v1/brokers/zerodha/auth")
async def zerodha_auth_init(request: Request):
    """
    Generate Zerodha (KiteConnect) login URL.
    """
    try:
        api_key = os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_API_KEY")
        if not api_key:
             # Try DB as fallback
             db_logger = get_trade_logger()
             config = db_logger.get_broker_config().get("zerodha", {})
             api_key = config.get("api_key")

        if not api_key:
             raise HTTPException(status_code=400, detail="Zerodha API Key not configured")

        auth_url = f"https://kite.trade/connect/login?api_key={api_key}&v=3"
        return {"status": "success", "auth_url": auth_url}
    except Exception as e:
        logger.error(f"Zerodha Auth Init Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/auth/callback/zerodha")
async def zerodha_callback(request: Request, request_token: str = Query(None)):
    """
    Callback for Zerodha KiteConnect OAuth.
    """
    if not request_token:
        return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=missing_token")

    try:
        from utils.finalize_zerodha_auth import finalize_zerodha_session
        success = await finalize_zerodha_session(request_token)
        if success:
             return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=success&message=zerodha_linked")
        else:
             return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=auth_failed")
    except Exception as e:
        logger.error(f"Critical failure in Zerodha callback: {e}")
        return RedirectResponse(url=f"{UI_BASE_URL}/openalgo/broker?status=error&message=internal_error")
