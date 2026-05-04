import asyncio
import websockets
import json
import os

async def test_ws():
    # Use localhost for host-level testing
    uri = "ws://localhost:18788/ws"
    jwt_secret = os.getenv("JWT_SECRET", "test-token")

    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending auth...")
            auth_msg = {
                "type": "auth",
                "token": jwt_secret
            }
            await websocket.send(json.dumps(auth_msg))

            # Wait for response
            resp = await websocket.recv()
            print(f"Received: {resp}")

            # Wait for ticks
            for _ in range(5):
                tick = await websocket.recv()
                print(f"Tick: {tick}")

    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
