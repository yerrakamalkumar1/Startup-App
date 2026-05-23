self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Connect Hub", {
    body: payload.body || "You have a new Connect Hub update.",
    icon: "assets/logo.png",
    badge: "assets/logo.png",
    data: { url: payload.url || "/" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});

