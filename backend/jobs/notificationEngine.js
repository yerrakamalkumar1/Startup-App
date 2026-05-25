function generateAiHubNotifications(user = {}, signals = {}) {
  const city = user.city || "your city";
  const skill = (user.skills || ["your skill"])[0];
  const now = new Date().toISOString();
  return [
    {
      id: `aihub-${Date.now()}-1`,
      to: user.name || user.email,
      type: "aihub_location",
      icon: "bell",
      text: `New startup activity found near ${city}.`,
      cta: "/dashboard/aihub",
      read: false,
      createdAt: now
    },
    {
      id: `aihub-${Date.now()}-2`,
      to: user.name || user.email,
      type: "aihub_skill",
      icon: "chart",
      text: `${skill} demand is rising in Indian startup searches.`,
      cta: "/dashboard/aihub",
      read: false,
      createdAt: now
    }
  ];
}

async function pushNotificationIfPossible(io, userRoom, notification) {
  if (io && userRoom) io.to(String(userRoom)).emit("notification:new", notification);
  return notification;
}

module.exports = { generateAiHubNotifications, pushNotificationIfPossible };
