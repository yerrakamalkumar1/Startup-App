import os
from typing import Any, Dict, List

import requests


def generate_text(prompt: str, fallback: str, max_tokens: int = 220) -> str:
    openai_key = os.getenv("OPENAI_API_KEY", "")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if openai_key:
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                json={
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.4,
                },
                timeout=12,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            pass
    if anthropic_key:
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest"),
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                },
                timeout=12,
            )
            response.raise_for_status()
            content = response.json().get("content", [])
            return "".join(part.get("text", "") for part in content).strip() or fallback
        except Exception:
            pass
    return fallback


def ad_variants(product: str, audience: str, tone: str) -> Dict[str, Any]:
    return {
        "variants": [
            {"headline": f"{product} for Indian startup growth", "body": f"Built for {audience}, with practical delivery and clear next steps.", "cta": "Connect now"},
            {"headline": f"Launch faster with {product}", "body": f"A {tone} offer for teams that need reliable execution without long cycles.", "cta": "Start a project"},
            {"headline": f"Make {product} visible", "body": "Reach founders, investors, and operators already looking for trusted support.", "cta": "Post this ad"},
        ],
        "hashtags": ["#ConnectHub", "#IndianStartups", "#StartupIndia"],
        "bestTimeToPost": "Tuesday to Thursday, 7 PM to 9 PM IST",
    }


def course_recommendations(skills: List[str], sector: str) -> List[Dict[str, str]]:
    skill_text = " ".join(skills).lower()
    if "video" in skill_text or "photo" in skill_text:
        query = "mobile video editing freelancing India"
    elif "react" in skill_text or "developer" in skill_text:
        query = "react full stack course"
    else:
        query = f"{sector} startup skills"
    return [
        {"title": "NPTEL free learning", "url": "https://nptel.ac.in/"},
        {"title": "freeCodeCamp practical courses", "url": "https://www.freecodecamp.org/learn/"},
        {"title": f"YouTube: {query}", "url": f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"},
    ]
