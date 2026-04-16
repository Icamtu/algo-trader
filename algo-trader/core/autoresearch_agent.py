import argparse
import ast
import asyncio
import json
import logging
import os
import re
import sys
import importlib.util
import inspect
from urllib import request as urllib_request
from datetime import datetime

# Make sure we can import from core and others
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.backtest_engine import BacktestEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("AutoResearchAgent")

def call_ollama(prompt, model="qwen3.5-claude:latest"):
    """Call the local Ollama LLM to generate code improvements."""
    url = "http://local_ollama:11434/api/generate"
    # Fallback for running outside docker
    if not os.environ.get("DOCKER_ENV"):
        try:
            # check if local_ollama resolves
            import socket
            socket.gethostbyname("local_ollama")
        except:
            url = "http://localhost:11434/api/generate"

    payload = json.dumps({"model": model, "prompt": prompt, "stream": False})
    req = urllib_request.Request(url, data=payload.encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib_request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get("response", "")
    except Exception as e:
        logger.error(f"Failed to call Ollama: {e}")
        return ""

def extract_python_code(response_text):
    """Extract python code from Markdown formatted LLM output."""
    match = re.search(r'```python\s*(.*?)\s*```', response_text, re.DOTALL)
    if match:
        return match.group(1)

    # fallback
    match = re.search(r'```\s*(.*?)\s*```', response_text, re.DOTALL)
    if match:
        return match.group(1)
    return response_text

def get_strategy_class_from_file(file_path):
    """Dynamically load the strategy class from a python file."""
    module_name = os.path.basename(file_path).replace(".py", "")
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    from core.strategy import BaseStrategy

    for name, obj in inspect.getmembers(module, inspect.isclass):
        if obj.__module__ == module_name:
            if issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
                return obj
            elif hasattr(obj, 'on_tick'): # Duck typing fallback
                return obj
    return None

async def run_iteration(file_path, directive, iteration, model):
    logger.info(f"--- AutoResearch Iteration {iteration} ---")
    strategy_cls = get_strategy_class_from_file(file_path)
    if not strategy_cls:
        logger.error(f"Could not find a valid strategy class in {file_path}")
        return None

    engine = BacktestEngine(strategy_class=strategy_cls, symbol="RELIANCE", interval="1m")
    # Tell engine to bypass AI analysis for faster iterative testing
    engine.no_ai = True

    try:
        results = await engine.run(days=7)
    except Exception as e:
        logger.error(f"Backtest engine failed during iteration {iteration}: {e}")
        return None

    perf = results.get("performance", {})
    logger.info(f"Backtest Metrics -> {perf}")

    # Read the current script
    with open(file_path, 'r') as f:
        current_script = f.read()

    prompt = f"""
You are an elite quantitative developer acting as an autonomous AutoResearch agent.
Your objective is to optimize the trading strategy given below to improve its backtest performance metrics.

--- Directive / Constraints ---
{directive}

--- Latest Evaluation Metrics ---
Net PnL: {perf.get("net_pnl", 0)}
Sharpe Ratio: {perf.get("sharpe_ratio", 0)}
Win Rate: {perf.get("win_rate", 0)}%
Max Drawdown: {perf.get("max_drawdown", 0)}%
Total Trades Executed: {results.get("total_trades", 0)}

--- Current Strategy Source Code ---
```python
{current_script}
```

--- Instructions ---
Based on the metrics and the directive, output an IMPROVED version of the above strategy python script.
- Ensure you do not change the class name or core imports.
- Only change thresholds, logical conditions, risk parameters, or add standard technicals supported by `self._calculate_indicators`.
- Example tuning: Adjust RSI extremely bounds, modify ATR stop loss multipliers, or tighten trailing stops.
- IMPORTANT for OpenAlgo: Use `ta` library (import pandas_ta as ta or equivalent, but OpenAlgo `ta` comes built-in). Use `ta.crossover()`, `ta.crossunder()`, `ta.exrem()` for signal cleaning, and `ta.flip()` for regime detection.
- IMPORTANT for Backtesting: Realize your signals will be executed by VectorBT. Consider standard TA-Lib indicators (EMA, SMA, RSI, MACD, BBands, ATR, ADX, STDDEV, MOM) and OpenAlgo specific (Supertrend, Donchian, Ichimoku).
- IMPORTANT for Numba: If using custom Numba logic, use `@njit(cache=True, nogil=True)`. Do NOT use `fastmath=True` as it breaks NaN handling.
- IMPORTANT: You MUST output ONLY the new Python script wrapped in a ```python ... ``` block. No markdown explanations.
"""
    logger.info("Calling LLM Agent to formulate hypothesis and write improved code...")
    response_text = call_ollama(prompt, model=model)
    if not response_text:
        logger.error("LLM returned an empty response.")
        return None

    new_script = extract_python_code(response_text)
    if len(new_script.strip()) < 50:
        logger.error("Extracted script is suspiciously short. LLM might have failed to format the code properly.")
        return None

    # Validate basic syntax before saving
    try:
        ast.parse(new_script)
    except SyntaxError as e:
        logger.error(f"LLM generated invalid Python syntax: {e}")
        return None

    # Save the new iteration
    # e.g., aether_scalper.py -> aether_scalper_v1.py
    base_name = os.path.basename(file_path).replace(".py", "")
    base_name = re.sub(r'_v\d+$', '', base_name) # Strip old version tag if any
    new_filename = os.path.join(os.path.dirname(file_path), f"{base_name}_v{iteration}.py")

    with open(new_filename, 'w') as f:
        f.write(new_script.strip())

    logger.info(f"Saved optimized strategy step to {new_filename}")
    return new_filename, perf

async def run_iteration_api(code: str = None, strategy_name: str = None, symbol: str = "RELIANCE", targets: dict = None, timeframe: str = "1m", days: int = 7, model="qwen3.5-claude:latest"):
    import uuid
    strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'strategies'))

    file_path = None
    if code:
        temp_id = str(uuid.uuid4())[:8]
        file_path = os.path.join(strat_dir, f"temp_ar_{temp_id}.py")
        with open(file_path, 'w') as f:
            f.write(code)
    elif strategy_name:
        file_path = os.path.join(strat_dir, strategy_name if strategy_name.endswith('.py') else f"{strategy_name}.py")
        if not os.path.exists(file_path):
            return {"error": f"Strategy {strategy_name} not found"}
        with open(file_path, 'r') as f:
            code = f.read()
    else:
        return {"error": "Provide either code or strategy_name"}

    strategy_cls = get_strategy_class_from_file(file_path)
    if not strategy_cls:
        if code and file_path and "temp_ar_" in file_path: os.remove(file_path)
        return {"error": "Could not find valid strategy class"}

    engine = BacktestEngine(strategy_class=strategy_cls, symbol=symbol, interval=timeframe)
    engine.no_ai = True

    try:
        results = await engine.run(days=days)
    except Exception as e:
        if code and file_path and "temp_ar_" in file_path: os.remove(file_path)
        return {"error": f"Backtest failed: {str(e)}"}

    perf = results.get("performance", {})

    # Construct LLM prompt
    target_str = "\n".join([f"- target {k}: {v}" for k, v in (targets or {}).items()]) if targets else "Improve the strategy"
    directive = f"Achieve the following target metrics mathematically:\\n{target_str}"

    prompt = f"""
You are an elite quantitative developer acting as an autonomous AutoResearch agent.
Your objective is to optimize the trading strategy given below to improve its backtest performance metrics.

--- Directive / Constraints ---
{directive}

--- Latest Evaluation Metrics ---
Net PnL: {perf.get("net_pnl", 0)}
Sharpe Ratio: {perf.get("sharpe_ratio", 0)}
Win Rate: {perf.get("win_rate", 0)}%
Max Drawdown: {perf.get("max_drawdown", 0)}%
Total Trades Executed: {results.get("total_trades", 0)}

--- Current Strategy Source Code ---
```python
{code}
```

--- Instructions ---
Based on the metrics and the directive, output an IMPROVED version of the above strategy python script.
- Ensure you do not change the class name or core imports.
- Only change thresholds, logical conditions, risk parameters, or add standard technicals supported by `self._calculate_indicators`.
- IMPORTANT for OpenAlgo: Use `ta` library (import pandas_ta as ta or equivalent, but OpenAlgo `ta` comes built-in). Use `ta.crossover()`, `ta.crossunder()`, `ta.exrem()` for signal cleaning, and `ta.flip()` for regime detection.
- IMPORTANT for Backtesting: Realize your signals will be executed by VectorBT. Consider standard TA-Lib indicators (EMA, SMA, RSI, MACD, BBands, ATR, ADX, STDDEV, MOM) and OpenAlgo specific (Supertrend, Donchian, Ichimoku).
- IMPORTANT for Numba: If using custom Numba logic, use `@njit(cache=True, nogil=True)`. Do NOT use `fastmath=True` as it breaks NaN handling.
- IMPORTANT: You MUST output ONLY the new Python script wrapped in a ```python ... ``` block. No markdown explanations.
"""
    response_text = call_ollama(prompt, model=model)
    new_script = extract_python_code(response_text)
    final_code = new_script.strip() if len(new_script.strip()) > 50 else code

    # Persistent saving for later viewing
    research_dir = os.path.join(strat_dir, 'autoresearch_history')
    os.makedirs(research_dir, exist_ok=True)

    if len(new_script.strip()) > 50:
        base_name = strategy_name.replace('.py', '') if strategy_name else "generated_strat"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        save_name = f"{base_name}_{timestamp}.py"
        save_path = os.path.join(research_dir, save_name)
        with open(save_path, 'w') as f:
            f.write(final_code)

        json_path = os.path.join(research_dir, f"{base_name}_{timestamp}.json")
        with open(json_path, 'w') as f:
            json.dump({"metrics": perf, "symbol": symbol, "timeframe": timeframe, "targets": targets}, f)

    if code and file_path and "temp_ar_" in file_path:
        try: os.remove(file_path)
        except: pass

    return {
        "metrics": perf,
        "new_code": final_code,
        "saved_path": save_path if len(new_script.strip()) > 50 else None
    }

async def main():
    parser = argparse.ArgumentParser(description="AutoResearch Agent for Continuous Strategy Improvement")
    parser.add_argument("--strategy", type=str, required=True, help="Base strategy python file name (e.g., aether_scalper.py)")
    parser.add_argument("--directive", type=str, required=True, help="Optimization directive")
    parser.add_argument("--iterations", type=int, default=3, help="Number of AutoResearch iterations loops")
    parser.add_argument("--model", type=str, default="qwen3.5-claude:latest", help="Ollama model to use")

    # Because we might run this in docker or outside
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        args = parser.parse_args(['--strategy', 'aether_scalper.py', '--directive', 'Minimize drawdown and increase win rate', '--iterations', '1'])
    else:
        args = parser.parse_args()

    strat_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'strategies'))
    current_file = os.path.join(strat_dir, args.strategy)
    if not current_file.endswith(".py"):
         current_file += ".py"

    if not os.path.exists(current_file):
        logger.error(f"Strategy file not found: {current_file}")
        sys.exit(1)

    best_file = current_file
    history = []

    for i in range(1, args.iterations + 1):
        result = await run_iteration(current_file, args.directive, i, args.model)
        if result:
            current_file, last_perf = result
            history.append((current_file, last_perf))
            best_file = current_file
        else:
            logger.warning(f"Iteration {i} failed. Stopping AutoResearch.")
            break

    logger.info("\n=== AutoResearch Complete ===")
    logger.info(f"Final Optimized Strategy stored at: {best_file}")
    if history:
        logger.info(f"Final Metrics: {history[-1][1]}")

if __name__ == "__main__":
    asyncio.run(main())
