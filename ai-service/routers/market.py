from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter

from integrations.adzuna import fetch_jobs
from integrations.gpt_client import ad_variants, generate_text
from integrations.google_places import fetch_places
from integrations.newsapi import fetch_news
from integrations.pytrends_client import fetch_trends

router = APIRouter()

SECTORS = [
    "Commerce & Retail",
    "Food & Hospitality",
    "Property & Infrastructure",
    "Health & Wellness",
    "Education & Training",
    "Finance & Legal",
    "Logistics & Mobility",
    "SaaS & Technology",
    "Consumer Services",
    "Media & Entertainment",
    "Manufacturing & Hardware",
]


@router.post("/market-intel")
def market_intel(payload: Dict[str, Any]):
    sector = payload.get("sector") or "SaaS & Technology"
    news = fetch_news(f"{sector} India startup funding", 5)
    trends = fetch_trends([sector, f"{sector} startup", "funding India"])
    return {
        "sector": sector,
        "news": news,
        "trends": trends,
        "summary": generate_text(
            f"Summarize Indian startup market momentum for {sector} in two short sentences.",
            f"{sector} shows steady startup activity in India. Track funding, hiring, and customer demand before making large decisions.",
        ),
    }


@router.post("/competitor-radar")
def competitor_radar(payload: Dict[str, Any]):
    lat = float(payload.get("lat") or 17.385)
    lng = float(payload.get("lng") or 78.4867)
    description = payload.get("description") or payload.get("query") or "startup"
    places = fetch_places(lat, lng, description, 15)[:5]
    return {
        "competitors": places,
        "analysis": generate_text(
            f"Give 3 differentiation ideas for this Indian startup: {description}",
            "Differentiate with trust, fast local support, and clearer pricing. Use ConnectHub media ads to show proof of work and customer outcomes.",
        ),
        "positioning": {
            "labels": ["Price", "Speed", "Quality", "Innovation", "Support"],
            "you": [68, 74, 72, 70, 82],
            "market": [60, 66, 68, 64, 63],
        },
    }


@router.post("/growth-suggestions")
def growth_suggestions(payload: Dict[str, Any]):
    sector = payload.get("sector") or "SaaS & Technology"
    return {
        "overall_health_score": 72,
        "growth_stage": "Early Traction",
        "top_3_suggestions": [
            {"title": "Post one focused gig", "reason": f"{sector} teams get faster responses with clear scope and budget.", "action": "Post a gig on ConnectHub", "urgency": "high"},
            {"title": "Add proof of work", "reason": "Profiles with media and portfolio proof receive more trust signals.", "action": "Upload photos or reels", "urgency": "medium"},
            {"title": "Message matched users", "reason": "Warm outreach converts better than passive discovery.", "action": "Send 3 personalized messages", "urgency": "medium"},
        ],
        "market_timing": f"{sector} has useful momentum in Indian startup searches this week.",
        "risk_flags": ["Incomplete profile lowers match score", "No recent media post found"],
    }


@router.post("/rate-estimate")
def rate_estimate(payload: Dict[str, Any]):
    skill = payload.get("skill") or "creative work"
    city = payload.get("city") or "India"
    experience = float(payload.get("experience") or 1)
    jobs = fetch_jobs(skill, city, 5)
    base = 600 + experience * 450
    return {
        "skill": skill,
        "city": city,
        "recommendedLow": round(base * 0.8),
        "recommendedHigh": round(base * 1.35),
        "marketLow": round(base * 0.6),
        "marketHigh": round(base * 1.8),
        "connectHubAvg": round(base),
        "reason": f"{skill} demand in {city} supports this range. Add niche proof like portfolio, sector experience, or tools to charge more.",
        "liveSignals": jobs[:3],
    }


@router.get("/geo-map-data")
def geo_map_data():
    return {
        "states": [
            {"state": "Telangana", "startupDensity": 78, "investorActivity": 52},
            {"state": "Karnataka", "startupDensity": 92, "investorActivity": 80},
            {"state": "Maharashtra", "startupDensity": 88, "investorActivity": 76},
            {"state": "Tamil Nadu", "startupDensity": 69, "investorActivity": 48},
            {"state": "Delhi NCR", "startupDensity": 84, "investorActivity": 70},
        ],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/market-trends")
def market_trends():
    return {
        "growingSectors": [{"sector": sector, "growth": max(16, 38 - index * 2)} for index, sector in enumerate(SECTORS[:6])],
        "inDemandSkills": [{"skill": skill, "demand": demand} for skill, demand in [("Video Editing", 89), ("React", 84), ("Branding", 79), ("Sales", 72)]],
        "averageFundingGoals": [{"sector": "SaaS & Technology", "amount": 1800000}, {"sector": "Commerce & Retail", "amount": 900000}],
        "investorActivity": [{"sector": "SaaS & Technology", "index": 78}, {"sector": "Finance & Legal", "index": 64}],
    }


@router.post("/generate-ad")
def generate_ad(payload: Dict[str, Any]):
    return ad_variants(payload.get("productName") or "your offer", payload.get("targetAudience") or "Indian startups", payload.get("tone") or "professional")
