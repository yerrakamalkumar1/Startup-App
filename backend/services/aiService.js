const AI_SERVICE_URL = (process.env.PYTHON_AI_SERVICE_URL || process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 7000);

function fallbackEmbedding(text = "") {
  const dim = 384;
  const vector = Array(dim).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9+#.-]+/g) || ["connecthub"];
  tokens.forEach(token => {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) hash = ((hash << 5) - hash + token.charCodeAt(index)) | 0;
    vector[Math.abs(hash) % dim] += hash % 2 === 0 ? 1 : -1;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => Number((value / norm).toFixed(6)));
}

async function requestAi(path, payload, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: payload ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `AI service ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function profileText(profile = {}) {
  return [profile.name, profile.title, profile.role, profile.city, profile.sector, profile.companyName, ...(profile.skills || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function localSearch({ query = "", profiles = [], role = "", lat = 17.385, lng = 78.4867 }) {
  const q = String(query).toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const rows = (profiles.length ? profiles : defaultProfiles()).map(profile => {
    const text = profileText(profile);
    const tokenHits = tokens.filter(token => text.includes(token)).length;
    const exact = text.includes(q) ? 30 : 0;
    const roleBoost = role && String(profile.role || "").includes(role) ? 10 : 0;
    const score = Math.min(98, 58 + tokenHits * 12 + exact + roleBoost);
    return {
      source: "ConnectHub",
      title: profile.name || profile.companyName || "ConnectHub profile",
      description: profile.title || profile.sector || "Profile on ConnectHub",
      role: profile.role,
      city: profile.city || profile.location || "India",
      sector: profile.sector,
      matchPercent: score,
      distanceKm: profile.lat && profile.lng ? distanceKm(lat, lng, profile.lat, profile.lng) : null,
      url: `/profile/${profile.handle || profile.id || slug(profile.name || profile.companyName || "profile")}`,
      why: "Matched by local ConnectHub profile text, role, skill, city, and sector signals."
    };
  });
  return rows.sort((a, b) => b.matchPercent - a.matchPercent).slice(0, 8);
}

function defaultProfiles() {
  return [
    { id: "kamal", name: "Kamal Kumar", role: "freelancer", title: "Photographer and Editor", city: "Hyderabad", sector: "Media & Entertainment", skills: ["photography", "video editing", "reels"], lat: 17.385, lng: 78.4867 },
    { id: "nexalocal", name: "NexaLocal Commerce", role: "startup", title: "Local commerce startup", city: "Hyderabad", sector: "Commerce & Retail", skills: ["branding", "operations"], lat: 17.42, lng: 78.45 },
    { id: "india-venture", name: "India Venture Fund", role: "investor", title: "Seed investor", city: "Bangalore", sector: "SaaS & Technology", skills: ["seed", "fintech"] }
  ];
}

function slug(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "profile";
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = value => Number(value) * Math.PI / 180;
  const dlat = toRad(lat2 - lat1);
  const dlng = toRad(lng2 - lng1);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

async function embed(text) {
  try {
    return await requestAi("/embed", { text });
  } catch {
    return { embedding: fallbackEmbedding(text), dims: 384, fallback: true };
  }
}

async function semanticSearch(payload) {
  try {
    return await requestAi("/search", payload);
  } catch {
    return {
      summary: "AI service is temporarily unavailable, so ConnectHub used local profile matching.",
      intent: "general",
      sources_used: ["ConnectHub local data"],
      results: localSearch(payload),
      fallback: true
    };
  }
}

async function nearbyOpportunities(payload) {
  try {
    return await requestAi("/nearby-opportunities", payload);
  } catch {
    return { results: localNearbyBusinesses(payload), userCity: detectCity(payload.lat, payload.lng, payload.city), count: localNearbyBusinesses(payload).length, fallback: true };
  }
}

function detectCity(lat, lng, city = "") {
  const label = String(city || "").toLowerCase();
  const nlat = Number(lat || 0);
  const nlng = Number(lng || 0);
  if (label.includes("hyderabad") || (Math.abs(nlat - 17.385) < 0.7 && Math.abs(nlng - 78.4867) < 0.9)) return "Hyderabad";
  if (label.includes("bangalore") || label.includes("bengaluru") || (Math.abs(nlat - 12.9716) < 0.7 && Math.abs(nlng - 77.5946) < 0.9)) return "Bangalore";
  if (label.includes("mumbai") || (Math.abs(nlat - 19.076) < 0.7 && Math.abs(nlng - 72.8777) < 0.9)) return "Mumbai";
  if (label.includes("delhi") || label.includes("ncr") || (Math.abs(nlat - 28.6139) < 0.8 && Math.abs(nlng - 77.209) < 1)) return "Delhi NCR";
  return city || "Your City";
}

function localNearbyBusinesses(payload = {}) {
  const lat = Number(payload.lat || 17.385);
  const lng = Number(payload.lng || 78.4867);
  const city = detectCity(lat, lng, payload.city);
  const cityRows = {
    Hyderabad: [
      ["Zomato Partner Kitchen", "FoodTech", "Cloud kitchen, hiring delivery ops", 0.006, 0.004, "Growth"],
      ["InMobi Regional Office", "SaaS", "Mobile ad-tech, Seed funded", 0.011, -0.006, "Seed"],
      ["PayU India", "FinTech", "Fintech payments, Series B", -0.015, 0.01, "Series B"],
      ["HealthKart Hub", "HealthTech", "Health supplements, hiring marketing", 0.01, 0.012, "Hiring"],
      ["UrbanCompany Hyderabad", "Consumer", "Home services platform, expanding", -0.004, -0.006, "Growth"],
      ["Swiggy Dark Store", "Logistics", "Quick commerce hub, hiring", 0.02, -0.012, "Hiring"],
      ["GITAM Innovation Center", "EdTech", "EdTech incubator, looking for mentors", -0.018, 0.012, "Incubator"],
      ["T-Hub Startup", "SaaS", "Gov-backed startup hub, 300+ startups", 0.014, 0.015, "Hub"],
      ["Dhruva Space", "Manufacturing", "Space tech startup, Seed stage", -0.026, 0.02, "Seed"],
      ["Mihup.ai", "SaaS", "Conversational AI, hiring ML engineers", 0.022, 0.008, "Hiring"]
    ],
    Bangalore: [
      ["Zepto Dark Store", "Logistics", "Quick commerce, Pre-IPO", 0.005, 0.004, "Pre-IPO"],
      ["Meesho Office", "Consumer", "Social commerce, Series F", 0.014, -0.01, "Series F"],
      ["Cred HQ", "FinTech", "Credit card payments, Series E", -0.012, 0.015, "Series E"],
      ["Unacademy Hub", "EdTech", "Online learning, Series F", 0.01, 0.008, "Series F"],
      ["Bounce Electric", "Logistics", "EV rentals, Seed funded, hiring", -0.008, -0.006, "Seed"],
      ["Groww Office", "FinTech", "Investment app, Series D", 0.02, -0.013, "Series D"],
      ["Navi Technologies", "FinTech", "Insurance + lending, IPO stage", -0.018, 0.02, "IPO"],
      ["Classplus", "EdTech", "Ed platform for tutors, Series D", 0.013, 0.018, "Series D"],
      ["Razorpay Office", "SaaS", "Payment gateway, Series F", -0.016, -0.014, "Series F"],
      ["Darwinbox", "SaaS", "HR tech, Series D, hiring", 0.025, 0.006, "Hiring"]
    ],
    Mumbai: [
      ["Nykaa Office", "Consumer", "Beauty e-commerce, listed", 0.008, 0.006, "Listed"],
      ["Dream11 HQ", "Consumer", "Fantasy sports, Unicorn", -0.017, 0.01, "Unicorn"],
      ["OYO Mumbai", "Property", "Hotel tech, Series G", 0.006, -0.007, "Series G"],
      ["Mamaearth", "Consumer", "D2C personal care, listed", 0.013, 0.012, "Listed"],
      ["Pepperfry Showroom", "Consumer", "Furniture marketplace, Series F", -0.021, 0.015, "Series F"],
      ["Licious Hub", "FoodTech", "Fresh meat delivery, Unicorn", 0.011, -0.011, "Unicorn"],
      ["Rupeek", "FinTech", "Gold loans, Series E", -0.016, -0.006, "Series E"],
      ["Dunzo Hub", "Logistics", "Quick commerce, Series E", 0.004, 0.004, "Series E"],
      ["Sequoia India Office", "Investor", "Top-tier VC, actively investing", -0.024, 0.018, "Investor"],
      ["Nexus Venture Partners", "Investor", "Early stage VC, Seed-Series A", 0.02, -0.017, "Investor"]
    ],
    "Delhi NCR": [
      ["Policybazaar", "FinTech", "Insurance marketplace, listed", 0.011, 0.008, "Listed"],
      ["MakeMyTrip", "Consumer", "Travel platform, NASDAQ listed", -0.018, 0.012, "Listed"],
      ["Zomato NCR", "FoodTech", "Food delivery, listed", 0.007, -0.006, "Listed"],
      ["Info Edge", "SaaS", "Naukri parent, listed", -0.024, 0.018, "Listed"],
      ["Snapdeal Office", "Consumer", "E-commerce, Series G", 0.015, -0.012, "Series G"],
      ["IndiaMart", "SaaS", "B2B marketplace, listed", -0.02, -0.01, "Listed"],
      ["Housing.com", "Property", "PropTech, Series D", 0.009, 0.01, "Series D"],
      ["Delhivery", "Logistics", "Logistics, listed", -0.028, 0.02, "Listed"],
      ["Vedantu", "EdTech", "Online tutoring, Series E", 0.018, -0.018, "Series E"],
      ["Bharatpe", "FinTech", "Merchant payments, Unicorn", -0.014, 0.014, "Unicorn"]
    ]
  };
  const rows = cityRows[city] || Array.from({ length: 10 }, (_, index) => {
    const sectors = ["SaaS", "FinTech", "EdTech", "Consumer", "Logistics", "HealthTech", "Manufacturing"];
    const sector = sectors[index % sectors.length];
    return [`${city} ${sector} Hub ${index + 1}`, sector, `${sector} business near you on ConnectHub`, (index % 5 - 2) * 0.006, (index % 4 - 1) * 0.008, "Local"];
  });
  return rows.map(([name, sector, description, dlat, dlng, stage], index) => {
    const rowLat = lat + dlat;
    const rowLng = lng + dlng;
    return {
      id: slug(name),
      source: "Nearby Business",
      title: name,
      name,
      sector,
      stage,
      description,
      city,
      lat: Number(rowLat.toFixed(6)),
      lng: Number(rowLng.toFixed(6)),
      distanceKm: distanceKm(lat, lng, rowLat, rowLng),
      matchPercent: Math.max(72, 96 - index * 3),
      why: `Nearby ${sector} signal in ${city}, useful for local networking and opportunities.`
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

async function skillDemand(payload) {
  try {
    return await requestAi("/skill-demand", payload);
  } catch {
    const skills = payload.skills || ["video editing", "react", "branding", "sales", "photography"];
    return { skills: skills.map((skill, index) => ({ skill, score: 90 - index * 8, direction: index < 2 ? "rising" : "stable" })), fallback: true };
  }
}

async function aiFeedItem(payload) {
  try {
    return await requestAi("/ai-feed-item", payload);
  } catch {
    return { title: "Fresh ConnectHub signal", body: "Your AI Hub found new market activity related to your role and city.", type: "Insight", fallback: true };
  }
}

async function marketIntel(payload) { return safePost("/market-intel", payload, { news: [], trends: {}, summary: "Market intelligence fallback is active." }); }
async function competitorRadar(payload) { return safePost("/competitor-radar", payload, { competitors: [], analysis: "Add API keys for live competitor intelligence." }); }
async function growthSuggestions(payload) { return safePost("/growth-suggestions", payload, { overall_health_score: 72, top_3_suggestions: [] }); }
async function dealFlow(payload) { return semanticSearch({ ...payload, query: payload.query || "startup investment opportunities" }); }
async function sectorIntel(payload) { return marketIntel(payload); }
async function dealNews(payload) { return marketIntel({ ...payload, sector: "startup funding India" }); }
async function portfolioRisk(payload) { return safePost("/portfolio-risk", payload, { diversificationScore: 0, overallRiskScore: 0, recommendation: "Select startups to analyze." }); }
async function rateEstimate(payload) { return safePost("/rate-estimate", payload, { recommendedLow: 800, recommendedHigh: 1800, reason: "Fallback rate based on ConnectHub local logic." }); }
async function chatbot(payload) { return safePost("/chatbot", payload, { reply: "I can help you find matches, draft messages, and understand AI Hub insights." }); }
async function geoMapData() { return safeGet("/geo-map-data", { states: [] }); }

async function safePost(path, payload, fallback) {
  try {
    return await requestAi(path, payload);
  } catch {
    return { ...fallback, fallback: true };
  }
}

async function safeGet(path, fallback) {
  try {
    return await requestAi(path);
  } catch {
    return { ...fallback, fallback: true };
  }
}

async function matchFreelancers(startup, freelancers) {
  try {
    return await requestAi("/match-freelancers", { startup, freelancers });
  } catch {
    const { localMatchFreelancers } = require("./matchEngine");
    return { matches: localMatchFreelancers(startup, freelancers), fallback: true };
  }
}

async function matchStartups(investor, startups) {
  try {
    return await requestAi("/match-startups", { investor, startups });
  } catch {
    const { localMatchStartups } = require("./matchEngine");
    return { matches: localMatchStartups(investor, startups), fallback: true };
  }
}

async function enhanceProfile(profile) { return safePost("/enhance-profile", profile, { skills: profile.skills || [], profileScore: 60, tips: ["Add skills and city."] }); }
async function scoreFraud(payload) { return safePost("/score-fraud", payload, { fraudScore: 0.05, reasons: ["Fallback low-risk result."] }); }
async function predictChurn(behavior) { return safePost("/predict-churn", behavior, { churnProbability: 0.25, atRisk: false }); }
async function generateAd(payload) { return safePost("/generate-ad", payload, { variants: [], hashtags: ["#ConnectHub"], bestTimeToPost: "7 PM IST" }); }
async function recommendCourses(payload) { return safePost("/recommend-courses", payload, { recommendations: [] }); }
async function marketTrends() { return safeGet("/market-trends", { growingSectors: [], inDemandSkills: [], averageFundingGoals: [], investorActivity: [] }); }

module.exports = {
  embed,
  semanticSearch,
  nearbyOpportunities,
  skillDemand,
  aiFeedItem,
  marketIntel,
  competitorRadar,
  growthSuggestions,
  dealFlow,
  sectorIntel,
  dealNews,
  portfolioRisk,
  rateEstimate,
  chatbot,
  geoMapData,
  matchFreelancers,
  matchStartups,
  enhanceProfile,
  scoreFraud,
  predictChurn,
  generateAd,
  recommendCourses,
  marketTrends
};
