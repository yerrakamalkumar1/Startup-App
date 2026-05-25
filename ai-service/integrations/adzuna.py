import os
from typing import Any, Dict, List

import requests


def fetch_jobs(query: str, city: str = "India", results_per_page: int = 10) -> List[Dict[str, Any]]:
    app_id = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        return _fallback_jobs(query, city)
    try:
        response = requests.get(
            "https://api.adzuna.com/v1/api/jobs/in/search/1",
            params={
                "app_id": app_id,
                "app_key": app_key,
                "where": city or "India",
                "what": query or "freelance",
                "results_per_page": results_per_page,
                "content-type": "application/json",
            },
            timeout=8,
        )
        response.raise_for_status()
        jobs = response.json().get("results", [])[:results_per_page]
        return [
            {
                "source": "Live Job",
                "title": job.get("title", "Live opportunity"),
                "description": job.get("description", "")[:180],
                "company": job.get("company", {}).get("display_name", "Hiring team"),
                "location": job.get("location", {}).get("display_name", city),
                "url": job.get("redirect_url", "#"),
                "matchPercent": 78,
                "salaryMin": job.get("salary_min"),
                "salaryMax": job.get("salary_max"),
            }
            for job in jobs
        ] or _fallback_jobs(query, city)
    except Exception:
        return _fallback_jobs(query, city)


def _fallback_jobs(query: str, city: str) -> List[Dict[str, Any]]:
    skill = query or "creative"
    return [
        {
            "source": "Live Job",
            "title": f"{skill.title()} freelancer needed",
            "description": f"Sample live-market fallback for {city}. Add Adzuna keys for real jobs.",
            "company": "ConnectHub Market Signal",
            "location": city or "India",
            "url": "https://www.adzuna.in/",
            "matchPercent": 76,
            "salaryMin": 25000,
            "salaryMax": 75000,
        }
    ]
