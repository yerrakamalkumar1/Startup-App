function textFor(item = {}) {
  return [
    item.name,
    item.title,
    item.role,
    item.sector,
    item.companyName,
    item.city,
    item.state,
    item.bio,
    item.description,
    ...(item.skills || []),
    ...(item.tags || [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function tokenSet(text) {
  return new Set(String(text || "").match(/[a-z0-9+#.-]+/gi)?.map(token => token.toLowerCase()) || []);
}

function similarity(a, b) {
  const left = tokenSet(textFor(a));
  const right = tokenSet(textFor(b));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter(token => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function locationScore(a, b) {
  if (a.city && b.city && String(a.city).toLowerCase() === String(b.city).toLowerCase()) return 1;
  if (a.state && b.state && String(a.state).toLowerCase() === String(b.state).toLowerCase()) return 0.5;
  return 0;
}

function reasonFor(a, b, score) {
  const reasons = [];
  if (score > 0.25) reasons.push("Skills and profile text overlap with the requirement.");
  if (locationScore(a, b)) reasons.push("Location signal is relevant.");
  if (b.profileScore >= 70) reasons.push("Profile completeness is strong.");
  if (!reasons.length) reasons.push("Profile has enough marketplace context for a starter match.");
  while (reasons.length < 3) reasons.push("Sector and activity signals may fit the search intent.");
  return reasons.slice(0, 3);
}

function localMatchFreelancers(startup, freelancers = []) {
  return freelancers.map(freelancer => {
    const base = similarity(startup, freelancer);
    const loc = locationScore(startup, freelancer);
    const complete = Math.min(Number(freelancer.profileScore || 50) / 100, 1);
    const score = Math.round(((base * 0.65) + (loc * 0.15) + (complete * 0.2)) * 100);
    return {
      userId: freelancer.id || freelancer.email || freelancer.name,
      name: freelancer.name,
      score,
      reasons: reasonFor(startup, freelancer, base)
    };
  }).sort((a, b) => b.score - a.score).slice(0, 10);
}

function localMatchStartups(investor, startups = []) {
  return startups.map(startup => {
    const base = similarity(investor, startup);
    const complete = Math.min(Number(startup.profileScore || 55) / 100, 1);
    const traction = Math.min(Number((startup.views || [40]).slice(-1)[0] || 40) / 160, 1);
    const score = Math.round(((base * 0.58) + (complete * 0.22) + (traction * 0.2)) * 100);
    return {
      startupId: startup.id || startup.name,
      name: startup.name,
      score,
      reasons: reasonFor(investor, startup, base)
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5);
}

module.exports = { localMatchFreelancers, localMatchStartups };
