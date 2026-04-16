
import asyncio
import logging
from services.session_service import get_session_service
from execution.openalgo_client import OpenAlgoClient
from execution.order_manager import OrderManager
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting manual broker re-authentication...")

    # Mock order manager enough for session service
    client = OpenAlgoClient(
        base_url=os.getenv("OPENALGO_BASE_URL", "http://openalgo-web:5000"),
        api_key=os.getenv("OPENALGO_API_KEY")
    )
    order_manager = OrderManager(client)

    ss = get_session_service(order_manager)

    logger.info("Current status: %s", ss.get_status())

    logger.info("Running health check...")
    healthy = await ss.check_health()
    logger.info("Is healthy? %s", healthy)

    if not healthy:
        logger.info("Triggering re-auth flow...")
        success = await ss.run_reauth_flow()
        logger.info("Re-auth success? %s", success)
    else:
        logger.info("Session already healthy. Forcing re-auth anyway for verification...")
        success = await ss.run_reauth_flow()
        logger.info("Forced re-auth success? %s", success)

if __name__ == "__main__":
    asyncio.run(main())
