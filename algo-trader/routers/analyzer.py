from fastapi import APIRouter, HTTPException, Query, Request, Body
from typing import List, Dict, Any, Optional
import logging
import json
from datetime import datetime
from database.trade_logger import get_trade_logger
from core.context import app_context

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analyzer"])

@router.get("/data")
async def get_analyzer_data(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100)
):
    """
    GET /analyzer/api/data
    Retrieves intercepted API payloads and signal integrity statistics.
    Used by the Validator_Kernel UI to audit neural scan logic.
    """
    try:
        db = get_trade_logger()
        # Fetch logs from database
        logs = db.get_api_logs(limit=limit)

        # Calculate stats
        anomalies = 0
        symbols = set()
        sources = set()

        formatted_requests = []
        for log in logs:
            req_data = log.get("request_data") or {}
            resp_data = log.get("response_data") or {}

            # Extract symbol from various possible fields in request_data
            symbol = req_data.get("symbol") or req_data.get("symbol_id") or req_data.get("tradingsymbol") or "N/A"
            if symbol != "N/A":
                symbols.add(symbol)

            # Extract strategy/source
            source = log.get("strategy") or "System"
            sources.add(source)

            # Check for anomalies/issues
            # The UI checks req.analysis?.issues to display 'ANOMALY'
            analysis = resp_data.get("analysis") or {}
            has_issues = False

            # If resp_data itself is the analysis (common in AetherAnalyzer output)
            if not analysis and isinstance(resp_data, dict):
                analysis = resp_data

            if isinstance(analysis, dict) and analysis.get("issues"):
                has_issues = True
                anomalies += 1

            formatted_requests.append({
                "id": log.get("id"),
                "timestamp": log.get("created_at"),
                "api_type": log.get("api_type"),
                "source": source,
                "symbol": symbol,
                "request_data": req_data,
                "response_data": resp_data,
                "analysis": analysis if has_issues else None
            })

        # Apply basic date filtering if requested
        if start_date or end_date:
            if start_date:
                formatted_requests = [r for r in formatted_requests if r["timestamp"] >= start_date]
            if end_date:
                formatted_requests = [r for r in formatted_requests if r["timestamp"] <= end_date]

        stats = {
            "total_requests": len(formatted_requests),
            "issues": {
                "total": anomalies
            },
            "symbols": sorted(list(symbols)),
            "sources": sorted(list(sources))
        }

        return {
            "status": "success",
            "data": {
                "stats": stats,
                "requests": formatted_requests
            }
        }
    except Exception as e:
        logger.error(f"Analyzer API Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")

@router.post("/scan")
async def trigger_neural_scan(
    symbol: str = Body(..., embed=True),
    timeframe: str = Body("5m", embed=True)
):
    """
    POST /analyzer/api/scan
    Triggers a real-time neural scan for a specific symbol.
    The result is logged to api_logs and returned to the caller.
    """
    try:
        analyzer = app_context.get("analyzer")
        if not analyzer:
             from services.aether_analyzer import get_analyzer
             analyzer = get_analyzer()

        result = await analyzer.analyze_symbol(symbol, timeframe)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"Neural Scan Trigger Error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
