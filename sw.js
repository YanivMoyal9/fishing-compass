// מצפן הדייג — עבודה גם בלי רשת: קבצי האפליקציה מהמטמון, התחזית מהרשת (ואם אין — מהמטמון).
const VERSION = "3.10.0";
const CACHE = `fishing-compass-${VERSION}`;
const SHELL = ["./", "index.html", "tokens.css?v=5", "app.css?v=1", "dashboard.js?v=11", "assets/dashboard-coast.webp", "vendor/suncalc.js", "data/species.js?v=4", "data/species-plus.js?v=2", "data/fish-info.js?v=1", "data/beach-features.js?v=2", "data/seabed.js?v=2", "data/legal.js?v=1", "fish-art.js?v=2", "data/fish-photos.js?v=15", "data/beaches.js?v=4",
  "engine.js?v=14", "forecast.js?v=7", "script.js?v=21", "compass.js?v=45", "manifest.webmanifest?v=6", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "data/zones/hashmal.json?v=3", "assets/fonts/assistant-hebrew.woff2?v=1", "assets/fonts/assistant-latin.woff2?v=1", "assets/fonts/heebo-hebrew.woff2?v=1", "assets/fonts/heebo-latin.woff2?v=1", "data/closed_areas.geojson?v=1", "data/zones/index.json?v=1", "assets/hero-sunset.webp"];
// v3.7: install bypasses the browser's HTTP cache (fresh files right after a deploy); only good responses are cached; daily data files
// are cached under their path without the ?t= query (one entry each, and the offline copy is found); the network gets 8 s before the
// cached copy is used.
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
const DATA = //data/(sg|official|ocean).json$/;
function netFirst(req, key) {
  const fromCache = () => caches.match(key);
  // the stored copy carries x-stored (ms) — a response the service worker builds itself shows all its headers to the page
  const store = r => r.clone().blob().then(b => { const h = new Headers(r.headers); h.set("x-stored", String(Date.now()));
    return caches.open(CACHE).then(c => c.put(key, new Response(b, { status: r.status, statusText: r.statusText, headers: h }))); });
  const net = fetch(req).then(r => { if (r.ok) { store(r); return r; } return fromCache().then(m => m || r); });
  const safeNet = net.catch(() => fromCache().then(m => m || Response.error()));
  const slow = new Promise(ok => setTimeout(ok, 8000)).then(fromCache).then(m => m || safeNet);
  return Promise.race([safeNet, slow]);
}
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const data = u.origin === location.origin && DATA.test(u.pathname);
  if (u.hostname.includes("open-meteo.com") || u.hostname.includes("hebcal.com")) e.respondWith(netFirst(e.request, e.request));
  else if (data) e.respondWith(netFirst(e.request, u.origin + u.pathname));
  else if (u.origin === location.origin) { // cache first
    e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })));
  }
});
