const aiService = require("../services/aiService");

async function refreshLiveData(context = {}) {
  const publicDB = typeof context.publicDB === "function" ? context.publicDB() : {};
  const skills = [...new Set([...(publicDB.jobs || []).flatMap(job => job.tags || []), "video editing", "react", "branding"])].slice(0, 10);
  const [skillDemand, marketIntel, feedItem] = await Promise.all([
    aiService.skillDemand({ skills, city: "India" }),
    aiService.marketIntel({ sector: "SaaS & Technology" }),
    aiService.aiFeedItem({ role: "freelancer", city: "India", skills })
  ]);
  return { skillDemand, marketIntel, feedItem, refreshedAt: new Date().toISOString() };
}

function scheduleLiveDataRefresh(context = {}) {
  refreshLiveData(context).catch(() => {});
  const timer = setInterval(() => refreshLiveData(context).catch(() => {}), 5 * 60 * 1000);
  timer.unref?.();
  return timer;
}

module.exports = { refreshLiveData, scheduleLiveDataRefresh };
