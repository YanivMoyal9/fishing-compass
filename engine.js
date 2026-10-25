/* מצפן הדייג — מנוע החישוב (בלי שרת).
   חלונות הסשן לפי השחר והדמדומים הימיים, טיפ שכבת המים לפי מגמת הלחץ, מדד פעילות לכל סשן (מודל נקודות),
   ציון נוחות שעתי, ובחירת דגים ודמויים לחוף. כל החישובים בשעון ישראל. */
(function () {
const TZ = "Asia/Jerusalem";
const HOUR = 36e5;
const pad = n => String(n).padStart(2, "0");
const fmtParts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
// local (Israel) parts of a timestamp
function il(ms) {
  const o = {}; fmtParts.formatToParts(new Date(ms)).forEach(p => { if (p.type !== "literal") o[p.type] = +p.value; });
  return { y: o.year, mo: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second, key: `${o.year}-${pad(o.month)}-${pad(o.day)}`, hf: o.hour + o.minute / 60 + o.second / 3600 };
}
// timestamp of a local Israel date + fractional hour
function ilTime(key, hf) {
  const [y, m, d] = key.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, 0, 0, 0) + hf * HOUR - 2 * HOUR;
  for (let i = 0; i < 2; i++) { const p = il(guess); const diff = (p.key === key ? p.hf : p.hf + (p.key < key ? -24 : 24)) - hf; guess -= diff * HOUR; }
  return Math.round(guess);
}
const r10 = h => Math.round(h * 6) / 6; // round to 10 minutes
const hm = h => { let H = Math.floor(h + 1e-9), M = Math.round((h - H) * 60); if (M === 60) { H++; M = 0; } return `${pad(H)}:${pad(M)}`; };
const addDays = (key, n) => il(ilTime(key, 12) + n * 24 * HOUR).key;

/* ---------- astronomy ---------- */
function windows(key, lat, lon) {
  const t = SunCalc.getTimes(new Date(ilTime(key, 12)), lat, lon);
  const dawn = il(+t.nauticalDawn).hf, dusk = il(+t.nauticalDusk).hf;
  const ms = r10(dawn - 0.5), es = r10(dusk - 2);
  return {
    dawn, dusk, sunrise: il(+t.sunrise).hf, sunset: il(+t.sunset).hf,
    sessions: [
      { id: "morning", name: "בוקר", start: ms, end: ms + 3 },
      { id: "midday", name: "צהריים", start: 11, end: 15 },
      { id: "evening", name: "ערב", start: es, end: es + 2.5 }
    ]
  };
}
// moon rise/set events (absolute ms) around a date range, plus transits between rise and set
function moonEvents(key0, days, lat, lon) {
  const ev = [];
  for (let i = -1; i <= days; i++) {
    const k = addDays(key0, i), m = SunCalc.getMoonTimes(new Date(ilTime(k, 0)), lat, lon);
    if (m.rise) ev.push({ T: +m.rise, type: "rise" }); if (m.set) ev.push({ T: +m.set, type: "set" });
  }
  ev.sort((a, b) => a.T - b.T);
  const uniq = ev.filter((e, i) => !i || Math.abs(e.T - ev[i - 1].T) > 6e4 || e.type !== ev[i - 1].type);
  const transits = [];
  for (let i = 0; i < uniq.length - 1; i++) if (uniq[i].type === "rise" && uniq[i + 1].type === "set") transits.push((uniq[i].T + uniq[i + 1].T) / 2);
  return { ev: uniq, transits };
}

/* ---------- tide from hourly sea level ---------- */
function tideExtremes(rows) {
  const out = [];
  for (let i = 3; i < rows.length - 3; i++) {
    const v = rows[i].sl; if (v == null) continue;
    const near = rows.slice(i - 3, i + 4).map(r => r.sl).filter(x => x != null);
    if (near.length < 7) continue;
    if (v === Math.max(...near) && v > Math.min(...near) + 0.01) out.push({ T: rows[i].T, type: "high", h: v });
    else if (v === Math.min(...near) && v < Math.max(...near) - 0.01) out.push({ T: rows[i].T, type: "low", h: v });
  }
  return out.filter((e, i) => !i || e.type !== out[i - 1].type);
}
// 0 = low water, 0.5 = high water, linear between extremes
function tidePhase(tides, T) {
  const i = tides.findIndex(t => t.T > T); if (i <= 0) return null;
  const a = tides[i - 1], b = tides[i], f = (T - a.T) / (b.T - a.T);
  return a.type === "low" ? f * 0.5 : 0.5 + f * 0.5;
}

/* ---------- inputs of a session ---------- */
function sessionInputs(rows, key, s) {
  const T0 = ilTime(key, Math.floor(s.start)), T1 = ilTime(key, Math.ceil(s.end));
  const hrs = rows.filter(r => r.T >= T0 && r.T < T1);
  if (!hrs.length) return null;
  const at = T => { let best = null; for (const r of rows) if (Math.abs(r.T - T) < 31 * 6e4) best = r; return best; };
  const pAt = T => { const r = at(T); return r && r.p != null ? r.p : null; };
  const avg = f => { const v = hrs.map(r => r[f]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const max = f => { const v = hrs.map(r => r[f]).filter(x => x != null); return v.length ? Math.max(...v) : null; };
  const p0 = pAt(T0), pEnd = pAt(hrs[hrs.length - 1].T), p3 = pAt(T0 - 3 * HOUR), p6 = pAt(T0 - 6 * HOUR);
  return {
    T0, T1, p0, dpS: p0 != null && pEnd != null ? pEnd - p0 : 0, dp3: p0 != null && p3 != null ? p0 - p3 : 0, dp6: p0 != null && p6 != null ? p0 - p6 : 0,
    wave: avg("wave"), waveMax: max("wave"), wind: avg("wind"), windMax: max("wind"), rain: max("rain"), sst: avg("sst"), air: avg("air"),
    src: hrs.some(r => r.src === "sg") ? "sg" : "om"
  };
}

/* ---------- activity index (sea) ----------
   Points model: tide phase and state, pressure level and trend, moon events, session time, sea state.
   Weights from our analysis of a week of all coast regions (docs/strike-point/08). Base 52. */
function seaIndex(x, s, tides, moon) {
  const f = []; const add = (pts, label) => { if (pts) f.push({ pts, label }); };
  const mid = (x.T0 + x.T1) / 2;
  if (tides.length) {
    const ph = tidePhase(tides, x.T0);
    if (ph != null) add(ph < 0.25 ? 9.5 : ph < 0.5 ? 3.9 : ph < 0.75 ? -4.9 : -8.6,
      ph < 0.25 ? "גאות מתחילה לעלות אחרי שפל" : ph < 0.5 ? "גאות עולה לקראת שיא" : ph < 0.75 ? "אחרי שיא הגאות" : "המים יורדים לקראת שפל");
    const inside = tides.filter(t => t.T >= x.T0 && t.T <= x.T1), next = tides.find(t => t.T > x.T0);
    if (inside.some(t => t.type === "high")) add(3.2, "שיא גאות בתוך החלון");
    else if (inside.some(t => t.type === "low")) add(-1.1, "שפל בתוך החלון");
    else if (next) add(next.type === "high" ? 4.7 : -6.9, next.type === "high" ? "הגאות עולה כל החלון" : "המים יורדים כל החלון");
  }
  if (x.p0 != null) {
    const p = x.p0;
    add(p < 1000 ? 6.2 : p < 1005 ? 4.1 : p < 1013 ? -1 : p < 1016 ? -8.1 : -10, `לחץ ${Math.round(p)} hPa ${p < 1005 ? "(נמוך)" : p >= 1013 ? "(גבוה)" : ""}`.trim());
    const d = x.dp3;
    add(d < -1 ? 10.2 : d < -0.3 ? 7.1 : d <= 0.3 ? 4 : d <= 1 ? 2.3 : -4.9,
      d < -0.3 ? "הלחץ ירד ב-3 השעות שלפני" : d <= 0.3 ? "לחץ יציב לפני הסשן" : "הלחץ עלה ב-3 השעות שלפני");
    if (x.dpS < -1) add(4.4, "הלחץ יורד בתוך הסשן"); else if (x.dpS > 0.3) add(-6.1, "הלחץ עולה בתוך הסשן");
  }
  if (moon) {
    const near = (T, h) => Math.abs(T - mid) <= ((x.T1 - x.T0) / 2 + h * HOUR);
    if (moon.ev.some(e => e.type === "rise" && near(e.T, 1))) add(7.8, "זריחת ירח בחלון");
    if (moon.ev.some(e => e.type === "set" && near(e.T, 1))) add(-3.3, "שקיעת ירח בחלון");
    if (moon.transits.some(T => near(T, 0))) add(-4.5, "הירח בשיא הגובה בחלון");
  }
  add(s.id === "morning" ? 4.2 : s.id === "midday" ? -0.7 : -3.5, s.id === "morning" ? "אור ראשון" : s.id === "evening" ? "ערב" : "אמצע היום");
  if (x.waveMax != null) { if (x.waveMax >= 90) add(-7.3, `גלים עד ${Math.round(x.waveMax)} ס״מ`); else if (x.waveMax <= 50) add(3, "ים נוח"); }
  let score = 52 + f.reduce((a, b) => a + b.pts, 0);
  const danger = (x.waveMax != null && x.waveMax >= 150) || (x.windMax != null && x.windMax >= 35);
  if (danger) { score = Math.min(score, 25); f.push({ pts: 0, label: "⚠️ ים או רוח מסוכנים — לא לעלות על שוברים" }); }
  return { score: Math.max(5, Math.min(98, Math.round(score))), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)), danger };
}

/* ---------- activity index (lake): pressure trend and wind ---------- */
function lakeIndex(x, s, moon) {
  const f = []; const add = (pts, label) => { if (pts) f.push({ pts, label }); };
  add(-13 * x.dpS, x.dpS < 0 ? "הלחץ יורד בתוך הסשן" : "הלחץ עולה בתוך הסשן");
  add(-6.5 * x.dp6, x.dp6 < 0 ? "הלחץ ירד ב-6 השעות שלפני" : "הלחץ עלה ב-6 השעות שלפני");
  if (x.wind != null) add(2 * Math.min(x.wind, 12), `רוח ${Math.round(x.wind)} קמ״ש מעוררת את המים`);
  if (s.id === "evening") add(-20, "ערב"); else if (s.id === "midday") add(-4, "אמצע היום");
  const mid = (x.T0 + x.T1) / 2;
  if (moon && moon.ev.some(e => Math.abs(e.T - mid) <= (x.T1 - x.T0) / 2)) add(-3, "אירוע ירח בחלון");
  let score = Math.round((47 + f.reduce((a, b) => a + b.pts, 0)) / 5) * 5;
  const danger = x.windMax != null && x.windMax >= 35;
  if (danger) { score = Math.min(score, 25); f.push({ pts: 0, label: "⚠️ רוח חזקה" }); }
  return { score: Math.max(5, Math.min(95, score)), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)), danger };
}

/* ---------- water-layer tip from the pressure trend (hPa rounded) ---------- */
function tip(rows, key, s, lake) {
  const pr = h => { const T = ilTime(key, h); const r = rows.find(q => Math.abs(q.T - T) < 31 * 6e4); return r && r.p != null ? Math.round(r.p) : null; };
  if (lake) {
    const h0 = Math.floor(s.start), p0 = pr(h0), p3 = pr(h0 - 3), p1 = pr(Math.round(s.end) - 2);
    const up = p0 != null && p1 != null && ((p3 != null && p0 - p3 <= -3) || (p0 <= 1014 && p1 - p0 <= -1));
    return up ? { layer: "upper", text: "לחץ יורד — הדגים למעלה, עבודת שטח מהירה" } : { layer: "bottom", text: "לחץ גבוה ויציב — לעבוד עמוק ולאט" };
  }
  const A = pr(Math.round(s.end) - 2), B = pr(Math.round(s.start));
  return A != null && B != null && A <= 1014 && A - B <= -1
    ? { layer: "upper", text: "מים עליונים — לחץ נמוך ויורד" }
    : { layer: "bottom", text: "חלק תחתון — לחץ גבוה או עולה" };
}

/* ---------- hourly fishing comfort 0–100 ---------- */
function comfort(r) {
  let s = 100;
  const w = r.wind || 0;
  s -= w <= 8 ? 0 : w <= 15 ? 10 : w <= 25 ? 40 : 65;
  if (w >= 9 && r.dir != null && (r.dir >= 245 || r.dir < 25)) s -= 10; // onshore (west / north-west)
  if ((r.rain || 0) > 20) s -= 15;
  const v = r.wave || 0; s -= v < 60 ? 0 : v < 100 ? 10 : v < 150 ? 30 : 55;
  return Math.max(0, Math.min(100, s));
}

const level = s => s >= 80 ? { t: "מצוין", c: "lv-top" } : s >= 65 ? { t: "טוב מאוד", c: "lv-good" } : s >= 50 ? { t: "טוב", c: "lv-ok" } : s >= 35 ? { t: "בינוני", c: "lv-mid" } : { t: "חלש", c: "lv-low" };

/* ---------- fish and lures for a beach ---------- */
function fishFor(beach, month, sst) {
  const res = { now: [], off: [], protected: [], caution: [] };
  for (const sp of SPECIES) {
    if (!sp.waters.includes(beach.water)) continue;
    if (beach.water !== "lake" && !sp.habitats.includes(beach.type) && !(beach.reports || []).includes(sp.name)) continue;
    if (sp.protectedIn && sp.protectedIn.includes(beach.water)) { res.protected.push(sp); continue; }
    if (sp.caution) { res.caution.push(sp); continue; }
    const peak = sp.p && sp.p.includes(month), inS = sp.m.includes(month);
    let tempNote = null;
    if (sst != null && sp.temp) { if (sst < sp.temp[0] - 1) tempNote = "המים קרים לו"; else if (sst > sp.temp[1] + 1) tempNote = "המים חמים לו"; }
    const row = { sp, peak, tempNote };
    (inS ? res.now : res.off).push(row);
  }
  res.now.sort((a, b) => (b.peak - a.peak) || ((a.tempNote ? 1 : 0) - (b.tempNote ? 1 : 0)));
  return res;
}
// lure codes for a water layer, weighted by fish in season (primary 2, secondary 1, peak ×1.5)
function luresFor(fishNow, layer) {
  const score = {};
  for (const { sp, peak, tempNote } of fishNow) {
    if (sp.bait || tempNote || sp.caution) continue;
    if (layer && sp.layer !== "all" && sp.layer !== layer) continue;
    const w = peak ? 1.5 : 1;
    sp.lures.forEach(c => score[c] = (score[c] || 0) + 2 * w); (sp.lures2 || []).forEach(c => score[c] = (score[c] || 0) + w);
  }
  return Object.entries(score).filter(([c]) => c !== "BAIT").sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/* ---------- fit of one species to one beach (0–100), for "where to fish for X" ----------
   season: peak 90 · in season 70 · out of season 15 · +10 if reported at this beach · −25 if the habitat does not match the beach type
   · −4 per °C outside the preferred water range (at most −12). Protected or caution species: null. */
function speciesFit(beach, sp, month, sst) {
  if (!sp.waters.includes(beach.water) || sp.caution || (sp.protectedIn && sp.protectedIn.includes(beach.water))) return null;
  let s = sp.p && sp.p.includes(month) ? 90 : sp.m.includes(month) ? 70 : 15;
  const why = [s >= 90 ? "שיא העונה" : s >= 70 ? "בעונה" : "מחוץ לעונה"];
  if ((beach.reports || []).includes(sp.name)) { s += 10; why.push("דווח בחוף הזה"); }
  if (beach.water !== "lake" && !sp.habitats.includes(beach.type)) { s -= 25; why.push("סוג החוף פחות מתאים"); }
  if (sst != null && sp.temp) { const d = sst < sp.temp[0] ? sp.temp[0] - sst : sst > sp.temp[1] ? sst - sp.temp[1] : 0; if (d > 0) { s -= Math.min(12, 4 * d); why.push(sst > sp.temp[1] ? "המים חמים לו" : "המים קרים לו"); } }
  return { score: Math.max(0, Math.min(100, Math.round(s))), why };
}

/* ---------- golden hours and the best hour of a day ---------- */
function goldenHours(key, lat, lon) {
  const t = SunCalc.getTimes(new Date(ilTime(key, 12)), lat, lon), sr = il(+t.sunrise).hf, ss = il(+t.sunset).hf;
  return [[sr, sr + 1], [ss - 1, ss]];
}
// best hour 05–21: fishing comfort × activity of the session that covers the hour (outside sessions: 35)
function bestHour(rows, key, sessions) {
  let best = null;
  for (const r of rows) {
    const p = il(r.T); if (p.key !== key || p.h < 5 || p.h > 21) continue;
    const s = sessions.find(q => !q.na && p.h + 0.5 >= q.start && p.h + 0.5 <= q.end);
    const v = (s ? s.score : 35) * comfort(r) / 100;
    if (!best || v > best.v) best = { h: p.h, v, s };
  }
  return best;
}

window.ENGINE = { il, ilTime, hm, addDays, windows, moonEvents, tideExtremes, tidePhase, sessionInputs, seaIndex, lakeIndex, tip, comfort, level, fishFor, luresFor, speciesFit, goldenHours, bestHour, HOUR };
})();
