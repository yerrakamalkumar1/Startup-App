const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

function setLocation(userId, location) {
  const key = String(userId || "anonymous");
  const value = { ...location, expiresAt: Date.now() + TTL_MS };
  cache.set(key, value);
  return value;
}

function indianCityFromCoords(lat, lng) {
  const points = [
    { city: "Hyderabad", region: "Telangana", lat: 17.385, lng: 78.4867 },
    { city: "Bangalore", region: "Karnataka", lat: 12.9716, lng: 77.5946 },
    { city: "Mumbai", region: "Maharashtra", lat: 19.076, lng: 72.8777 },
    { city: "Delhi NCR", region: "Delhi", lat: 28.6139, lng: 77.209 },
    { city: "Chennai", region: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
    { city: "Pune", region: "Maharashtra", lat: 18.5204, lng: 73.8567 }
  ];
  const nLat = Number(lat);
  const nLng = Number(lng);
  const nearest = points
    .map(point => ({ ...point, score: Math.hypot(point.lat - nLat, point.lng - nLng) }))
    .sort((a, b) => a.score - b.score)[0];
  return nearest && nearest.score < 4 ? nearest : { city: "Hyderabad", region: "Telangana" };
}

function getLocation(userId) {
  const value = cache.get(String(userId || "anonymous"));
  if (!value || Date.now() > value.expiresAt) return null;
  return value;
}

async function resolveLocation({ userId, lat, lng, city, region, ip }) {
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    const detected = indianCityFromCoords(lat, lng);
    return setLocation(userId, {
      lat: Number(lat),
      lng: Number(lng),
      city: city || detected.city,
      region: region || detected.region,
      source: "gps"
    });
  }
  const cached = getLocation(userId);
  if (cached) return cached;
  const fallback = await ipLocation(ip);
  return setLocation(userId, fallback);
}

async function ipLocation(ip) {
  try {
    const response = await fetch("http://ip-api.com/json/");
    const data = await response.json();
    if (data && data.status !== "fail" && String(data.countryCode || "").toUpperCase() === "IN") {
      return {
        lat: Number(data.lat) || 17.385,
        lng: Number(data.lon) || 78.4867,
        city: data.city || "Hyderabad",
        region: data.regionName || "Telangana",
        source: "ip"
      };
    }
  } catch {}
  return { lat: 17.385, lng: 78.4867, city: "Hyderabad", region: "Telangana", source: "india-fallback" };
}

module.exports = { resolveLocation, getLocation, setLocation };
