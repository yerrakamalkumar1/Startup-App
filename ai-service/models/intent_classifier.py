from typing import Dict, List

SKILL_KEYWORDS = {
    "design": ["design", "figma", "canva", "branding", "logo", "ui", "ux"],
    "development": ["react", "node", "python", "web", "app", "developer", "software"],
    "media": ["photo", "photography", "video", "editor", "reel", "instagram"],
    "marketing": ["seo", "ads", "marketing", "growth", "sales", "content"],
    "finance": ["finance", "funding", "legal", "tax", "accounting"],
}


def classify_intent(query: str) -> Dict[str, object]:
    text = str(query or "").lower()
    if any(word in text for word in ["hire", "freelancer", "talent", "designer", "developer", "editor"]):
        intent = "find_talent"
    elif any(word in text for word in ["gig", "job", "work", "apply", "opportunity"]):
        intent = "find_gig"
    elif any(word in text for word in ["competitor", "similar business", "nearby business"]):
        intent = "competitor_search"
    elif any(word in text for word in ["funding", "invest", "startup", "deal"]):
        intent = "investment_opportunity"
    elif any(word in text for word in ["news", "trend", "market"]):
        intent = "market_research"
    else:
        intent = "general"
    return {"intent": intent, "skills": extract_skills(text)}


def extract_skills(text: str) -> List[str]:
    found = []
    lowered = str(text or "").lower()
    for category, words in SKILL_KEYWORDS.items():
        if any(word in lowered for word in words):
            found.append(category)
            found.extend([word for word in words if word in lowered][:2])
    return list(dict.fromkeys(found))[:8]
