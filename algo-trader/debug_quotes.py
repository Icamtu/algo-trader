import asyncio
import os
import sys

# Ensure the project root is in sys.path
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.append(project_root)

from execution.openalgo_client import OpenAlgoClient
from execution.order_manager import OrderManager
from core.config import settings

async def main():
    client = OpenAlgoClient(
        base_url=settings.get("openalgo", {}).get("base_url"),
        api_key=settings.get("openalgo", {}).get("api_key"),
    )
    om = OrderManager(client, mode="live")

    print(f"OM Initialized")

    quote = await om.get_quote("RELIANCE", "NSE")
    print(f"RELIANCE Quote Result: {quote}")

    funds = om.client.get_funds()
    print(f"Funds Result: {funds}")

if __name__ == "__main__":
    asyncio.run(main())
