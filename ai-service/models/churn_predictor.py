from typing import Dict


def predict_churn(behavior: Dict) -> Dict:
    login_frequency = float(behavior.get("loginFrequency", 0))
    profile_views = float(behavior.get("profileViewsReceived", 0))
    connections = float(behavior.get("connectionsMade", 0))
    opportunities = float(behavior.get("opportunitiesViewed", 0))
    inactivity_days = float(behavior.get("daysSinceLastActive", 0))

    risk = 0.18
    risk += min(inactivity_days / 14, 1) * 0.42
    risk -= min(login_frequency / 7, 1) * 0.16
    risk -= min(profile_views / 10, 1) * 0.09
    risk -= min(connections / 5, 1) * 0.08
    risk -= min(opportunities / 8, 1) * 0.07
    risk = max(0.02, min(0.98, risk))
    return {"churnProbability": round(risk, 3), "atRisk": risk > 0.7}
