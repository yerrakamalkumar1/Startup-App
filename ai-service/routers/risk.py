from typing import Any, Dict, List

from fastapi import APIRouter

from integrations.gpt_client import ad_variants, course_recommendations
from models.faiss_index import default_profiles, profile_index
from models.intent_classifier import extract_skills
from models.risk_scorer import portfolio_risk, score_startup_risk

router = APIRouter()


@router.post("/risk-score")
def risk_score(payload: Dict[str, Any]):
    return score_startup_risk(payload.get("startup") or payload)


@router.post("/portfolio-risk")
def analyze_portfolio(payload: Dict[str, Any]):
    return portfolio_risk(payload.get("startups") or payload.get("portfolio") or [])


@router.post("/score-fraud")
def score_fraud(payload: Dict[str, Any]):
    text = " ".join(str(value) for value in payload.values()).lower()
    score = 0.08
    reasons = ["No major risk signal detected."]
    if any(word in text for word in ["guaranteed", "crypto double", "pay first", "urgent loan"]):
        score += 0.45
        reasons = ["Suspicious promotional language detected."]
    if "@" not in str(payload.get("email", "@")):
        score += 0.15
    return {"fraudScore": round(min(score, 0.95), 2), "reasons": reasons}


@router.post("/predict-churn")
def predict_churn(payload: Dict[str, Any]):
    login_frequency = float(payload.get("loginFrequency") or payload.get("logins") or 1)
    profile_views = float(payload.get("profileViews") or 0)
    connections = float(payload.get("connections") or 0)
    risk = 0.75 - min(0.35, login_frequency * 0.06) - min(0.2, profile_views * 0.01) - min(0.2, connections * 0.03)
    return {"churnProbability": round(max(0.05, min(0.9, risk)), 2), "atRisk": risk > 0.7}


@router.post("/recommend-courses")
def recommend_courses(payload: Dict[str, Any]):
    return {"recommendations": course_recommendations(payload.get("skills") or [], payload.get("sector") or "SaaS & Technology")}


@router.post("/match-freelancers")
def match_freelancers(payload: Dict[str, Any]):
    startup = payload.get("startup") or {}
    freelancers = payload.get("freelancers") or [item for item in default_profiles() if item["role"] == "freelancer"]
    query = " ".join([startup.get("sector", ""), startup.get("description", ""), startup.get("title", "")])
    profile_index.build(freelancers)
    return {"matches": _matches(profile_index.search(query or "startup freelancer", 10))}


@router.post("/match-startups")
def match_startups(payload: Dict[str, Any]):
    investor = payload.get("investor") or {}
    startups = payload.get("startups") or [item for item in default_profiles() if item["role"] == "startup"]
    query = " ".join([investor.get("sector", ""), investor.get("thesis", ""), investor.get("title", "")])
    profile_index.build(startups)
    return {"matches": _matches(profile_index.search(query or "startup investment", 5))}


@router.post("/enhance-profile")
def enhance_profile(payload: Dict[str, Any]):
    profile = payload.get("profile") or payload
    skills = list(dict.fromkeys([*(profile.get("skills") or []), *extract_skills(f"{profile.get('title', '')} {profile.get('bio', '')}")]))[:8]
    score = min(100, 40 + len(skills) * 7 + (20 if profile.get("bio") else 0) + (10 if profile.get("city") else 0))
    return {
        "skills": skills,
        "headlineSuggestions": [
            f"{profile.get('title') or profile.get('role', 'Professional')} for Indian startup growth",
            "Trusted ConnectHub partner for practical execution",
            "Startup-ready professional with clear delivery focus",
        ],
        "bio": profile.get("bio") or f"{profile.get('name', 'This member')} helps Indian startup teams with practical, reliable work and clear communication.",
        "profileScore": score,
        "tips": ["Add a profile photo.", "Add city and sector.", "Upload proof of work."],
    }


@router.post("/generate-ad")
def generate_ad(payload: Dict[str, Any]):
    return ad_variants(payload.get("productName") or "your service", payload.get("targetAudience") or "Indian startups", payload.get("tone") or "professional")


def _matches(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    matches = []
    for row in rows:
        score = int((row.get("semanticScore") or 0.72) * 100)
        matches.append({**row, "score": max(60, min(98, score)), "reasons": ["Skill/sector alignment", "Profile relevance", "Indian market fit"]})
    return matches
