from typing import Any, Dict, List


def score_startup_risk(startup: Dict[str, Any]) -> Dict[str, Any]:
    completeness = float(startup.get("profileScore") or startup.get("profileCompleteness") or 55)
    funding_goal = _money_to_number(startup.get("fundingGoal") or startup.get("target") or startup.get("ask") or 0)
    activity = float(startup.get("activityScore") or startup.get("engagementScore") or 45)
    sector = str(startup.get("sector") or "").lower()
    sector_heat = 72 if any(word in sector for word in ["saas", "technology", "health", "commerce"]) else 55
    funding_penalty = 18 if funding_goal > 10_000_000 else 8 if funding_goal > 3_000_000 else 0
    risk = 100 - (completeness * 0.35 + activity * 0.25 + sector_heat * 0.25) + funding_penalty
    risk = max(5, min(95, round(risk, 1)))
    return {
        "riskScore": risk,
        "riskLevel": "low" if risk < 30 else "medium" if risk <= 60 else "high",
        "reasons": [
            f"Profile completeness contributes {round(completeness)} points of confidence.",
            f"Sector heat is estimated at {sector_heat}/100.",
            "Funding ask looks reasonable." if funding_penalty == 0 else "Funding ask needs stronger traction proof.",
        ],
    }


def portfolio_risk(startups: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not startups:
        return {
            "diversificationScore": 0,
            "overallRiskScore": 0,
            "recommendation": "Select startups to analyze portfolio balance.",
            "matrix": [],
        }
    risks = [score_startup_risk(item)["riskScore"] for item in startups]
    sectors = [str(item.get("sector") or "Unknown") for item in startups]
    unique_sectors = len(set(sectors))
    diversification = min(100, round((unique_sectors / max(1, len(startups))) * 100))
    overall = round(sum(risks) / len(risks), 1)
    matrix = [
        [1.0 if left == right else 0.65 if sectors[left] == sectors[right] else 0.25 for right in range(len(startups))]
        for left in range(len(startups))
    ]
    return {
        "diversificationScore": diversification,
        "overallRiskScore": overall,
        "recommendation": "Portfolio is balanced across sectors." if diversification > 65 else "Add a startup from a different sector to reduce correlated risk.",
        "matrix": matrix,
    }


def _money_to_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").lower().replace(",", "")
    digits = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    amount = float(digits or 0)
    if "crore" in text:
        amount *= 10_000_000
    elif "lakh" in text:
        amount *= 100_000
    return amount
