import asyncio
import websockets
import json
import time
import requests

# Unified Ports
WS_URL = "ws://localhost:5002"
API_URL = "http://localhost:18788/api/v1"

async def test_websocket_telemetry():
    print(f"[*] Connecting to WebSocket at {WS_URL}...")
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("[+] Connected! Waiting for heartbeats or signals...")

            # Start a strategy to trigger heartbeats (if not already running)
            # For this test, we assume the engine is running.

            start_time = time.time()
            heartbeat_count = 0

            while time.time() - start_time < 30: # Wait for 30 seconds
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(message)
                    event_type = data.get("type")

                    if event_type == "heartbeat":
                        heartbeat_count += 1
                        print(f"[HEARTBEAT] Received from {data['payload']['strategy']} ({data['payload']['symbol']} @ {data['payload']['ltp']})")
                    elif event_type == "trade_filled":
                        print(f"[TRADE] !!! {data['payload']['action']} {data['payload']['quantity']} {data['payload']['symbol']} @ {data['payload']['price']}")
                    elif event_type == "order_rejected":
                        print(f"[REJECT] Order rejected: {data['payload']['reason']}")
                    elif event_type == "tick":
                        pass # Ignore ticks for this specific test
                    else:
                        print(f"[EVENT] Received {event_type}: {data}")

                    if heartbeat_count >= 1:
                        print("[SUCCESS] Telemetry pipeline is LIVE.")
                        return True

                except asyncio.TimeoutError:
                    print("[.] Still waiting for events...")

            print("[!] Timeout: No telemetry received. Is the engine running?")
            return False

    except Exception as e:
        print(f"[!] WebSocket Connection Failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Phase 40 Telemetry Verification ===")
    asyncio.run(test_websocket_telemetry())
