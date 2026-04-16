import asyncio
import json
import os
import logging
import websockets
from datetime import datetime
from data.timescale_logger import ts_logger
from core.latency import latency_profile, init_latency_db

# Initialize latency logging
init_latency_db()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

API_KEY = os.getenv("API_KEY")
WS_URL = "ws://openalgo-web:8765"

async def on_tick(message):
    """Handles incoming ticks from OpenAlgo WebSocket."""
    data = json.loads(message)

    # Shoonya Format: s: symbol, lp: last_price, v: quantity, ft: timestamp
    symbol = data.get('s')
    ltp = data.get('lp')
    qty = data.get('v', 0)

    if symbol and ltp:
        # 1. Log to console (minimal)
        # logger.debug(f"📈 TICK: {symbol} @ {ltp}")

        # 2. Route to TimescaleDB
        await ts_logger.log_tick(
            symbol=symbol,
            price=float(ltp),
            quantity=int(qty) if qty else 0,
            side='TRADE'
        )

async def listen():
    """Main loop to connect and listen to OpenAlgo WS."""
    if not API_KEY:
        logger.error("❌ API_KEY not found in environment variables!")
        return

    while True:
        try:
            logger.info(f"🔌 Connecting to OpenAlgo WS at {WS_URL}...")
            async with websockets.connect(WS_URL) as ws:
                # 1. Authenticate
                await ws.send(json.dumps({
                    "action": "authenticate",
                    "api_key": API_KEY
                }))

                # 2. Subscribe (Example: Nifty 50 or broad market)
                await ws.send(json.dumps({
                    "type": "subscribe",
                    "symbols": "NSE:Nifty 50,NSE:RELIANCE-EQ"
                }))

                logger.info("✅ Authenticated and Subscribed.")

                # 3. Initialize Logger
                await ts_logger.connect()

                # 4. Listen loop
                async for message in ws:
                    await on_tick(message)

        except Exception as e:
            logger.error(f"❌ Connection error: {e}. Retrying in 5s...")
            await asyncio.sleep(5)
        finally:
            await ts_logger.disconnect()

if __name__ == "__main__":
    try:
        asyncio.run(listen())
    except KeyboardInterrupt:
        pass
