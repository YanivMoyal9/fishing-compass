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

/* ---------- tide from hourly sea level ----------
   v3.4 (4/11/2026): the time of each extreme is refined below the hour with a parabola through the hour before, the extreme hour and the
   hour after (vertex offset 0.5·(a−c)/(a−2b+c) h, kept within ±0.5 h), as Hooked does (docs/hooked-il/01 §3.2). Before, every high and low
   sat on a round hour. Measured against the site's own tide times (strike-point-snapshots/compass/tide_interp_check.txt, 949 extremes):
   MAE 30 → 22 min, within 30 min 56% → 85%. But the activity weights (SEA_W) were fitted on the whole-hour times, and scoring with the
   exact minutes made the score vs Strike Point slightly worse (MAE 10.45 → 10.76, best session 69% → 66%). So each extreme keeps both:
   T = the exact time (shown to the user), Tm = the whole hour the models were calibrated on (used by tidePhase, seaIndex, hourIndex). */
const tm = t => t.Tm != null ? t.Tm : t.T;
function tideExtremes(rows) {
  const out = [];
  for (let i = 3; i < rows.length - 3; i++) {
    const v = rows[i].sl; if (v == null) continue;
    const near = rows.slice(i - 3, i + 4).map(r => r.sl).filter(x => x != null);
    if (near.length < 7) continue;
    const type = v === Math.max(...near) && v > Math.min(...near) + 0.01 ? "high" : v === Math.min(...near) && v < Math.max(...near) - 0.01 ? "low" : null;
    if (!type) continue;
    const a = rows[i - 1].sl, c = rows[i + 1].sl, den = a - 2 * v + c;
    const off = den ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0;
    out.push({ T: Math.round(rows[i].T + off * HOUR), Tm: rows[i].T, type, h: v - 0.25 * (a - c) * off });
  }
  return out.filter((e, i) => !i || e.type !== out[i - 1].type);
}
// 0 = low water, 0.5 = high water, linear between extremes
function tidePhase(tides, T) {
  const i = tides.findIndex(t => tm(t) > T); if (i <= 0) return null;
  const a = tides[i - 1], b = tides[i], f = (T - tm(a)) / (tm(b) - tm(a));
  return a.type === "low" ? f * 0.5 : 0.5 + f * 0.5;
}

/* ---------- inputs of a session ---------- */
// ocean current over some hours (v3.4): vector mean of Open-Meteo ocean_current_velocity (km/h) and _direction (° the water flows TO)
function curMean(hrs) {
  const v = hrs.filter(r => r.cur != null && r.curDir != null); if (!v.length) return { cur: null, curDir: null };
  let e = 0, n = 0; for (const r of v) { const a = r.curDir * Math.PI / 180; e += r.cur * Math.sin(a); n += r.cur * Math.cos(a); }
  e /= v.length; n /= v.length;
  return { cur: Math.hypot(e, n), curDir: (Math.atan2(e, n) * 180 / Math.PI + 360) % 360 };
}
// the Strike Point wave band: 40–70 cm on the site's StormGlass scale; Open-Meteo reads 20–30 cm higher, so 55–95 cm on Open-Meteo rows
const inWaveBand = r => r.wave != null && (r.src === "sg" ? r.wave >= 40 && r.wave < 70 : r.wave >= 55 && r.wave < 95);
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
    // hours with a 40–70 cm wave on the Strike Point scale (docs/strike-point/16). Open-Meteo runs 20–30 cm higher than the site's
    // StormGlass wave, so the band is tested 20 cm up: 55–95 cm here (calibrated 29/10, docs/strike-point/20 §8; band agreement 69% → 86%)
    // v3.7: hours that carry the StormGlass overlay (data/sg.json) are already on the site's own scale → the site's band, 40–70 cm
    waveBand: hrs.filter(inWaveBand).length,
    ...curMean(hrs),
    src: hrs.some(r => r.src === "sg") ? "sg" : "om"
  };
}

/* ---------- activity index (sea), v2 — recalibrated 28/10/2026 ----------
   Same factors as v1 plus the decoded wave band; points fitted on 2,040 Strike Point VIP session scores (26/10–2/11, all sea regions)
   against the app's own Open-Meteo inputs, ridge-regularised (docs/strike-point/15 §5). On unseen dates: MAE 11.5 vs 16.6 for v1.
   Session constants set to 0 on 29/10 (user approved, docs/strike-point/20 §12): the fitted −3.3 / +2.7 made the evening win over the morning on
   every day, while the site picks the morning on 26% of beach-days; without them the tide decides and best-session agreement rises 75% → 82%.
   v1 is kept below (seaIndexV1); set ENGINE.SEA_VERSION = 1 to switch back. */
const SEA_W = { base: 57.2,
  tideLowAfter: 0.5, tideRising: 2.6, tideAfterHigh: -2.6, tideFalling: -0.5, highIn: 5, lowIn: -4.1, risingAll: -0.7, fallingAll: -0.2,
  pMid: 1.7, pHigh: -3.9, dp3Drop: 3.2, dp3Fall: 0.5, dp3Rise: 0.1, dpSDrop: 0.4, dpSRise: 0.2,
  moonRise: 0.7, moonSet: 0.7, transit: -2, morning: 0, evening: 0, waveBand: 3.4, windStrong: 0.6, eilat: 1.1 };
function seaIndex(x, s, tides, moon, water) {
  if (window.ENGINE && window.ENGINE.SEA_VERSION === 1) return seaIndexV1(x, s, tides, moon);
  const f = []; const add = (pts, label, ev) => { if (pts) f.push({ pts, label, ev }); }, W = SEA_W;
  const mid = (x.T0 + x.T1) / 2;
  if (tides.length) {
    const ph = tidePhase(tides, x.T0);
    if (ph != null) add(ph < 0.25 ? W.tideLowAfter : ph < 0.5 ? W.tideRising : ph < 0.75 ? W.tideAfterHigh : W.tideFalling,
      ph < 0.25 ? "גאות מתחילה לעלות אחרי שפל" : ph < 0.5 ? "גאות עולה לקראת שיא" : ph < 0.75 ? "אחרי שיא הגאות" : "המים יורדים לקראת שפל", "s");
    const inside = tides.filter(t => tm(t) >= x.T0 && tm(t) <= x.T1), next = tides.find(t => tm(t) > x.T0);
    if (inside.some(t => t.type === "high")) add(W.highIn, "שיא גאות בתוך החלון", "s");
    else if (inside.some(t => t.type === "low")) add(W.lowIn, "שפל בתוך החלון", "s");
    else if (next) add(next.type === "high" ? W.risingAll : W.fallingAll, next.type === "high" ? "הגאות עולה כל החלון" : "המים יורדים כל החלון", "s");
  }
  if (x.p0 != null) {
    const p = x.p0;
    if (p >= 1005 && p < 1013) add(W.pMid, `לחץ ${Math.round(p)} hPa`, "w"); else if (p >= 1016) add(W.pHigh, `לחץ ${Math.round(p)} hPa (גבוה)`, "w");
    const d = x.dp3;
    if (d < -1) add(W.dp3Drop, "הלחץ ירד ב-3 השעות שלפני", "m"); else if (d < -0.3) add(W.dp3Fall, "הלחץ ירד מעט ב-3 השעות שלפני", "m"); else if (d > 0.3 && d <= 1) add(W.dp3Rise, "הלחץ עלה מעט ב-3 השעות שלפני", "m");
    if (x.dpS < -1) add(W.dpSDrop, "הלחץ יורד בתוך הסשן", "m"); else if (x.dpS > 0.3) add(W.dpSRise, "הלחץ עולה בתוך הסשן", "m");
  }
  if (moon) {
    const near = (T, h) => Math.abs(T - mid) <= ((x.T1 - x.T0) / 2 + h * HOUR);
    if (moon.ev.some(e => e.type === "rise" && near(e.T, 1))) add(W.moonRise, "זריחת ירח בחלון", "w");
    if (moon.ev.some(e => e.type === "set" && near(e.T, 1))) add(W.moonSet, "שקיעת ירח בחלון", "w");
    if (moon.transits.some(T => near(T, 0))) add(W.transit, "הירח בשיא הגובה בחלון", "w");
  }
  if (s.id === "morning") add(W.morning, "אור ראשון"); else if (s.id === "evening") add(W.evening, "ערב");
  if (x.waveBand) add(W.waveBand, x.src === "sg" ? "גל 40–70 ס״מ (StormGlass) — ים פעיל" : "גל 60–90 ס״מ — ים פעיל", "s");
  if (x.windMax != null && x.windMax >= 14) add(W.windStrong, `רוח עד ${Math.round(x.windMax)} קמ״ש`, "m");
  if (water && water !== "med") add(W.eilat, "מפרץ אילת", "w");
  const score = W.base + f.reduce((a, b) => a + b.pts, 0);
  return { score: Math.max(5, Math.min(98, Math.round(score))), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)) };
}

/* ---------- activity index (sea), v1 — kept for comparison and rollback ----------
   Points model: tide phase and state, pressure level and trend, moon events, session time, sea state.
   Weights from our analysis of a week of all coast regions (docs/strike-point/08). Base 52. */
function seaIndexV1(x, s, tides, moon) {
  const f = []; const add = (pts, label) => { if (pts) f.push({ pts, label }); };
  const mid = (x.T0 + x.T1) / 2;
  if (tides.length) {
    const ph = tidePhase(tides, x.T0);
    if (ph != null) add(ph < 0.25 ? 9.5 : ph < 0.5 ? 3.9 : ph < 0.75 ? -4.9 : -8.6,
      ph < 0.25 ? "גאות מתחילה לעלות אחרי שפל" : ph < 0.5 ? "גאות עולה לקראת שיא" : ph < 0.75 ? "אחרי שיא הגאות" : "המים יורדים לקראת שפל", "s");
    const inside = tides.filter(t => tm(t) >= x.T0 && tm(t) <= x.T1), next = tides.find(t => tm(t) > x.T0);
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
  // the activity index stays pure (Strike Point-based); sea safety is reported separately by safety()
  const score = 52 + f.reduce((a, b) => a + b.pts, 0);
  return { score: Math.max(5, Math.min(98, Math.round(score))), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)) };
}

/* ---------- activity index (lake): pressure trend and wind ---------- */
function lakeIndex(x, s, moon) {
  const f = []; const add = (pts, label, ev) => { if (pts) f.push({ pts, label, ev }); };
  add(-13 * x.dpS, x.dpS < 0 ? "הלחץ יורד בתוך הסשן" : "הלחץ עולה בתוך הסשן", "m");
  add(-6.5 * x.dp6, x.dp6 < 0 ? "הלחץ ירד ב-6 השעות שלפני" : "הלחץ עלה ב-6 השעות שלפני", "m");
  if (x.wind != null) add(2 * Math.min(x.wind, 12), `רוח ${Math.round(x.wind)} קמ״ש מעוררת את המים`, "m");
  if (s.id === "evening") add(-20, "ערב", "m"); else if (s.id === "midday") add(-4, "אמצע היום", "m");
  const mid = (x.T0 + x.T1) / 2;
  if (moon && moon.ev.some(e => Math.abs(e.T - mid) <= (x.T1 - x.T0) / 2)) add(-3, "אירוע ירח בחלון", "w");
  const score = Math.round((47 + f.reduce((a, b) => a + b.pts, 0)) / 5) * 5;
  return { score: Math.max(5, Math.min(95, score)), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)) };
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

/* ---------- hourly safety & comfort 0–100 ----------
   The fishing-index mechanics measured on the Cormorant site (docs/cormorant/08): factor curves for wind, gusts, waves, rain,
   visibility, air temperature and light; weights grow with the factor's deficit (w·(1 + 11.5·deficit)); the score never exceeds the worst
   of wind / gusts / waves + 20; any of them at 0 → "dangerous" (≤ 20); an official sea warning → at most 40.
   It is a SAFETY layer only — the activity index (when to fish) stays the Strike Point-based model above. */
const ip = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = [pts[i - 1], pts[i]]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return pts[pts.length - 1][1]; };
const CURVE = {
  wind: [[4, 100], [5, 98], [6, 89], [7, 82], [8, 76], [9, 65], [10, 56], [11, 51], [14, 35], [18, 15], [25, 0]],          // knots
  gust: [[7, 100], [9, 91], [10, 85], [11, 78], [12, 72], [13, 64], [14, 61], [15, 57], [16, 48], [17, 44], [18, 37], [22, 20], [26, 6], [30, 0]],
  waveSea: [[0.35, 100], [0.5, 80], [0.6, 75], [0.7, 68], [0.8, 59], [0.9, 54], [1.0, 48], [1.2, 29], [1.6, 0]], // m
  waveLake: [[0.3, 100], [0.4, 55], [0.6, 30], [1.0, 0]],                                                          // IMS official range, upper value
  rain: [[0.1, 100], [0.3, 94], [0.6, 90], [1, 80], [2, 67], [4, 0]],                                              // mm/h
  vis: [[0.5, 0], [1, 60], [2, 76], [4, 88], [5, 100]],                                                             // km
  air: [[2, 0], [14, 100], [28, 100], [29, 84], [31, 65], [32, 57], [33, 42], [34, 36], [42, 0]]                  // °C
};
const W8 = { wind: .28, gust: .14, waves: .28, rain: .10, vis: .05, air: .07, light: .08 };
// r: hourly row (wind & gust km/h, wave cm, rain mm/h, vis m, air °C); o: { lake, light: "day"|"twilight"|"night", lakeWave: m, warning: bool }
function safety(r, o = {}) {
  const kn = v => v == null ? null : v / 1.852;
  const f = {};
  if (r.wind != null) f.wind = ip(CURVE.wind, kn(r.wind));
  if (r.gust != null) f.gust = ip(CURVE.gust, kn(r.gust));
  const wave = o.lake ? o.lakeWave : (r.wave != null ? r.wave / 100 : null);
  if (wave != null) f.waves = ip(o.lake ? CURVE.waveLake : CURVE.waveSea, wave);
  if (r.mm != null) f.rain = ip(CURVE.rain, r.mm);
  if (r.vis != null) f.vis = ip(CURVE.vis, r.vis / 1000);
  if (r.air != null) f.air = ip(CURVE.air, r.air);
  f.light = o.light === "night" ? 84 : o.light === "twilight" ? 90 : 100;
  let num = 0, den = 0;
  for (const [k, s] of Object.entries(f)) { const w = W8[k] * (1 + 11.5 * (100 - s) / 100); num += w * s; den += w; }
  let score = num / den;
  const safe = ["wind", "gust", "waves"].filter(k => f[k] != null).map(k => f[k]);
  const worst = safe.length ? Math.min(...safe) : 100;
  score = Math.min(score, worst + 20);
  if (worst <= 0) score = Math.min(score, 20);
  if (o.warning) score = Math.min(score, 40);
  // v3.7: thunderstorm (WMO weather code 95–99) — lightning on an exposed breakwater with a carbon rod; CAPE ≥ 1500 with rain likely = possible
  const storm = r.wcode >= 95 ? "yes" : r.cape >= 1500 && (r.rain || 0) >= 40 ? "maybe" : null;
  if (storm === "yes") score = Math.min(score, 25); else if (storm === "maybe") score = Math.min(score, 45);
  score = Math.round(Math.max(0, Math.min(100, score)));
  return { score, f, storm, level: score >= 75 ? "טוב" : score >= 50 ? "סביר" : score >= 30 ? "חלש" : "מסוכן", cls: score >= 75 ? "sf-good" : score >= 50 ? "sf-ok" : score >= 30 ? "sf-weak" : "sf-danger" };
}
const comfort = (r, o) => safety(r, o).score;

const level = s => s >= 80 ? { t: "מצוין", c: "lv-top" } : s >= 65 ? { t: "טוב מאוד", c: "lv-good" } : s >= 50 ? { t: "טוב", c: "lv-ok" } : s >= 35 ? { t: "בינוני", c: "lv-mid" } : { t: "חלש", c: "lv-low" };

/* ---------- water temperature for a species (v3.5) ----------
   sp.t4 = [lives from, ideal from, ideal to, lives to] °C (data/species-plus.js, after Hooked); older entries only have sp.temp = the
   preferred range (then ±1° is tolerated, as before). out = outside the range where it lives ("too cold / too warm" — such a fish is
   not used for the day's lures), ideal = inside the ideal range, d = °C from the ideal range. */
function tempFit(sp, sst) {
  if (sst == null) return null;
  if (sp.t4) { const [a, b, c, d] = sp.t4, dist = sst < b ? b - sst : sst > c ? sst - c : 0;
    if (sst < a) return { out: true, d: dist, text: "המים קרים לו" }; if (sst > d) return { out: true, d: dist, text: "המים חמים לו" };
    return dist ? { out: false, d: dist, text: sst < b ? "המים מעט קרים לו" : "המים מעט חמים לו" } : { out: false, ideal: true, d: 0, text: "טמפ׳ מים אידיאלית לו" }; }
  if (sp.temp) { if (sst < sp.temp[0] - 1) return { out: true, d: sp.temp[0] - sst, text: "המים קרים לו" }; if (sst > sp.temp[1] + 1) return { out: true, d: sst - sp.temp[1], text: "המים חמים לו" }; }
  return null;
}
/* ---------- fish and lures for a beach ---------- */
// v3.7: a beach report names a species by its name, an alias (aka) or the name without the bracket ("אמנון" = "אמנון (מושט)");
// ASCII apostrophes and gershayim are normalised (ג'רבידה = ג׳רבידה)
const normName = t => String(t || "").replace(/['`’]/g, "׳").replace(/"/g, "״").replace(/s+/g, " ").trim();
const REPORT_ALIAS = { "גרזינון": "גרזנון", "שינן הניבים": "שינן", "סולטן איברהים": "ברבוניה" }; // spellings seen in the reports
function reported(beach, sp) {
  const reps = beach.reports; if (!reps || !reps.length) return false;
  const names = new Set([sp.name, sp.name.replace(/s*(.*)s*$/, ""), ...(sp.aka || [])].map(normName));
  return reps.some(r => names.has(normName(REPORT_ALIAS[r] || r)) || names.has(normName(r).replace(/s*(.*)s*$/, "")));
}
function fishFor(beach, month, sst) {
  const res = { now: [], off: [], protected: [], caution: [] };
  for (const sp of SPECIES) {
    if (!sp.waters.includes(beach.water)) continue;
    if (beach.water !== "lake" && !sp.habitats.includes(beach.type) && !reported(beach, sp)) continue;
    if (sp.protectedIn && sp.protectedIn.includes(beach.water)) { res.protected.push(sp); continue; }
    if (sp.caution) { res.caution.push(sp); continue; }
    const peak = sp.p && sp.p.includes(month), inS = sp.m.includes(month);
    const tf = tempFit(sp, sst), tempNote = tf && tf.out ? tf.text : null;
    const row = { sp, peak, tempNote, temp: tf };
    (inS ? res.now : res.off).push(row);
  }
  res.now.sort((a, b) => (!!b.peak - !!a.peak) || ((a.tempNote ? 1 : 0) - (b.tempNote ? 1 : 0)));
  return res;
}
/* ---------- why here today (docs/strike-point/18, stage 1) ----------
   What a predator looks for — food, ambush, comfort — matched against this beach's structure tags (data/beach-features.js) and
   today's conditions. Knowledge rules from docs/strike-point/17 §3, not yet validated on catches; every line carries its confidence.
   x = sessionInputs, sid = session id, rows = the beach's hourly forecast, f = BEACH_FEATURES entry. → { pro: [...≤3], con: [...≤1] } */
const CONF = { high: 3, mid: 2, low: 1 };
function whereToday(b, x, sid, rows, f, month) {
  const pro = [], con = [], tags = (f && f.tags) || [], has = re => tags.some(t => re.test(t)), lake = b.water === "lake";
  const struct = tags.filter(t => /סלעים|שובר גלים|מזח/.test(t)).map(t => t.replace(" / ", " ו")), rocks = struct.length > 0;
  const shelter = has(/מים מוגנים|מפרצון|לגונה|ים שקט/) || ["marina", "port"].includes(b.type), lights = has(/מרינה|נמל|מזח/) || ["marina", "port"].includes(b.type);
  const river = has(/שפך נחל|יציאת מים|תעלה/), surf = has(/מתאים לסרף/) || ["sand", "mixed"].includes(b.type), deep = has(/מים עמוקים קרוב/);
  const add = (list, need, conf, text, k) => list.push({ need, conf, text, k: CONF[conf] * 10 + (k || 0) });
  const w = x.waveMax, sst = x.sst, lowLight = sid !== "midday";
  const before = h => rows.filter(r => r.T < x.T0 && r.T >= x.T0 - h * HOUR);
  const dd = (a, c) => Math.abs(((a - c) % 360 + 540) % 360 - 180);
  const fromSea = r => f && f.az != null && r.dir != null && dd(r.dir, f.az) <= 60;
  const mid = rows.find(r => Math.abs(r.T - (x.T0 + x.T1) / 2) < 31 * 6e4) || {};
  // light: the strongest established factor
  if (lowLight) add(pro, "ambush", "high", `${sid === "morning" ? "שחר" : "דמדומים"} — באור עמום לטורף יש יתרון ראייה על הפיתיון`, 5);
  else if (!(w >= 40 && w <= 100)) add(con, "ambush", "high", "אור מלא — הפיתיון רואה את הטורף; לרדת לעומק או לחכות לשקיעה", 2);
  if (!lake && w != null) {
    if (w > 100) { if (shelter) add(pro, "comfort", "high", `ים גבוה (${Math.round(w)} ס״מ) — כאן יש מים מוגנים, שם הדגים מתרכזים`, 9);
      else add(con, "comfort", "high", `ים גבוה (${Math.round(w)} ס״מ) בחוף חשוף — עדיף מרינה או מים מוגנים`, 9); }
    else if (w >= 40) {
      if (rocks) add(pro, "ambush", "high", `גל ${Math.round(w)} ס״מ על ${struct.slice(0, 2).join(" ו")} — קו קצף שמסתיר את הטורף`, 8);
      else if (surf) add(pro, "ambush", "mid", `גל ${Math.round(w)} ס״מ — ים עובד וקצף מעל השרטונים`, 6);
      if (w >= 50 && surf) add(pro, "ambush", "mid", "זרם חוזר בין השרטונים — לברק מחכה בו למזון שנסחף", 4);
    } else if (w < 30) {
      if (deep || rocks) add(pro, "ambush", "mid", `ים צלול — ${deep ? "עומק קרוב לחוף" : "המבנה"} נותן לטורף מסתור`, 3);
      else if (!lowLight) add(con, "ambush", "mid", "ים צלול באור מלא בחוף רדוד — הטורף נחשף ונרתע", 3);
    }
    const prev = before(36).map(r => r.wave).filter(v => v != null);
    if (prev.length && Math.max(...prev) >= 100 && (w == null || w < 80) && surf) add(pro, "food", "mid", "אחרי סערה — הסרף חשף מזון ועכר את המים: דניס ולברק", 7);
  }
  // food pushed onshore by a steady sea breeze; river mouths after rain
  const onshore = before(24).filter(r => r.wind != null && r.wind >= 12 && fromSea(r)).length;
  if (!lake && onshore >= 12) add(pro, "food", "low", `רוח מהים ${onshore} שעות לפני החלון — פיתיון נדחף לרדודים`, 5);
  const mm = before(72).reduce((s, r) => s + (r.mm || 0), 0);
  if (river && b.water === "med" && mm >= 5) add(pro, "food", "mid", `${Math.round(mm)} מ״מ גשם ב-3 הימים האחרונים — השפך פעיל: לדוג בשולי הכתם העכור`, 8); // Eilat wadis are dry
  // strong onshore wind: the lee of the structure
  if (!lake && x.windMax >= 20 && fromSea(mid)) { if (shelter || has(/שובר גלים/)) add(pro, "comfort", "mid", `רוח ${Math.round(x.windMax)} קמ״ש מהים — בצד המוגן של השובר המים רגועים והפיתיון מתרכז`, 6);
    else add(con, "comfort", "mid", `רוח ${Math.round(x.windMax)} קמ״ש מהים ואין מחסה בחוף`, 6); }
  if (sid === "evening" && lights) add(pro, "food", "low", "אחרי החשכה — האורות מושכים פלנקטון, ואחריו קלאמרי וברקודה", 2);
  // water temperature
  if (has(/מים חמים בחורף/) && ((sst != null && sst <= 20) || [12, 1, 2, 3].includes(month))) add(pro, "comfort", "mid", `מים ${sst != null ? sst.toFixed(0) + "°" : "קרים"} — יציאת המים החמים מרכזת טורפים`, 9);
  if (sst != null && sst >= 29 && !lowLight) { if (deep) add(pro, "comfort", "mid", `מים ${sst.toFixed(0)}° — העומק הקרוב לחוף קריר יותר`, 3);
    else add(con, "comfort", "mid", `מים ${sst.toFixed(0)}° באמצע היום — הדגים יורדים לעומק`, 4); }
  // Kinneret (stage 4, rules 12–13): the downwind shore gathers drifting food and mixed water; a strong afternoon westerly pushes the
  // warm surface layer east and upwells cold, oxygen-poor water on the western shore (Laval et al. 2003)
  if (lake) {
    if (x.windMax >= 15 && fromSea(mid)) add(pro, "food", "mid", `רוח ${Math.round(x.windMax)} קמ״ש מהאגם — החוף במורד הרוח: מזון נסחף ומים מעורבבים`, 7);
    const westShore = f && f.az != null && dd(f.az, 90) <= 45; // the beach faces east = the lake's western shore
    if (westShore && sid !== "morning" && mid.wind >= 20 && mid.dir != null && dd(mid.dir, 270) <= 45) add(con, "comfort", "mid", `רוח מערבית ${Math.round(mid.wind)} קמ״ש אחה״צ — בחוף המערבי עולים מים קרים ודלי חמצן`, 7);
  }
  // Eilat (rule 14): a real 0.6–0.9 m tide (Open-Meteo, not the site's inverted one — docs/strike-point/17 §1); at mid tide the current
  // along the reef edge and the breakwaters carries food
  if (b.water === "eilat" && (rocks || has(/שונית|איים|מצוק/) || b.type === "reef")) {
    const ph = tidePhase(tideExtremes(rows), (x.T0 + x.T1) / 2);
    if (ph != null && Math.abs(ph % 0.5 - 0.25) <= 0.1) add(pro, "food", "mid", `אמצע גאות ${ph < 0.5 ? "עולה" : "יורדת"} — הזרם בשולי השונית ובשוברים מביא מזון`, 6);
  }
  const by = (a, c) => c.k - a.k;
  return { pro: pro.sort(by).slice(0, 3), con: con.sort(by).slice(0, 1) };
}
// net "fits here today" points of a whereToday result: confidence points of the pros minus the cons (−3 … +9)
const whereScore = w => w ? w.pro.reduce((s, r) => s + CONF[r.conf], 0) - w.con.reduce((s, r) => s + CONF[r.conf], 0) : 0;
/* ---------- where to go today (stage 2): rank beaches of a region for one session ----------
   cands = [{ b, s (session with score), w (whereToday), safeMin, inSeason }]. "When" is the session's activity index; "where" adds 3 points per
   confidence point of the rules, so beaches that share a forecast group are separated by their structure. A dangerous session (safety
   minimum < 30) or a beach where the chosen fish is out of season is never recommended. Returns the top n as levels, not numbers. */
const GO_LEVEL = t => t >= 75 ? { t: "מצוין", c: "lv-top" } : t >= 60 ? { t: "טוב", c: "lv-good" } : { t: "סביר", c: "lv-ok" };
function goToday(cands, n = 3) {
  return cands.filter(c => c.s && !c.s.na && c.inSeason !== false && !(c.safeMin != null && c.safeMin < 30))
    .map(c => { const ws = whereScore(c.w), total = Math.max(0, Math.min(100, c.s.score + 3 * ws)), pro = (c.w && c.w.pro) || [];
      // the headline reason is the beach-specific one; the light line (shared by every beach of the session) only when nothing else applies
      return { ...c, ws, total, lv: GO_LEVEL(total), reason: pro.find(r => !/^(שחר|דמדומים) —/.test(r.text)) || pro[0] || null }; })
    .sort((a, c) => c.total - a.total || c.s.score - a.s.score).slice(0, n);
}
/* ---------- daily adjustment of a beach's 200 m strips (stage 3, rules 1–3, 5, 6, 8) ----------
   ctx = stripContext(...) once per beach and session; stripAdjust(strip, ctx, sid, fishId) → { d: points to add to the strip's fixed
   score, why: [short reasons] }. Small, capped points: the fixed ranking (colour, clarity, depth, structures) still leads. */
function stripContext(b, x, rows, f, month) {
  const dd = (a, c) => Math.abs(((a - c) % 360 + 540) % 360 - 180);
  const mid = rows.find(r => Math.abs(r.T - (x.T0 + x.T1) / 2) < 31 * 6e4) || {};
  const fromSea = f && f.az != null && mid.dir != null && dd(mid.dir, f.az) <= 60;
  const mm = rows.filter(r => r.T < x.T0 && r.T >= x.T0 - 72 * HOUR).reduce((s, r) => s + (r.mm || 0), 0);
  return { lake: b.water === "lake", w: x.waveMax, mm, onshore: x.windMax >= 20 && fromSea, cold: (x.sst != null && x.sst <= 20) || [12, 1, 2, 3].includes(month) };
}
function stripAdjust(t, c, sid, fishId) {
  const d = [], near = t.near || {}, le = (k, m) => near[k] != null && near[k] <= m, struct = le("סלע", 120) || le("שובר", 150) || le("מזח", 150);
  if (c.lake || c.w == null) return { d: 0, why: [] };
  if (c.w >= 40 && c.w <= 100 && t.band >= 90 && struct) d.push([6, "קצף ליד מבנה"]);
  if (c.w >= 50 && c.w <= 120 && t.rip) d.push([fishId === "seabass" ? 6 : 4, "זרם חוזר"]);
  if (c.w < 30) { if (t.z200 >= 6 || struct) d.push([4, `ים צלול — ${t.z200 >= 6 ? "עומק קרוב" : "מבנה"}`]); else if (sid === "midday" && t.z200 < 4) d.push([-4, "ים צלול באור מלא ברדודים"]); }
  if (c.mm >= 5 && (le("נחל", 300) || le("תעלת מים", 300))) d.push([6, "השפך פעיל אחרי הגשם"]);
  if (c.onshore) { if (t.shelter) d.push([5, "הצד המוגן מהרוח"]); else if (le("שובר", 200)) d.push([3, "ליד השובר — מחסה מהרוח"]); }
  if (c.cold && t.warmWinter >= 0.3) d.push([4, "מים חמים יותר"]);
  return { d: d.reduce((s, r) => s + r[0], 0), why: d.map(r => (r[0] > 0 ? "↑ " : "↓ ") + r[1]) };
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
   · water (v3.5, sp.t4): −12 outside the range where it lives, −2 per °C outside the ideal range (at most −8) · species with only
   sp.temp: −12 when more than 1° outside it. Protected or caution species: null. */
function speciesFit(beach, sp, month, sst) {
  if (!sp.waters.includes(beach.water) || sp.caution || (sp.protectedIn && sp.protectedIn.includes(beach.water))) return null;
  let s = sp.p && sp.p.includes(month) ? 90 : sp.m.includes(month) ? 70 : 15;
  const why = [s >= 90 ? "שיא העונה" : s >= 70 ? "בעונה" : "מחוץ לעונה"];
  if (reported(beach, sp)) { s += 10; why.push("דווח בחוף הזה"); }
  if (beach.water !== "lake" && !sp.habitats.includes(beach.type)) { s -= 25; why.push("סוג החוף פחות מתאים"); }
  const tf = tempFit(sp, sst);
  if (tf && tf.out) { s -= 12; why.push(tf.text); }                                    // outside the range where it lives
  else if (tf && tf.d > 0) { s -= Math.min(8, 2 * tf.d); why.push(tf.text); }          // lives here, but outside the ideal range
  else if (tf && tf.ideal) why.push(tf.text);
  return { score: Math.max(0, Math.min(100, Math.round(s))), why };
}

/* ---------- evidence strength of each scored factor (v3.4, after Hooked's labels: docs/hooked-il/01 §4.1) ----------
   How well our own research against the Strike Point session scores supports the factor (docs/strike-point/16, 20):
   s = strong (decoded: tide state, the 60–90 cm wave band), m = medium (found but not exact: pressure trend, strong wind, the lake model),
   w = weak (small or unstable effect: pressure level, moon, the Eilat offset), h = hypothesis (not measured: the dark-hours prior). */
const EVIDENCE = { s: { t: "חזק", c: "high", d: "פוענח במחקר מול ציוני Strike Point" }, m: { t: "בינוני", c: "mid", d: "נמצאה השפעה, לא מדויקת" },
  w: { t: "חלש", c: "low", d: "השפעה קטנה או לא יציבה במחקר" }, h: { t: "השערה", c: "low", d: "לא נמדד; הנחת עבודה" } };

/* ---------- ocean current and sinker (v3.4, after Hooked: docs/hooked-il/01 §4.1) ----------
   x.cur / x.curDir = the session's mean Open-Meteo ocean current (km/h, direction the water flows TO). Drift relative to the beach's
   seaward azimuth az (data/beach-features.js; Mediterranean default 285°): standing on the beach facing the sea, a current toward az+90° pulls
   the line to the right, toward az−90° to the left. Sinker for bait fishing, Hooked's rule of thumb: on a structure (marina, port,
   breakwater) 50 g, 60–80 g grip lead when the current is strong (> 1.5 km/h); from the beach by the wave height: < 0.6 m 60–80 g pyramid or
   flat (100 g in a strong current), < 1 m 100 g grip lead, higher 120–150 g grip lead or wait for the sea to settle. */
function currentAdvice(x, az, type) {
  if (!x || x.cur == null) return null;
  const v = Math.round(x.cur * 10) / 10, strong = v > 1.5, // the model gives 0.1 km/h steps; the advice uses the value it shows
    wave = x.waveMax != null ? x.waveMax / 100 : 0.5, structure = ["marina", "port", "breakwater"].includes(type);
  let drift;
  if (v < 0.4) drift = "הזרם כמעט עומד";
  else if (az == null || x.curDir == null) drift = "יש זרם";
  else { const rel = ((x.curDir - az) % 360 + 540) % 360 - 180;
    drift = Math.abs(rel) <= 30 ? "הזרם מושך החוצה לים" : Math.abs(rel) >= 150 ? "הזרם דוחף חזרה לחוף" : `הזרם מושך את הפיתיון ${rel > 0 ? "ימינה" : "שמאלה"} (כשהפנים לים)`; }
  const sinker = structure ? (strong ? "60–80 גרם עוגן" : "50 גרם")
    : wave < 0.6 ? (strong ? "100 גרם" : "60–80 גרם פירמידה או שטוחה") : wave < 1 ? "100 גרם עוגן" : "120–150 גרם עוגן, או לחכות שהים יירגע";
  return { v, strong, drift, sinker, heavy: v > 1.8 };
}

/* ---------- rain on the fishing day (v3.4, after Hooked's rain watch: docs/hooked-il/01 §3.2) ----------
   Over the fishing hours (an hour before nautical dawn to two hours after nautical dusk): an hour is wet at precipitation probability ≥ 60% or
   ≥ 1 mm, "maybe" at ≥ 35% or ≥ 0.2 mm. Returns null on a dry day; otherwise the peak probability, the total mm and the longest run of dry
   hours (at least 2) — the best dry window. */
function rainWatch(rows, key, win) {
  const h0 = Math.floor(win.dawn - 1), h1 = Math.ceil(win.dusk + 2), hrs = [];
  for (const r of rows) { const p = il(r.T); if (p.key === key && p.h >= h0 && p.h < h1) hrs.push({ h: p.h, p: r.rain || 0, mm: r.mm || 0 }); }
  if (!hrs.length) return null;
  const lv = q => q.p >= 60 || q.mm >= 1 ? 2 : q.p >= 35 || q.mm >= 0.2 ? 1 : 0;
  const peak = Math.max(...hrs.map(lv)); if (!peak) return null;
  let best = null, run = null;
  for (const q of hrs) { run = lv(q) ? null : run && q.h === run.end ? { start: run.start, end: q.h + 1 } : { start: q.h, end: q.h + 1 };
    if (run && run.end - run.start >= 2 && (!best || run.end - run.start > best.end - best.start)) best = { ...run }; }
  return { level: peak === 2 ? "wet" : "maybe", maxProb: Math.max(...hrs.map(q => q.p)), mm: hrs.reduce((a, q) => a + q.mm, 0), dry: best,
    wetFrom: hrs.find(q => lv(q)).h, wetTo: hrs.filter(q => lv(q)).pop().h + 1 };
}

/* ---------- v3.6 (5/11/2026): depth along the cast, cast plan per fish, jig weight, swell direction, moon light, solunar ----------
   Depth profile: straight lines between the EMODnet facts of a beach ({to5, to10, at300, at1000}: grid ~115 m, so a rough estimate) or of
   a 200 m strip ({to5, z200}: z200 = deepest point within 300 m). Points are [distance m, depth m], depth kept non-decreasing. */
function depthProfile(d) {
  if (!d) return null;
  const pts = [[0, 0]];
  if (d.z200 != null) { if (d.to5 != null) pts.push([d.to5, 5]); pts.push([300, d.z200]); }
  else { if (d.to5 != null) pts.push([d.to5, 5]); if (d.at300 != null) pts.push([300, d.at300]); if (d.to10 != null) pts.push([d.to10, 10]); if (d.at1000 != null) pts.push([1000, d.at1000]); }
  if (pts.length < 2) return null;
  pts.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < pts.length; i++) pts[i][1] = Math.max(pts[i][1], pts[i - 1][1]);
  return pts;
}
function depthAt(prof, x) {
  if (!prof) return null;
  for (let i = 1; i < prof.length; i++) { const [x0, y0] = prof[i - 1], [x1, y1] = prof[i];
    if (x <= x1) return x1 > x0 ? y0 + (y1 - y0) * (x - x0) / (x1 - x0) : y1; }
  return prof[prof.length - 1][1];
}
function distFor(prof, z) { // the distance at which the depth first reaches z (null: not within the profile)
  if (!prof) return null;
  for (let i = 1; i < prof.length; i++) { const [x0, y0] = prof[i - 1], [x1, y1] = prof[i];
    if (z <= y1) return y1 > y0 ? x0 + (x1 - x0) * (z - y0) / (y1 - y0) : x0; }
  return null;
}
// cast plan for one fish at one beach / strip: depth over the fish's casting range, and how far to cast to reach the depth it lives at.
// From a sandy shore most anglers cast 30–60 m; ~80 m with a surf rod; beyond 100 m is out of reach.
const CAST_MAX = 100;
function castPlan(sp, prof, type) {
  const g = sp && sp.gear; if (!g || !g.cast || !prof) return null;
  const r1 = Math.round(depthAt(prof, g.cast[0]) * 2) / 2, r2 = Math.round(depthAt(prof, g.cast[1]) * 2) / 2;
  const res = { cast: g.cast, z: [r1, r2] }, structure = ["marina", "port", "breakwater", "reef"].includes(type);
  if (g.depth && g.depth[0] > r2 + 0.5) {
    const d = distFor(prof, g.depth[0]);
    res.need = { z: g.depth[0], dist: d != null ? Math.round(d / 10) * 10 : null, reach: d != null && d <= CAST_MAX };
    if (structure) res.need.structure = true; // off a breakwater or a pier head the water is deeper than the beach profile says
  }
  return res;
}
// jig / lure weight: rule of thumb 2–3.5 g per metre of depth to reach the bottom within a few seconds, more with current, wind and waves;
// at least 10–20 g to cast 40 m or more from the shore. Returns [lo, hi] grams in 5 g steps.
function jigWeight(depth, cur, wind, wave) {
  const z = Math.max(1, depth || 3), k = 1 + Math.min(1, 0.4 * Math.max(0, (cur || 0) - 0.3)) + ((wind || 0) > 25 ? 0.3 : 0) + ((wave || 0) > 80 ? 0.2 : 0);
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  const lo = r5(Math.max(10, z * 2) * k), hi = r5(Math.max(20, z * 3.5) * k);
  return [Math.min(lo, 80), Math.min(Math.max(hi, lo + 5), 100)];
}
// swell direction against the shore (Open-Meteo marine wave_direction / swell_wave_direction: where the waves come FROM).
// az = the beach's seaward azimuth. rel > 0: the waves come from the right of an angler who faces the sea → the drift runs to the left.
function swellAdvice(dirFrom, az, h, per, hasBreakwater) {
  if (dirFrom == null || az == null || h == null || h < 40) return null;
  const rel = ((dirFrom - az) % 360 + 540) % 360 - 180, a = Math.abs(rel), side = rel > 0 ? "שמאלה" : "ימינה";
  const lee = (((az + (rel > 0 ? -90 : 90)) % 360) + 360) % 360; // compass bearing of the sheltered side of a structure
  if (a <= 20) return { k: "head", rel, text: `הגלים נכנסים ישר לחוף${per >= 7 ? ` (מחזור ${Math.round(per)} שנ׳)` : ""} — זרמים חוזרים בין השרטונים: שם הלברק והדניס מחכים למזון, ושם לא נכנסים למים` };
  if (a <= 65) return { k: "oblique", rel, lee, text: `הגלים מגיעים באלכסון — זרם לאורך החוף ${side} (כשהפנים לים): להטיל מעט נגד הזרם ולתת לפיתיון להיסחף${hasBreakwater ? "; הצד המוגן של השובר הוא בצד שהזרם הולך אליו" : ""}` };
  if (a <= 110) return { k: "side", rel, lee, text: `הגלים מגיעים מהצד — החוף מוגן יחסית${hasBreakwater ? "; מאחורי השובר, בצד שאליו הגלים הולכים, המים רגועים" : ""}` };
  return null; // waves from the land side: offshore, no effect on the beach
}
// moonlight after dark: the illuminated fraction reduced by cloud cover (an overcast full moon behaves like a dark night)
function moonLight(ill, cloud) { return cloud == null ? ill : ill * (1 - 0.75 * Math.min(100, cloud) / 100); }
// solunar periods (John Alden Knight's tables): major ≈ 2 h around the moon's upper and lower transit, minor ≈ 1 h around moonrise and
// moonset. Weak evidence — shown as information, not scored. Transit = the moon's highest point, found by a 10-minute scan of the day.
function solunar(key, lat, lon) {
  const t0 = ilTime(key, 0), alt = T => SunCalc.getMoonPosition(new Date(T), lat, lon).altitude, out = [];
  let hi = null, lo = null;
  for (let T = t0; T < t0 + 864e5; T += 6e5) { const a = alt(T); if (!hi || a > hi.a) hi = { T, a }; if (!lo || a < lo.a) lo = { T, a }; }
  const edge = T => T > t0 + 6e5 && T < t0 + 864e5 - 6e5; // a real turning point, not the day's edge
  if (hi && edge(hi.T)) out.push({ k: "major", T: hi.T, from: hi.T - 36e5, to: hi.T + 36e5, what: "הירח במרום" });
  if (lo && edge(lo.T)) out.push({ k: "major", T: lo.T, from: lo.T - 36e5, to: lo.T + 36e5, what: "הירח בנקודה הנמוכה" });
  // SunCalc works from the device's local midnight: ask around the Israeli day and keep what falls inside it (any device time zone)
  const seen = [];
  for (const dt of [6e5, 12 * 36e5, 864e5 - 6e5]) { const m = SunCalc.getMoonTimes(new Date(t0 + dt), lat, lon);
    for (const [T, what] of [[m.rise && +m.rise, "זריחת הירח"], [m.set && +m.set, "שקיעת הירח"]]) if (T && !seen.some(q => Math.abs(q - T) < 6e5)) { seen.push(T); out.push({ k: "minor", T, from: T - 18e5, to: T + 18e5, what }); } }
  return out.filter(p => il(p.T).key === key).sort((a, b) => a.T - b.T);
}

/* ---------- golden hours and the best hour of a day ---------- */
function goldenHours(key, lat, lon) {
  const t = SunCalc.getTimes(new Date(ilTime(key, 12)), lat, lon), sr = il(+t.sunrise).hf, ss = il(+t.sunset).hf;
  return [[sr, sr + 1], [ss - 1, ss]];
}
// best hour: inside the session with the highest activity index (Strike Point-based), the hour with the best safety score;
// hours that are not at least "fair" (50) are used only when nothing else exists. safeOf(row) → safety score.
function bestHour(rows, key, sessions, safeOf) {
  let best = null;
  for (const r of rows) {
    const p = il(r.T); if (p.key !== key) continue;
    const s = sessions.find(q => !q.na && p.h + 0.5 >= q.start && p.h + 0.5 <= q.end); if (!s) continue;
    const sf = safeOf ? safeOf(r) : 100;
    const v = (sf >= 50 ? 1e6 : 0) + s.score * 1000 + sf;
    if (!best || v > best.v) best = { h: p.h, v, s, safety: sf };
  }
  return best;
}

/* ---------- hourly activity curve (v3.3, 31/10/2026) ----------
   The same factors and weights as seaIndex, evaluated for every hour, so the day has a shape between and beyond the three session
   windows (the site has no night session, so the sessions stay the scored truth; this is the display layer, docs/strike-point/21).
   Per hour: tide phase and an extreme within ±1.5 h (= "inside the window" of a session), pressure level, 3 h trend before the hour and
   a centred 3 h change, moon rise/set within 2.5 h and transit within 1.5 h, wave band, strong wind. New here only: light — twilight
   and day 0, dark −4 (a prior, not fitted: 6 of the 12 gallery catches were after dark), with one hour of grace after dusk / before
   dawn so the evening session is not penalised. Validation (compass/hourly_curve.js, 4,080 sessions): the window mean sits within 2.5
   of the session score, and the best session of the day agrees with the site 78% (session model 76%). */
const HOUR_W = { night: -4, twilight: 0, grace: 1 };
function hourIndex(rows, i, tides, moon, win, water) {
  const r = rows[i], T = r.T, mid = T + HOUR / 2, hr = il(T).h + 0.5, f = [], W = SEA_W;
  const add = (pts, label, ev) => { if (pts) f.push({ pts, label, ev }); };
  if (tides.length) {
    const ph = tidePhase(tides, T);
    if (ph != null) add(ph < 0.25 ? W.tideLowAfter : ph < 0.5 ? W.tideRising : ph < 0.75 ? W.tideAfterHigh : W.tideFalling,
      ph < 0.25 ? "גאות מתחילה לעלות אחרי שפל" : ph < 0.5 ? "גאות עולה לקראת שיא" : ph < 0.75 ? "אחרי שיא הגאות" : "המים יורדים לקראת שפל", "s");
    const near = tides.filter(t => Math.abs(tm(t) - mid) <= 1.5 * HOUR), next = tides.find(t => tm(t) > T);
    if (near.some(t => t.type === "high")) add(W.highIn, "שיא גאות בשעה הזו", "s");
    else if (near.some(t => t.type === "low")) add(W.lowIn, "שפל בשעה הזו", "s");
    else if (next) add(next.type === "high" ? W.risingAll : W.fallingAll, next.type === "high" ? "הגאות עולה" : "המים יורדים", "s");
  }
  const at = k => rows[i + k] && rows[i + k].p != null ? rows[i + k].p : null, p0 = r.p;
  if (p0 != null) {
    if (p0 >= 1005 && p0 < 1013) add(W.pMid, `לחץ ${Math.round(p0)} hPa`, "w"); else if (p0 >= 1016) add(W.pHigh, `לחץ ${Math.round(p0)} hPa (גבוה)`, "w");
    const p3 = at(-3), d = p3 != null ? p0 - p3 : 0;
    if (d < -1) add(W.dp3Drop, "הלחץ ירד ב-3 השעות שלפני", "m"); else if (d < -0.3) add(W.dp3Fall, "הלחץ ירד מעט ב-3 השעות שלפני", "m"); else if (d > 0.3 && d <= 1) add(W.dp3Rise, "הלחץ עלה מעט ב-3 השעות שלפני", "m");
    const pa = at(-1), pb = at(2), dS = pa != null && pb != null ? pb - pa : 0;
    if (dS < -1) add(W.dpSDrop, "הלחץ יורד סביב השעה", "m"); else if (dS > 0.3) add(W.dpSRise, "הלחץ עולה סביב השעה", "m");
  }
  if (moon) {
    const near = (t, h) => Math.abs(t - mid) <= h * HOUR;
    if (moon.ev.some(e => e.type === "rise" && near(e.T, 2.5))) add(W.moonRise, "זריחת ירח", "w");
    if (moon.ev.some(e => e.type === "set" && near(e.T, 2.5))) add(W.moonSet, "שקיעת ירח", "w");
    if (moon.transits.some(t => near(t, 1.5))) add(W.transit, "הירח בשיא הגובה", "w");
  }
  if (inWaveBand(r)) add(W.waveBand, r.src === "sg" ? "גל 40–70 ס״מ (StormGlass) — ים פעיל" : "גל 60–90 ס״מ — ים פעיל", "s");
  if (r.wind != null && r.wind >= 14) add(W.windStrong, `רוח ${Math.round(r.wind)} קמ״ש`, "m");
  if (water && water !== "med") add(W.eilat, "מפרץ אילת", "w");
  const light = (hr >= win.dawn - HOUR_W.grace && hr < win.sunrise + 1) || (hr > win.sunset - 1 && hr <= win.dusk + HOUR_W.grace) ? "twilight" : hr >= win.sunrise + 1 && hr <= win.sunset - 1 ? "day" : "night";
  if (light === "twilight") add(HOUR_W.twilight, "דמדומים", "h"); else if (light === "night") add(HOUR_W.night, "חושך", "h");
  const score = W.base + f.reduce((a, b) => a + b.pts, 0);
  return { score: Math.max(5, Math.min(98, Math.round(score))), factors: f.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts)), light };
}
// the curve of one day: rows = the full hourly forecast (the first hours of the day need the hours before them); lake beaches have no
// hourly model, so each hour there takes the score of its (nearest) session, minus the dark prior at night
function hourCurve(rows, key, tides, moon, win, water, sessions) {
  const T0 = ilTime(key, 0), T1 = ilTime(key, 24), out = [], lake = water === "lake";
  rows.forEach((r, i) => {
    if (r.T < T0 || r.T >= T1) return;
    const p = il(r.T), hr = p.h + 0.5;
    if (lake) {
      const ok = (sessions || []).filter(q => !q.na); if (!ok.length) return;
      const s = ok.find(q => hr >= q.start && hr <= q.end) || ok.slice().sort((a, c) => Math.abs((a.start + a.end) / 2 - hr) - Math.abs((c.start + c.end) / 2 - hr))[0];
      const night = hr < win.dawn - HOUR_W.grace || hr > win.dusk + HOUR_W.grace;
      out.push({ T: r.T, h: p.h, row: r, score: Math.max(5, s.score + (night ? HOUR_W.night : 0)), factors: [{ pts: 0, label: `לפי סשן ${s.name}` }].concat(night ? [{ pts: HOUR_W.night, label: "חושך" }] : []), light: night ? "night" : "day" });
      return;
    }
    out.push({ T: r.T, h: p.h, row: r, ...hourIndex(rows, i, tides, moon, win, water) });
  });
  return out;
}
// the best run of 3 consecutive hours (2 when clearly better) that has not ended yet; the "recommended window" of the day screen
function bestWindow(curve, fromT) {
  const c = curve.filter(p => p.T + HOUR > fromT); if (!c.length) return null;
  let best = null;
  for (const n of [3, 2]) for (let i = 0; i + n <= c.length; i++) {
    const seg = c.slice(i, i + n); if (seg.some((p, k) => k && p.T - seg[k - 1].T !== HOUR)) continue;
    const m = seg.reduce((a, p) => a + p.score, 0) / n;
    if (!best || m > best.mean + 0.5) best = { start: seg[0].h, end: seg[n - 1].h + 1, mean: m, score: Math.round(m), hours: seg };
  }
  return best;
}

window.ENGINE = { il, ilTime, hm, addDays, windows, moonEvents, tideExtremes, tidePhase, sessionInputs, seaIndex, seaIndexV1, SEA_W, lakeIndex, tip, comfort, level, fishFor, whereToday, whereScore, goToday, stripContext, stripAdjust, luresFor, speciesFit, goldenHours, bestHour, safety, hourIndex, hourCurve, bestWindow, HOUR_W, HOUR, EVIDENCE, tempFit, currentAdvice, rainWatch, curMean, depthProfile, depthAt, distFor, castPlan, jigWeight, swellAdvice, moonLight, solunar };
})();
