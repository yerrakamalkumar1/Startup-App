const aiService = require("../services/aiService");

async function runChurnDetection({ users = [], notify = async () => {} } = {}) {
  const results = [];
  for (const user of users) {
    const behavior = user.behavior || {
      loginFrequency: user.loginFrequency || 0,
      profileViewsReceived: user.profileViewsReceived || 0,
      connectionsMade: user.connectionsMade || 0,
      opportunitiesViewed: user.opportunitiesViewed || 0,
      daysSinceLastActive: user.daysSinceLastActive || 0
    };
    const prediction = await aiService.predictChurn(behavior);
    const result = { userId: user.id || user.email || user.name, ...prediction };
    results.push(result);
    if (prediction.atRisk) {
      await notify(user, {
        subject: "You have new ConnectHub matches this week",
        text: "Open ConnectHub to review new matches, profile views, and role-based suggestions."
      });
    }
  }
  return results;
}

module.exports = { runChurnDetection };
