self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Connect Hub";
  const options = {
    body: data.body || "You have a new update.",
    icon: data.icon || "/assets/logo.png",
    badge: data.badge || "/assets/logo.png",
    data: { url: data.url || "/" },
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windowClients.find(client => new URL(client.url).pathname === targetUrl);
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  })());
});

