from typing import Any, Dict

from fastapi import APIRouter

from integrations.gpt_client import generate_text

router = APIRouter()


@router.post("/chatbot")
def chatbot(payload: Dict[str, Any]):
    user = payload.get("user") or {}
    message = payload.get("message") or ""
    role = user.get("role") or payload.get("role") or "member"
    city = user.get("city") or payload.get("city") or "India"
    fallback = f"For a {role} in {city}, start with one clear action: update your profile, search nearby matches, and send a short personalized message. I can help draft that message or explain your AI Hub results."
    answer = generate_text(
        f"You are ConnectHub AI for Indian startup networking. User role: {role}. City: {city}. User asks: {message}. Keep answer 3-5 practical sentences.",
        fallback,
    )
    return {"reply": answer, "role": role, "city": city}
