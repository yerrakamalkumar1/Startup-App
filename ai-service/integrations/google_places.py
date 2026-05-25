import math
import os
from typing import Any, Dict, List

import requests


def fetch_places(lat: float, lng: float, query: str = "startup", radius_km: int = 10) -> List[Dict[str, Any]]:
    key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not key:
        return _fallback_places(lat, lng, query)
    try:
        response = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "key": key,
                "location": f"{lat},{lng}",
                "radius": int(radius_km * 1000),
                "keyword": query or "startup",
                "type": "establishment",
            },
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
        places = []
        for item in data.get("results", [])[:10]:
            location = item.get("geometry", {}).get("location", {})
            distance = haversine_km(lat, lng, location.get("lat", lat), location.get("lng", lng))
            places.append(
                {
                    "source": "Nearby Business",
                    "title": item.get("name", "Nearby business"),
                    "description": item.get("vicinity", "Business near your area"),
                    "lat": location.get("lat", lat),
                    "lng": location.get("lng", lng),
                    "distanceKm": round(distance, 1),
                    "rating": item.get("rating"),
                    "matchPercent": max(55, min(94, 90 - int(distance * 4))),
                    "url": f"https://www.google.com/maps/search/?api=1&query={location.get('lat', lat)},{location.get('lng', lng)}",
                }
            )
        return places or _fallback_places(lat, lng, query)
    except Exception:
        return _fallback_places(lat, lng, query)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius = 6371
    dlat = math.radians(float(lat2) - float(lat1))
    dlng = math.radians(float(lng2) - float(lng1))
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlng / 2) ** 2
    return earth_radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fallback_places(lat: float, lng: float, query: str) -> List[Dict[str, Any]]:
    names = [
        f"{query.title() or 'Startup'} Growth Studio",
        "Local Founder Workspace",
        "ConnectHub Business Circle",
    ]
    offsets = [(0.012, 0.009), (-0.018, 0.014), (0.026, -0.018)]
    return [
        {
            "source": "Nearby Business",
            "title": name,
            "description": "Approximate nearby business signal. Add Google Places key for live data.",
            "lat": round(float(lat) + offsets[index][0], 6),
            "lng": round(float(lng) + offsets[index][1], 6),
            "distanceKm": round(1.5 + index * 2.1, 1),
            "rating": 4.2 + index * 0.1,
            "matchPercent": 88 - index * 7,
            "url": "https://www.google.com/maps",
        }
        for index, name in enumerate(names)
    ]
