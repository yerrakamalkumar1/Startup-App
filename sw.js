const CACHE_NAME = "connecthub-v4";
const APP_SHELL = [
  "index.html",
  "index.css",
  "config.js",
  "app-ui.js",
  "db.js",
  "ai-bot.js",
  "dashboard-startup.html",
  "dashboard-freelancer.html",
  "dashboard-investor.html",
  "manifest.json",
  "assets/logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
