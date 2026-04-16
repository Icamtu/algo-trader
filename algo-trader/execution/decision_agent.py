import logging
import asyncio
import httpx
import json
import os
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class DecisionAgent:
    """
    Hybrid Intelligence Agent for AetherDesk Prime.
    Supports three modes:
      - 'ai': Neural-symbolic reasoning using LLMs (Ollama or OpenClaw)
      - 'program': Deterministic Rule-Based Expert System (Expert Fallback)
      - 'human': Advisory mode for manual review
    """

    OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://local_ollama:11434")
    # OPENCLAW_URL = "http://openclaw:18789/v1/chat/completions" # Docker internal
    OPENCLAW_URL = os.getenv("OPENCLAW_URL", "http://openclaw:18789/v1/chat/completions")
    OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN")

    # Circuit Breaker & Caching State
    CONSECUTIVE_FAILURES = 0
    FAILURE_THRESHOLD = 3
    LAST_ERROR = ""
    SIGNAL_CACHE = {} # Cache keyed by (symbol, price_bin)

    def __init__(self, mode: str = "ai", model: str = None, provider: str = "ollama", agent_enabled: bool = True):
        self.mode = mode
        self.model = model or os.getenv("OLLAMA_MODEL", "glm-5.1:cloud")
        self.provider = provider or os.getenv("LLM_PROVIDER", "ollama")
        self.agent_enabled = agent_enabled

    async def analyze_top_picks(self, picks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run deep analysis on the scanner results with caching."""
        if self.mode == "human":
            return self._apply_human_layer(picks)

        results = []
        for pick in picks:
            symbol = pick.get("symbol")
            price = pick.get("price", 0)
            price_bin = round(price, -1) # Bin by ₹10
            cache_key = (symbol, price_bin)

            # Check Cache
            if cache_key in DecisionAgent.SIGNAL_CACHE:
                logger.info(f"Cache Hit for {symbol} at {price_bin}")
                cached_res = DecisionAgent.SIGNAL_CACHE[cache_key]
                results.append({**pick, **cached_res, "is_cached": True})
                continue

            if self.mode == "program":
                reasoning, conviction = self._get_programmatic_reasoning(pick)
            else:
                # Mode is 'ai'
                if self.provider == "openclaw" and self.agent_enabled:
                    reasoning, conviction = await self._get_openclaw_reasoning(pick)
                else:
                    reasoning, conviction = await self._get_llm_reasoning(pick)

            res_payload = {
                "ai_conviction": conviction,
                "ai_reasoning": reasoning,
                "decision_mode": self.mode,
                "provider": self.provider
            }

            # Update Cache
            DecisionAgent.SIGNAL_CACHE[cache_key] = res_payload

            results.append({**pick, **res_payload})

        return results

    def _apply_human_layer(self, picks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [{**p, "ai_reasoning": "Awaiting human desk approval.", "ai_conviction": 0.5} for p in picks]

    def _get_programmatic_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Deterministic Expert System logic."""
        rsi = pick.get("rsi", 50)
        score = pick.get("score", 50)

        if rsi < 30 and score > 70:
            return "Extreme oversold confluence with technical strength. High probability reversal.", 0.85
        if rsi > 70 and score < 30:
            return "Extreme overbought exhaustion. Heavy distribution detected.", 0.20
        if score > 80:
            return "Strong technical momentum profile with trend alignment.", 0.75

        return "Deterministic trend-following protocol active. Neutral bias.", 0.50

    async def _get_llm_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Single-turn neural reasoning via Local Ollama."""
        market_context = pick.get("market_context", "No additional context.")
        prompt = (
            f"As a Quant Analyst, analyze {pick['symbol']} at ₹{pick['price']}. "
            f"Technical Identifiers: RSI is {pick['rsi']}, Score is {pick['score']}. "
            f"Market Structure Context: {market_context}. "
            f"Analyze if the current positioning supports a trade. "
            f"Provide a 1-sentence reasoning and a conviction score (0.0 to 1.0). "
            f"Format response as JSON: {{\"reasoning\": \"...\", \"conviction\": 0.XX}}"
        )

        logger.info(f"Ollama Request: Model={self.model}, Provider={self.provider}")
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Use /api/chat for better compatibility
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
                    result_content = data["message"]["content"]
                    # Robust JSON extraction
                    try:
                        start = result_content.find("{")
                        end = result_content.rfind("}")
                        if start != -1 and end != -1:
                            json_str = result_content[start:end+1]
                        else:
                            json_str = result_content

                        parsed = json.loads(json_str)
                        return parsed.get("reasoning", "Analysis complete."), float(parsed.get("conviction", 0.5))
                    except (json.JSONDecodeError, ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse Ollama JSON: {e}. Raw: {result_content}")
                else:
                    logger.error(f"Ollama API Error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.warning(f"Ollama inference failed, falling back to Expert System: {repr(e)}")

        return self._get_programmatic_reasoning(pick)

    async def _get_openclaw_reasoning(self, pick: Dict[str, Any]) -> tuple:
        """Agentic reasoning via OpenClaw Gateway."""
        # Use internal container name or localhost mapping
        url = "http://openclaw:18789/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.OPENCLAW_TOKEN}",
            "Content-Type": "application/json"
        }

        # Note: OpenClaw often expects Claude/OpenAI style messages
        market_context = pick.get("market_context", "No additional context.")
        prompt = (
            f"Autonomous Agent Task: Conduct a strategic scan of {pick['symbol']}."
            f"LTP: {pick['price']}, RSI: {pick['rsi']}, Score: {pick['score']}."
            f"Market Structure: {market_context}."
            f"Analyze for high-conviction institutional setup. Respond ONLY with a JSON object: "
            f"{{\"reasoning\": \"Your deep agentic reasoning here\", \"conviction\": 0.XX}}"
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client: # Higher timeout for agents
                response = await client.post(
                    url,
                    headers=headers,
                    json={
                        "model": os.getenv("OPENCLAW_MODEL", "minimax-m2.7:cloud"), # Env-driven, matches available model
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2
                    }
                )
                if response.status_code == 200:
                    DecisionAgent.CONSECUTIVE_FAILURES = 0
                    DecisionAgent.LAST_ERROR = ""
                    data = response.json()
                    result_content = data["choices"][0]["message"]["content"]

                    try:
                        # Find the first { and last } to extract JSON
                        start = result_content.find("{")
                        end = result_content.rfind("}")
                        if start != -1 and end != -1:
                            result_content = result_content[start:end+1]

                        parsed = json.loads(result_content)
                        return parsed.get("reasoning", "Agent analysis complete."), parsed.get("conviction", 0.5)
                    except (json.JSONDecodeError, ValueError) as e:
                        logger.warning(f"Failed to parse OpenClaw JSON: {e}. Raw: {result_content}")
                else:
                    DecisionAgent.CONSECUTIVE_FAILURES += 1
                    DecisionAgent.LAST_ERROR = f"OpenClaw Status {response.status_code}"
                    logger.error(f"OpenClaw API Error: {response.status_code} - {response.text}")
        except Exception as e:
            DecisionAgent.CONSECUTIVE_FAILURES += 1
            DecisionAgent.LAST_ERROR = str(e)
            logger.warning(f"OpenClaw agentic reasoning failed: {e}")

        # Fallback to local neural or expert
        return await self._get_llm_reasoning(pick)
