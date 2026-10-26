// מצפן הדייג — עבודה גם בלי רשת: קבצי האפליקציה מהמטמון, התחזית מהרשת (ואם אין — מהמטמון).
const VERSION = "2.3.1";
const CACHE = `fishing-compass-${VERSION}`;
const SHELL = ["./", "index.html", "styles.css?v=4", "fixes.css?v=24", "compass.css?v=10", "theme.css?v=7", "coastal.css?v=2", "vendor/suncalc.js", "data/species.js?v=4", "data/fish-info.js?v=1", "data/beach-features.js?v=1", "fish-art.js?v=2", "data/fish-photos.js?v=15", "data/beaches.js?v=3",
  "engine.js?v=3", "forecast.js?v=3", "script.js?v=20", "compass.js?v=21", "manifest.webmanifest?v=5", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "data/zones/hashmal.json?v=3", "assets/shore-hero-spinning.webp", "assets/hero-sunset.webp"];
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
