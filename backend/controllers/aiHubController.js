const aiService = require("../services/aiService");
const locationService = require("../services/locationService");

function profilesFromDb(db = {}) {
  return [
    ...(db.registeredProfiles || []),
    ...(db.demoProfiles || []),
    ...(db.startups || []).map(startup => ({
      ...startup,
      role: "startup",
      title: startup.description,
      companyName: startup.name,
      city: startup.city || "Hyderabad",
      skills: [startup.sector, ...(startup.tags || [])]
    }))
  ];
}

function currentUser(auth = {}, body = {}) {
  auth = auth || {};
  body = body || {};
  return {
    id: auth.email || auth.name || body.userId || "guest",
    name: auth.name || body.name || "ConnectHub member",
    role: normalizeRole(auth.role || body.role || "freelancer"),
    city: auth.city || body.city || "Hyderabad",
    sector: auth.sector || body.sector || "",
    skills: auth.skills || body.skills || []
  };
}

async function updateLocation(body, context) {
  const user = currentUser(context.auth, body);
  const location = await locationService.resolveLocation({
    userId: user.id,
    lat: body.lat,
    lng: body.lng,
    city: body.city,
    region: body.region,
    ip: context.req?.socket?.remoteAddress
  });
  return { success: true, location, badge: location.source === "gps" ? "GPS location enabled" : "Using city-level location" };
}

async function semanticSearch(body, context) {
  const db = context.publicDB();
  const user = currentUser(context.auth, body);
  const location = locationService.getLocation(user.id) || { lat: body.lat || body.user_lat || 17.385, lng: body.lng || body.user_lng || 78.4867, city: body.city || user.city };
  const data = await aiService.semanticSearch({
    query: body.query || "",
    user_role: user.role,
    role: user.role,
    user_lat: location.lat,
    user_lng: location.lng,
    city: location.city || user.city,
    user_skills: user.skills,
    user_sector: user.sector,
    filters: body.filters || {},
    profiles: profilesFromDb(db)
  });
  return { success: true, ...data };
}

async function getNearbyOpportunities(body, context) {
  const db = context.publicDB();
  const user = currentUser(context.auth, body);
  const location = locationService.getLocation(user.id) || { lat: Number(body.lat || 17.385), lng: Number(body.lng || 78.4867), city: body.city || user.city };
  const data = await aiService.nearbyOpportunities({
    lat: location.lat,
    lng: location.lng,
    city: location.city,
    radius_km: Number(body.radius_km || body.radiusKm || 10),
    user_skills: user.skills,
    user_sector: user.sector || body.sector || "SaaS & Technology",
    profiles: profilesFromDb(db)
  });
  return { success: true, ...data };
}

async function getSkillDemand(body, context) {
  const db = context.publicDB();
  const user = currentUser(context.auth, body);
  const skills = body.skills || user.skills || collectSkills(db);
  const data = await aiService.skillDemand({ skills: skills.length ? skills : collectSkills(db), city: body.city || user.city });
  return { success: true, ...data };
}

async function getAIFeed(body, context) {
  const user = currentUser(context.auth, body);
  const item = await aiService.aiFeedItem({ role: user.role, city: user.city, skills: user.skills });
  return { success: true, items: [item] };
}

async function getMarketIntel(body, context) {
  const data = await aiService.marketIntel({ sector: body.sector || context.auth?.sector || "SaaS & Technology" });
  return { success: true, ...data };
}

async function getCompetitorRadar(body) {
  const data = await aiService.competitorRadar(body);
  return { success: true, ...data };
}

async function getEcosystemMap(body) {
  const data = await aiService.nearbyOpportunities({ ...body, user_sector: "startup ecosystem" });
  return { success: true, ...data };
}

async function getGrowthSuggestions(body, context) {
  const data = await aiService.growthSuggestions({ ...body, sector: body.sector || context.auth?.sector || "SaaS & Technology" });
  return { success: true, ...data };
}

async function getDealFlow(body, context) {
  const db = context.publicDB();
  const data = await aiService.dealFlow({ ...body, profiles: profilesFromDb(db), query: body.query || "seed stage startups" });
  return { success: true, ...data };
}

async function getSectorIntel(body) {
  const data = await aiService.sectorIntel(body);
  return { success: true, ...data };
}

async function getDealNews(body) {
  const data = await aiService.dealNews(body);
  return { success: true, ...data };
}

async function analyzePortfolioRisk(body) {
  const data = await aiService.portfolioRisk(body);
  return { success: true, ...data };
}

async function getGeoInvestmentMap() {
  const data = await aiService.geoMapData();
  return { success: true, ...data };
}

async function getAIRateEstimate(body) {
  const data = await aiService.rateEstimate(body);
  return { success: true, ...data };
}

async function chatbotMessage(body, context) {
  const user = currentUser(context.auth, body);
  const data = await aiService.chatbot({ ...body, user });
  return { success: true, ...data };
}

async function getNotifications(body, context) {
  const db = context.publicDB();
  const user = currentUser(context.auth, body);
  const rows = (db.notifications || [])
    .filter(item => !item.to || item.to === user.name || item.to === user.id || item.to === context.auth?.email)
    .slice(-10)
    .reverse()
    .map(item => ({
      id: item.id,
      type: item.type || "aihub",
      text: item.text || "AI Hub update",
      icon: item.icon || "sparkles",
      read: Boolean(item.read),
      createdAt: item.createdAt || new Date().toISOString(),
      cta: item.cta || "/dashboard/aihub"
    }));
  if (!rows.length) {
    rows.push({
      id: "aihub-welcome",
      type: "aihub",
      text: "AI Hub is ready with nearby opportunities and market insights.",
      icon: "sparkles",
      read: false,
      createdAt: new Date().toISOString(),
      cta: "/dashboard/aihub"
    });
  }
  return { success: true, notifications: rows, unread: rows.filter(item => !item.read).length };
}

function collectSkills(db = {}) {
  const source = [...(db.jobs || []), ...(db.freelancerAds || [])];
  const skills = source.flatMap(item => item.tags || item.skills || []);
  return [...new Set(skills)].slice(0, 10);
}

function normalizeRole(role = "") {
  const value = String(role).toLowerCase();
  if (value.includes("startup")) return "startup";
  if (value.includes("investor") || value.includes("sponsor")) return "investor";
  return "freelancer";
}

module.exports = {
  updateLocation,
  semanticSearch,
  getNearbyOpportunities,
  getSkillDemand,
  getAIFeed,
  getMarketIntel,
  getCompetitorRadar,
  getEcosystemMap,
  getGrowthSuggestions,
  getDealFlow,
  getSectorIntel,
  getDealNews,
  analyzePortfolioRisk,
  getGeoInvestmentMap,
  getAIRateEstimate,
  chatbotMessage,
  getNotifications
};
