import os
import logging
import asyncio
from kiteconnect import KiteConnect
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

async def finalize_zerodha_session(request_token: str):
    """
    Finalizes Zerodha session by exchanging request_token for access_token.
    Persists the access_token to TradeLogger (trades.db).
    """
    try:
        api_key = os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_API_KEY")
        api_secret = os.getenv("AETHERBRIDGE_BROKERS_ZERODHA_API_SECRET")

        if not api_key or not api_secret:
            # Fallback to DB if env is not set (might happen if set via UI)
            db_logger = get_trade_logger()
            config = db_logger.get_broker_config().get("zerodha", {})
            api_key = api_key or config.get("api_key")
            api_secret = api_secret or config.get("api_secret")

        if not api_key or not api_secret:
            logger.error("Zerodha credentials missing in environment and database")
            return False

        kite = KiteConnect(api_key=api_key)

        # kite.generate_session is synchronous, run in thread
        data = await asyncio.to_thread(kite.generate_session, request_token, api_secret=api_secret)
        access_token = data["access_token"]

        # Persist to TradeLogger
        db_logger = get_trade_logger()
        db_logger.update_broker_config("zerodha", {
            "access_token": access_token,
            "public_token": data.get("public_token", ""),
            "last_login": str(data.get("login_time", ""))
        })

        # Update current environment for immediate use
        os.environ["AETHERBRIDGE_BROKERS_ZERODHA_ACCESS_TOKEN"] = access_token

        logger.info(f"✅ Zerodha session finalized for user {data.get('user_id')}. Persisted to TradeLogger.")
        return True
    except Exception:
        logger.error("Error finalizing Zerodha session", exc_info=True)
        return False
