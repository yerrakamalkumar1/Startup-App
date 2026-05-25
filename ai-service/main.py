from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from models.churn_predictor import predict_churn
from models.embedder import embed_text
from models.fraud_detector import score_fraud
from models.matcher import match_freelancers, match_startups

app = FastAPI(title="ConnectHub AI Service", version="1.0.0")


class TextPayload(BaseModel):
    text: str = ""


class MatchFreelancersPayload(BaseModel):
    startup: Dict[str, Any]
    freelancers: List[Dict[str, Any]] = Field(default_factory=list)


class MatchStartupsPayload(BaseModel):
    investor: Dict[str, Any]
    startups: List[Dict[str, Any]] = Field(default_factory=list)


class EnhanceProfilePayload(BaseModel):
    name: str = ""
    title: str = ""
    bio: str = ""
    skills: List[str] = Field(default_factory=list)
    role: str = "freelancer"
    sector: Optional[str] = None


class AdPayload(BaseModel):
    productName: str
    targetAudience: str = "Indian startups"
    tone: str = "professional"
    sector: str = "SaaS & Technology"


class CoursePayload(BaseModel):
    skills: List[str] = Field(default_factory=list)
    sector: str = "SaaS & Technology"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/embed")
def embed(payload: TextPayload):
    return {"embedding": embed_text(payload.text), "dims": 384}


@app.post("/match-freelancers")
def api_match_freelancers(payload: MatchFreelancersPayload):
    return {"matches": match_freelancers(payload.startup, payload.freelancers)}


@app.post("/match-startups")
def api_match_startups(payload: MatchStartupsPayload):
    return {"matches": match_startups(payload.investor, payload.startups)}


@app.post("/enhance-profile")
def enhance_profile(payload: EnhanceProfilePayload):
    raw_skills = set(skill.strip().title() for skill in payload.skills if skill.strip())
    for token in f"{payload.title} {payload.bio}".replace("/", " ").split():
        if token.lower() in {"react", "node", "design", "branding", "sales", "marketing", "editor", "video", "python", "ai"}:
            raw_skills.add(token.title())
    title_base = payload.title or ("Startup Founder" if payload.role == "startup_admin" else payload.role.title())
    bio = payload.bio or f"{payload.name or 'This ConnectHub member'} works with Indian startups and business teams, focusing on practical execution, trust, and measurable outcomes. They are open to relevant opportunities, partnerships, and long-term professional connections. Their profile is being improved with clearer skills and sector positioning."
    score = 35 + min(len(raw_skills), 6) * 7 + (20 if payload.bio else 0) + (10 if payload.sector else 0)
    tips = []
    if not payload.bio:
        tips.append("Add a short bio with sector, strengths, and ideal collaboration.")
    if len(raw_skills) < 3:
        tips.append("Add at least 3 specific skills to improve matching.")
    tips.append("Add city, profile photo, and proof of work for better trust.")
    return {
        "skills": sorted(raw_skills),
        "headlineSuggestions": [
            f"{title_base} for Indian startup growth",
            f"{title_base} helping teams launch faster",
            f"{title_base} focused on measurable business outcomes",
        ],
        "bio": bio,
        "profileScore": min(score, 100),
        "tips": tips[:3],
    }


@app.post("/score-fraud")
def api_score_fraud(payload: Dict[str, Any]):
    return score_fraud(payload)


@app.post("/predict-churn")
def api_predict_churn(payload: Dict[str, Any]):
    return predict_churn(payload)


@app.post("/generate-ad")
def generate_ad(payload: AdPayload):
    tone = payload.tone.lower()
    cta = "Book a quick call" if tone == "professional" else "Let's build this"
    variants = [
        {
            "headline": f"Launch {payload.productName} with startup-ready execution",
            "body": f"Built for {payload.targetAudience}, this offer helps teams move faster with clear delivery, practical pricing, and India-focused support.",
            "cta": cta,
        },
        {
            "headline": f"{payload.productName} that fits your next growth sprint",
            "body": f"Get focused help for {payload.targetAudience} without long agency cycles. Simple scope, fast turnaround, and measurable outcomes.",
            "cta": "Start your project",
        },
        {
            "headline": f"Make {payload.productName} visible to the right startup clients",
            "body": f"Position your service with sharp messaging, clean creatives, and a CTA designed for Indian founders and operators.",
            "cta": "Post this ad",
        },
    ]
    return {
        "variants": variants,
        "hashtags": ["#IndianStartups", "#StartupIndia", "#FounderNetwork", "#FreelanceIndia"],
        "bestTimeToPost": "Tuesday to Thursday, 7:00 PM - 9:00 PM IST",
    }


@app.post("/recommend-courses")
def recommend_courses(payload: CoursePayload):
    skills = " ".join(payload.skills).lower()
    if "design" in skills or "branding" in skills:
        courses = [
            {"title": "Canva Design School", "url": "https://www.canva.com/designschool/"},
            {"title": "NPTEL Design Thinking", "url": "https://nptel.ac.in/"},
            {"title": "YouTube: Brand Identity Basics", "url": "https://www.youtube.com/results?search_query=brand+identity+basics"},
        ]
    elif "react" in skills or "developer" in skills:
        courses = [
            {"title": "React Official Tutorial", "url": "https://react.dev/learn"},
            {"title": "freeCodeCamp Web Development", "url": "https://www.freecodecamp.org/learn/"},
            {"title": "NPTEL Programming Courses", "url": "https://nptel.ac.in/"},
        ]
    else:
        courses = [
            {"title": "Startup India Learning Program", "url": "https://www.startupindia.gov.in/"},
            {"title": "NPTEL Entrepreneurship", "url": "https://nptel.ac.in/"},
            {"title": "YouTube: Client Communication Skills", "url": "https://www.youtube.com/results?search_query=client+communication+skills"},
        ]
    return {"recommendations": courses[:3], "sector": payload.sector}


@app.get("/market-trends")
def market_trends():
    return {
        "growingSectors": [
            {"sector": "SaaS & Technology", "growth": 28},
            {"sector": "Commerce & Retail", "growth": 21},
            {"sector": "Health & Wellness", "growth": 17},
        ],
        "inDemandSkills": [
            {"skill": "Video Editing", "demand": 31},
            {"skill": "Branding", "demand": 26},
            {"skill": "React Development", "demand": 22},
        ],
        "averageFundingGoals": [
            {"sector": "SaaS & Technology", "amount": 1800000},
            {"sector": "Commerce & Retail", "amount": 900000},
            {"sector": "Consumer Services", "amount": 650000},
        ],
        "investorActivity": [
            {"sector": "SaaS & Technology", "index": 78},
            {"sector": "Finance & Legal", "index": 64},
            {"sector": "Health & Wellness", "index": 59},
        ],
    }
