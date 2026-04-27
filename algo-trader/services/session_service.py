import logging
import asyncio
import os
from datetime import datetime, timedelta
from typing import Optional, Any

from utils.get_shoonya_token import get_shoonya_auth_code
from utils.finalize_shoonya_auth import finalize_shoonya_session

logger = logging.getLogger(__name__)

class SessionService:
    """
    Service responsible for maintaining the Shoonya broker session.
    It performs proactive health checks and triggers automated re-authentication
    via headless Selenium if the session expires.
    """

    def __init__(self, order_manager: Any = None):
        self.order_manager = order_manager
        self.last_check = None
        self.is_healthy = False
        self.last_error = ""
        self.reauth_in_progress = False
        self.consecutive_failures = 0
        self.max_retries = 3

        # Configuration from environment
        self.auto_relogin = os.getenv("SHOONYA_AUTO_RELOGIN", "true").lower() == "true"

        logger.info(f"SessionService initialized (Auto-Relogin: {self.auto_relogin}).")

    def set_order_manager(self, order_manager: Any):
        self.order_manager = order_manager

    async def check_health(self) -> bool:
        """
        Verify if the current broker session is valid by performing a lightweight API call.
        """
        if not self.order_manager or not self.order_manager.client:
            return False

        if self.reauth_in_progress:
            return False

        try:
            # Check session health via a simple funds/margin call
            # This follows the pattern in openalgo_client.py
            # OpenAlgoClient methods are synchronous!
            result = self.order_manager.client.get_funds()

            # Shoonya/OpenAlgo success usually returns a dict with 'stat': 'Ok'
            # If it returns an error field, 403, or 'NOT_OK', it's invalid.
            if isinstance(result, dict):
                msg = result.get("message", "").lower()
                status = result.get("status", "").upper()
                stat = result.get("stat", "").upper()

                if status == "ERROR" or stat == "NOT_OK" or "invalid" in msg or "expired" in msg or "403" in msg:
                    logger.warning(f"Broker session invalid. Status: {status}, Stat: {stat}, Msg: {msg}")
                    self.is_healthy = False
                    self.last_error = msg or f"Stat: {stat}"
                    return False

            self.is_healthy = True
            self.last_check = datetime.now()
            self.consecutive_failures = 0
            return True

        except Exception as e:
            logger.error(f"Session health check fault: {e}")
            self.is_healthy = False
            self.last_error = str(e)
            return False

    async def run_reauth_flow(self) -> bool:
        """
        Triggers the Selenium-based auth flow to refresh the broker session.
        """
        if self.reauth_in_progress:
            logger.info("Re-authentication already in progress. Skipping.")
            return False

        if not self.auto_relogin:
            logger.warning("Auto-relogin is disabled. Manual intervention required.")
            return False

        if self.consecutive_failures >= self.max_retries:
            logger.error("Max re-authentication retries reached. Locking out to prevent loop.")
            return False

        self.reauth_in_progress = True
        logger.info("🚀 Initiating automated Shoonya re-authentication flow...")

        try:
            # 1. Capture Auth Code (Selenium Headless)
            # We run this in a thread to prevent blocking the async loop
            auth_code = await asyncio.to_thread(get_shoonya_auth_code)

            if not auth_code or "ERROR" in str(auth_code) or "FAILURE" in str(auth_code):
                logger.error(f"Failed to capture auth code: {auth_code}")
                self.consecutive_failures += 1
                return False

            # 2. Finalize and Inject (Handshake + DB Update)
            target_name = self.order_manager.client.openalgo_user_id if self.order_manager and self.order_manager.client else "kamaleswar"
            result = await asyncio.to_thread(finalize_shoonya_session, auth_code, target_name=target_name)

            if result.get("status") == "success":
                logger.info("✅ Shoonya session refreshed and injected successfully.")
                self.is_healthy = True
                self.consecutive_failures = 0

                # 3. Refresh Client Credentials
                if self.order_manager and self.order_manager.client:
                    logger.info("Notifying OpenAlgoClient to reload credentials...")
                    self.order_manager.client._refresh_api_key_from_db()

                    # 4. Trigger Reconciliation to sync engine with broker reality
                    logger.info("Triggering post-reauth synchronization...")
                    asyncio.create_task(self.order_manager.sync_with_broker())

                return True
            else:
                logger.error(f"Session finalization failed: {result.get('message')}")
                self.consecutive_failures += 1
                return False

        except Exception as e:
            logger.error(f"Re-auth flow encountered a critical error: {e}", exc_info=True)
            self.consecutive_failures += 1
            return False
        finally:
            self.reauth_in_progress = False

    def get_status(self) -> dict:
        """Returns the current health status for telemetry."""
        return {
            "is_healthy": self.is_healthy,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_error": self.last_error,
            "reauth_in_progress": self.reauth_in_progress,
            "auto_relogin_enabled": self.auto_relogin
        }

    async def validate_session(self) -> bool:
        """Alias for check_health used by the API layer."""
        return await self.check_health()

    async def get_session_state(self) -> dict:
        """Returns the current session state for the dashboard."""
        return self.get_status()

# Singleton instance
_session_service: Optional[SessionService] = None

def get_session_service(order_manager: Any = None) -> SessionService:
    global _session_service
    if _session_service is None:
        _session_service = SessionService(order_manager)
    elif order_manager:
        _session_service.set_order_manager(order_manager)
    return _session_service
