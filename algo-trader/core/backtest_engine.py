import asyncio
import logging
import time
from typing import Any, Dict, List, Type
from datetime import datetime, timedelta

from data.history_manager import HistoryManager
from data.market_data import Tick
from execution.sim_order_manager import SimulatedOrderManager

logger = logging.getLogger(__name__)

class BacktestEngine:
    """
    Drives a Strategy through historical candles as if they were real ticks.
    """

    def __init__(self, strategy_class: Type, symbol: str, interval: str = "1m", slippage_pct: float = 0.0005):
        self.strategy_class = strategy_class
        self.symbol = symbol
        self.interval = interval
        self.history_manager = HistoryManager()
        self.order_manager = SimulatedOrderManager(slippage_pct=slippage_pct)

    async def run(self, days: int = 7, initial_capital: float = 1000000.0):
        # 1. Instantiate Strategy to discover symbols
        from portfolio.portfolio_manager import PortfolioManager
        self.portfolio_manager = PortfolioManager(account_capital=initial_capital)
        # Instantiate Strategy — handle both BaseStrategy full-sig and compact strategies
        import inspect
        init_params = list(inspect.signature(self.strategy_class.__init__).parameters.keys())
        # init_params[0] is always 'self'; check if strategy expects (name, symbols, ...) or just (order_manager, ...)
        if len(init_params) >= 4 and init_params[1] in ("name",):
            # Full BaseStrategy convention: __init__(self, name, symbols, order_manager, portfolio_manager)
            strategy = self.strategy_class("BacktestStrategy", [self.symbol], self.order_manager, self.portfolio_manager)
        else:
            # Compact convention: __init__(self, order_manager, portfolio_manager=None)
            strategy = self.strategy_class(self.order_manager, self.portfolio_manager)


        # Monkey-patch analyze_signal for no-ai mode
        if getattr(self, 'no_ai', False):
            logger.info(f"[{self.strategy_class.__name__}] AI Bypassed (Perfect Conviction Mode)")
            async def mock_analyze(*args, **kwargs):
                return "Simulated technical breakout (AI Bypassed)", 0.99
            strategy.analyze_signal = mock_analyze

        # 2. Fetch History for ALL strategy symbols
        market_anchor = getattr(strategy, 'market_anchor', "NIFTY 50")
        if market_anchor == "NIFTY":
            market_anchor = "NIFTY 50"

        symbols_to_fetch = list(set(strategy.symbols + [market_anchor]))
        all_candles = []

        # Parse dates (UI will now pass these explicitly)
        if isinstance(days, str): # Handle passing dates as from_date or YYYY-MM-DD
            try:
                start_date = datetime.strptime(days, "%Y-%m-%d")
                end_date = datetime.now() # Default end
            except:
                end_date = datetime.now()
                start_date = end_date - timedelta(days=7)
        elif isinstance(days, int):
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
        else:
            # Fallback
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)

        # Pre-flight data sync
        auto_sync = getattr(self, 'auto_sync', True)
        if auto_sync:
            from services.historify_service import historify_service
            for sym in symbols_to_fetch:
                logger.info(f"Checking data readiness for {sym}...")
                # We assume NSE for now, but in a production app we'd map this
                exchange = "NSE"
                interval = self.interval.replace("m", "") # Convert 1m to 1

                # Check and wait for data if missing
                # A more optimized version would check DuckDB range first
                success = historify_service.check_and_wait_for_data(
                    symbol=sym,
                    exchange=exchange,
                    interval=interval,
                    from_date=start_date.strftime("%Y-%m-%d"),
                    to_date=end_date.strftime("%Y-%m-%d")
                )
                if not success:
                    logger.warning(f"Data sync failed for {sym}. Backtest results may be partial.")

        import pandas as pd
        import numpy as np

        for sym in symbols_to_fetch:
            logger.info(f"Loading history for {sym}...")
            df = self.history_manager.get_candles_df(
                sym,
                interval=self.interval,
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d")
            )

            if df.empty:
                continue

            df['symbol'] = sym

            # Identify timestamp column
            ts_col = 'timestamp' if 'timestamp' in df.columns else ('time' if 'time' in df.columns else None)

            if ts_col:
                # Convert to numeric, handle s vs ms vs datetime
                ts_series = pd.to_numeric(df[ts_col], errors='coerce')

                # If numeric conversion failed (likely datetime string), use pd.to_datetime
                if ts_series.isna().any():
                    df['_ts'] = pd.to_datetime(df[ts_col]).view('int64') // 10**9
                else:
                    # Guess s vs ms: if > 10**10, it's likely ms
                    df['_ts'] = np.where(ts_series > 10**11, ts_series / 1000, ts_series)
            else:
                df['_ts'] = time.time()

            # Filter by date range if necessary (DuckDB might return more)
            start_ts = start_date.timestamp()
            end_ts = end_date.timestamp()
            df = df[(df['_ts'] >= start_ts) & (df['_ts'] <= end_ts)]

            all_candles.extend(df.to_dict('records'))

        # 3. Synchronize Ticks (Sort by Timestamp)
        all_candles.sort(key=lambda x: x['_ts'])

        await strategy.on_start()

        # 4. Emulate synchronized tick stream & Track Price History for MTM
        price_history: Dict[float, Dict[str, float]] = {}
        logger.info(f"Replaying {len(all_candles)} synchronized ticks...")

        for candle in all_candles:
            if not strategy.is_active:
                logger.error(f"STRATEGY INACTIVE DURING LOOP! Symbol: {candle['symbol']}")
                break

            ts = candle['_ts']
            if ts not in price_history:
                price_history[ts] = {}
            price_history[ts][candle['symbol']] = float(candle.get('close', 0))

            tick = Tick(
                symbol=candle['symbol'],
                ltp=float(candle.get('close', 0)),
                timestamp=ts,
                raw=candle
            )

            # Sync simulation clock with order manager
            self.order_manager.set_sim_time(ts)

            # Update strategy price buffers for indicators
            if hasattr(strategy, 'update_history'):
                strategy.update_history(tick)

            await strategy.on_tick(tick)

        # 5. Finalize
        logger.info("Simulation loop complete. Finalizing...")
        await strategy.on_stop()

        # 6. Calculate Institutional Performance Metrics
        from core.performance import PerformanceCalculator
        trade_logs = self.order_manager.get_trade_log()

        calc = PerformanceCalculator(
            trade_logs=trade_logs,
            initial_capital=initial_capital,
            price_history=price_history,
            benchmark_symbol=market_anchor
        )

        report = calc.calculate_metrics()

        logger.info(f"Backtest Complete. Total Trades: {report.get('total_trades', 0)}")

        return {
            "total_trades": report.get('total_trades', 0),
            "performance": report,
            "equity_curve": report.get('equity_curve', []),
            "trades": report.get('closed_trades_list', trade_logs) # Use raw logs if formatter not ready
        }
