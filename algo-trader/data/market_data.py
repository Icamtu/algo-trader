import asyncio
import json
import logging
import random
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List

from core.config import settings

try:
    import websockets
except ImportError:  # pragma: no cover - depends on installed extras
    websockets = None

from utils.latency_tracker import latency_tracker

logger = logging.getLogger(__name__)

# Mapping to normalize broker symbols back to UI expectations
# We now use the exact symbols from ticker.yaml to ensure dashboard sync
BROKER_TO_UI_MAP = {
    "NIFTY": "NIFTY",
    "BANKNIFTY": "BANKNIFTY",
    "FINNIFTY": "FINNIFTY",
    "RELIANCE": "RELIANCE",
    "HDFCBANK": "HDFCBANK",
    "TCS": "TCS",
    "INFY": "INFY",
    "ICICIBANK": "ICICIBANK",
    "HCLTECH": "HCLTECH",
    "SBIN": "SBIN",
}

# Reverse map for upstream subscriptions
UI_TO_BROKER_MAP = {v: k for k, v in BROKER_TO_UI_MAP.items()}

@dataclass
class Tick:
    """
    Represents a single market data tick with basic validation.
    """
    symbol: str
    ltp: float
    timestamp: float
    raw: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.ltp < 0:
            raise ValueError("LTP cannot be negative")

    @property
    def price(self) -> float:
        """Convenience alias so strategies can use either `tick.ltp` or `tick.price`."""
        return self.ltp

class MarketDataStream:
    """
    Connects to an OpenAlgo-compatible WebSocket to receive and dispatch
    real-time market data ticks based on symbol subscriptions.
    """

    def __init__(self):
        self.ws_url: str = settings.get('openalgo', {}).get('ws_url', '')
        self.subscriptions: Dict[str, List[Callable[[Tick], Awaitable[None]]]] = defaultdict(list)
        self._running = False
        self._connection_task = None
        self._active_ws = None
        self._simulation_enabled = settings.get('simulation', {}).get('enabled', False)
        self._tick_interval = settings.get('simulation', {}).get('tick_interval_seconds', 1.0)
        self._base_price = settings.get('simulation', {}).get('base_price', 100.0)
        self._price_step = settings.get('simulation', {}).get('price_step', 1.5)
        self._last_prices: Dict[str, float] = {}
        
        # AetherBridge: Native Data Source (Phase 6)
        self.native_broker = None
        self._native_subscribed_symbols = set()

    def set_native_broker(self, broker: Any):
        """Inject a native broker to use for market data instead of OpenAlgo WS."""
        self.native_broker = broker
        if broker:
            broker.register_tick_callback(self._on_native_tick)
            logger.info(f"MarketDataStream: Native Broker source linked: {broker.broker_id}")

    def _on_native_tick(self, tick_data: Any):
        """Callback for native broker ticks (AetherBridge)."""
        # Map from brokers.models.TickData to data.market_data.Tick
        tick = Tick(
            symbol=tick_data.symbol,
            ltp=tick_data.last_price,
            timestamp=tick_data.timestamp.timestamp() * 1000,
            raw={"source": "aetherbridge", "volume": tick_data.volume}
        )
        # Dispatch to engine and UI
        asyncio.create_task(self._dispatch_tick(tick))

    def subscribe(self, symbols: List[str], callback: Callable[[Tick], Awaitable[None]]):
        """
        Register an async callback function for a list of symbols.
        Callback signature: async def func(tick: Tick)
        """
        new_symbols = []
        for symbol in symbols:
            if symbol not in self.subscriptions:
                new_symbols.append(symbol)
            if callback not in self.subscriptions[symbol]:
                self.subscriptions[symbol].append(callback)
                logger.info(f"Subscribed {callback.__name__} to {symbol}")
        
        # If using native broker, subscribe there too
        if self.native_broker:
            asyncio.create_task(self.native_broker.subscribe_ticks(symbols))
            return

        # If already running and connected, send dynamic subscription upstream
        if self._running and self._active_ws and new_symbols:
            asyncio.create_task(self._send_subscription(self._active_ws, new_symbols))

    async def _send_subscription(self, websocket, symbols: List[str]):
        """Helper to send subscription message upstream."""
        # Generic set of indices to detect correct exchange
        # Common indices that require NSE_INDEX exchange
        indices = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTY 50", "NIFTY BANK", "BANK NIFTY", "SENSEX"}
        
        # Normalize and split symbols
        # Phase 16: Translate UI symbols to broker-specific symbols before sending upstream
        translated_symbols = [UI_TO_BROKER_MAP.get(s, s) for s in symbols]
        
        idx_list = [s for s in translated_symbols if s.upper() in indices]
        eq_list = [s for s in translated_symbols if s.upper() not in indices]
        
        try:
            if eq_list:
                # OpenAlgo expects symbols as a list of objects in newer versions
                # Sending as objects to avoid 'str has no attribute get' error
                # Sending as objects with explicit exchange to match server expectation
                symbol_payload = [{"symbol": s, "exchange": "NSE"} for s in eq_list]
                await websocket.send(json.dumps({
                    "action": "subscribe",
                    "symbols": symbol_payload
                }))
                logger.info(f"Subscribed to Equity: {eq_list}")
                
            if idx_list:
                symbol_payload = [{"symbol": s, "exchange": "NSE_INDEX"} for s in idx_list]
                await websocket.send(json.dumps({
                    "action": "subscribe",
                    "symbols": symbol_payload
                }))
                logger.info(f"Subscribed to Indices: {idx_list}")
        except Exception as e:
            logger.error(f"Failed to send dynamic subscription: {e}")

    def unsubscribe(self, symbols: List[str], callback: Callable):
        """
        Unregister a callback function for a list of symbols.
        """
        for symbol in symbols:
            if symbol in self.subscriptions and callback in self.subscriptions[symbol]:
                self.subscriptions[symbol].remove(callback)
                logger.info(f"Unsubscribed {callback.__name__} from {symbol}")
                # We don't necessarily send 'unsubscribe' upstream to keep it simple,
                # as multiple callbacks might be listening to the same symbol.

    async def _run(self):
        """
        The main connection and message handling loop.
        Includes reconnection logic with a fixed delay.
        """
        if self.native_broker:
            logger.info("MarketDataStream: Running in Native AetherBridge mode.")
            # We assume native_broker manages its own connection task (e.g. Shoonya SDK)
            # but we ensure existing subscriptions are active
            symbols = list(self.subscriptions.keys())
            if symbols:
                await self.native_broker.subscribe_ticks(symbols)
            return

        if self._use_simulation_mode():
            logger.info("Running market data stream in simulation mode.")
            await self._run_simulation()
            return

        logger.info(f"Connecting to Market Data Stream: {self.ws_url}")
        while self._running:
            try:
                async with websockets.connect(self.ws_url) as websocket:
                    self._active_ws = websocket
                    logger.info("Successfully connected to WebSocket")
                    await self._message_handler(websocket)
            except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError) as e:
                logger.warning(f"WebSocket connection lost: {e}. Reconnecting in 5s...")
                self._active_ws = None
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"An unexpected WebSocket error occurred: {e}", exc_info=True)
                self._active_ws = None
                await asyncio.sleep(5) # Avoid rapid-fire reconnection on persistent errors

    def _use_simulation_mode(self) -> bool:
        return self._simulation_enabled or not self.ws_url or websockets is None

    async def _run_simulation(self):
        """
        Generate simple ticks locally so the project is usable before live
        market data is wired up.
        """
        while self._running:
            symbols = list(self.subscriptions.keys())
            if not symbols:
                await asyncio.sleep(self._tick_interval)
                continue

            for symbol in symbols:
                previous_price = self._last_prices.get(symbol, self._base_price)
                next_price = max(0.05, previous_price + random.uniform(-self._price_step, self._price_step))
                self._last_prices[symbol] = round(next_price, 2)

                tick = Tick(
                    symbol=symbol,
                    ltp=self._last_prices[symbol],
                    timestamp=time.time(),
                    raw={"mode": "simulation"},
                )
                await self._dispatch_tick(tick)

            await asyncio.sleep(self._tick_interval)

    async def _message_handler(self, websocket):
        """Handles incoming messages from the websocket."""
        # 1. Send authentication if needed
        if settings.get('openalgo', {}).get('api_key'):
            auth_payload = {
                "type": "auth",
                "apikey": settings.get('openalgo', {}).get('api_key')
            }
            await websocket.send(json.dumps(auth_payload))
            logger.info("Sent auth message to WebSocket.")
            
            # 2. Immediately subscribe to all current symbols (Don't wait for auth response)
            # Some versions of OpenAlgo don't send auth confirmation
            symbols = list(self.subscriptions.keys())
            if symbols:
                await self._send_subscription(websocket, symbols)

        while self._running:
            try:
                message = await websocket.recv()
                data = json.loads(message)
                
                # Debug logging for ALL incoming market data messages
                logger.debug(f"Market Data WS RX: {data}")
                
                 # In case it DOES send auth response later, just log it
                if data.get('type') == 'auth' or (data.get('status') == 'success' and 'authenticated' in str(data.get('message', '')).lower()):
                    logger.info(f"Market Data Auth Response: {data}")
                    continue
                
                # Support both standard OpenAlgo format and flat tick format
                symbol = data.get('symbol')
                ltp = data.get('ltp')
                
                if not symbol or ltp is None:
                    # Try nested data
                    inner = data.get('data', {})
                    symbol = data.get('symbol') or inner.get('symbol')
                    ltp = inner.get('ltp')
                
                if symbol and ltp is not None:
                    # Normalize timestamp to milliseconds
                    ts = float(data.get('timestamp', time.time()))
                    if ts < 1e11: # Seconds
                        ts *= 1000
                    
                    tick = Tick(
                        symbol=symbol,
                        ltp=float(ltp),
                        timestamp=ts,
                        raw=data,
                    )
                    self._last_prices[symbol] = tick.ltp
                    await self._dispatch_tick(tick)

            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON message: {message}")
            except (websockets.exceptions.ConnectionClosed, BrokenPipeError, ConnectionResetError) as e:
                logger.info(f"Market Data connection closed during recv: {e}")
                break
            except Exception as e:
                logger.warning(f"Error handling WS message: {e}")
                if "BrokenResourceError" in str(e):
                    break

    async def _dispatch_tick(self, tick: Tick):
        """Fan out a tick to all callbacks subscribed for the symbol with low-latency optimizations."""
        # 1. Log to TimescaleDB (Async burst)
        try:
            from data.timescale_logger import ts_logger
            asyncio.create_task(ts_logger.log_tick(tick.symbol, tick.ltp))
        except ImportError:
            pass

        if tick.symbol not in self.subscriptions:
            return

        callbacks = self.subscriptions[tick.symbol]
        if not callbacks:
            return

        # Optimization: Group callbacks to minimize task creation overhead
        # We execute ALL callbacks for a single tick in parallel using asyncio.gather
        # This prevents one slow strategy (e.g. AI-synthesis) from blocking others.
        async def _execute_parallel(tick_data: Tick, cbs: list):
            tasks = [cb(tick_data) for cb in cbs]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, res in enumerate(results):
                if isinstance(res, Exception):
                    logger.error(f"Strategy callback {cbs[i].__name__} failed for {tick_data.symbol}: {res}")

        # Dispatch as a single parallel task
        async def _tracked_execute():
            async with await latency_tracker.measure_async("TickDispatch", metadata={"symbol": tick.symbol}):
                await _execute_parallel(tick, callbacks)
        
        asyncio.create_task(_tracked_execute())


    def start(self):
        """
        Starts the WebSocket listener in a background task.
        """
        if not self._running:
            self._running = True
            # Initialize TimescaleDB logger
            from data.timescale_logger import ts_logger
            asyncio.create_task(ts_logger.connect())
            
            self._connection_task = asyncio.create_task(self._run())
            logger.info("Market data stream started.")

    async def stop(self):
        """
        Stops the WebSocket listener.
        """
        if self._running:
            self._running = False
            
            # Stop TimescaleDB logger
            from data.timescale_logger import ts_logger
            await ts_logger.disconnect()

            if self._connection_task:
                self._connection_task.cancel()
                try:
                    await self._connection_task
                except asyncio.CancelledError:
                    pass
            logger.info("Market data stream stopped.")

class DuckDBIngestor:
    """
    Batches real-time ticks and persists them to DuckDB Historify.
    Optimized for high-frequency trading with symbol-specific buffering
    and non-blocking ingestion patterns.
    """
    def __init__(self, batch_size=500, flush_interval=5):
        # Key: symbol -> List[Dict]
        self.buffers: Dict[str, List[Dict]] = defaultdict(list)
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.last_flush_times: Dict[str, float] = defaultdict(time.time)
        self.lock = asyncio.Lock()
        logger.info(f"DuckDB Ingestor initialized (Batch: {batch_size}, Interval: {flush_interval}s).")

    async def handle_tick(self, tick: Tick):
        """Callback for MarketDataStream. Minimal overhead on hot path."""
        symbol = tick.symbol
        
        # Prepare data row
        row = {
            "timestamp": int(tick.timestamp),
            "open": tick.ltp,
            "high": tick.ltp,
            "low": tick.ltp,
            "close": tick.ltp,
            "volume": tick.raw.get("v", tick.raw.get("volume", 0)),
            "oi": tick.raw.get("oi", 0)
        }
        
        self.buffers[symbol].append(row)
        
        # Check if we need to flush this specific symbol
        now = time.time()
        buffer_len = len(self.buffers[symbol])
        
        if buffer_len >= self.batch_size or (now - self.last_flush_times[symbol]) >= self.flush_interval:
            # We use a non-blocking task for the actual DB write to keep the tick loop fast
            asyncio.create_task(self.flush(symbol))

    async def flush(self, symbol: str):
        """Atomic flush of a symbol's buffer to DuckDB."""
        if not self.buffers[symbol]:
            return

        # Double-check lock to ensure we don't have multiple flushes for the same symbol
        # overlapping, though the buffer clear makes it safe.
        async with self.lock:
            data_to_save = list(self.buffers[symbol])
            self.buffers[symbol] = []
            self.last_flush_times[symbol] = time.time()

        if not data_to_save:
            return

        try:
            import pandas as pd
            from data.historify_db import upsert_market_data, get_duckdb_conn
            
            async with await latency_tracker.measure_async("DuckDBIngest", metadata={"symbol": symbol, "batch": len(data_to_save)}):
                df = pd.DataFrame(data_to_save)
                # Phase 9 Optimization: Run synchronous DuckDB I/O in a separate thread to avoid blocking the event loop
                count = await asyncio.to_thread(upsert_market_data, df, symbol, "NSE", "TICK")
            
            if count:
                logger.debug(f"Persisted {count} ticks for {symbol} to DuckDB")

            # Rolling 24h cleanup: only run if it's been an hour since last cleanup
            if not hasattr(self, '_last_cleanup') or (time.time() - self._last_cleanup) > 3600:
                try:
                    with get_duckdb_conn() as conn:
                        cutoff = int((time.time() - (24 * 3600)) * 1000)
                        conn.execute("DELETE FROM market_data WHERE interval = 'TICK' AND timestamp < ?", [cutoff])
                        logger.info("DuckDB Historify: Cleaned up ticks older than 24h.")
                    self._last_cleanup = time.time()
                except Exception as cleanup_err:
                    logger.warning(f"Historify Cleanup Warning: {cleanup_err}")

        except Exception as e:
            logger.error(f"Historify Flush Error for {symbol}: {e}")

# Example usage for testing
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    async def strategy_one_callback(tick: Tick):
        """A simple callback simulating a trading strategy."""
        print(f"[Strategy 1] Received tick for {tick.symbol}: LTP=${tick.ltp:.2f}")
        # In a real scenario, you might do more complex async work here
        await asyncio.sleep(0.1) 

    async def notification_service_callback(tick: Tick):
        """A simple callback simulating a notification service."""
        print(f"[Notifier] Alert! {tick.symbol} is now at ${tick.ltp:.2f}")

    async def main():
        stream = MarketDataStream()
        
        # Subscribe strategies to symbols
        stream.subscribe(['NIFTYBEES', 'RELIANCE'], strategy_one_callback)
        stream.subscribe(['RELIANCE'], notification_service_callback)
        
        stream.start()
        
        # Let it run for 20 seconds
        print("Stream running for 20 seconds...")
        await asyncio.sleep(20)
        
        # Unsubscribe strategy_one from RELIANCE
        print("\nUnsubscribing Strategy 1 from RELIANCE.\n")
        stream.unsubscribe(['RELIANCE'], strategy_one_callback)
        
        await asyncio.sleep(10)

        # Stop the stream
        print("Stopping stream.")
        await stream.stop()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Manually stopped.")
