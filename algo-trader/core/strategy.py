# algo-trader/core/strategy.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional
import logging
import asyncio
import os

# Assuming OrderManager and Tick types are defined elsewhere
from execution.order_manager import OrderManager
from data.market_data import Tick
from execution.decision_agent import DecisionAgent
import numpy as np

logger = logging.getLogger(__name__)

class BaseStrategy(ABC):
    """
    Abstract Base Class for all trading strategies.

    This class provides the structure that the StrategyRunner expects.
    Your custom strategies should inherit from this class.
    """

    def __init__(self, name: str, symbols: List[str], order_manager: OrderManager, portfolio_manager: Any = None):
        """
        Initializes the strategy. This method is called by the StrategyRunner
        when it loads the strategy.

        Args:
            name (str): The unique name of the strategy.
            symbols (List[str]): A list of instrument symbols the strategy
                                 needs data for.
            order_manager (OrderManager): The manager for sending trade orders.
            portfolio_manager (PortfolioManager): The manager for dynamic sizing.
        """
        self.name = name.strip()
        self.symbols = list(dict.fromkeys(symbols))
        self.order_manager = order_manager
        self.portfolio_manager = portfolio_manager
        self._is_active = False
        self._stop_event = asyncio.Event()

        # Phase 29: AI Decision Layer
        self.decision_agent = DecisionAgent(
            mode=os.getenv("AI_DECISION_MODE", "ai"),
            model=os.getenv("AI_MODEL", os.getenv("OLLAMA_MODEL", "qwen3.5:4b")),
            provider=os.getenv("AI_PROVIDER", "ollama"),
            agent_enabled=True
        )
        self.price_history: Dict[str, List[float]] = {}
        self.regime_status = "NEUTRAL"
        self.market_anchor = "NIFTY"
        logger.info(f"Strategy '{self.name}' initialized for symbols: {self.symbols}")

    @property
    def is_active(self) -> bool:
        return self._is_active

    @is_active.setter
    def is_active(self, value: bool):
        self._is_active = value

    @abstractmethod
    async def on_tick(self, tick: Tick):
        """
        *** YOUR TRADING LOGIC GOES HERE ***

        This is the core method of your strategy. It's called by the
        StrategyRunner for every new price tick for the symbols you've
        subscribed to.

        Args:
            tick (Tick): A data object containing the latest price tick
                         information (e.g., symbol, price, timestamp).
        """
        pass

    async def on_start(self):
        """
        Called by the StrategyRunner when the trading session starts.
        You can use this for any setup tasks, like fetching historical data
        or initializing indicators.
        """
        self.is_active = True
        logger.info(f"Strategy '{self.name}' is starting.")

    async def on_stop(self):
        """
        Called by the StrategyRunner when the trading session ends.
        Use this for any cleanup tasks, like saving state or closing all
        open positions.
        """
        self.is_active = False
        logger.info(f"Strategy '{self.name}' is stopping.")
        pass

    # --- ORDER EXECUTION WRAPPERS ---
    # These methods are helpers to make placing orders from your strategy
    # simple and clean.

    async def analyze_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str = "") -> tuple:
        """
        Synthesize a signal using the AI Decision Agent.
        Returns (reasoning, conviction).
        """
        picks = [{
            "symbol": symbol,
            "price": price,
            "rsi": rsi,
            "score": score,
            "market_context": market_context
        }]
        results = await self.decision_agent.analyze_top_picks(picks)
        if results:
            res = results[0]
            reasoning = res.get("ai_reasoning")
            conviction = res.get("ai_conviction", 0.5)
            
            # Phase 9: Sync back to TradeLogger if it was a retrospective analysis
            return reasoning, conviction
        return "No synthesis available", 0.5

    async def async_analyze_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str = ""):
        """
        Non-blocking AI analysis. Fires the request in the background and 
        updates the trade log later.
        """
        asyncio.create_task(self._process_async_signal(symbol, price, rsi, score, market_context))

    async def _process_async_signal(self, symbol: str, price: float, rsi: float, score: float, market_context: str):
        reasoning, conviction = await self.analyze_signal(symbol, price, rsi, score, market_context)
        # In a real production scenario, we'd update the database record for the latest trade.
        logger.info(f"[{self.name}] Async Synthesis Complete for {symbol}: Conviction {conviction}")

    async def buy(
        self,
        symbol: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        human_approval: bool = False,
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
    ):
        """
        Places a BUY order.
        """
        if not self.is_active:
            logger.warning(f"[{self.name}] Ignoring BUY signal; strategy is stopping.")
            return

        if price == 0.0 and symbol in self.price_history and self.price_history[symbol]:
            price = self.price_history[symbol][-1]

        logger.info(f"[{self.name}] >> sending buy order for {quantity} {symbol} at estimated ₹{price:.2f}.")
        return await self.order_manager.place_order(
            strategy_name=self.name,
            symbol=symbol,
            action="BUY",
            quantity=quantity,
            order_type=order_type,
            price=price,
            product=product,
            exchange=exchange,
            human_approval=human_approval,
            ai_reasoning=ai_reasoning,
            conviction=conviction,
        )

    async def sell(
        self,
        symbol: str,
        quantity: int,
        order_type: str = "MARKET",
        price: float = 0.0,
        product: str = "MIS",
        exchange: str = "NSE",
        human_approval: bool = False,
        ai_reasoning: Optional[str] = None,
        conviction: Optional[float] = None,
    ):
        """
        Places a SELL order.
        """
        if not self.is_active:
            logger.warning(f"[{self.name}] Ignoring SELL signal; strategy is stopping.")
            return

        if price == 0.0 and symbol in self.price_history and self.price_history[symbol]:
            price = self.price_history[symbol][-1]

        logger.info(f"[{self.name}] >> sending sell order for {quantity} {symbol} at estimated ₹{price:.2f}.")
        return await self.order_manager.place_order(
            strategy_name=self.name,
            symbol=symbol,
            action="SELL",
            quantity=quantity,
            order_type=order_type,
            price=price,
            product=product,
            exchange=exchange,
            human_approval=human_approval,
            ai_reasoning=ai_reasoning,
            conviction=conviction,
        )
    def _calculate_indicators(self, symbol: str, rsi_window: int = 14, vol_window: int = 20) -> Dict[str, float]:
        """Vectorized indicator computation using NumPy."""
        prices = self.price_history.get(symbol, [])
        if len(prices) < max(rsi_window, vol_window) + 1:
            return {"rsi": 50.0, "volatility": 1.0}

        # Use NumPy for O(1) vectorized calculation
        p_arr = np.array(prices)
        
        # Vectorized RSI
        deltas = np.diff(p_arr)
        recent_deltas = deltas[-(rsi_window):]
        gains = np.where(recent_deltas > 0, recent_deltas, 0)
        losses = np.where(recent_deltas < 0, -recent_deltas, 0)
        
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        
        if avg_loss == 0:
            rsi_val = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi_val = 100.0 - (100.0 / (1.0 + rs))

        # Vectorized Volatility (Standard Deviation)
        vol_val = np.std(p_arr[-vol_window:]) or 1.0

        return {"rsi": float(rsi_val), "volatility": float(vol_val)}

    def _calculate_market_regime(self) -> str:
        """Standardized global trend safeguard."""
        prices = self.price_history.get(self.market_anchor, [])
        if len(prices) < 20: return "NEUTRAL"
        current = prices[-1]
        ema = sum(prices[-20:]) / 20
        if current > ema * 1.001: return "BULLISH"
        elif current < ema * 0.999: return "BEARISH"
        return "NEUTRAL"

    def update_history(self, tick: Tick, max_len: int = 200):
        """Standardized history management."""
        if tick.symbol not in self.price_history:
            self.price_history[tick.symbol] = []
        self.price_history[tick.symbol].append(tick.price)
        if len(self.price_history[tick.symbol]) > max_len:
            self.price_history[tick.symbol].pop(0)
