from typing import Any, Dict, List

from .embedder import cosine_similarity, embed_text


def _profile_text(item: Dict[str, Any]) -> str:
    parts = [
        item.get("name"),
        item.get("title"),
        item.get("role"),
        item.get("sector"),
        item.get("companyName"),
        item.get("city"),
        item.get("state"),
        item.get("bio"),
        " ".join(item.get("skills") or []),
        " ".join(item.get("tags") or []),
        item.get("description"),
    ]
    return " ".join(str(part) for part in parts if part)


def _location_score(source: Dict[str, Any], target: Dict[str, Any]) -> float:
    source_city = str(source.get("city") or "").lower()
    target_city = str(target.get("city") or "").lower()
    source_state = str(source.get("state") or "").lower()
    target_state = str(target.get("state") or "").lower()
    if source_city and source_city == target_city:
        return 1.0
    if source_state and source_state == target_state:
        return 0.55
    return 0.0


def _sector_score(source: Dict[str, Any], target: Dict[str, Any]) -> float:
    source_sector = str(source.get("sector") or source.get("companySector") or "").lower()
    target_sector = str(target.get("sector") or target.get("title") or "").lower()
    if source_sector and source_sector in target_sector:
        return 1.0
    if target_sector and target_sector in source_sector:
        return 1.0
    return 0.0


def _reasons(source: Dict[str, Any], target: Dict[str, Any], similarity: float) -> List[str]:
    reasons = []
    if similarity >= 0.55:
        reasons.append("Profile language is strongly aligned with your requirement.")
    if _sector_score(source, target):
        reasons.append("Sector focus overlaps with your business context.")
    if _location_score(source, target):
        reasons.append("Location signal is close enough for easier collaboration.")
    if target.get("profileScore", 0) >= 70:
        reasons.append("Profile completeness is strong.")
    while len(reasons) < 3:
        reasons.append("Activity and profile details show relevant marketplace intent.")
    return reasons[:3]


def match_freelancers(startup: Dict[str, Any], freelancers: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    source_vector = startup.get("profileVector") or embed_text(_profile_text(startup))
    ranked = []
    for freelancer in freelancers:
        target_vector = freelancer.get("profileVector") or embed_text(_profile_text(freelancer))
        semantic = cosine_similarity(source_vector, target_vector)
        sector = _sector_score(startup, freelancer)
        location = _location_score(startup, freelancer)
        engagement = min(float(freelancer.get("engagementScore") or freelancer.get("profileScore") or 40) / 100, 1)
        score = (semantic * 0.58) + (sector * 0.16) + (location * 0.11) + (engagement * 0.15)
        ranked.append({
            "userId": freelancer.get("id") or freelancer.get("_id") or freelancer.get("email") or freelancer.get("name"),
            "name": freelancer.get("name"),
            "score": round(score * 100),
            "reasons": _reasons(startup, freelancer, semantic),
        })
    return sorted(ranked, key=lambda item: item["score"], reverse=True)[:limit]


def match_startups(investor: Dict[str, Any], startups: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    source_vector = investor.get("profileVector") or embed_text(_profile_text(investor))
    ranked = []
    for startup in startups:
        target_vector = startup.get("profileVector") or embed_text(_profile_text(startup))
        semantic = cosine_similarity(source_vector, target_vector)
        sector = _sector_score(investor, startup)
        completeness = min(float(startup.get("profileScore") or 55) / 100, 1)
        traction = min(float(startup.get("tractionScore") or startup.get("views", [40])[-1] if startup.get("views") else 40) / 160, 1)
        score = (semantic * 0.5) + (sector * 0.18) + (completeness * 0.18) + (traction * 0.14)
        ranked.append({
            "startupId": startup.get("id") or startup.get("_id") or startup.get("name"),
            "name": startup.get("name"),
            "score": round(score * 100),
            "reasons": _reasons(investor, startup, semantic),
        })
    return sorted(ranked, key=lambda item: item["score"], reverse=True)[:limit]
