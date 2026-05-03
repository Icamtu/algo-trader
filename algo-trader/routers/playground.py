from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any
import os

router = APIRouter(tags=["Playground"])

@router.get("/endpoints")
async def get_playground_endpoints():
    """
    GET /api/v1/playground/endpoints
    Returns the list of available API endpoints for the AetherDesk Playground.
    """
    return {
        "execution": [
            { "name": "Place Order", "path": "/api/v1/placeorder", "method": "POST", "body": { "symbol": "NSE:RELIANCE-EQ", "action": "BUY", "quantity": 1, "pricetype": "MARKET", "product": "MIS", "exchange": "NSE" } },
            { "name": "Cancel Order", "path": "/api/v1/orders/{order_id}/cancel", "method": "POST", "body": { "order_id": "ORD_123" } },
            { "name": "Order Book", "path": "/api/v1/orderbook", "method": "GET" },
            { "name": "Trade Book", "path": "/api/v1/tradebook", "method": "GET" },
            { "name": "Sandbox Summary", "path": "/api/v1/sandbox/summary", "method": "GET" }
        ],
        "telemetry": [
            { "name": "System Health", "path": "/api/v1/health", "method": "GET" },
            { "name": "Deep Telemetry", "path": "/api/v1/telemetry", "method": "GET" },
            { "name": "PnL Summary", "path": "/api/v1/telemetry/pnl", "method": "GET" },
            { "name": "System Logs", "path": "/api/v1/system/logs", "method": "GET" }
        ],
        "intelligence": [
            { "name": "GEX Data", "path": "/api/v1/analytics/gex/api/gex-data", "method": "POST", "body": { "underlying": "NIFTY", "exchange": "NFO", "expiry_date": "07MAY26" } },
            { "name": "OI Profile", "path": "/api/v1/analytics/oiprofile/api/profile-data", "method": "POST", "body": { "underlying": "NIFTY", "exchange": "NFO", "expiry_date": "07MAY26" } },
            { "name": "Neural Scan", "path": "/api/v1/analyzer/scan", "method": "POST", "body": { "symbol": "NSE:RELIANCE-EQ", "timeframe": "5m" } }
        ],
        "utilities": [
            { "name": "Exchanges", "path": "/api/v1/master-contract/exchanges", "method": "GET" },
            { "name": "Active Symbols", "path": "/api/v1/master-contract/symbols/active", "method": "GET" },
            { "name": "RBAC Matrix", "path": "/api/v1/system/rbac", "method": "GET" }
        ]
    }

@router.get("/api-key")
async def get_playground_api_key():
    """
    GET /api/v1/playground/api-key
    Returns the unified engine API key for playground authentication.
    """
    return {"api_key": os.getenv("API_KEY")}
