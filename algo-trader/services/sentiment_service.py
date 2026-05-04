import logging
import feedparser
import requests
from bs4 import BeautifulSoup
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

class SentimentService:
    """
    Scrapes news and social media to provide real-time sentiment signals.
    Uses VADER for fast sentiment analysis.
    """

    def __init__(self):
        self.analyzer = SentimentIntensityAnalyzer()
        # Common Indian financial news RSS feeds
        self.feeds = [
            "https://www.moneycontrol.com/rss/latestnews.xml",
            "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
            "https://www.livemint.com/rss/markets"
        ]

    async def get_latest_news_sentiment(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches latest news from RSS feeds and calculates sentiment.
        Optionally filters by query (e.g., 'RELIANCE', 'NIFTY').
        """
        news_items = []

        for feed_url in self.feeds:
            try:
                # Running in executor to avoid blocking the event loop
                loop = asyncio.get_event_loop()
                feed = await loop.run_in_executor(None, feedparser.parse, feed_url)

                for entry in feed.entries[:10]: # Process top 10 from each feed
                    title = entry.title
                    summary = getattr(entry, 'summary', '')

                    if query and query.lower() not in title.lower() and query.lower() not in summary.lower():
                        continue

                    # Sentiment Analysis
                    sentiment_scores = self.analyzer.polarity_scores(title + " " + summary)

                    news_items.append({
                        "title": title,
                        "link": entry.link,
                        "published": entry.get('published', datetime.now().isoformat()),
                        "sentiment": sentiment_scores['compound'], # Range -1 to 1
                        "pos": sentiment_scores['pos'],
                        "neg": sentiment_scores['neg'],
                        "neu": sentiment_scores['neu'],
                        "source": feed_url.split('/')[2]
                    })
            except Exception:
                logger.error(f"Failed to parse feed {feed_url}", exc_info=True)

        # Sort by sentiment strength
        news_items.sort(key=lambda x: abs(x['sentiment']), reverse=True)
        return news_items

    async def get_aggregated_sentiment(self, symbol: str) -> Dict[str, Any]:
        """
        Returns a single aggregated sentiment score for a symbol.
        Used as a feature for strategies.
        """
        items = await self.get_latest_news_sentiment(query=symbol)
        if not items:
            return {"symbol": symbol, "score": 0.0, "count": 0, "status": "neutral"}

        total_sentiment = sum(item['sentiment'] for item in items)
        avg_sentiment = total_sentiment / len(items)

        status = "NEUTRAL"
        if avg_sentiment > 0.15: status = "BULLISH"
        elif avg_sentiment < -0.15: status = "BEARISH"

        return {
            "symbol": symbol,
            "score": round(avg_sentiment, 3),
            "count": len(items),
            "status": status,
            "timestamp": datetime.now().isoformat()
        }

# Singleton
sentiment_service = SentimentService()
