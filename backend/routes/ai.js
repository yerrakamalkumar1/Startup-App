const aiService = require("../services/aiService");

const buckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

function rateLimitKey(req, auth) {
  return auth?.email || auth?.name || req.socket?.remoteAddress || "anonymous";
}

function isRateLimited(req, auth) {
  const key = rateLimitKey(req, auth);
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > MAX_REQUESTS;
}

function profilesFromDb(db) {
  return [
    ...(db.registeredProfiles || []),
    ...(db.demoProfiles || [])
  ];
}

function startupsFromDb(db) {
  return db.startups || [];
}

async function handleAiApi(req, res, context) {
  const { route, readBody, sendJson, auth, publicDB } = context;
  if (!route.startsWith("/api/ai")) return false;
  if (isRateLimited(req, auth)) {
    sendJson(res, 429, { success: false, message: "AI rate limit reached. Try again in a minute." });
    return true;
  }
  const db = publicDB();
  const body = req.method === "POST" ? await readBody(req) : {};
  const profiles = profilesFromDb(db);
  const freelancers = profiles.filter(profile => profile.role === "freelancer");
  const startups = startupsFromDb(db);

  if (route === "/api/ai/embed" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.embed(body.text || "")) });
    return true;
  }
  if (route === "/api/ai/match-freelancers" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.matchFreelancers(body.startup || auth || {}, body.freelancers || freelancers)) });
    return true;
  }
  if (route === "/api/ai/match-startups" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.matchStartups(body.investor || auth || {}, body.startups || startups)) });
    return true;
  }
  if (route === "/api/ai/enhance-profile" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.enhanceProfile(body.profile || body || {})) });
    return true;
  }
  if (route === "/api/ai/score-fraud" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.scoreFraud(body)) });
    return true;
  }
  if (route === "/api/ai/predict-churn" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.predictChurn(body.behavior || body)) });
    return true;
  }
  if (route === "/api/ai/generate-ad" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.generateAd(body)) });
    return true;
  }
  if (route === "/api/ai/recommend-courses" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.recommendCourses(body)) });
    return true;
  }
  if (route === "/api/ai/market-trends" && req.method === "GET") {
    sendJson(res, 200, { success: true, ...(await aiService.marketTrends()) });
    return true;
  }
  sendJson(res, 404, { success: false, message: "AI route not found." });
  return true;
}

module.exports = { handleAiApi };
