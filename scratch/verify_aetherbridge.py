import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from brokers.factory import BrokerFactory
from brokers.models import OrderAction, OrderType, ProductType

async def verify_aetherbridge():
    print("--- AetherBridge Core Verification ---")
    
    # 1. Test Factory & PaperBroker
    config = {"initial_funds": 500000.0}
    broker = BrokerFactory.get_broker("paper", config)
    
    print(f"Created Broker: {broker.broker_id}")
    
    success = await broker.login()
    print(f"Login Success: {success}")
    
    # 2. Test Order Placement
    order = await broker.place_order(
        symbol="RELIANCE",
        action=OrderAction.BUY,
        quantity=10,
        order_type=OrderType.LIMIT,
        price=2500.0,
        product=ProductType.MIS
    )
    
    print(f"Placed Order: {order.order_id} | Status: {order.status}")
    
    # 3. Test Position Management
    positions = await broker.get_positions()
    print(f"Open Positions: {len(positions)}")
    if positions:
        p = positions[0]
        print(f"  Symbol: {p.symbol} | Qty: {p.quantity} | Avg: {p.avg_price}")
    
    # 4. Test Margins
    margins = await broker.get_margins()
    print(f"Margins: Available={margins['available']} | Used={margins['used']}")
    
    # 5. Test Tick Flow (AetherBridge Native)
    from data.market_data import MarketDataStream, Tick
    market_stream = MarketDataStream()
    market_stream.set_native_broker(broker)
    
    received_ticks = []
    async def on_tick(tick: Tick):
        received_ticks.append(tick)
        print(f"  [TICK] {tick.symbol} @ {tick.ltp}")
    
    market_stream.subscribe(["RELIANCE", "NIFTY"], on_tick)
    market_stream.start()
    
    print("Waiting for native ticks (Simulation Mode)...")
    await asyncio.sleep(3) # Wait for simulation ticks
    
    await market_stream.stop()
    print(f"Total Ticks Received: {len(received_ticks)}")
    
    await broker.logout()
    print("Verification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_aetherbridge())
