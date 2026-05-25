const aiHubController = require("../controllers/aiHubController");

const buckets = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 20;

function isLimited(req, auth) {
  const key = auth?.email || auth?.name || req.socket?.remoteAddress || "anonymous";
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

async function handleAiHubApi(req, res, context) {
  const { route, readBody, sendJson, auth } = context;
  if (!route.startsWith("/api/aihub")) return false;
  if (isLimited(req, auth)) {
    sendJson(res, 429, { success: false, message: "AI Hub rate limit reached. Try again in a minute." });
    return true;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
  const ctx = { ...context, req, url };
  const path = route.replace("/api/aihub", "") || "/";

  try {
    if (path === "/locate" && req.method === "POST") return respond(sendJson, res, await aiHubController.updateLocation(body, ctx));
    if (path === "/search" && req.method === "POST") return respond(sendJson, res, await aiHubController.semanticSearch(body, ctx));
    if (path === "/nearby-opportunities" && req.method === "GET") return respond(sendJson, res, await aiHubController.getNearbyOpportunities(body, ctx));
    if (path === "/skill-demand" && req.method === "GET") return respond(sendJson, res, await aiHubController.getSkillDemand(body, ctx));
    if (path === "/feed" && req.method === "GET") return respond(sendJson, res, await aiHubController.getAIFeed(body, ctx));
    if (path === "/market-intel" && req.method === "GET") return respond(sendJson, res, await aiHubController.getMarketIntel(body, ctx));
    if (path === "/competitor-radar" && req.method === "GET") return respond(sendJson, res, await aiHubController.getCompetitorRadar(body, ctx));
    if (path === "/ecosystem-map" && req.method === "GET") return respond(sendJson, res, await aiHubController.getEcosystemMap(body, ctx));
    if (path === "/growth-suggestions" && req.method === "GET") return respond(sendJson, res, await aiHubController.getGrowthSuggestions(body, ctx));
    if (path === "/deal-flow" && req.method === "GET") return respond(sendJson, res, await aiHubController.getDealFlow(body, ctx));
    if (path === "/sector-intel" && req.method === "GET") return respond(sendJson, res, await aiHubController.getSectorIntel(body, ctx));
    if (path === "/deal-news" && req.method === "GET") return respond(sendJson, res, await aiHubController.getDealNews(body, ctx));
    if (path === "/portfolio-risk" && req.method === "POST") return respond(sendJson, res, await aiHubController.analyzePortfolioRisk(body, ctx));
    if (path === "/geo-investment-map" && req.method === "GET") return respond(sendJson, res, await aiHubController.getGeoInvestmentMap(body, ctx));
    if (path === "/rate-estimate" && req.method === "POST") return respond(sendJson, res, await aiHubController.getAIRateEstimate(body, ctx));
    if (path === "/chatbot" && req.method === "POST") return respond(sendJson, res, await aiHubController.chatbotMessage(body, ctx));
    if (path === "/notifications" && req.method === "GET") return respond(sendJson, res, await aiHubController.getNotifications(body, ctx));
    sendJson(res, 404, { success: false, message: "AI Hub route not found." });
    return true;
  } catch (error) {
    sendJson(res, 500, { success: false, message: error.message || "AI Hub failed." });
    return true;
  }
}

function respond(sendJson, res, payload, status = 200) {
  sendJson(res, status, payload);
  return true;
}

module.exports = { handleAiHubApi };
