import os
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests


def fetch_news(query: str, page_size: int = 5) -> List[Dict[str, Any]]:
    key = os.getenv("NEWSAPI_KEY", "")
    if not key:
        return _fallback_news(query)
    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "apiKey": key,
                "q": f"{query or 'startup'} India",
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": page_size,
            },
            timeout=8,
        )
        response.raise_for_status()
        articles = response.json().get("articles", [])[:page_size]
        return [
            {
                "source": "News",
                "title": article.get("title") or "Startup news",
                "description": article.get("description") or article.get("source", {}).get("name", ""),
                "url": article.get("url", "#"),
                "publishedAt": article.get("publishedAt"),
                "matchPercent": 74,
                "sentiment": "Positive" if any(word in (article.get("title") or "").lower() for word in ["raises", "growth", "launch"]) else "Neutral",
            }
            for article in articles
        ] or _fallback_news(query)
    except Exception:
        return _fallback_news(query)


def _fallback_news(query: str) -> List[Dict[str, Any]]:
    topic = query or "Indian startups"
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "source": "News",
            "title": f"{topic.title()} demand is active across Indian startup teams",
            "description": "Fallback insight generated because NewsAPI is not configured.",
            "url": "https://www.startupindia.gov.in/",
            "publishedAt": now,
            "matchPercent": 70,
            "sentiment": "Neutral",
        }
    ]
