# algo-trader/core/strategy_runner.py
import asyncio
import logging
from typing import Any, Dict, Iterable, List

from .strategy import BaseStrategy
from .strategy_registry import StrategyDefinition, discover_strategy_definitions
from data.market_data import MarketDataStream
from execution.order_manager import OrderManager

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
        self._tick_counter = 0
        import time
        self._start_time = time.time()

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

            strategy_instance.is_active = False
            self._strategies_by_key[strategy_key] = strategy_instance
            logger.info(
                "Prepared enabled strategy: '%s' (key: '%s')",
                strategy_instance.name,
                strategy_key,
            )

        self.strategies = list(self._strategies_by_key.values())

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
        return definition.strategy_class(order_manager=self.order_manager, portfolio_manager=self.portfolio_manager)

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

        await self.start_strategies(self._strategies_by_key.keys())

    async def start_strategies(self, strategy_keys: Iterable[str]):
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

            # Wrap on_tick to inject telemetry heartbeats
            async def wrapped_on_tick(tick, strategy=strategy_instance):
                await strategy.on_tick(tick)
                self._tick_counter += 1
                if self.telemetry_callback and self._tick_counter % 50 == 0:
                    asyncio.create_task(self.telemetry_callback("heartbeat", {
                        "strategy": strategy.name,
                        "symbol": tick.symbol,
                        "ltp": tick.ltp,
                        "active_trades": len(getattr(strategy, 'active_trades', []))
                    }))

            self.market_stream.subscribe(strategy_instance.symbols, wrapped_on_tick)
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

        for _, strategy in stop_pairs:
            self.market_stream.unsubscribe(strategy.symbols, strategy.on_tick)

        await asyncio.gather(*(strategy.on_stop() for _, strategy in stop_pairs), return_exceptions=True)
        for strategy_key, _ in stop_pairs:
            self._strategies_by_key.pop(strategy_key, None)

        self._refresh_strategy_list()
        logger.info("Selected strategies have been stopped.")

    def get_telemetry(self) -> Dict[str, Any]:
        """Collect real-time telemetry from all active strategies."""
        telemetry = {
            "regime": "NEUTRAL",
            "active_trades_count": 0,
            "strategies": [],
            "broker_session": {
                "is_healthy": False,
                "status": "initializing"
            },
            "uptime": int(__import__('time').time() - self._start_time),
            "is_hitl_active": False
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

            # Intraday specific metrics
            if hasattr(strategy, "regime_status"):
                telemetry["regime"] = strategy.regime_status

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
