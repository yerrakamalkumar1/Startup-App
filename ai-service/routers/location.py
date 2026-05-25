from typing import Dict

from fastapi import APIRouter

router = APIRouter()


@router.post("/locate")
def locate(payload: Dict[str, object]):
    lat = float(payload.get("lat") or 17.385)
    lng = float(payload.get("lng") or 78.4867)
    return {
        "lat": lat,
        "lng": lng,
        "city": payload.get("city") or "Hyderabad",
        "region": payload.get("region") or "Telangana",
        "source": "gps" if payload.get("lat") and payload.get("lng") else "fallback",
        "ttlSeconds": 1800,
    }
