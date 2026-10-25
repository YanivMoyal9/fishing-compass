// מצפן הדייג — עבודה גם בלי רשת: קבצי האפליקציה מהמטמון, התחזית מהרשת (ואם אין — מהמטמון).
const VERSION = "1.3.0";
const CACHE = `fishing-compass-${VERSION}`;
const SHELL = ["./", "index.html", "styles.css?v=4", "fixes.css?v=24", "compass.css?v=3", "vendor/suncalc.js", "data/species.js?v=4", "data/beaches.js?v=3",
  "engine.js?v=2", "forecast.js?v=2", "script.js?v=17", "bubbles.js?v=3", "compass.js?v=5", "manifest.webmanifest?v=4"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const live = u.hostname.includes("open-meteo.com") || u.pathname.endsWith("/data/sg.json") || u.pathname.endsWith("/data/official.json");
  if (live) { // network first
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
  } else if (u.origin === location.origin) { // cache first
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
  }
});
