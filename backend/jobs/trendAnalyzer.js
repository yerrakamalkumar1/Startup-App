const aiService = require("../services/aiService");

async function runTrendAnalyzer({ cache = new Map() } = {}) {
  const data = await aiService.marketTrends();
  cache.set("market-trends", {
    data,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  return cache.get("market-trends");
}

module.exports = { runTrendAnalyzer };
