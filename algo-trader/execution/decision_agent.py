import logging
import asyncio
import httpx
import json
import os
from typing import List, Dict, Any
from utils.narrative import generate_sector_narrative
from data.timescale_logger import ts_logger
from utils.charges import ZerodhaCalculator

logger = logging.getLogger(__name__)

class DecisionAgent:
    """
    Hybrid Intelligence Agent for AetherDesk Prime.
    Supports three modes:
      - 'ai': Neural-symbolic reasoning using LLMs (Ollama or OpenClaw)
      - 'program': Deterministic Rule-Based Expert System (Expert Fallback)
      - 'human': Advisory mode for manual review
    """

    # Dynamic Networking (Handshake with Docker vs Host)
    def _get_env_url(key: str, default: str) -> str:
        url = os.getenv(key, default)
        # If we are NOT in a container, and the url contains docker service names, fallback to localhost
        if not os.path.exists("/.dockerenv"):
            if "ollama_engine" in url or "local_ollama" in url:
                return url.replace("ollama_engine", "localhost").replace("local_ollama", "localhost")
        return url

    OLLAMA_URL = _get_env_url("OLLAMA_BASE_URL", "http://ollama_engine:11434")
    OPENCLAW_URL = _get_env_url("OPENCLAW_URL", "http://local_ollama:11434/v1/chat/completions")
    OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "ollama")

    # Circuit Breaker & Caching State
    CONSECUTIVE_FAILURES = 0
    FAILURE_THRESHOLD = 3
    LAST_ERROR = ""
    CIRCUIT_OPEN_UNTIL = 0

    SIGNAL_CACHE = {}   # Keyed by (symbol, price_bin)
    REGIME_CACHE = {}   # Keyed by symbol
    SENTIMENT_CACHE = {} # Keyed by sector_name

    _llm_semaphore = asyncio.Semaphore(3) # Limit parallel LLM calls to 3

    def __init__(self, mode: str = "ai", model: str = None, provider: str = "ollama", agent_enabled: bool = True):
        self.mode = mode
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3.5-claude:latest")
        self.provider = provider or os.getenv("LLM_PROVIDER", "ollama")
        self.agent_enabled = agent_enabled

        # Institutional Latency Governance
        self.timeout = float(os.getenv("AI_TIMEOUT", 25.0))

    async def analyze_top_picks(self, picks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run deep analysis on the scanner results with caching and parallel neural processing."""
        if self.mode == "human" or not self.agent_enabled:
            return self._apply_human_layer(picks)

        # Phase 12.1: Parallelize Analysis using gather
        tasks = [self._analyze_single_pick(pick) for pick in picks]
        return await asyncio.gather(*tasks)

    async def _analyze_single_pick(self, pick: Dict[str, Any]) -> Dict[str, Any]:
        """Core atomic analysis for a single pick with caching and governance."""
        symbol = pick.get("symbol")
        price = pick.get("price", 0)
        price_bin = round(price, -1)
        cache_key = (symbol, price_bin)

        # 1. Caching Layer
        if cache_key in DecisionAgent.SIGNAL_CACHE:
            logger.debug(f"Cache Hit for {symbol} at {price_bin}")
            cached_res = DecisionAgent.SIGNAL_CACHE[cache_key]
            return {**pick, **cached_res, "is_cached": True}

        # 2. Check Circuit Breaker
        import time
        if time.time() < DecisionAgent.CIRCUIT_OPEN_UNTIL:
            logger.warning(f"AI Circuit Open. Using Expert System for {symbol}.")
            reasoning, conviction = self._get_programmatic_reasoning(pick)
            res_payload = self._build_payload(reasoning, conviction, pick, "circuit_fallback")
            return {**pick, **res_payload}

        # 3. Get Technical "Plain Logic" Baseline
        plain_reasoning, plain_conviction = self._get_programmatic_reasoning(pick)

        if self.mode == "program":
            reasoning, conviction = plain_reasoning, plain_conviction
        else:
            # 4. Get AI Consensus (OpenClaw + Ollama)
            reasoning, conviction = await self._get_consensus_decision(pick)

        # 5. Apply Governance (Net Profitability & Safety)
        governed_conviction = self._apply_governance(conviction, pick)
        if governed_conviction < conviction:
            reasoning = f"[GOVERNED] {reasoning} | Note: Low expectancy/safety drag detected."
            conviction = governed_conviction

        res_payload = self._build_payload(reasoning, conviction, pick, "consensus" if self.mode == "ai" else "expert_system")
        res_payload["plain_conviction"] = plain_conviction

        DecisionAgent.SIGNAL_CACHE[cache_key] = res_payload

        # Institutional Logging (Background)
        asyncio.create_task(self._log_signal_to_timescale(symbol, price, conviction, reasoning, pick, res_payload))

        return {**pick, **res_payload}

    def _build_payload(self, reasoning: str, conviction: float, pick: Dict[str, Any], provider: str) -> Dict[str, Any]:
        return {
            "ai_conviction": conviction,
            "ai_reasoning": reasoning,
            "decision_mode": self.mode,
            "provider": provider
        }

    async def _log_signal_to_timescale(self, symbol, price, conviction, reasoning, pick, res_payload):
        try:
            await ts_logger.log_signal(
                strategy_id=res_payload.get("provider", "expert_system"),
                symbol=symbol,
                signal_type="BUY" if conviction > 0.65 else "SELL" if conviction < 0.35 else "NEUTRAL",
                price=price,
                indicators=pick,
                ai_reasoning=reasoning,
                conviction=conviction
            )
        except Exception as e:
            logger.debug(f"Signal logging failed: {e}")

    def _apply_profitability_check(self, pick: Dict[str, Any], conviction: float) -> float:
        """
        Calculates if the projected move is enough to cover charges + slippage.
        Rejects (downwards) if the net expectancy is negative.
        """
        price = pick.get("price", 0)
        symbol = pick.get("symbol", "")

        # Assume a standard scalp/intraday target of 0.5% if not specified
        target_pct = pick.get("target_pct", 0.005)
        projected_exit = price * (1 + target_pct if conviction > 0.5 else 1 - target_pct)

        asset_type = ZerodhaCalculator.infer_asset_type(symbol)
        charges = ZerodhaCalculator.calculate_charges(
            buy_price=min(price, projected_exit),
            sell_price=max(price, projected_exit),
            quantity=pick.get("quantity", 1),
            asset_type=asset_type
        )

        total_cost_pts = charges["break_even"]
        slippage_pts = price * 0.0005 # 0.05% slippage estimate
        total_drag = total_cost_pts + slippage_pts

        projected_move = abs(projected_exit - price)

        if projected_move < total_drag * 1.5:
            logger.warning(f"Negative Expectancy for {symbol}: Move({projected_move:.2f}) < Drag({total_drag:.2f} * 1.5)")
            return conviction * 0.5 # Severe penalty for high-drag trades

        return conviction

    def _apply_governance(self, conviction: float, pick: Dict[str, Any]) -> float:
        """Enforces 'Logic Safeguards' over AI conviction."""
        rsi = pick.get("rsi", 50)

        # 1. Technical Circuit Breakers
        if rsi > 78 and conviction > 0.7:
             logger.warning(f"AI overly bullish on Overbought RSI ({rsi}). Governing conviction downward.")
             conviction = 0.6

        if rsi < 22 and conviction > 0.7:
             logger.warning(f"AI overly bullish on Oversold RSI ({rsi}). Governing conviction for extra caution.")
             conviction = 0.65

        # 2. Profitability Governance
        conviction = self._apply_profitability_check(pick, conviction)

        return conviction

    async def _get_consensus_decision(self, pick: Dict[str, Any]) -> tuple:
        """
        Hierarchy of Truth:
        - OpenClaw (Primary Strategic Scan)
        - Ollama (Local Tactical Validator)
        - Fallback: Expert System
        """
        # Level 1: OpenClaw
        oc_reason, oc_conv = await self._get_openclaw_reasoning(pick)

        # If OpenClaw provides a valid signal, we validate with Ollama
        if oc_conv > 0.4:
            ol_reason, ol_conv = await self._get_llm_reasoning(pick)

            # Weighted average for conviction, combined reasoning
            final_conv = (oc_conv * 0.7) + (ol_conv * 0.3)
            final_reason = f"{oc_reason} (Validated by Local Tactical: {ol_reason})"
            return final_reason, final_conv

        return oc_reason, oc_conv

    def _apply_human_layer(self, picks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [{**p, "ai_reasoning": "Awaiting human desk approval.", "ai_conviction": 0.5} for p in picks]

    def _get_programmatic_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Deterministic Expert System logic [Plain Logic]."""
        rsi = pick.get("rsi", 50)
        score = pick.get("score", 50)

        if rsi < 30 and score > 75:
            return "Technical Confluence: Oversold trend exhaustion with internal score support.", 0.80
        if rsi > 70 and score < 25:
            return "Technical Confluence: Overbought expansion exhaustion. Potential distribution.", 0.20
        if score > 85:
            return "Technical Confluence: High-velocity trend-following profile.", 0.70

        return "Standard Technical Protocol: Neutral market structure detected.", 0.50

    async def _get_llm_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Single-turn neural reasoning via Local Ollama."""
        market_context = pick.get("market_context", "No additional context.")
        prompt = (
            f"As a Quant Analyst, analyze {pick['symbol']} at ₹{pick['price']}. "
            f"Technical Identifiers: RSI is {pick['rsi']}, Score is {pick['score']}. "
            f"Market Structure Context: {market_context}. "
            f"Format response as JSON: {{\"reasoning\": \"1 sentence reasoning\", \"conviction\": 0.XX}}"
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.OLLAMA_URL}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False,
                        "format": "json"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("message", {}).get("content", "")
                    parsed = self._extract_json(content)
                    return parsed.get("reasoning", "Analysis complete."), float(parsed.get("conviction", 0.5))
        except Exception as e:
            logger.warning(f"Ollama tactical scan failed: {e}")

        return "Ollama Offline. Using local baseline.", 0.5

    async def get_market_regime(self, symbol: str, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Macro market regime scan with high-performance caching (300s TTL)."""
        if not self.agent_enabled:
            return {"regime": "NEUTRAL", "pos_mult": 1.0, "risk_mult": 1.0, "reasoning": "Agent disabled."}

        # 1. Cache Layer (Regime doesn't change every tick)
        import time
        now = time.time()
        cache_data = DecisionAgent.REGIME_CACHE.get(symbol)
        if cache_data and (now - cache_data["ts"] < 300):
            return cache_data["data"]

        # 2. Expert Fallback if Circuit is Open
        if now < DecisionAgent.CIRCUIT_OPEN_UNTIL:
            res = self._get_programmatic_regime(symbol, candles)
            return {**res, "reasoning": f"[CIRCUIT_OPEN] {res['reasoning']}"}

        history_str = "\n".join([f"C:{sub['close']}" for sub in candles[-15:]])
        prompt = (
            f"Institutional Macro Scan for {symbol}:\n{history_str}\n"
            f"Categorize: [BULLISH, BEARISH, VOLATILE, RANGE].\n"
            f"JSON ONLY: {{\"categorization\": \"...\", \"reasoning\": \"...\", \"position_multiplier\": 1.0, \"risk_multiplier\": 1.0}}"
        )

        try:
            if self.provider == "openclaw":
                result = await self._call_openclaw(prompt)
            else:
                result = await self._call_ollama(prompt)

            if result:
                processed = {
                    "regime": result.get("categorization", "NEUTRAL").upper(),
                    "reasoning": result.get("reasoning", "Analysis complete."),
                    "pos_mult": float(result.get("position_multiplier", 1.0)),
                    "risk_mult": float(result.get("risk_multiplier", 1.0))
                }
                DecisionAgent.REGIME_CACHE[symbol] = {"ts": now, "data": processed}
                DecisionAgent.CONSECUTIVE_FAILURES = 0 # Reset on success
                return processed

        except Exception as e:
            self._handle_failure(f"Regime scan failed for {symbol}: {e}")

        return self._get_programmatic_regime(symbol, candles)

    def _get_programmatic_regime(self, symbol: str, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Deterministic fallback for market regime."""
        if not candles or len(candles) < 20:
             return {"regime": "NEUTRAL", "pos_mult": 1.0, "risk_mult": 1.0, "reasoning": "Insufficent history."}

        closes = [c['close'] for c in candles]
        last_close = closes[-1]
        sma = sum(closes[-20:]) / 20

        regime = "BULLISH" if last_close > sma else "BEARISH"
        return {
            "regime": regime,
            "pos_mult": 1.0 if regime == "BULLISH" else 0.8,
            "risk_mult": 1.0 if regime == "BULLISH" else 0.8,
            "reasoning": "Technical Baseline (SMA-20 Breakdown)"
        }

    def _handle_failure(self, error_msg: str):
        """Manages the circuit breaker state."""
        DecisionAgent.CONSECUTIVE_FAILURES += 1
        DecisionAgent.LAST_ERROR = error_msg
        logger.warning(f"AI Failure {DecisionAgent.CONSECUTIVE_FAILURES}/{DecisionAgent.FAILURE_THRESHOLD}: {error_msg}")

        if DecisionAgent.CONSECUTIVE_FAILURES >= DecisionAgent.FAILURE_THRESHOLD:
            import time
            DecisionAgent.CIRCUIT_OPEN_UNTIL = time.time() + 300 # Open for 5 minutes
            logger.error("AI CIRCUIT BREAKER TRIPPED. Disabling neural reasoning for 5 minutes.")

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Robustlly extract JSON object from text potentially containing garbage."""
        if not text:
            return {}

        # Clean markdown code blocks if present
        if "```json" in text:
            text = text.split("```json")[-1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[-1].split("```")[0]

        try:
            # Attempt 1: Standard extraction between first { and last }
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1:
                json_str = text[start:end+1]
                # Filter out control characters that break json.loads
                json_str = "".join(char for char in json_str if char.isprintable() or char in "\n\r\t")
                return json.loads(json_str)
        except Exception as e:
            logger.debug(f"Level 1 JSON extraction failed: {e}. Attempting deep clean...")

        try:
            # Attempt 2: More aggressive cleaning for 'expected end of object' errors
            # Often caused by trailing text after a valid JSON object
            import re
            # Find all potential JSON objects
            matches = re.findall(r'\{[^{}]*\}', text)
            for match in reversed(matches): # Try the last one first
                try:
                    return json.loads(match)
                except: continue
        except: pass

        logger.warning(f"All JSON extraction attempts failed. Raw text: {text[:200]}...")
        return {}

    async def _call_ollama(self, prompt: str) -> Dict[str, Any]:
        async with DecisionAgent._llm_semaphore:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.OLLAMA_URL}/api/chat",
                        json={"model": self.model, "messages": [{"role": "user", "content": prompt}], "stream": False, "format": "json"}
                    )
                    if response.status_code == 200:
                        content = response.json()["message"]["content"]
                        return self._extract_json(content)
            except Exception as e:
                logger.warning(f"Ollama call failed: {e}")
            return {}

    async def _call_openclaw(self, prompt: str) -> Dict[str, Any]:
        async with DecisionAgent._llm_semaphore:
            headers = {"Authorization": f"Bearer {self.OPENCLAW_TOKEN}", "Content-Type": "application/json"}
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        self.OPENCLAW_URL,
                        headers=headers,
                        json={
                            "model": os.getenv("OPENCLAW_MODEL", "qwen3.5-claude:latest"),
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.1
                        }
                    )
                    if response.status_code == 200:
                        content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                        return self._extract_json(content)
                    else:
                        logger.error(f"OpenClaw non-200 response: {response.status_code}")
            except Exception as e:
                logger.warning(f"OpenClaw call failed: {e}")
            return {}

    async def _get_openclaw_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Agentic reasoning via OpenClaw Gateway (18789)."""
        headers = {"Authorization": f"Bearer {self.OPENCLAW_TOKEN}", "Content-Type": "application/json"}
        prompt = (
            f"Strategic scan: {pick['symbol']} LTP:{pick['price']} RSI:{pick['rsi']} SCORE:{pick['score']}."
            f"Analyze for institutional setup. JSON ONLY: {{\"reasoning\": \"str\", \"conviction\": 0.XX}}"
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    self.OPENCLAW_URL,
                    headers=headers,
                    json={
                        "model": os.getenv("OPENCLAW_MODEL", "qwen3.5-claude:latest"),
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    parsed = self._extract_json(content)
                    if parsed:
                        return parsed.get("reasoning", "Strategic scan complete."), float(parsed.get("conviction", 0.5))
        except Exception as e:
            logger.warning(f"OpenClaw scan failed: {e}")

        # Fallback to local neural reasoning
        return await self._get_llm_reasoning(pick)

    async def analyze_sector_sentiment(self, sector_name: str, index_symbol: str, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Macro sector sentiment with multi-tier caching and parallel safety."""
        if not self.agent_enabled:
             return self._get_programmatic_sentiment(index_symbol, candles)

        # 1. Caching Layer
        import time
        now = time.time()
        cache_data = DecisionAgent.SENTIMENT_CACHE.get(sector_name)
        if cache_data and (now - cache_data["ts"] < 600): # 10m TTL
            return cache_data["data"]

        # 2. expert Fallback if Circuit is Open
        if now < DecisionAgent.CIRCUIT_OPEN_UNTIL:
            return self._get_programmatic_sentiment(index_symbol, candles)

        # 3. Generate Narrative Context
        narrative_txt = generate_sector_narrative(index_symbol, candles)
        prompt = (
            f"Sector Insight: {sector_name} ({index_symbol})\n"
            f"Narrative: {narrative_txt}\n"
            f"Task: Determine the institutional sentiment bias and conviction (0.0 to 1.0).\n"
            f"Return JSON ONLY: {{\"sentiment\": \"BULLISH|BEARISH|NEUTRAL\", \"reasoning\": \"...\", \"conviction\": 0.XX}}"
        )

        # 4. Level 1: OpenClaw (Strategic Gateway)
        if self.provider == "openclaw" or os.getenv("FORCE_AI_GATEWAY") == "true":
            res = await self._call_openclaw(prompt)
            if self._is_reliable(res):
                processed = {**res, "source": "openclaw", "status": "AI_STRATEGIC"}
                DecisionAgent.SENTIMENT_CACHE[sector_name] = {"ts": now, "data": processed}
                return processed

        # 5. Level 2: Ollama (Local Tactical)
        res = await self._call_ollama(prompt)
        if self._is_reliable(res):
            processed = {**res, "source": "ollama", "status": "AI_LOCAL"}
            DecisionAgent.SENTIMENT_CACHE[sector_name] = {"ts": now, "data": processed}
            return processed

        # 6. Level 3: Technical Expert System (Deterministic Fallback)
        tech_res = self._get_programmatic_sentiment(index_symbol, candles)
        return {**tech_res, "source": "expert_system", "status": "TECH_FALLBACK"}

    def _is_reliable(self, res: Dict[str, Any]) -> bool:
        """Dual-trigger reliability check: Hard (empty) + Soft (low conviction/neutral)."""
        if not res or "sentiment" not in res:
            return False

        conviction = float(res.get("conviction", 0.0))
        sentiment = res.get("sentiment", "NEUTRAL").upper()

        # Soft-trigger: Ambiguity is equivalent to no response
        if conviction <= 0.3 or sentiment == "NEUTRAL":
            logger.info(f"AI response deemed unreliable (Conviction: {conviction}). Falling back...")
            return False

        return True

    def _get_programmatic_sentiment(self, symbol: str, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Rule-based fallback using RSI and SMA divergence."""
        if not candles or len(candles) < 10:
            return {"sentiment": "NEUTRAL", "reasoning": "Insufficent technical data.", "conviction": 0.5}

        prices = [c['close'] for c in candles]
        last_price = prices[-1]
        sma = sum(prices[-10:]) / 10

        if last_price > sma * 1.005:
            sentiment = "BULLISH"
            reasoning = "Technical breakout above 10-period standard baseline."
        elif last_price < sma * 0.995:
            sentiment = "BEARISH"
            reasoning = "Technical breakdown below 10-period support zone."
        else:
            sentiment = "NEUTRAL"
            reasoning = "Trading within baseline standard deviation."

        return {
            "sentiment": sentiment,
            "reasoning": reasoning,
            "conviction": 0.6 # Fixed confidence for technical expert systems
        }
