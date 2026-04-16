
import asyncio
import logging
import os
from services.session_service import get_session_service
from execution.openalgo_client import OpenAlgoClient
from execution.order_manager import OrderManager

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def main():
    logger.info("Starting manual broker re-authentication inside container...")

    # Initialize enough context to run the service
    client = OpenAlgoClient(
        base_url=os.getenv("OPENALGO_BASE_URL", "http://openalgo-web:5000"),
        api_key=os.getenv("OPENALGO_API_KEY")
    )
    order_manager = OrderManager(client)

    ss = get_session_service(order_manager)

    logger.info("Current health check...")
    healthy = await ss.check_health()
    logger.info("Is healthy? %s", healthy)

    # We force re-auth because we know it's expired or we want to refresh
    logger.info("🚀 Triggering automated re-authentication flow...")
    success = await ss.run_reauth_flow()

    if success:
        logger.info("✅ Re-authentication SUCCESSFUL.")
    else:
        logger.error("❌ Re-authentication FAILED.")

if __name__ == "__main__":
    asyncio.run(main())
