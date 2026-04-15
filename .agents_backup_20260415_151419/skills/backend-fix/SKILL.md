---
name: backend-fix
description: Use when fixing algo_engine Flask backend issues. Triggers on: "Flask", "endpoint", "route", "API error", "500", "404", "blueprint", "request context", "response mapping", "CORS", "rate limit", "threading", "order submission".
---

# Backend Fix Skill — algo_engine Flask

## Standard Flask App Structure (algo-trader/api.py)
```python
# Use Blueprints for feature isolation
from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
from blueprints.analytics import analytics_bp

app = Flask(__name__)
CORS(app)

# Register Blueprints
app.register_blueprint(analytics_bp)

# Global context check (e.g. trading mode)
def trading_mode_gate(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        mode = request.headers.get("X-Trading-Mode", "PAPER")
        # Logic to switch order_manager based on mode
        return f(*args, **kwargs)
    return decorated_function

# Unified Response Envelope
def api_response(status="success", data=None, message="", code=200):
    return jsonify({
        "status": status,
        "data": data,
        "message": message
    }), code
```

## JSON Error Handler Pattern
```python
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled Error: {e}", exc_info=True)
    return jsonify({
        "status": "error",
        "message": "Internal Server Error",
        "details": str(e) if app.debug else None
    }), 500
```

## Pattern: Blueprint Endpoints (e.g. /blueprints/action_center.py)
```python
@action_center_bp.route("/api/v1/actioncenter/approve", methods=["POST"])
async def approve_order():
    try:
        data = request.json or {}
        order_id = data.get("id")
        if not order_id:
            return api_response("error", message="Missing order ID", code=400)
            
        success = await action_manager.approve_order(int(order_id))
        return api_response(data={"id": order_id}) if success else api_response("error", code=500)
    except Exception as e:
        return api_response("error", message=str(e), code=500)
```

## Pattern: Background Processing (Thread-Safe)
Since the Flask app runs in a threaded environment (see `main.py`), use `asyncio.run_coroutine_threadsafe` for interacting with the main event loop if necessary, or managed shared state.
```python
from threading import Lock
_state_lock = Lock()

def update_shared_state(new_data):
    with _state_lock:
        # thread-safe mutation
        global_state.update(new_data)
```

## Data Access: DuckDB / SQLite Audit
```python
# ALWAYS use parameterized queries to prevent SQLi
def get_audit_trail(order_id):
    conn = get_db_connection() # sqlite for trades
    return conn.execute(
        "SELECT * FROM audit_logs WHERE order_id = ?", 
        (order_id,)
    ).fetchall()
```

## [Agents: add new backend patterns here when created]
