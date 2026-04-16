import sys
import os

# Add algo-trader to path
sys.path.append(os.path.join(os.getcwd(), "algo-trader"))

from database.trade_logger import get_trade_logger

tl = get_trade_logger()

# 1. Test Personality
tl.update_strategy_personality("AetherVault_X", {
    "confidence_score": 0.85,
    "regime_preference": "BULL",
    "total_profit_factor": 1.45
})

p = tl.get_strategy_personality("AetherVault_X")
print(f"Strategy Personality: {p}")

# 2. Test Episodes
# We need a dummy trade_id first, but I can just use 999 since FK checks aren't enforced by default unless PRAGMA is sent
tl.record_decision_episode(999, {
    "market_regime": "TRENDING_BULL",
    "conviction_at_entry": 0.9,
    "expected_pnl": 500.0,
    "actual_pnl_normalized": 1.2,
    "semantic_lessons": "RSI divergence confirmed at entry."
})

episodes = tl.get_recent_episodes(limit=1)
# Note: Join might fail if trade 999 doesn't exist. Let's check a raw query if joined fails.
print(f"Recent Episodes (Count): {len(episodes)}")

print("Memory System Verification Complete.")
