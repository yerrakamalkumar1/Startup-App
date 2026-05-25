import re
from typing import Dict

DISPOSABLE_DOMAINS = {"mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"}
SPAM_TERMS = {"guaranteed income", "pay registration fee", "crypto doubling", "urgent payment", "no interview"}


def score_fraud(payload: Dict) -> Dict:
    email = str(payload.get("email") or "").lower()
    text = f"{payload.get('name', '')} {payload.get('title', '')} {payload.get('bio', '')} {payload.get('description', '')}".lower()
    domain = email.split("@")[-1] if "@" in email else ""
    score = 0.0
    reasons = []
    if domain in DISPOSABLE_DOMAINS:
        score += 0.35
        reasons.append("Disposable email domain detected.")
    if any(term in text for term in SPAM_TERMS):
        score += 0.35
        reasons.append("Spam-like wording found in profile or opportunity text.")
    if len(re.findall(r"https?://", text)) > 2:
        score += 0.15
        reasons.append("Too many links in a short text block.")
    if len(text.strip()) < 20:
        score += 0.1
        reasons.append("Profile or opportunity text is too sparse.")
    return {"fraudScore": round(min(score, 1.0), 3), "reasons": reasons or ["No strong fraud signals detected."]}
