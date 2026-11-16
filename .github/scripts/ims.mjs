// מצפן הדייג — מדידות חיות של השירות המטאורולוגי (v3.11).
// Reads the public IMS last-hour file (10-minute readings, no token) and writes a small ims.json with the coastal and Kinneret
// stations only. Runs in GitHub Actions every 20 minutes (.github/workflows/ims.yml), which force-pushes the file to the data-ims
// branch; the app reads it from raw.githubusercontent.com (CORS allowed). The file is display and safety data only: it never
// enters the activity index. Station coordinates: data.gov.il "תחנות מטאורולוגיות" (ims_stat.csv), matched by English name.
// Usage: node ims.mjs <out-dir>   (exit 0 always; a failed fetch writes nothing, so the branch keeps the last good file)
import fs from "node:fs";
import path from "node:path";

const URL = "https://ims.gov.il/sites/default/files/ims_data/xml_files/imslasthour.xml";
const STATIONS = {
  "ROSH HANIQRA": { he: "ראש הנקרה", lat: 33.0808, lon: 35.1079, water: "med" },
  "HAIFA REFINERIES": { he: "חיפה בז״ן", lat: 32.8034, lon: 35.0548, water: "med" },
  "EN KARMEL": { he: "עין כרמל", lat: 32.6808, lon: 34.9594, water: "med" },
  "HADERA PORT": { he: "נמל חדרה", lat: 32.4732, lon: 34.8815, water: "med" },
  "TEL AVIV COAST": { he: "תל אביב חוף", lat: 32.058, lon: 34.7588, water: "med" },
  "ASHDOD PORT": { he: "נמל אשדוד", lat: 31.8342, lon: 34.6377, water: "med" },
  "ASHQELON PORT": { he: "נמל אשקלון", lat: 31.6394, lon: 34.5215, water: "med" },
  "ELAT": { he: "אילת", lat: 29.5526, lon: 34.952, water: "eilat" },
  "KEFAR NAHUM": { he: "כפר נחום", lat: 32.8835, lon: 35.5792, water: "lake" },
  "BET ZAYDA": { he: "בית ציידא", lat: 32.88, lon: 35.6504, water: "lake" },
  "ZEMAH": { he: "צמח", lat: 32.7024, lon: 35.5839, water: "lake" }
};
const out = process.argv[2] || ".";
const n = v => (v == null || v === "" || !Number.isFinite(+v) ? null : +v);
const kmh = v => (n(v) == null ? null : Math.round(+v * 36) / 10); // m/s → km/h, one decimal
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return m ? m[1].trim() : null; };
// time_obs is Israel local time without a zone: find the UTC instant whose Asia/Jerusalem wall clock matches it
function ilToIso(local) {
  const guess = Date.parse(local + "Z");
  for (const off of [2, 3]) {
    const t = guess - off * 36e5;
    const wall = new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" }).replace(" ", "T");
    if (wall.slice(0, 16) === local.slice(0, 16)) return new Date(t).toISOString();
  }
  return new Date(guess - 2 * 36e5).toISOString();
}

try {
  const res = await fetch(URL + "?t=" + Date.now(), { headers: { "User-Agent": "Mozilla/5.0 (fishing-compass; IMS last-hour reader)" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const xml = await res.text();
  const stations = {};
  for (const m of xml.matchAll(/<Observation>([\s\S]*?)<\/Observation>/g)) {
    const o = m[1], name = tag(o, "stn_name"), st = STATIONS[name];
    if (!st) continue;
    const t = tag(o, "time_obs"); if (!t) continue;
    (stations[name] ||= { ...st, obs: [] }).obs.push({
      t: ilToIso(t), wind: kmh(tag(o, "WS")), gust: kmh(tag(o, "WSmax")), dir: n(tag(o, "WD")),
      air: n(tag(o, "TD")), rh: n(tag(o, "RH")), rain: n(tag(o, "Rain")), p: n(tag(o, "BP"))
    });
  }
  for (const s of Object.values(stations)) s.obs.sort((a, b) => a.t.localeCompare(b.t));
  const count = Object.keys(stations).length;
  if (!count) throw new Error("no matching stations in the file");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "ims.json"), JSON.stringify({
    generated: new Date().toISOString(), source: "השירות המטאורולוגי — מדידות 10 דקות (imslasthour.xml)", modified: res.headers.get("last-modified"), stations
  }));
  console.log(`ims.json: ${count} stations, latest ${Object.values(stations).map(s => s.obs.at(-1).t).sort().at(-1)}`);
} catch (e) {
  console.log("IMS fetch failed, nothing written: " + (e.message || e));
}
