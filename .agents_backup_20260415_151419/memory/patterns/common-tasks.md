# AetherDesk Prime — Common Patterns
# Type: Auto (agents add patterns here when they create reusable solutions)
# Purpose: Prevents re-solving the same problems. Load this before writing any code.

## 1. Core Communication (Unified Ports)
- **REST Gateway**: Use port **18788** for all engine interactions.
- **WebSocket Ticks**: Use port **5002** for real-time market data.
- **Internal OpenAlgo**: `http://openalgo-web:5000` (Docker internal only).

## 2. Pattern: Shoonya OAuth Session Sync
Essential for maintaining broker connectivity.
```python
# algo-trader/utils/finalize_shoonya_auth.py
from utils.get_shoonya_token import get_shoonya_auth_code
from utils.finalize_shoonya_auth import finalize_shoonya_session

# Robust headless auth
auth_code = get_shoonya_auth_code()
if auth_code and not auth_code.startswith("FAILURE"):
    session_info = finalize_shoonya_session(auth_code)
    # session_info['susertoken'] is the key for API calls
```

## 3. Pattern: Flask Blueprint for Feature Isolation
Use blueprints to keep `api.py` clean.
```python
# algo-trader/blueprints/analytics.py
from flask import Blueprint, jsonify, request

analytics_bp = Blueprint("analytics_bp", __name__)

@analytics_bp.route("/api/v1/analytics/gex", methods=["GET"])
def get_gex_data():
    try:
        # Business logic here
        return jsonify({"status": "success", "data": {...}}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
```

## 4. Pattern: Managed Order Execution (Action Center)
Always route orders through the Action Manager for risk checks and audit.
```python
from execution.action_manager import get_action_manager
action_manager = get_action_manager()

# Queue for semi-auto or fully-auto execution
order_token = await action_manager.submit_order({
    "exchange": "NSE",
    "symbol": "SBIN-EQ",
    "qty": 10,
    "side": "BUY",
    "type": "LMT",
    "price": 605.5
})
```

## 5. Pattern: DuckDB Historify (High-Speed Analytics)
Native analytical storage pattern.
```python
# /app/storage/historify.duckdb
import duckdb

conn = duckdb.connect("/app/storage/historify.duckdb")
# Bulk insert OHLCV for backtesting
conn.execute("INSERT INTO candles SELECT * FROM read_csv_auto('data.csv')")
# Range query
df = conn.execute("SELECT * FROM candles WHERE symbol = ? AND ts > ?", [symbol, start]).df()
```

## 6. Pattern: React WebSocket Ticks (Port 5002)
Standard bilingual parser for the UI.
```typescript
// trading-ui/src/hooks/useRealtime.ts
const socket = new WebSocket('ws://' + window.location.hostname + ':5002');

socket.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    // Standardize Ticks (tk), Orders (om), and System (sys) events
    if (data.t === 'tk') dispatch(updateLTP(data.lp));
};
```

## 7. Pattern: Protected UI Route (AuthGuard)
```tsx
// trading-ui/src/components/auth/AuthGuard.tsx
import { supabase } from '@/integrations/supabase/client';

export const AuthGuard = ({ children }) => {
    const session = useSession(); // Accesses Supabase GoTrue session
    if (!session) return <LoginForm />;
    return <>{children}</>;
};
```

## 8. Pattern: Structured Log & Redis Flush
```python
# Standardized JSON logging for production audit
logger.info(json.dumps({
    "event": "strategy_signal",
    "strategy": "AetherVault",
    "signal": "LONG",
    "price": ltp
}))

# Immediate state sync to Redis
redis_conn.set(f"state:{strategy_name}", json.dumps(current_state))
```

## 9. Pattern: Component-Level Null Safety (Industrial Metrics)
Standardized pattern for counter animations in high-load data dashboards.
```tsx
// trading-ui/src/components/trading/IndustrialValue.tsx
const spring = useSpring(value ?? 0, { ... });

useEffect(() => {
    const safeValue = value ?? 0;
    spring.set(safeValue);
    // ... animation logic
}, [value, spring]);
```

## 10. Pattern: Normalized Metric Aggregation
Enforce full schema integrity in SQL/DuckDB aggregation results to prevent UI crashes on empty datasets.
```python
# algo-trader/database/trade_logger.py
def get_metrics():
    if not rows:
        return {
            "sharpe": 0.0, "net_pnl": 0.0, 
            "max_drawdown": 0.0, "total_trades": 0
        }
    # Return calculated values
```

## 11. Pattern: Standardized Shadcn Form (Zod + Accessibility)
Standard pattern for input validation and decorative icon handling.
```tsx
// 1. Definition
const formSchema = z.object({
  id: z.string().min(1, "Access ID Required"),
});

// 2. Implementation
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>ACCESS_ID</FormLabel>
          <FormControl>
            <div className="relative">
              <Zap className="absolute icon" aria-hidden="true" />
              <Input {...field} placeholder="TRADER_ID" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>
```

## 12. Pattern: Premium Reactive Switch (Bi-directional Labels)
Standard pattern for high-visibility toggles with reactive status coloring.
```tsx
// Usage in dashbaords for critical gates (Execution, Safeguards, Cache)
<div className="flex items-center gap-3">
  <span className={cn(
    "text-[8px] font-mono font-black transition-colors uppercase tracking-widest",
    !isEnabled ? "text-rose-500" : "text-muted-foreground/20"
  )}>
    {labelOff}
  </span>
  
  <Switch 
    checked={isEnabled}
    onCheckedChange={setIsEnabled}
    className="scale-90"
  />
  
  <span className={cn(
    "text-[8px] font-mono font-black transition-colors uppercase tracking-widest",
    isEnabled ? "text-primary" : "text-muted-foreground/20"
  )}>
    {labelOn}
  </span>
</div>
```

## [Agents: add new reusable patterns here when created during fixes]
