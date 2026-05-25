const cache = new Map();
const TTL_MS = 30 * 60 * 1000;

function setLocation(userId, location) {
  const key = String(userId || "anonymous");
  const value = { ...location, expiresAt: Date.now() + TTL_MS };
  cache.set(key, value);
  return value;
}

function getLocation(userId) {
  const value = cache.get(String(userId || "anonymous"));
  if (!value || Date.now() > value.expiresAt) return null;
  return value;
}

async function resolveLocation({ userId, lat, lng, city, region, ip }) {
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return setLocation(userId, {
      lat: Number(lat),
      lng: Number(lng),
      city: city || "Detected location",
      region: region || "",
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
    if (data && data.status !== "fail") {
      return {
        lat: Number(data.lat) || 17.385,
        lng: Number(data.lon) || 78.4867,
        city: data.city || "Hyderabad",
        region: data.regionName || "Telangana",
        source: "ip"
      };
    }
  } catch {}
  return { lat: 17.385, lng: 78.4867, city: "Hyderabad", region: "Telangana", source: ip ? "fallback" : "default" };
}

module.exports = { resolveLocation, getLocation, setLocation };
