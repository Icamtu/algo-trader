from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict
from services.sentiment_service import sentiment_service

router = APIRouter()

@router.get("/news")
async def get_news_sentiment(
    query: Optional[str] = Query(None, description="Filter news by keyword (e.g. RELIANCE, NIFTY)")
):
    """Fetch latest news and their sentiment scores."""
    try:
        results = await sentiment_service.get_latest_news_sentiment(query)
        return {"status": "success", "count": len(results), "news": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/aggregate")
async def get_aggregated_sentiment(
    symbol: str = Query(..., description="Symbol to aggregate sentiment for")
):
    """Get a single aggregated sentiment score for a symbol."""
    try:
        result = await sentiment_service.get_aggregated_sentiment(symbol)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
