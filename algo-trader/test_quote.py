import asyncio
from core.context import app_context
from fastapi_app import create_app
import nest_asyncio

nest_asyncio.apply()

async def test():
    app = create_app()
    om = app_context.get("order_manager")
    if not om:
        print("No order manager")
        return

    print(f"OM Mode: {om.mode}")
    if hasattr(om, "native_broker") and om.native_broker:
        try:
            quote = await om.native_broker.get_quote("NIFTY", "NSE_INDEX")
            print(f"Native Quote: {quote}")
        except Exception as e:
            print(f"Native broker error: {e}")
    else:
        print("No native broker")

asyncio.run(test())
