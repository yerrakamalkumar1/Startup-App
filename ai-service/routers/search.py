from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from integrations.adzuna import fetch_jobs
from integrations.google_places import fetch_places, haversine_km
from integrations.newsapi import fetch_news
from integrations.pytrends_client import skill_demand_scores
from models.embedder import embed_text
from models.faiss_index import default_profiles, profile_index
from models.intent_classifier import classify_intent

router = APIRouter()


class TextPayload(BaseModel):
    text: str = ""


class SearchPayload(BaseModel):
    query: str = ""
    user_role: str = "freelancer"
    role: str = "freelancer"
    user_lat: float = 17.385
    user_lng: float = 78.4867
    lat: float = 17.385
    lng: float = 78.4867
    city: str = "Hyderabad"
    user_skills: List[str] = Field(default_factory=list)
    user_sector: str = "SaaS & Technology"
    filters: Dict[str, Any] = Field(default_factory=dict)
    profiles: List[Dict[str, Any]] = Field(default_factory=list)


class NearbyPayload(BaseModel):
    lat: float = 17.385
    lng: float = 78.4867
    radius_km: int = 10
    user_skills: List[str] = Field(default_factory=list)
    user_sector: str = "SaaS & Technology"
    city: str = "Hyderabad"
    profiles: List[Dict[str, Any]] = Field(default_factory=list)


class SkillDemandPayload(BaseModel):
    skills: List[str] = Field(default_factory=lambda: ["video editing", "react", "branding", "sales", "figma", "photography", "seo", "node.js", "finance", "ai tools"])
    city: str = "India"


@router.post("/embed")
def embed(payload: TextPayload):
    return {"embedding": embed_text(payload.text), "dims": 384}


@router.post("/classify-intent")
def classify(payload: TextPayload):
    return classify_intent(payload.text)


@router.post("/search")
def search(payload: SearchPayload):
    profiles = payload.profiles or default_profiles()
    profile_index.build(profiles)
    db_results = [_format_profile_result(item, payload.user_lat or payload.lat, payload.user_lng or payload.lng) for item in profile_index.search(payload.query, 8)]
    jobs = fetch_jobs(payload.query, payload.city, 5)
    places = fetch_places(payload.user_lat or payload.lat, payload.user_lng or payload.lng, payload.query or payload.user_sector, 10)
    news = fetch_news(f"{payload.query} India startup", 4)
    merged = _merge_results(db_results, jobs, places, news)
    return {
        "summary": _summary(payload.query, merged, payload.user_role or payload.role),
        "intent": classify_intent(payload.query)["intent"],
        "sources_used": ["ConnectHub DB", "Adzuna", "Google Places", "NewsAPI", "Google Trends"],
        "results": merged[:8],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/nearby-opportunities")
def nearby(payload: NearbyPayload):
    profiles = payload.profiles or default_profiles()
    db_results = []
    for item in profiles:
        if item.get("lat") and item.get("lng"):
            distance = haversine_km(payload.lat, payload.lng, float(item["lat"]), float(item["lng"]))
            if distance <= payload.radius_km:
                db_results.append(_format_profile_result({**item, "semanticScore": 0.78}, payload.lat, payload.lng))
    places = fetch_places(payload.lat, payload.lng, payload.user_sector, payload.radius_km)
    jobs = fetch_jobs((payload.user_skills or [payload.user_sector])[0], payload.city, 8)
    results = _merge_results(db_results, places, jobs)
    return {"results": results[:12], "center": {"lat": payload.lat, "lng": payload.lng}, "radiusKm": payload.radius_km}


@router.post("/skill-demand")
def skill_demand(payload: SkillDemandPayload):
    return {
        "city": payload.city,
        "skills": skill_demand_scores(payload.skills),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/ai-feed-item")
def ai_feed_item(payload: Dict[str, Any]):
    role = payload.get("role", "freelancer")
    skill = (payload.get("skills") or ["Video Editing"])[0]
    city = payload.get("city", "your city")
    return {
        "id": f"feed-{int(datetime.now(timezone.utc).timestamp())}",
        "type": "Gig Alert" if role == "freelancer" else "Market Insight",
        "title": f"{skill} demand is active in {city}",
        "body": f"ConnectHub AI found fresh signals for {skill} around {city}. Check nearby opportunities and update your profile tags.",
        "source": "ConnectHub AI",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def _format_profile_result(item: Dict[str, Any], lat: float, lng: float) -> Dict[str, Any]:
    distance = None
    if item.get("lat") and item.get("lng"):
        distance = round(haversine_km(lat, lng, float(item["lat"]), float(item["lng"])), 1)
    score = int((item.get("semanticScore") or 0.7) * 100)
    return {
        "source": "ConnectHub",
        "title": item.get("name") or "ConnectHub profile",
        "description": item.get("title") or item.get("sector") or "Profile on ConnectHub",
        "role": item.get("role"),
        "sector": item.get("sector"),
        "city": item.get("city"),
        "lat": item.get("lat"),
        "lng": item.get("lng"),
        "distanceKm": distance,
        "matchPercent": max(55, min(98, score)),
        "url": f"/profile/{item.get('id') or item.get('handle') or item.get('name', '').lower().replace(' ', '-')}",
        "why": f"Matched by semantic similarity to skills, role, and sector. Location signal is {'nearby' if distance is not None and distance < 10 else 'available'}."
    }


def _merge_results(*groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for group in groups:
        for item in group:
            score = item.get("matchPercent", 65)
            distance = item.get("distanceKm")
            distance_bonus = 10 if distance is not None and distance <= 5 else 4 if distance is not None and distance <= 15 else 0
            rows.append({**item, "compositeScore": min(100, score + distance_bonus)})
    return sorted(rows, key=lambda row: row.get("compositeScore", 0), reverse=True)


def _summary(query: str, results: List[Dict[str, Any]], role: str) -> str:
    if not results:
        return f"No strong AI matches found for '{query}'. Try a skill, sector, city, or company name."
    top = results[0]
    return f"For {role}, the strongest result is {top.get('title')} with {top.get('matchPercent', 70)}% AI match. Results combine ConnectHub profiles, live jobs, news, and nearby business signals."
