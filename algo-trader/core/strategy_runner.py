# algo-trader/core/strategy_runner.py
import asyncio
import logging
import yaml
import os
import pandas as pd
import datetime
from typing import Any, Dict, Iterable, List

from .strategy import BaseStrategy
from .strategy_registry import StrategyDefinition, discover_strategy_definitions
from data.market_data import MarketDataStream
from execution.order_manager import OrderManager
from execution.decision_agent import DecisionAgent
from core.config import settings
from data.historify_db import get_duckdb_conn, upsert_market_data
from database.trade_logger import get_trade_logger

logger = logging.getLogger(__name__)

class StrategyRunner:
    """
    Discovers, loads, and runs all trading strategies.

    This class scans the 'strategies' directory, finds all classes that
    inherit from BaseStrategy, and wires them up to the market data and
    order execution systems based on the application configuration.
    """

    def __init__(
        self,
        market_stream: MarketDataStream,
        order_manager: OrderManager,
        portfolio_manager: Any,
        config: Dict[str, Any],
        telemetry_callback: Any = None
    ):
        """
        Initializes the StrategyRunner.

        Args:
            market_stream (MarketDataStream): The client for getting live market data.
            order_manager (OrderManager): The client for executing trades.
            portfolio_manager (PortfolioManager): The client for dynamic sizing.
            config (Dict[str, Any]): The application configuration.
            telemetry_callback (Callable): Optional async function to broadcast events.
        """
        self.market_stream = market_stream
        self.order_manager = order_manager
        self.portfolio_manager = portfolio_manager
        self.config = config
        self.telemetry_callback = telemetry_callback
        self.strategies: List[BaseStrategy] = []
        self._definitions_by_key: Dict[str, StrategyDefinition] = {}
        self._strategies_by_key: Dict[str, BaseStrategy] = {}
        self._wrapped_callbacks: Dict[str, Any] = {} # Key: strategy_key, Value: wrapped_callback
        self._tick_counter = 0
        self._start_time = __import__('time').time()

        # AI Intelligence Hub (Phase 12: DecisionAgent Cluster)
        self.decision_agent = DecisionAgent(
            mode="ai",
            provider=settings.get("ai", {}).get("provider", "ollama"),
            agent_enabled=settings.get("ai", {}).get("agent_enabled", True)
        )
        self.risk_dispatcher = None
        self.current_regime_data = {
            "regime": "NEUTRAL",
            "pos_mult": 1.0,
            "risk_mult": 1.0,
            "reasoning": "Awaiting initial scan...",
            "last_update": None
        }
        self.sector_sentiment: Dict[str, Dict[str, Any]] = {}

        # Load Sector Registry
        sector_path = os.path.join(os.getcwd(), "config", "sectors.yaml")
        try:
            with open(sector_path, "r") as f:
                self.sector_config = yaml.safe_load(f)
                logger.info("Sector Registry loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load sectors.yaml: {e}")
            self.sector_config = {"tiers": {}}

    def _discover_strategies(self):
        """
        Discover available strategy definitions and instantiate enabled ones.
        """
        logger.info("Discovering strategies...")
        self._definitions_by_key = {
            definition.config_key: definition for definition in discover_strategy_definitions()
        }
        self._strategies_by_key = {}
        enabled_keys = self._enabled_strategy_keys()

        for strategy_key in enabled_keys:
            strategy_instance = self._create_strategy_instance(strategy_key)
            if strategy_instance is None:
                continue

            self._strategies_by_key[strategy_key] = strategy_instance
            logger.info(
                "Instantiated strategy: %s (%s)",
                strategy_instance.name,
                strategy_instance.config_key,
            )

        self.strategies = list(self._strategies_by_key.values())

    def set_risk_dispatcher(self, dispatcher):
        """Sets the risk dispatcher for direct telemetry broadcasts."""
        self.risk_dispatcher = dispatcher

    def get_strategy_matrix(self) -> Dict[str, Any]:
        """
        Returns the operational status matrix for all loaded strategies.
        This is used for high-frequency telemetry dashboards.
        """
        import time
        strats = []
        for key, s in self._strategies_by_key.items():
            # Calculate uptime from start if active, else 0
            uptime = int(time.time() - s.start_time) if (hasattr(s, 'start_time') and s.is_active) else 0

            # Use real telemetry if available, else placeholders
            stats = getattr(s, 'metrics', {})

            strats.append({
                "id": key,
                "name": s.name,
                "status": "active" if s.is_active else "idle",
                "uptime": uptime,
                "symbols": s.symbols,
                "params": s.get_params() if hasattr(s, 'get_params') else {},
                "sharpe": stats.get('sharpe', 0.0),
                "win_rate": stats.get('win_rate', 0.0),
                "r_mult": stats.get('r_mult', 0.0)
            })

        return {
            "strategies": strats,
            "total_active": sum(1 for s in self._strategies_by_key.values() if s.is_active),
            "timestamp": time.time()
        }

    def _enabled_strategy_keys(self) -> List[str]:
        enabled_settings = self.config.get("strategies", {})
        return [
            strategy_key
            for strategy_key, is_enabled in enabled_settings.items()
            if is_enabled and strategy_key in self._definitions_by_key
        ]

    def _create_strategy_instance(self, strategy_key: str) -> BaseStrategy | None:
        definition = self._definitions_by_key.get(strategy_key)
        if definition is None:
            logger.warning("Strategy key '%s' is not registered and cannot be started.", strategy_key)
            return None
        instance = definition.strategy_class(order_manager=self.order_manager, portfolio_manager=self.portfolio_manager)
        if instance:
            instance.runner = self
            # Phase 16: Ensure the instance knows its registry identity
            setattr(instance, "config_key", strategy_key)
        return instance

    def _refresh_strategy_list(self):
        self.strategies = list(self._strategies_by_key.values())

    def running_strategy_keys(self) -> List[str]:
        return list(self._strategies_by_key.keys())

    async def start(self):
        """
        Starts the strategy runner and all discovered strategies.
        """
        self._discover_strategies()
        if not self._strategies_by_key:
            logger.warning("No enabled strategies found. The runner will start but do nothing.")
            return

        # Start the proactive safeguard monitor loop
        asyncio.create_task(self._safeguard_monitor_loop())
        logger.info("Institutional safeguard monitor loop started.")

        # Start AI Market Regime loop
        asyncio.create_task(self._market_regime_loop())
        logger.info("Global Market Regime monitor (AI) started.")

        # Start Sector Sentiment loop (Phase 12)
        asyncio.create_task(self._sector_sentiment_loop())
        logger.info("Multi-Sector Sentiment Intelligence cluster started.")

        # Start Trading Hours Monitor (Phase 16)
        asyncio.create_task(self._trading_hours_monitor_loop())
        logger.info("Institutional Trading Hours & Square-off monitor started.")

        await self.start_strategies(self._strategies_by_key.keys())

    async def start_strategies(self, strategy_keys: Iterable[str], config: Dict[str, Any] = None):
        """Start one or more selected strategies without duplicating subscriptions."""
        startup_pairs: List[tuple[str, BaseStrategy]] = []

        for strategy_key in strategy_keys:
            if strategy_key in self._strategies_by_key:
                strategy_instance = self._strategies_by_key[strategy_key]
                if getattr(strategy_instance, "is_active", False):
                    logger.info("Strategy '%s' is already running.", strategy_key)
                    continue
            else:
                strategy_instance = self._create_strategy_instance(strategy_key)
                if strategy_instance is None:
                    continue
                self._strategies_by_key[strategy_key] = strategy_instance

            strategy_instance.is_active = True

            # Apply dynamic configuration from deployment form
            if config:
                strategy_instance.max_risk = config.get("max_risk", getattr(strategy_instance, "max_risk", 500))
                strategy_instance.capital_multiplier = config.get("capital_multiplier", getattr(strategy_instance, "capital_multiplier", 1.0))
                strategy_instance.target_pnl = config.get("target_pnl", getattr(strategy_instance, "target_pnl", 2500))
                strategy_instance.strategy_type = config.get("strategy_type", "intraday")
                strategy_instance.product_type = config.get("product_type", getattr(strategy_instance, "product_type", "MIS"))
                strategy_instance.trading_mode = config.get("trading_mode", "both")
                strategy_instance.trading_hours = config.get("trading_hours", {
                    "start": "09:15",
                    "end": "15:15",
                    "square_off": "15:20"
                })
                logger.info(f"Applied deployment config to {strategy_key}: {config}")

            # Wrap on_tick to inject telemetry heartbeats (Phase 16: Time-gated to avoid flooding)
            strategy_instance._last_telem_ts = 0

            async def wrapped_on_tick(tick, strategy=strategy_instance):
                await strategy.on_tick(tick)

                import time
                now = time.time()

                # Heartbeat every 1 second (Institutional Telemetry Standard)
                if self.telemetry_callback and (now - strategy._last_telem_ts) >= 1.0:
                    strategy._last_telem_ts = now
                    asyncio.create_task(self.telemetry_callback("heartbeat", {
                        "strategy": strategy.name,
                        "symbol": tick.symbol,
                        "ltp": tick.ltp,
                        "active_trades": len(getattr(strategy, 'active_trades', []))
                    }))

            self.market_stream.subscribe(strategy_instance.symbols, wrapped_on_tick)
            self._wrapped_callbacks[strategy_key] = wrapped_on_tick
            startup_pairs.append((strategy_key, strategy_instance))

        self._refresh_strategy_list()
        if not startup_pairs:
            logger.info("No new strategies were started.")
            return

        results = await asyncio.gather(
            *(strategy.on_start() for _, strategy in startup_pairs),
            return_exceptions=True,
        )
        for (strategy_key, strategy), result in zip(startup_pairs, results):
            if isinstance(result, Exception):
                logger.error("Strategy '%s' failed during startup: %s", strategy.name, result, exc_info=True)
                self.market_stream.unsubscribe(strategy.symbols, strategy.on_tick)
                self._strategies_by_key.pop(strategy_key, None)
            else:
                logger.info("Strategy '%s' is now running.", strategy.name)
        self._refresh_strategy_list()

        # Phase 16: Immediate Matrix Sync
        if self.telemetry_callback:
            matrix = []
            for s in self.strategies:
                matrix.append({
                    "id": s.name.lower().replace(" ", "-"),
                    "name": s.name,
                    "is_active": getattr(s, "is_active", False),
                    "status": "Running" if getattr(s, "is_active", False) else "Idle"
                })
            asyncio.create_task(self.telemetry_callback("matrix_update", {"strategies": matrix}))

    async def stop(self):
        """
        Stops all running strategies gracefully.
        """
        await self.stop_strategies(self._strategies_by_key.keys())

    async def stop_strategies(self, strategy_keys: Iterable[str]):
        """Stop one or more running strategies and unsubscribe them from ticks."""
        stop_pairs = [
            (strategy_key, self._strategies_by_key[strategy_key])
            for strategy_key in strategy_keys
            if strategy_key in self._strategies_by_key
        ]
        logger.info("Stopping %s running strategies...", len(stop_pairs))
        if not stop_pairs:
            return

        for strategy_key, strategy in stop_pairs:
            callback = self._wrapped_callbacks.get(strategy_key, strategy.on_tick)
            self.market_stream.unsubscribe(strategy.symbols, callback)
            self._wrapped_callbacks.pop(strategy_key, None)

        await asyncio.gather(*(strategy.on_stop() for _, strategy in stop_pairs), return_exceptions=True)
        for strategy_key, _ in stop_pairs:
            self._strategies_by_key.pop(strategy_key, None)

        self._refresh_strategy_list()
        logger.info("Selected strategies have been stopped.")

        # Phase 16: Immediate Matrix Sync
        if self.telemetry_callback:
            matrix = []
            for s in self.strategies:
                matrix.append({
                    "id": s.name.lower().replace(" ", "-"),
                    "name": s.name,
                    "is_active": getattr(s, "is_active", False),
                    "status": "Running" if getattr(s, "is_active", False) else "Idle"
                })
            asyncio.create_task(self.telemetry_callback("matrix_update", {"strategies": matrix}))

    async def halt_strategy(self, strategy_key: str) -> bool:
        """Institutional Halt: Stops execution and blocks new orders via RiskManager."""
        try:
            # 1. Stop tick processing
            await self.stop_strategies([strategy_key])

            # 2. Halt in RiskManager (prevents any manual/stray order validation)
            if hasattr(self.order_manager, 'risk_manager'):
                self.order_manager.risk_manager.halt_strategy(strategy_key)

            logger.warning(f"INSTITUTIONAL HALT >> {strategy_key} is now fully halted.")
            return True
        except Exception as e:
            logger.error(f"Failed to halt strategy {strategy_key}: {e}")
            return False

    async def unhalt_strategy(self, strategy_key: str) -> bool:
        """Institutional Unhalt: Resumes risk status and restarts tick processing."""
        try:
            # 1. Resume in RiskManager
            if hasattr(self.order_manager, 'risk_manager'):
                self.order_manager.risk_manager.resume_strategy(strategy_key)

            # 2. Restart execution
            await self.start_strategies([strategy_key])

            logger.info(f"INSTITUTIONAL RESUME >> {strategy_key} has been unhalted.")
            return True
        except Exception as e:
            logger.error(f"Failed to unhalt strategy {strategy_key}: {e}")
            return False

    def get_telemetry(self) -> Dict[str, Any]:
        """Collect real-time telemetry from all active strategies."""
        regime_data = self.current_regime_data or {
            "regime": "NEUTRAL",
            "reasoning": "System initializing...",
            "pos_mult": 1.0,
            "risk_mult": 1.0
        }

        telemetry = {
            "regime": regime_data.get("regime", "NEUTRAL"),
            "reasoning": regime_data.get("reasoning", ""),
            "pos_mult": regime_data.get("pos_mult", 1.0),
            "risk_mult": regime_data.get("risk_mult", 1.0),
            "sector_sentiment": self.sector_sentiment,
            "active_trades_count": 0,
            "strategies": [],
            "broker_session": {
                "is_healthy": False,
                "status": "initializing"
            },
            "uptime": int(__import__('time').time() - self._start_time),
            "is_hitl_active": False,
            "market_regime": regime_data
        }

        # Phase 8: Add Session Health to Telemetry
        try:
            from services.session_service import get_session_service
            ss = get_session_service()
            telemetry["broker_session"] = ss.get_status()
        except:
            pass

        for strategy in self.strategies:
            strat_info = {
                "name": strategy.name,
                "is_active": getattr(strategy, "is_active", False),
                "hitl_enabled": getattr(strategy, "hitl_enabled", False)
            }

            if hasattr(strategy, "regime_status"):
                # Prefer reporting the global runner regime
                strat_info["regime_status"] = self.current_regime_data["regime"]

            if hasattr(strategy, "active_trades"):
                active_count = len(strategy.active_trades)
                telemetry["active_trades_count"] += active_count
                strat_info["active_trades"] = active_count

            if strat_info["hitl_enabled"] and strat_info["is_active"]:
                telemetry["is_hitl_active"] = True

            telemetry["strategies"].append(strat_info)

        return telemetry

    async def _safeguard_monitor_loop(self):
        """
        Background heart-beat task that audits all running strategies
        against their institutional kill-switches.
        """
        while True:
            try:
                # Phase 9: High-frequency monitoring (10s interval)
                await asyncio.sleep(10)

                # Use the risk manager injected via order_manager
                risk_mgr = self.order_manager.risk_manager

                # Check for each registered strategy
                for strategy_id in list(self._strategies_by_key.keys()):
                    outcome = risk_mgr.check_strategy_safeguards(strategy_id)

                    if outcome.get("status") == "breached":
                        reason = outcome.get("reason", "Institutional Safeguard Breach")
                        logger.warning(f"GUARD >> {strategy_id} breached: {reason}")

                        # AUTONOMOUS KILL-SWITCH (Phase 7 Requirement)
                        asyncio.create_task(self.order_manager.liquidate_strategy(strategy_id))

                        if self.telemetry_callback:
                            asyncio.create_task(self.telemetry_callback("safeguard_breach", {
                                "strategy": strategy_id,
                                "reason": reason,
                                "action": "HALT_AND_LIQUIDATE"
                            }))

            except Exception as e:
                logger.error(f"Safeguard Loop Error: {e}")
                await asyncio.sleep(30)

    async def _trading_hours_monitor_loop(self):
        """
        Background task to monitor strategy trading hours and trigger square-offs.
        """
        import pytz
        from datetime import datetime
        ist = pytz.timezone('Asia/Kolkata')

        while True:
            try:
                await asyncio.sleep(60) # Check every minute
                now = datetime.now(ist).time()

                for strategy_id, strategy in list(self._strategies_by_key.items()):
                    if not strategy.is_active or strategy.strategy_type not in ["intraday", "scalping"]:
                        continue

                    try:
                        sq_off_t = datetime.strptime(strategy.trading_hours["square_off"], "%H:%M").time()
                        if now >= sq_off_t:
                            logger.warning(f"SQUARE_OFF >> {strategy_id} square-off time reached ({sq_off_t}). Liquidating and stopping...")

                            # Execute liquidation and stop sequentially
                            try:
                                await self.order_manager.liquidate_strategy(strategy_id)
                                await self.stop_strategies([strategy_id])
                            except Exception as exec_err:
                                logger.error(f"Failed to execute auto square-off for {strategy_id}: {exec_err}")

                            if self.telemetry_callback:
                                asyncio.create_task(self.telemetry_callback("auto_square_off", {
                                    "strategy": strategy_id,
                                    "time": str(sq_off_t),
                                    "action": "LIQUIDATE_AND_STOP"
                                }))
                    except Exception as parse_err:
                        logger.error(f"Error checking square-off for {strategy_id}: {parse_err}")

            except Exception as e:
                logger.error(f"Trading Hours Loop Error: {e}")

    async def _market_regime_loop(self):
        """
        Background task to update the global market regime every 15 minutes.
        Uses 15m candles for NIFTY to classify the trend.
        """
        logger.info("Market Regime Agent active. Initializing scan...")

        while True:
            try:
                # 1. Fetch 15m candles for NIFTY from DuckDB (History)
                from data.historify_db import get_duckdb_conn, upsert_market_data
                import pandas as pd
                import datetime

                symbol = "NIFTY"
                interval = "15" # Consistent with internal 15m logic

                candles = []
                with get_duckdb_conn() as conn:
                    # Check if table exists first
                    tables = conn.execute("SHOW TABLES").fetchall()
                    if ('market_data',) in tables:
                        res = conn.execute("""
                            SELECT timestamp, open, high, low, close, volume
                            FROM market_data
                            WHERE symbol = ? AND interval = ?
                            ORDER BY timestamp DESC LIMIT 50
                        """, [symbol, interval]).fetchall()

                        if res:
                            # Convert to list of dicts manually for NumPy 2.0 / Arrow safety
                            candles = [
                                {"timestamp": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
                                for r in res
                            ]

                # 2. Self-healing: If no data, sync from OpenAlgo
                if not candles:
                    logger.info(f"Regime Agent: DuckDB empty for {symbol} {interval}. Attempting OpenAlgo sync...")
                    # Normalize for OpenAlgo history endpoint requirements
                    end_date = datetime.datetime.now().strftime("%Y-%m-%d")
                    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
                    sync_interval = f"{interval}m" if "m" not in str(interval) else interval

                    try:
                        logger.warning(f"Regime Agent: OpenAlgo decommissioned. Skipping sync for {symbol}.")
                    except Exception as sync_err:
                        logger.error(f"Regime Agent Sync Error: {sync_err}")

                # 3. Analyze Regime
                if candles:
                    # Ensure candles are in correct order for indicators (ascending timestamp)
                    # The query returned DESC, so we reverse it
                    df_candles = pd.DataFrame(candles).sort_values("timestamp")
                    regime_result = await self.decision_agent.get_market_regime(symbol, df_candles.to_dict("records"))

                    self.current_regime_data.update(regime_result)
                    self.current_regime_data["last_update"] = __import__('time').time()

                    logger.info(f"REGIME >> Current Market is {self.current_regime_data['regime']}. "
                                f"Factors: Pos {self.current_regime_data['pos_mult']}x, Risk {self.current_regime_data['risk_mult']}x")

                    # 4. Broadcast update to UI via telemetry callback
                    if self.telemetry_callback:
                        asyncio.create_task(self.telemetry_callback("regime_update", self.current_regime_data))

            except Exception as e:
                logger.error(f"Regime Agent Loop Error: {e}")

            # Wait for next 15m slice (900s)
            await asyncio.sleep(900)

    async def _sector_sentiment_loop(self):
        """
        Periodically analyze sentiment for Tier 1 and Tier 2 sectors.
        Runs every 15 minutes.
        """
        logger.info("Sector Sentiment loop active.")
        await asyncio.sleep(5) # Stagger start from global regime

        while True:
            try:
                tier_priority = ["tier_1", "tier_2"]
                for tier_key in tier_priority:
                    tier_data = self.sector_config.get("tiers", {}).get(tier_key, {})
                    sectors = tier_data.get("sectors", [])

                    if not sectors:
                        continue

                    # Parallel Fetch: Optimize data retrieval across all sector indices
                    logger.info(f"Sector Sync: Starting parallel history fetch for {len(sectors)} {tier_key} indices")
                    fetch_tasks = [self._fetch_index_candles(s.get("index")) for s in sectors]
                    all_candles = await asyncio.gather(*fetch_tasks)

                    # Parallel Analysis: Concurrent AI sentiment evaluation
                    logger.info(f"Sector Sentiment: Analyzing {len(sectors)} {tier_key} sectors in parallel")

                    async def analyze_and_update(sector, candles, tier):
                        name = sector.get("name")
                        index = sector.get("index")
                        if candles:
                            sentiment_res = await self.decision_agent.analyze_sector_sentiment(name, index, candles)
                            self.sector_sentiment[name] = {
                                **sentiment_res,
                                "timestamp": __import__('time').time(),
                                "tier": tier
                            }
                            logger.info(f"SENTIMENT >> {name} is {sentiment_res['sentiment']} ({sentiment_res['source']})")
                            if self.telemetry_callback:
                                asyncio.create_task(self.telemetry_callback("sector_update", {
                                    "name": name,
                                    "data": self.sector_sentiment[name]
                                }))

                    analysis_tasks = [analyze_and_update(s, c, tier_key) for s, c in zip(sectors, all_candles)]
                    await asyncio.gather(*analysis_tasks)

            except Exception as e:
                logger.error(f"Sector Sentiment Loop Error: {e}")

            await asyncio.sleep(900) # 15m interval

    async def _fetch_index_candles(self, symbol: str, interval: str = "15") -> List[Dict[str, Any]]:
        """Utility to fetch candles from DuckDB or Sync if missing."""
        try:
            with get_duckdb_conn() as conn:
                tables = conn.execute("SHOW TABLES").fetchall()
                if ('market_data',) in [tuple(t) for t in tables]:
                    res = conn.execute("""
                        SELECT timestamp, open, high, low, close, volume
                        FROM market_data
                        WHERE symbol = ? AND interval = ?
                        ORDER BY timestamp DESC LIMIT 50
                    """, [symbol, interval]).fetchall()

                    if res:
                        # Convert to list of dicts manually for NumPy 2.0 safety
                        records = [
                            {"timestamp": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]}
                            for r in res
                        ]
                        return sorted(records, key=lambda x: x["timestamp"])

            # Normalize for OpenAlgo history endpoint requirements
            end_date = datetime.datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
            sync_interval = f"{interval}m" if "m" not in str(interval) else interval

            # Map Index Symbols specifically for OpenAlgo (which uses NSE_INDEX for indices)
            NSE_INDEX_SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYIT", "NIFTYAUTO", "NIFTYENERGY", "NIFTYPHARMA"]

            fetch_exchange = "NSE"
            if symbol.upper() in NSE_INDEX_SYMBOLS:
                fetch_exchange = "NSE_INDEX"

            logger.warning(f"Sector Sync: OpenAlgo decommissioned. Skipping sync for {symbol}.")

        except Exception as e:
            logger.warning(f"Failed to fetch candles for {symbol}: {e}")

        return []
