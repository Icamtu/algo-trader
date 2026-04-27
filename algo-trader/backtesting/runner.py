import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from utils.charges import ZerodhaCalculator

from core.strategy_registry import build_strategy_snapshots


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RESULTS_DIR = PROJECT_ROOT / "run_data" / "backtests"


@dataclass
class BacktestTrade:
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    quantity: int
    pnl: float
    charges: float = 0.0
    mae: float = 0.0 # Maximum Adverse Excursion (%)
    mfe: float = 0.0 # Maximum Favorable Excursion (%)


@dataclass
class BacktestResult:
    result_id: str
    strategy_key: str
    strategy_name: str
    symbol: str
    start_date: str
    end_date: str
    total_trades: int
    win_rate: float
    gross_pnl: float
    net_pnl: float
    max_drawdown: float
    average_hold_minutes: float
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    equity_curve: List[float] = field(default_factory=list)
    trades: List[BacktestTrade] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["trades"] = [asdict(trade) for trade in self.trades]
        return payload


class BacktestRunner:
    """Replay simple historical close-price data against a selected strategy."""

    def __init__(self, results_dir: Optional[Path] = None):
        self.results_dir = results_dir or DEFAULT_RESULTS_DIR
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def run(
        self,
        strategy_key: str,
        symbol: str,
        candles: List[Dict[str, Any]],
        initial_cash: float = 100000.0,
        params: Optional[Dict[str, Any]] = None,
    ) -> BacktestResult:

        if not candles:
            raise ValueError("Backtest requires at least one candle")

        snapshots = {
            snapshot.config_key: snapshot
            for snapshot in build_strategy_snapshots(
                config={"strategies": {strategy_key: True}},
                order_manager=None,
            )
        }
        if strategy_key not in snapshots:
            raise ValueError(f"Unknown strategy key: {strategy_key}")

        snapshot = snapshots[strategy_key]
        active_params = snapshot.params.copy()
        if params:
            active_params.update(params)

        quantity = int(active_params.get("trade_quantity", 1))

        cash = float(initial_cash)
        open_position: Optional[Dict[str, Any]] = None
        equity_curve: List[float] = []
        trades: List[BacktestTrade] = []
        closing_prices: List[float] = []

        for candle in candles:
            price = float(candle["close"])
            timestamp = str(candle["timestamp"])
            closing_prices.append(price)
            signal = self._signal_for(strategy_key, active_params, closing_prices, price, symbol)

            if signal == "BUY" and open_position is None:
                open_position = {
                    "entry_time": timestamp,
                    "entry_price": price,
                    "quantity": quantity,
                    "max_fav": price,
                    "max_adv": price,
                }
                cash -= price * quantity
            elif signal == "SELL" and open_position is not None:
                # Add symbol to open_position for charge inference
                open_position["symbol"] = symbol
                trade = self._close_trade(open_position, timestamp, price, strategy_key)
                cash += price * quantity
                trades.append(trade)
                open_position = None

            mark_to_market = 0.0
            if open_position is not None:
                mark_to_market = open_position["quantity"] * price
                # Update MAE/MFE
                open_position["max_fav"] = max(open_position["max_fav"], price)
                open_position["max_adv"] = min(open_position["max_adv"], price)
            equity_curve.append(cash + mark_to_market)

        if open_position is not None:
            last_candle = candles[-1]
            last_price = float(last_candle["close"])
            open_position["symbol"] = symbol
            trades.append(self._close_trade(open_position, str(last_candle["timestamp"]), last_price, strategy_key))
            cash += last_price * quantity
            equity_curve[-1] = cash

        gross_pnl = sum(trade.pnl for trade in trades)
        total_charges = sum(trade.charges for trade in trades)
        net_pnl = gross_pnl - total_charges

        wins = sum(1 for trade in trades if (trade.pnl - trade.charges) > 0)
        win_rate = (wins / len(trades)) * 100 if trades else 0.0

        gross_profit = sum(trade.pnl for trade in trades if trade.pnl > 0)
        gross_loss = abs(sum(trade.pnl for trade in trades if trade.pnl <= 0))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)

        avg_win = (gross_profit / wins) if wins > 0 else 0.0
        losses = len(trades) - wins
        avg_loss = (gross_loss / losses) if losses > 0 else 0.0
        expectancy = ((win_rate/100) * avg_win) - ((1 - win_rate/100) * avg_loss)

        average_hold_minutes = (
            sum(self._hold_minutes(trade) for trade in trades) / len(trades) if trades else 0.0
        )
        max_drawdown = self._max_drawdown(equity_curve)

        # Performance ratios
        total_return_pct = (equity_curve[-1] - initial_cash) / initial_cash if equity_curve else 0.0
        calmar_ratio = (total_return_pct * 100 / max_drawdown) if max_drawdown > 0 else 0.0

        # Simple Sharpe/Sortino using daily returns if possible
        # For now, simplistic approximation:
        sharpe_ratio = (total_return_pct / 0.15) if total_return_pct != 0 else 0.0 # Baseline vol 15%
        sortino_ratio = (total_return_pct / 0.10) if total_return_pct != 0 else 0.0 # Baseline downside vol 10%

        result_id = f"{strategy_key}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"

        result = BacktestResult(
            result_id=result_id,
            strategy_key=strategy_key,
            strategy_name=snapshot.strategy_name,
            symbol=symbol,
            start_date=str(candles[0]["timestamp"]),
            end_date=str(candles[-1]["timestamp"]),
            total_trades=len(trades),
            win_rate=round(win_rate, 2),
            gross_pnl=round(gross_pnl, 2),
            net_pnl=round(net_pnl, 2),
            max_drawdown=round(max_drawdown, 2),
            average_hold_minutes=round(average_hold_minutes, 2),
            sharpe_ratio=round(sharpe_ratio, 2),
            sortino_ratio=round(sortino_ratio, 2),
            calmar_ratio=round(calmar_ratio, 2),
            profit_factor=round(profit_factor, 2),
            expectancy=round(expectancy, 2),
            equity_curve=[round(value, 2) for value in equity_curve],
            trades=trades,
        )
        self.persist_result(result)
        return result

    def persist_result(self, result: BacktestResult) -> Path:
        output_path = self.results_dir / f"{result.result_id}.json"
        output_path.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
        return output_path

    def _signal_for(
        self,
        strategy_key: str,
        params: Dict[str, Any],
        prices: List[float],
        latest_price: float,
        symbol: str,
    ) -> str:
        if strategy_key == "intraday":
            if latest_price >= float(params.get("buy_above", 101.0)):
                return "BUY"
            if latest_price <= float(params.get("sell_below", 99.0)):
                return "SELL"
            return "HOLD"

        if strategy_key == "swing":
            from strategies.swing_strategy import generate_signal as swing_signal

            return swing_signal(
                {
                    "symbol": symbol,
                    "prices": prices,
                    "fast_period": params.get("fast_period", 5),
                    "slow_period": params.get("slow_period", 12),
                }
            )

        if strategy_key == "long_term":
            from strategies.longterm_strategy import generate_signal as longterm_signal

            return longterm_signal(
                {
                    "symbol": symbol,
                    "prices": prices,
                    "trend_period": params.get("trend_period", 20),
                    "rsi_period": params.get("rsi_period", 14),
                    "buy_below_rsi": params.get("buy_below_rsi", 45),
                    "sell_above_rsi": params.get("sell_above_rsi", 65),
                }
            )

        if strategy_key == "sample":
            if latest_price <= float(params.get("buy_below_price", 95.0)):
                return "BUY"
            if latest_price >= float(params.get("sell_above_price", 105.0)):
                return "SELL"
            return "HOLD"

        raise ValueError(f"Unsupported strategy key: {strategy_key}")

    def _close_trade(self, position: Dict[str, Any], exit_time: str, exit_price: float, strategy_key: str = "intraday") -> BacktestTrade:
        entry_price = float(position["entry_price"])
        quantity = int(position["quantity"])
        gross_pnl = (exit_price - entry_price) * quantity

        # Calculate Zerodha charges
        asset_type = ZerodhaCalculator.infer_asset_type(position.get("symbol", "EQUITY"), strategy_key)
        charge_data = ZerodhaCalculator.calculate_charges(
            buy_price=entry_price,
            sell_price=exit_price,
            quantity=quantity,
            asset_type=asset_type
        )
        total_charges = charge_data["total_charges"]

        # Calculate MAE/MFE as percentages relative to entry
        entry_price = float(position["entry_price"])
        # For LONG (assuming long for now in simple runner)
        mfe_pct = ((position["max_fav"] - entry_price) / entry_price) * 100
        mae_pct = ((position["max_adv"] - entry_price) / entry_price) * 100

        return BacktestTrade(
            entry_time=str(position["entry_time"]),
            exit_time=exit_time,
            entry_price=entry_price,
            exit_price=float(exit_price),
            quantity=quantity,
            pnl=round(gross_pnl, 2),
            charges=round(total_charges, 2),
            mae=round(mae_pct, 2),
            mfe=round(mfe_pct, 2),
        )

    def _hold_minutes(self, trade: BacktestTrade) -> float:
        start = datetime.fromisoformat(trade.entry_time)
        end = datetime.fromisoformat(trade.exit_time)
        return (end - start).total_seconds() / 60

    def _max_drawdown(self, equity_curve: List[float]) -> float:
        peak = None
        max_drawdown = 0.0
        for value in equity_curve:
            peak = value if peak is None else max(peak, value)
            if peak:
                max_drawdown = max(max_drawdown, peak - value)
        return max_drawdown
