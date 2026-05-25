const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 7000);

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

function fallbackEmbedding(text = "") {
  const dim = 384;
  const vector = Array(dim).fill(0);
  const tokens = String(text).toLowerCase().match(/[a-z0-9+#.-]+/g) || [];
  tokens.forEach(token => {
    let hash = 0;
    for (let index = 0; index < token.length; index++) hash = ((hash << 5) - hash + token.charCodeAt(index)) | 0;
    vector[Math.abs(hash) % dim] += hash % 2 === 0 ? 1 : -1;
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => Number((value / norm).toFixed(6)));
}

async function embed(text) {
  try {
    return await requestAi("/embed", { text });
  } catch {
    return { embedding: fallbackEmbedding(text), fallback: true };
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

async function enhanceProfile(profile) {
  try {
    return await requestAi("/enhance-profile", profile);
  } catch {
    const skills = [...new Set([...(profile.skills || []), ...String(profile.title || "").split(/[,\s/]+/).filter(Boolean)])].slice(0, 8);
    return {
      skills,
      headlineSuggestions: [
        `${profile.title || "Professional"} for Indian startups`,
        `${profile.title || "Professional"} focused on practical growth`,
        `${profile.title || "Professional"} open to trusted collaborations`
      ],
      bio: profile.bio || `${profile.name || "This member"} is building a stronger ConnectHub profile for Indian startup networking, opportunities, and partnerships.`,
      profileScore: Math.min(100, 40 + skills.length * 7 + (profile.bio ? 20 : 0)),
      tips: ["Add city and sector.", "Add proof of work.", "Add at least 3 specific skills."],
      fallback: true
    };
  }
}

async function scoreFraud(payload) {
  try {
    return await requestAi("/score-fraud", payload);
  } catch {
    return { fraudScore: 0.05, reasons: ["AI fraud service unavailable; default low-risk fallback applied."], fallback: true };
  }
}

async function predictChurn(behavior) {
  try {
    return await requestAi("/predict-churn", behavior);
  } catch {
    return { churnProbability: 0.25, atRisk: false, fallback: true };
  }
}

async function generateAd(payload) {
  try {
    return await requestAi("/generate-ad", payload);
  } catch {
    return {
      variants: [
        { headline: `Grow with ${payload.productName}`, body: "A practical offer for Indian startups looking for reliable execution.", cta: "Post this ad" },
        { headline: `${payload.productName} for faster launch`, body: "Clear scope, startup-friendly pricing, and quick delivery.", cta: "Get started" },
        { headline: `Make ${payload.productName} visible`, body: "Reach founders, operators, and business teams on ConnectHub.", cta: "Publish now" }
      ],
      hashtags: ["#IndianStartups", "#StartupIndia", "#ConnectHub"],
      bestTimeToPost: "Tuesday to Thursday, 7:00 PM - 9:00 PM IST",
      fallback: true
    };
  }
}

async function recommendCourses(payload) {
  try {
    return await requestAi("/recommend-courses", payload);
  } catch {
    return {
      recommendations: [
        { title: "NPTEL", url: "https://nptel.ac.in/" },
        { title: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/" },
        { title: "Startup India", url: "https://www.startupindia.gov.in/" }
      ],
      fallback: true
    };
  }
}

async function marketTrends() {
  try {
    return await requestAi("/market-trends");
  } catch {
    return {
      growingSectors: [],
      inDemandSkills: [],
      averageFundingGoals: [],
      investorActivity: [],
      fallback: true
    };
  }
}

module.exports = {
  embed,
  matchFreelancers,
  matchStartups,
  enhanceProfile,
  scoreFraud,
  predictChurn,
  generateAd,
  recommendCourses,
  marketTrends
};
