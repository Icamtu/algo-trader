import logging
import asyncio
import pandas as pd
from typing import List, Dict, Any
from openalgo import ta

logger = logging.getLogger(__name__)

# Predefined symbol lists for Indian markets
INDICES = {
    "NIFTY_50": [
        "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "SBIN", "LICI", "HINDUNILVR",
        "LT", "BAJFINANCE", "KOTAKBANK", "ADANIENT", "AXISBANK", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NTPC",
        "TATASTEEL", "ADANIPORTS", "M&M", "HCLTECH", "ONGC", "ASIANPAINT", "POWERGRID", "JSWSTEEL", "COALINDIA", "TATARELI",
        "BAJAJFINSV", "NESTLEIND", "GRASIM", "TECHM", "EICHERMOT", "INDUSINDBK", "HINDALCO", "LTIM", "BRITANNIA", "TATAMOTORS",
        "ADANIPOWER", "CIPLA", "SBILIFE", "BPCL", "DRREDDY", "WIPRO", "HDFCLIFE", "APOLLOHOSP", "HEROMOTOCO", "BAJAJ-AUTO"
    ],
    "NIFTY_BANK": ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "AUsmall", "BANDHANBNK", "FEDERALBNK", "IDFCFIRSTB", "PNB"],
    "NIFTY_AUTO": ["TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR", "ASHOKLEY", "BALKRISIND", "BHARATFORG", "MRF"],
    "NIFTY_PHARMA": ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "ZydusLife", "TORNTPHARM", "LUPIN", "AUROPHARMA", "IPCALAB", "BIOCON"],
}

class ScannerEngine:
    """
    Core engine for market scanning and technical analysis.
    Processes batches of symbols to find high-conviction setups.
    """
    
    def __init__(self, order_manager=None):
        self.order_manager = order_manager

    async def _fetch_history_with_retry(self, symbol: str, exchange: str, interval: str = "1D", retries: int = 2) -> List[Dict]:
        """Fetch history with basic retry logic for reliability."""
        for attempt in range(retries + 1):
            try:
                # Use order_manager's get_history which should support interval
                history = await self.order_manager.get_history(symbol, exchange, interval=interval)
                if history and len(history) >= 20: # Minimum requirement for most indicators
                    return history
                logger.warning(f"Scanner: Insufficient data for {symbol} on attempt {attempt+1} (interval={interval})")
            except Exception as e:
                logger.warning(f"Scanner: Attempt {attempt+1} failed for {symbol}: {e}")
            
            if attempt < retries:
                await asyncio.sleep(0.5) # Small backoff
        return []

    def _evaluate_condition(self, df: pd.DataFrame, cond: Dict[str, Any]) -> bool:
        """Evaluate a single technical condition against the dataframe."""
        try:
            indicator = cond.get("indicator", "").lower()
            op = cond.get("operator", ">")
            val = cond.get("value", 0)
            target = None
            
            close = df["close"].values
            
            if indicator == "rsi":
                period = cond.get("params", {}).get("period", 14)
                target = ta.rsi(close, period)[-1]
            elif indicator == "ema":
                period = cond.get("params", {}).get("period", 20)
                target = ta.ema(close, period)[-1]
            elif indicator == "price_above_ema":
                period = cond.get("params", {}).get("period", 20)
                target = close[-1]
                val = ta.ema(close, period)[-1]
            elif indicator == "ema_cross":
                short = cond.get("params", {}).get("short", 20)
                long = cond.get("params", {}).get("long", 50)
                s_ema = ta.ema(close, short)[-1]
                l_ema = ta.ema(close, long)[-1]
                target = s_ema
                val = l_ema
            
            if target is None:
                return False
                
            if op == ">": return target > val
            if op == ">=": return target >= val
            if op == "<": return target < val
            if op == "<=": return target <= val
            if op == "==": return abs(target - val) < 0.0001
            if op == "above": return target > val
            if op == "below": return target < val
            
            return False
        except Exception as e:
            logger.debug(f"Scanner: Condition eval error: {e}")
            return False

    def _evaluate_logic(self, df: pd.DataFrame, logic: Dict[str, Any]) -> bool:
        """
        Recursively evaluate logical conditions.
        Supports both simple conditions and complex AND/OR groups.
        """
        if "group" in logic:
            group_type = logic["group"].upper()
            sub_conditions = logic.get("conditions", [])
            
            if not sub_conditions:
                return True if group_type == "AND" else False
                
            if group_type == "AND":
                return all(self._evaluate_logic(df, c) for c in sub_conditions)
            elif group_type == "OR":
                return any(self._evaluate_logic(df, c) for c in sub_conditions)
            else:
                logger.warning(f"Scanner: Unknown logic group type: {group_type}")
                return False
        else:
            # Atomic condition
            return self._evaluate_condition(df, logic)

    async def scan_single_symbol(self, symbol: str, exchange: str = "NSE", interval: str = "1D", conditions: List[Dict] = None) -> Dict[str, Any]:
        """Fetch history and compute indicators for one symbol using dynamic conditions."""
        try:
            history = await self._fetch_history_with_retry(symbol, exchange, interval=interval)
            if not history:
                return {"symbol": symbol, "status": "insufficient_data"}
            
            df = pd.DataFrame(history)
            close = df["close"].values
            
            # Default scoring if no conditions provided
            if not conditions:
                conditions = [
                    {"indicator": "rsi", "operator": ">", "value": 60, "weight": 20},
                    {"indicator": "rsi", "operator": "<", "value": 40, "weight": -20},
                    {"indicator": "price_above_ema", "params": {"period": 20}, "operator": "above", "weight": 10},
                    {"indicator": "ema_cross", "params": {"short": 20, "long": 50}, "operator": "above", "weight": 10}
                ]

            score = 50
            matched_count = 0
            for cond in conditions:
                if self._evaluate_logic(df, cond):
                    score += cond.get("weight", 0)
                    matched_count += 1
            
            # Additional diagnostics for UI
            rsi = ta.rsi(close, 14)[-1]
            price = close[-1]
            prev_price = close[-2] if len(close) > 1 else price
            change_pct = ((price - prev_price) / prev_price) * 100

            return {
                "symbol": symbol,
                "price": round(price, 2),
                "change": round(change_pct, 2),
                "rsi": round(rsi, 2),
                "score": min(100, max(0, score)),
                "sentiment": "BULLISH" if score > 65 else "BEARISH" if score < 35 else "NEUTRAL",
                "matched_conditions": matched_count,
                "interval": interval,
                "ai_reasoning": f"Scanner detected {matched_count} matches on {interval} chart. Final confidence: {score}%."
            }
        except Exception as e:
            logger.error(f"Scanner: Error scanning {symbol}: {e}")
            return {"symbol": symbol, "status": "error", "message": str(e)}

    async def run_scan(self, index_name: str = None, symbols: List[str] = None, interval: str = "1D", conditions: List[Dict] = None) -> List[Dict[str, Any]]:
        """Run batch scan for a predefined index OR a custom symbol list."""
        if not symbols:
            symbols = INDICES.get(index_name, [])
            
        if not symbols:
            logger.warning(f"Scanner: No symbols found for scan (index={index_name})")
            return []
            
        logger.info(f"Scanner: Starting batch scan for {len(symbols)} symbols at {interval} interval")
        
        # Max concurrency to prevent API rate limiting
        sem = asyncio.Semaphore(5) 
        
        async def sem_scan(symbol):
            async with sem:
                return await self.scan_single_symbol(symbol, interval=interval, conditions=conditions)
                
        tasks = [sem_scan(s) for s in symbols]
        results = await asyncio.gather(*tasks)
        
        # Filter out errors and sort by score
        successful = [r for r in results if r.get("status") not in {"error", "insufficient_data"}]
        return sorted(successful, key=lambda x: x["score"], reverse=True)

    async def run_index_scan(self, index_name: str) -> List[Dict[str, Any]]:
        """Legacy compatibility method."""
        return await self.run_scan(index_name=index_name)
