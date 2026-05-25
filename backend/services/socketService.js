const aiService = require("./aiService");

function registerAiHubSocket(io, options = {}) {
  if (!io || io.__connectHubAiHubRegistered) return;
  io.__connectHubAiHubRegistered = true;

  io.on("connection", socket => {
    socket.on("aihub:join", payload => {
      const role = normalizeRole(payload?.role);
      socket.join(role);
      socket.data.aihub = { role, userId: payload?.userId, city: payload?.city || "India", skills: payload?.skills || [] };
      socket.emit("aihub:live", { ok: true, role, message: "AI Hub live stream connected." });
    });
  });

  setInterval(async () => {
    const db = typeof options.publicDB === "function" ? options.publicDB() : {};
    const feed = await aiService.aiFeedItem({ role: "freelancer", city: "India", skills: ["startup"] });
    io.to("freelancer").emit("live_feed_update", { insight: feed, newGigs: db.jobs || [], generatedAt: new Date().toISOString() });
    io.to("startup").emit("live_market_update", { insight: feed, generatedAt: new Date().toISOString() });
    io.to("investor").emit("live_deal_update", { insight: feed, generatedAt: new Date().toISOString() });
  }, 120000).unref?.();
}

function emitNotification(io, userRoom, notification) {
  if (io && userRoom) io.to(String(userRoom)).emit("notification:new", notification);
}

function normalizeRole(role = "") {
  const value = String(role).toLowerCase();
  if (value.includes("startup")) return "startup";
  if (value.includes("investor") || value.includes("sponsor")) return "investor";
  return "freelancer";
}

module.exports = { registerAiHubSocket, emitNotification };
