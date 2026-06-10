const CACHE_NAME = "connecthub-v54-admin-location";
const APP_SHELL = [
  "index.html",
  "index.css",
  "config.js",
  "app-ui.js",
  "db.js",
  "firebase-chat.js",
  "supabase-sync.js",
  "ai-bot.js",
  "push-sw.js",
  "dashboard-startup.html",
  "dashboard-freelancer.html",
  "dashboard-investor.html",
  "frontend/aihub/aihub.html",
  "frontend/aihub/aihub.css",
  "frontend/aihub/aihub.js",
  "frontend/aihub/freelancer-hub.js",
  "frontend/aihub/startup-hub.js",
  "frontend/aihub/investor-hub.js",
  "frontend/aihub/chatbot.js",
  "frontend/aihub/notifications.js",
  "profile.html",
  "admin.html",
  "manifest.json",
  "assets/logo.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(event.request))
  );
});
