import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core import config as config_module
from core.strategy_registry import build_strategy_snapshots, discover_strategy_definitions
from core.strategy_runner import StrategyRunner
from backtesting.runner import BacktestRunner
from execution.paper_broker import PaperBroker


class DummyMarketStream:
    def __init__(self):
        self.subscriptions = {}

    def subscribe(self, symbols, callback):
        for symbol in symbols:
            self.subscriptions.setdefault(symbol, []).append(callback)

    def unsubscribe(self, symbols, callback):
        for symbol in symbols:
            callbacks = self.subscriptions.get(symbol, [])
            if callback in callbacks:
                callbacks.remove(callback)


class DummyOrderManager:
    pass


class StrategyConfigTests(unittest.TestCase):
    def test_load_config_includes_default_strategy_toggles(self):
        missing_path = PROJECT_ROOT / "config" / "settings-does-not-exist.yaml"
        with patch.object(config_module, "CONFIG_PATH", missing_path):
            with patch.dict(os.environ, {}, clear=True):
                settings = config_module.load_config()

        self.assertEqual(
            settings["strategies"],
            {
                "intraday": True,
                "swing": True,
                "long_term": True,
                "sample": False,
            },
        )

    def test_env_can_enable_and_disable_strategies(self):
        missing_path = PROJECT_ROOT / "config" / "settings-does-not-exist.yaml"
        with patch.object(config_module, "CONFIG_PATH", missing_path):
            with patch.dict(
                os.environ,
                {
                    "ENABLED_STRATEGIES": "sample",
                    "DISABLED_STRATEGIES": "intraday,long_term",
                },
                clear=True,
            ):
                settings = config_module.load_config()

        self.assertFalse(settings["strategies"]["intraday"])
        self.assertFalse(settings["strategies"]["long_term"])
        self.assertTrue(settings["strategies"]["sample"])
        self.assertTrue(settings["strategies"]["swing"])

    def test_registry_discovers_expected_strategy_keys(self):
        definitions = discover_strategy_definitions()
        config_keys = {definition.config_key for definition in definitions}

        self.assertTrue({"intraday", "swing", "long_term", "sample"}.issubset(config_keys))

    def test_strategy_runner_loads_only_enabled_strategies(self):
        runner = StrategyRunner(
            market_stream=DummyMarketStream(),
            order_manager=DummyOrderManager(),
            config={
                "strategies": {
                    "intraday": True,
                    "swing": False,
                    "long_term": True,
                    "sample": False,
                }
            },
        )

        runner._discover_strategies()

        loaded_names = {strategy.name for strategy in runner.strategies}
        self.assertEqual(loaded_names, {"Intraday Strategy", "Long Term Strategy"})


class StrategyControlTests(unittest.IsolatedAsyncioTestCase):
    async def test_runner_can_start_selected_strategies(self):
        market_stream = DummyMarketStream()
        runner = StrategyRunner(
            market_stream=market_stream,
            order_manager=DummyOrderManager(),
            config={"strategies": {}},
        )
        runner._discover_strategies()

        await runner.start_strategies(["intraday", "sample"])

        self.assertEqual(set(runner.running_strategy_keys()), {"intraday", "sample"})
        self.assertIn("RELIANCE", market_stream.subscriptions)
        self.assertEqual(len(market_stream.subscriptions["RELIANCE"]), 2)

    async def test_runner_can_stop_selected_strategies(self):
        market_stream = DummyMarketStream()
        runner = StrategyRunner(
            market_stream=market_stream,
            order_manager=DummyOrderManager(),
            config={"strategies": {}},
        )
        runner._discover_strategies()
        await runner.start_strategies(["intraday", "sample"])

        await runner.stop_strategies(["sample"])

        self.assertEqual(set(runner.running_strategy_keys()), {"intraday"})
        self.assertEqual(len(market_stream.subscriptions["RELIANCE"]), 1)


class OpenAlgoReuseTests(unittest.TestCase):
    def test_local_paper_broker_is_deprecated(self):
        with self.assertRaises(NotImplementedError):
            PaperBroker()


class BacktestRunnerTests(unittest.TestCase):
    def test_backtest_runner_generates_trade_and_result_file(self):
        candles = [
            {"timestamp": "2026-01-01T09:15:00+00:00", "close": 100.0},
            {"timestamp": "2026-01-01T09:16:00+00:00", "close": 94.0},
            {"timestamp": "2026-01-01T09:17:00+00:00", "close": 96.0},
            {"timestamp": "2026-01-01T09:18:00+00:00", "close": 106.0},
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            runner = BacktestRunner(results_dir=Path(temp_dir))
            result = runner.run(strategy_key="sample", symbol="RELIANCE", candles=candles)

            self.assertEqual(result.total_trades, 1)
            self.assertGreater(result.gross_pnl, 0)
            output_files = list(Path(temp_dir).glob("*.json"))
            self.assertEqual(len(output_files), 1)

    def test_strategy_snapshots_include_enabled_flag(self):
        snapshots = build_strategy_snapshots(
            config={"strategies": {"intraday": True, "swing": False, "long_term": False, "sample": True}},
            order_manager=DummyOrderManager(),
        )

        enabled_by_key = {snapshot.config_key: snapshot.enabled for snapshot in snapshots}
        self.assertTrue(enabled_by_key["intraday"])
        self.assertFalse(enabled_by_key["swing"])
        self.assertTrue(enabled_by_key["sample"])


if __name__ == "__main__":
    unittest.main()
