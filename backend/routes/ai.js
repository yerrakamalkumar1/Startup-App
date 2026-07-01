const aiService = require("../services/aiService");
const hfService = require("../services/hfService");

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
  if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + WINDOW_MS; }
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count > MAX_REQUESTS;
}

function profilesFromDb(db) {
  return [...(db.registeredProfiles || []), ...(db.demoProfiles || [])];
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
  const freelancers = profiles.filter(p => p.role === "freelancer");
  const startupsList = startupsFromDb(db);

  // Health
  if (route === "/api/ai/health" && req.method === "GET") {
    sendJson(res, 200, {
      success: true,
      hfAvailable: hfService.HF_AVAILABLE,
      hfChat: !!hfService.HF_AVAILABLE,
      aiService: true,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      ollama: !!process.env.OLLAMA_BASE_URL,
      timestamp: new Date().toISOString()
    });
    return true;
  }

  // HuggingFace Chat
  if (route === "/api/ai/chat" && req.method === "POST") {
    const reply = await hfService.hfChat(body.message || "", body.systemPrompt);
    sendJson(res, 200, {
      success: true,
      reply: reply || "I'm here to help you find opportunities on ConnectHub. Try describing your skills or goals!",
      model: reply ? "Qwen2.5-1.5B-Instruct" : "fallback",
      hfUsed: !!reply
    });
    return true;
  }

  // Sentiment
  if (route === "/api/ai/sentiment" && req.method === "POST") {
    const result = await hfService.hfSentiment(body.text || "");
    sendJson(res, 200, { success: true, sentiment: result || { label: "NEUTRAL", score: 0.5 }, hfUsed: !!result });
    return true;
  }

  // Content moderation
  if (route === "/api/ai/moderate" && req.method === "POST") {
    const result = await hfService.hfToxicity(body.text || "");
    sendJson(res, 200, { success: true, moderation: result || { label: "safe", score: 0, isToxic: false }, hfUsed: !!result });
    return true;
  }

  // Classify sector
  if (route === "/api/ai/classify" && req.method === "POST") {
    const sectors = body.labels || ["fintech","healthtech","edtech","ecommerce","cleantech","agritech","logistics","saas","biotech","legaltech","proptech","manufacturing","consumer"];
    const result = await hfService.hfClassify(body.text || "", sectors);
    sendJson(res, 200, { success: true, classification: result || sectors.map((l, i) => ({ label: l, score: parseFloat((1 / sectors.length).toFixed(3)) })), hfUsed: !!result });
    return true;
  }

  // Embed
  if (route === "/api/ai/embed" && req.method === "POST") {
    const text = body.text || "";
    const hfEmb = await hfService.hfEmbed(text);
    if (hfEmb) {
      sendJson(res, 200, { success: true, embedding: hfEmb, dims: hfEmb.length, hfUsed: true });
    } else {
      const fallback = await aiService.embed(text);
      sendJson(res, 200, { success: true, ...fallback, hfUsed: false });
    }
    return true;
  }

  // Original AI service routes
  if (route === "/api/ai/match-freelancers" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.matchFreelancers(body.startup || auth || {}, body.freelancers || freelancers)) });
    return true;
  }
  if (route === "/api/ai/match-startups" && req.method === "POST") {
    sendJson(res, 200, { success: true, ...(await aiService.matchStartups(body.investor || auth || {}, body.startups || startupsList)) });
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
