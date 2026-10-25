/* מצפן הדייג — שליפת תחזית לכל קבוצת נתונים (נקודת ים אחת לכמה חופים סמוכים).
   מקור חי: Open-Meteo (מזג אוויר + ים: גלים, טמפ' מים, גובה פני הים לגאות).
   שכבת דיוק: data/sg.json — קובץ יומי מ-StormGlass (גלים, רוח, משקעים וטמפ' מים) כשהוא עדכני; הלחץ נשאר מ-Open-Meteo. */
(function () {
const CACHE_KEY = "compass-forecast-v2", CACHE_MS = 30 * 60 * 1000, SG_MAX_AGE = 72 * 36e5;
const W_URL = "https://api.open-meteo.com/v1/forecast", M_URL = "https://marine-api.open-meteo.com/v1/marine";
const list = a => a.map(x => x.toFixed(3)).join(",");

async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

async function fetchOpenMeteo(groups) {
  const ids = Object.keys(groups), sea = ids.filter(id => groups[id].water !== "lake");
  const wq = `${W_URL}?latitude=${list(ids.map(i => groups[i].lat))}&longitude=${list(ids.map(i => groups[i].lon))}` +
    "&hourly=pressure_msl,wind_speed_10m,wind_direction_10m,precipitation_probability,temperature_2m&past_days=1&forecast_days=8&timezone=GMT";
  const mq = `${M_URL}?latitude=${list(sea.map(i => groups[i].mlat))}&longitude=${list(sea.map(i => groups[i].mlon))}` +
    "&hourly=wave_height,swell_wave_height,wave_period,sea_surface_temperature,sea_level_height_msl&past_days=1&forecast_days=8&timezone=GMT";
  // boat mode: open sea ~11 km west of each Mediterranean data point
  const med = ids.filter(i => groups[i].water === "med");
  const oq = `${M_URL}?latitude=${list(med.map(i => groups[i].lat))}&longitude=${list(med.map(i => groups[i].lon - 0.12))}` +
    "&hourly=wave_height,swell_wave_height,wave_period,sea_surface_temperature&past_days=1&forecast_days=8&timezone=GMT";
  const [w, m, o] = await Promise.all([getJSON(wq), getJSON(mq), getJSON(oq).catch(() => null)]);
  const W = Array.isArray(w) ? w : [w], M = Array.isArray(m) ? m : [m], O = o ? (Array.isArray(o) ? o : [o]) : null;
  const out = {};
  ids.forEach((id, i) => {
    const h = W[i].hourly, mi = sea.indexOf(id), mh = mi >= 0 ? M[mi].hourly : null;
    out[id] = h.time.map((t, k) => ({
      T: Date.parse(t + "Z"), p: h.pressure_msl[k], wind: h.wind_speed_10m[k], dir: h.wind_direction_10m[k], rain: h.precipitation_probability[k], air: h.temperature_2m[k],
      wave: mh && mh.wave_height[k] != null ? mh.wave_height[k] * 100 : null, swell: mh && mh.swell_wave_height[k] != null ? mh.swell_wave_height[k] * 100 : null,
      per: mh ? mh.wave_period[k] : null, sst: mh ? mh.sea_surface_temperature[k] : null, sl: mh ? mh.sea_level_height_msl[k] : null, src: "om"
    }));
    const oi = med.indexOf(id), oh = O && oi >= 0 ? O[oi].hourly : null;
    if (oh) out[id + "@boat"] = out[id].map((r, k) => ({ ...r, wave: oh.wave_height[k] != null ? oh.wave_height[k] * 100 : null, swell: oh.swell_wave_height[k] != null ? oh.swell_wave_height[k] * 100 : null,
      per: oh.wave_period[k], sst: oh.sea_surface_temperature[k] }));
  });
  return out;
}

// StormGlass overlay: [time, wave cm, swell cm, period s, wind km/h, dir°, pressure, sst, precip %]
function overlaySG(rows, sg) {
  if (!sg || !sg.hours || Date.now() - Date.parse(sg.pulled_at) > SG_MAX_AGE) return false;
  const byT = new Map(sg.hours.map(h => [Date.parse(h[0] + ":00:00Z"), h]));
  let n = 0;
  for (const r of rows) {
    const h = byT.get(r.T); if (!h) continue;
    r.wave = h[1]; r.swell = h[2]; r.per = h[3]; r.wind = h[4]; r.dir = h[5]; if (h[7]) r.sst = h[7]; r.rain = h[8]; r.src = "sg"; n++;
  }
  return n > 0;
}

async function loadForecast(groups, force) {
  if (!force) {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); if (c && Date.now() - c.at < CACHE_MS) return c; } catch (e) { /* no cache */ }
  }
  const data = await fetchOpenMeteo(groups);
  let sg = null; try { sg = await getJSON("data/sg.json?t=" + Math.floor(Date.now() / 6e5)); } catch (e) { /* no daily StormGlass file */ }
  const sgGroups = [];
  if (sg && sg.groups) for (const id in data) if (!id.includes("@") && overlaySG(data[id], sg.groups[id])) sgGroups.push(id);
  // official IMS sea forecast, warnings and Kinneret level (daily file from the home PC)
  let official = null; try { official = await getJSON("data/official.json?t=" + Math.floor(Date.now() / 6e5)); } catch (e) { /* not available */ }
  const res = { at: Date.now(), data, sgGroups, sgAt: sg ? sg.generated : null, official };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(res)); } catch (e) { /* storage full or blocked */ }
  return res;
}

window.FORECAST = { loadForecast };
})();
