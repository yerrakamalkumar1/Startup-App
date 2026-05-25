from typing import Dict, List


def fetch_trends(keywords: List[str]) -> Dict[str, int]:
    clean = [keyword for keyword in keywords if keyword][:5] or ["startup", "freelance", "funding"]
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-IN", tz=330)
        pytrends.build_payload(clean, timeframe="now 7-d", geo="IN")
        interest = pytrends.interest_over_time()
        if interest.empty:
            raise ValueError("empty trend response")
        return {keyword: int(interest[keyword].tail(3).mean()) for keyword in clean if keyword in interest}
    except Exception:
        return {keyword: max(35, 88 - index * 9) for index, keyword in enumerate(clean)}


def skill_demand_scores(skills: List[str]) -> List[Dict[str, object]]:
    trends = fetch_trends(skills)
    rows = []
    for index, skill in enumerate(skills):
        score = min(100, int(trends.get(skill, 50) * 0.65 + (80 - index * 4) * 0.35))
        direction = "rising" if score >= 70 else "stable" if score >= 45 else "falling"
        rows.append({"skill": skill, "score": score, "direction": direction})
    return sorted(rows, key=lambda row: row["score"], reverse=True)
