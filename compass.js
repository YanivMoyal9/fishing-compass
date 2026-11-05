/* מצפן הדייג — ממשק: היום · חופים · דגים · דמויים · יומן */
(function () {
const E = window.ENGINE;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const REGIONS = ["צפון", "שרון", "מרכז", "דרום", "אילת", "כנרת"];
const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } } };
const state = { tab: store.get("compass-tab", "today"), beach: store.get("compass-beach", "חברת חשמל"), day: null, rankSession: "best", rankRegion: "all", boat: false, target: store.get("compass-target", "") };
// IMS sea-forecast zone per region
const ZONE = { "צפון": "212", "שרון": "210", "מרכז": "210", "דרום": "213", "אילת": "214", "כנרת": "211" };
const DIR8 = d => ["צפון", "צפון-מזרח", "מזרח", "דרום-מזרח", "דרום", "דרום-מערב", "מערב", "צפון-מערב"][Math.round(((d % 360) + 360) % 360 / 45) % 8];
let FC = null;
const HOUR_MS = 36e5;
const todayKey = () => E.il(Date.now()).key;
// v3.7: on today, only sessions that have not ended yet can be recommended
const ahead = (sessions, key) => key !== todayKey() ? sessions : sessions.filter(s => s.end > E.il(Date.now()).hf);

/* ---------- calculation per beach and day ---------- */
const cache = new Map();
const canBoat = b => ["marina", "port", "breakwater"].includes(b.type) && b.water === "med" && FC && FC.data[b.group + "@boat"];
function beachDay(b, key, boat) {
  boat = !!boat && canBoat(b);
  const ck = b.name + key + (FC ? FC.at : 0) + (boat ? "@boat" : ""); if (cache.has(ck)) return cache.get(ck);
  const rows = (FC && FC.data[b.group + (boat ? "@boat" : "")]) || [];
  const win = E.windows(key, b.lat, b.lon), lake = b.water === "lake";
  const tides = lake ? [] : E.tideExtremes(rows), moon = E.moonEvents(key, 1, b.lat, b.lon);
  const safeOf = r => E.safety(r, safetyCtx(b, r)).score;
  const sessions = win.sessions.map(s => {
    const x = E.sessionInputs(rows, key, s); if (!x) return { ...s, na: true };
    const idx = lake ? E.lakeIndex(x, s, moon) : E.seaIndex(x, s, tides, moon, b.water);
    // safety layer for the session's hours (Cormorant mechanics): average for display, minimum for the danger flag
    const T0 = E.ilTime(key, Math.floor(s.start)), T1 = E.ilTime(key, Math.ceil(s.end));
    const sf = rows.filter(r => r.T >= T0 && r.T < T1).map(safeOf);
    const safe = sf.length ? { avg: Math.round(sf.reduce((a, c) => a + c, 0) / sf.length), min: Math.min(...sf) } : null;
    return { ...s, x, ...idx, tip: E.tip(rows, key, s, lake), safe };
  });
  const res = { win, sessions, safeOf, tides: tides.filter(t => E.il(t.T).key === key), rows: rows.filter(r => E.il(r.T).key === key), rowsAll: rows, tidesAll: tides };
  cache.set(ck, res); return res;
}
/* ---------- safety context per hour: light, Kinneret wave (IMS official range), relevant official warning ---------- */
const sunCache = new Map();
function lightAt(b, T) {
  const k = E.il(T).key, ck = b.name + k;
  if (!sunCache.has(ck)) sunCache.set(ck, SunCalc.getTimes(new Date(E.ilTime(k, 12)), b.lat, b.lon));
  const t = sunCache.get(ck);
  return T >= +t.sunrise && T <= +t.sunset ? "day" : (T >= +t.dawn && T < +t.sunrise) || (T > +t.sunset && T <= +t.dusk) ? "twilight" : "night";
}
/* v3.7: an official warning counts only for the water body it names and inside its valid time.
   Water: "בים התיכון" / "חופי הים התיכון" → med · "מפרץ אילת" / "ים סוף" / "אילת" → eilat · "כנרת" → lake; a sea warning that names no water
   is taken as Mediterranean (the usual IMS wording). Time: "ב-DD/MM מ-HH עד HH" (to the next day when the end hour is earlier; "עד HH ב-DD/MM"
   when given); without a parsable time: from the issue time for 24 h. */
const SEA_WARN = /גלים|ים סוער|ים גבוה|סערה|רוחות חזקות/;
function warnWater(w) {
  const t = w.title + " " + w.text, out = [];
  if (/ים התיכון|הים התיכון|חופי הים/.test(t)) out.push("med");
  if (/מפרץ אילת|ים סוף|אילת/.test(t)) out.push("eilat");
  if (/כנרת|כנרות/.test(t)) out.push("lake");
  if (!out.length && /גלים|ים סוער|ים גבוה/.test(t)) out.push("med");
  return out;
}
function warnSpan(w) {
  const t = w.text || "", y = new Date().getFullYear();
  const m = t.match(/ב-?(\d{1,2})\/(\d{1,2})\s*מ-?(\d{1,2})(?::\d{2})?\s*(?:ועד|עד)\s*(\d{1,2})(?::\d{2})?(?:\s*ב-?(\d{1,2})\/(\d{1,2}))?/);
  if (m) {
    const key = (d, mo) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, k0 = key(m[1], m[2]);
    const from = E.ilTime(k0, +m[3]); let to = m[5] ? E.ilTime(key(m[5], m[6]), +m[4]) : E.ilTime(k0, +m[4]);
    if (to <= from) to += 864e5;
    return [from, to];
  }
  const T = Date.parse(w.date); return isNaN(T) ? null : [T, T + 864e5];
}
function zoneWarning(b, T) {
  const o = FC && FC.official; if (!o || !o.warnings) return false;
  return o.warnings.some(w => {
    if (!(SEA_WARN.test(w.title + w.text) || (/כנרת|כנרות/.test(w.text) && /רוח|סערה|גלים/.test(w.text)))) return false;
    if (!warnWater(w).includes(b.water)) return false;
    const sp = warnSpan(w); return !sp || T == null || (T >= sp[0] && T < sp[1]);
  });
}
function lakeWaveAt(T) {
  const z = FC && FC.official && FC.official.sea && FC.official.sea.zones["211"]; if (!z) return null;
  // IMS local time ("YYYY-MM-DD HH:MM") → Israel time incl. summer time (v3.7; was a fixed +02:00)
  const at = s => E.ilTime(s.slice(0, 10), +s.slice(11, 13) + +s.slice(14, 16) / 60);
  const p = z.periods.find(q => { const a = at(q.from), c = at(q.to); return T >= a && T < c; });
  return p && p.wave_cm ? p.wave_cm[1] / 100 : null;
}
function safetyCtx(b, r) { return { lake: b.water === "lake", light: lightAt(b, r.T), lakeWave: b.water === "lake" ? lakeWaveAt(r.T) : null, warning: zoneWarning(b, r.T) }; }
// v3.7: a beach whose shore point is inside (or within ~60 m of) a nature reserve or a military area — never recommended (data/legal.js);
// port polygons are too broad (they include breakwaters where people fish), so ports stay as information only
const closedAt = b => { const a = window.LEGAL && window.LEGAL.areas && window.LEGAL.areas[b.name]; return a ? a.find(x => ["reserve", "military"].includes(x.kind) && x.dist_m <= 60) || null : null; };
const beachByName = n => BEACHES.find(b => b.name === n) || BEACHES[0];
// VIP beaches: the 14 beaches Strike Point locks to its VIP tier (site list, 30/10/2026) — shown as a small tag next to the name.
const vipTag = b => b.vip ? ` <span class="vip-tag" title="חוף VIP באתר Strike Point">VIP</span>` : "";

/* ---------- tabs ---------- */
function setTab(t) {
  state.tab = t; store.set("compass-tab", t);
  document.body.classList.toggle("dashboard-home", t === "today");
  $$("[data-tab]").forEach(el => el.hidden = el.dataset.tab !== t);
  $$(".tabbar button").forEach(b => { const on = b.dataset.go === t; b.classList.toggle("is-on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
  if (t === "rank") renderRank(); if (t === "fish") renderFish(); if (t === "log") renderLog(); if (t === "lures") renderLureGuide();
  window.scrollTo({ top: 0 });
  if (t === "today" && window.FISHING_DASHBOARD) requestAnimationFrame(() => FISHING_DASHBOARD.invalidate());
}

/* ---------- beach picker ---------- */
function fillPicker() {
  const reg = $("#pickRegion"), sel = $("#pickBeach"), b = beachByName(state.beach);
  reg.innerHTML = REGIONS.map(r => `<option ${r === b.region ? "selected" : ""}>${r}</option>`).join("");
  const fill = r => { sel.innerHTML = BEACHES.filter(x => x.region === r).map(x => `<option ${x.name === state.beach ? "selected" : ""}>${esc(x.name)}</option>`).join(""); };
  fill(b.region);
  reg.onchange = () => { fill(reg.value); pickBeach(sel.value); };
  sel.onchange = () => pickBeach(sel.value);
}
function pickBeach(n) { state.beach = n; store.set("compass-beach", n); renderToday(); if (state.tab === "fish") renderFish(); }

/* ---------- beach characteristics (data/beach-features.js) ---------- */
function featuresHtml(b) {
  const f = (window.BEACH_FEATURES || {})[b.name]; if (!f) return "";
  return `<p class="features">${f.tags.map(t => `<span class="ft">${esc(t)}</span>`).join("")}${f.warn.map(w => `<span class="ft is-warn">⚠️ ${esc(w)}</span>`).join("")}</p>`;
}

/* ---------- what to do in these conditions: method, lure, colour and where in the beach ----------
   Our fishing-knowledge matrix (docs/strike-point/04 §2, §6, §7): sea state × wind, light, pressure trend, after a storm,
   onshore / offshore wind, warm water in winter, moon. */
const DIRDIFF = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
// v3.7: the stream that empties near the beach (data/legal.js STREAMS when present; otherwise the beach's own "שפך נחל" tag)
function streamNear(b) {
  const L = window.LEGAL && window.LEGAL.streams && window.LEGAL.streams[b.name]; if (L) return L.stream;
  const f = (window.BEACH_FEATURES || {})[b.name]; return f && f.tags.includes("שפך נחל") ? "נחל" : null;
}
// v3.6: satellite ocean signals for the beach's data group (data/ocean.json): SST fronts, chlorophyll level and colour edges, SST anomaly.
// Shore anglers get a front or an edge only when it is close (≤ 12 km); in boat mode up to 30 km. Images older than 7 days are ignored.
function oceanAdvice(b) {
  const O = FC && FC.ocean, o = O && O.g && O.g[b.group]; if (!o) return [];
  const boat = state.boat && canBoat(b), near = boat ? 30 : 12, out = [];
  const fresh = d => d && Date.now() - Date.parse(d) < 7 * 864e5, dm = d => d.slice(8, 10).replace(/^0/, "") + "/" + d.slice(5, 7).replace(/^0/, "");
  const sstDate = O.sstDate, chlDate = o.chlDate || O.chlDate;
  if (fresh(sstDate) && o.front && o.front.dist_km <= near) {
    const f = o.front, dT = f.sstWarmSide != null && f.sstColdSide != null ? Math.abs(f.sstWarmSide - f.sstColdSide).toFixed(1) : null;
    out.push(["🌡️", `חזית טמפרטורה${f.strong ? " חדה" : ""} ~${Math.round(f.dist_km)} ק״מ ל${DIR8(f.bearing_deg)}${dT ? ` (הפרש ~${dT}° בין המים)` : ""} — דגי פיתיון וטורפים פלגיים (פלמידה, טונית, אינטיאס) מסיירים לאורך קווים כאלה${f.dist_km > 12 ? "; רלוונטי לסירה" : ""} · לוויין ${dm(sstDate)}`]);
  }
  if (fresh(sstDate) && o.sstA != null && Math.abs(o.sstA) >= 1.5) out.push(["🌡️", `המים ${o.sstA > 0 ? "חמים" : "קרים"} ב-${Math.abs(o.sstA).toFixed(1)}° מהרגיל לעונה — ${o.sstA > 0 ? "מינים של מים חמים נשארים מאוחר יותר" : "המעבר לדגי החורף מוקדם"} · לוויין`]);
  // v3.7: water clarity — the satellite estimate (Kd490 → Secchi depth) corrected by the last two days of waves and rain near the shore
  { const rows = (FC.data && FC.data[b.group]) || [], now = Date.now(), past = rows.filter(r => r.T <= now && r.T > now - 48 * 36e5);
    const wMax = past.reduce((m, r) => Math.max(m, r.wave || 0), 0), mm = past.reduce((a, r) => a + (r.mm || 0), 0);
    const kdOk = fresh(o.kdDate) && o.clarity, stormy = wMax >= 150 || mm >= 15;
    if (stormy) out.push(["💧", `צלילות: עכור ליד החוף — ${wMax >= 150 ? `גלים עד ${Math.round(wMax)} ס״מ` : `${Math.round(mm)} מ״מ גשם`} ביומיים האחרונים: צבעים בולטים (צ׳רטרוז, זוהר), רעש ורטט; לברק ודניס בסרף`]);
    else if (kdOk) { const T = { clear: ["צלול", "חוט דק, ליידר פלואורוקרבון ודמויים טבעיים; עדיף שחר ודמדומים"], mid: ["בינוני", "צבעים טבעיים עם נגיעת ניגוד"], murky: ["עכור", "צבעים בולטים, רעש ורטט"] }[o.clarity];
      if (T) out.push(["💧", `צלילות: ${T[0]}${o.secchi_m ? ` (ראות במים ~${o.secchi_m >= 40 ? "40+" : o.secchi_m} מ׳ בים הפתוח)` : ""} — ${T[1]} · לוויין ${dm(o.kdDate)}`]); } }
  if (fresh(chlDate)) {
    if (o.chlLvl === "high") out.push(["🟢", `מים ירוקים ליד החוף (כלורופיל ${o.chl.toFixed(1)} מ״ג/מ״ק): הרבה מזון ודגיגים, אבל פחות צלול — צבעים בולטים; אחרי סערה זו בעיקר עכירות · לוויין ${dm(chlDate)}`]);
    else if (o.chlLvl === "low") out.push(["🔵", `מים כחולים ודלים (כלורופיל ${o.chl.toFixed(2)}): צלול מאוד — חוט דק, דמויים טבעיים ושעות אור עמום · לוויין ${dm(chlDate)}`]);
    const e = o.chlEdge; if (e && e.dist_km <= near) out.push(["🟩", `קו צבע ירוק–כחול ~${Math.round(e.dist_km)} ק״מ ל${DIR8(e.bearing_deg)} — דגי פיתיון מתרכזים בשוליו, ואחריהם טורפים${e.dist_km > 12 ? "; רלוונטי לסירה" : ""} · לוויין ${dm(chlDate)}`]);
  }
  return out;
}
function adviceFor(s, b) {
  const x = s.x, out = [], lake = b.water === "lake", w = x.waveMax, wind = x.wind;
  if (!lake && w != null) {
    if (w > 130) out.push(["⛔", "ים גבוה מאוד — לא יוצאים"]);
    else if (w > 100) out.push(["🛟", "ים גבוה — רק מקומות מוגנים: מרינה או הצד המוגן של שובר"]);
    else if (w >= 60) out.push(["🌊", "ים עובד — מינו או וויברציה לגומבר וללברק, צבעים בולטים, לחפש מים לבנים מעל שרטונים"]);
    else if (w >= 30) out.push(wind != null && wind > 25 ? ["💨", "ים נוח עם רוח — מתכות כבדות יותר והטלה עם הרוח"] : ["✨", `ים נוח — חלון טוב: מתכות לטרכון ולפלמידה${s.id === "morning" ? ", פופר בשחר" : ""}`]);
    else out.push(["🪞", "ים שקט מאוד — מים צלולים ודגים זהירים: חוט דק, דמויים קטנים וטבעיים, LRF; אגי בערב"]);
  }
  if (lake && wind != null) out.push(wind > 25 ? ["💨", "רוח חזקה בכנרת — לחפש חוף מוגן מהרוח, להיזהר מגלים"] : ["🪞", "כנרת שקטה — דמויים קטנים וחוט דק, שחר וערב"]);
  // light: the session decides the layer
  out.push(s.id === "morning" ? ["🌅", "שחר — לעבוד על פני המים: פופר או סטיקבייט"] : s.id === "midday" ? ["☀️", "אור מלא — לרדת לעומק: ג׳יג מתכת או מיקרו-ג׳יג"] : ["🌇", "דמדומים — מינו או שאד; אחרי החשכה אגי, וברקודה מתחת לאורות"]);
  if (x.dpS <= -0.3 || x.dp3 <= -1) out.push(["📉", "לחץ יורד — בדרך כלל חלון אכילה פעיל"]);
  else if (x.dp6 >= 2) out.push(["📈", "לחץ עולה מהר — הדגים זהירים יותר: עבודה איטית ועדינה"]);
  const rows = (FC && FC.data[b.group]) || [], prev = rows.filter(r => r.T < x.T0 && r.T >= x.T0 - 36 * HOUR_MS).map(r => r.wave).filter(v => v != null);
  if (!lake && prev.length && Math.max(...prev) >= 100 && (w == null || w < 80)) out.push(["🟤", "אחרי סערה — מים עכורים: צבעים בולטים או זוהרים, שפכי נחלים; דניס ולברק בסרף"]);
  const f = (window.BEACH_FEATURES || {})[b.name], mid = rows.find(r => Math.abs(r.T - (x.T0 + x.T1) / 2) < 31 * 6e4);
  if (f && f.az != null && mid && mid.dir != null && mid.wind >= 12) {
    const fromSea = DIRDIFF(mid.dir, f.az) <= 60, fromLand = DIRDIFF(mid.dir, (f.az + 180) % 360) <= 60;
    if (fromLand) out.push(["🧭", "רוח מהיבשה — ים שטוח והטלה רחוקה: לדוג בנקודה החשופה"]);
    else if (fromSea) out.push(["🧭", "רוח מהים — לחפש צד מוגן של שובר או מפרצון"]);
  }
  // v3.4: ocean current and sinker (engine currentAdvice, after Hooked); rain in the window and in the day before
  if (!lake) { const ca = E.currentAdvice(x, f && f.az != null ? f.az : b.water === "med" ? 285 : null, b.type);
    if (ca) out.push(["⚓", `זרם ${ca.v.toFixed(1)} קמ״ש — ${ca.drift}. משקולת לפיתיון: ${ca.sinker}${ca.heavy ? "; בדמויים: ג׳יג כבד יותר כדי להגיע לעומק" : ""}`]); }
  const sessMm = rows.filter(r => r.T >= x.T0 && r.T < x.T1).reduce((a, r) => a + (r.mm || 0), 0), pr = x.rain || 0;
  if (pr >= 60 || sessMm >= 1) out.push(["☔", `גשם צפוי בחלון (עד ${Math.round(pr)}%${sessMm >= 0.5 ? `, ${sessMm.toFixed(1)} מ״מ` : ""}) — מעיל גשם ושקית לטלפון; סלעים ושוברים רטובים חלקים`]);
  else if (pr >= 35 || sessMm >= 0.2) out.push(["🌂", `סיכוי לגשם בחלון (${Math.round(pr)}%) — לקחת מעיל`]);
  const mm24 = rows.filter(r => r.T < x.T0 && r.T >= x.T0 - 24 * HOUR_MS).reduce((a, r) => a + (r.mm || 0), 0);
  if (mm24 >= 10) out.push(["🟤", `${Math.round(mm24)} מ״מ גשם ב-24 השעות שלפני — מים עכורים ליד החוף ובשפכים: צבעים בולטים`]);
  // v3.7: thunderstorms in the window (WMO code 95–99, or high CAPE with rain likely)
  const win = rows.filter(r => r.T >= x.T0 && r.T < x.T1), thunder = win.some(r => r.wcode >= 95), unstable = !thunder && win.some(r => r.cape >= 1500 && (r.rain || 0) >= 40);
  if (thunder) out.push(["⚡", "סופת רעמים צפויה בחלון — ברק פוגע בחכה ארוכה על שובר או חוף פתוח: לא לצאת, או לפנות לרכב בשמיעת רעם ולחכות 30 דקות אחרי הרעם האחרון"]);
  else if (unstable) out.push(["🌩️", "אוויר לא יציב עם סיכוי לממטרים — ייתכנו רעמים: לעקוב אחרי השמיים ולהתרחק מהמים ברעם הראשון"]);
  // v3.7: runoff after rain near a stream mouth (Ministry of Health advice: no bathing after rain near outlets) — murky water, don't eat the catch
  const mm48 = rows.filter(r => r.T < x.T0 && r.T >= x.T0 - 48 * HOUR_MS).reduce((a, r) => a + (r.mm || 0), 0), sm = streamNear(b);
  if (!lake && sm && mm48 >= 15) out.push(["🚱", `${Math.round(mm48)} מ״מ גשם ביומיים — ${esc(sm)} שופך ליד החוף מי נגר ולעיתים ביוב: מים עכורים, ולא מומלץ לאכול דגים שנתפסו ליד השפך`]);
  // v3.7: jellyfish season (Rhopilema nomadica swarms, mainly June–August)
  if (b.water === "med" && [6, 7, 8].includes(+state.day.slice(5, 7))) out.push(["🪼", "עונת המדוזות — לבדוק דיווחים לפני היציאה (meduzot.co.il), לא לגעת במדוזות שנתפסו בחוט, ובצריבה: לשטוף במי ים, לא במים מתוקים"]);
  const mo = +state.day.slice(5, 7);
  if (f && f.tags.includes("מים חמים בחורף") && (x.sst != null ? x.sst <= 21 : [12, 1, 2, 3].includes(mo))) out.push(["🌡️", `מים ${x.sst != null ? fmtNum(x.sst, 1) + "°" : "קרים"} — המים החמים בקטע הזה מרכזים טורפים (ראו נקודות בחוף)`]);
  // v3.6: jig weight for this beach's depth at a 50 m cast, the current, wind and waves; swell direction against the shore
  if (!lake) { const prof = E.depthProfile(b.depth), z50 = prof ? E.depthAt(prof, 50) : null, jw = E.jigWeight(z50, x.cur, x.windMax, w);
    out.push(["⚖️", `משקל ג׳יג / מתכת: ${jw[0]}–${jw[1]} ג׳${z50 != null ? ` (עומק ~${fmtNum(z50, 1)} מ׳ בהטלה של 50 מ׳)` : ""}${x.cur > 1 || x.windMax > 25 ? " — כבד יותר בגלל ה" + [x.cur > 1 ? "זרם" : "", x.windMax > 25 ? "רוח" : ""].filter(Boolean).join(" וה") : ""}`]);
    const az = f && f.az != null ? f.az : b.water === "med" ? 285 : null, sw = mid ? E.swellAdvice(mid.sdir != null && mid.swell >= 30 ? mid.sdir : mid.wdir, az, mid.wave, mid.per, f && f.tags.some(t => /שובר|מזח/.test(t))) : null;
    if (sw) out.push(["↗️", sw.text]); }
  if (!lake) out.push(...oceanAdvice(b));
  if (s.id === "evening" && typeof SunCalc !== "undefined") { const ill = SunCalc.getMoonIllumination(new Date(x.T1)).fraction;
    const night = rows.filter(r => r.T >= x.T1 && r.T < x.T1 + 4 * HOUR_MS && r.cloud != null), cloud = night.length ? night.reduce((a, r) => a + r.cloud, 0) / night.length : null, lit = E.moonLight(ill, cloud);
    if (ill >= 0.85 && lit >= 0.6) out.push(["🌕", "ירח כמעט מלא — יותר פעילות בלילה: קלאמרי, וברקודה מתחת לאורות"]);
    else if (ill >= 0.6 && cloud >= 70) out.push(["☁️", `ירח ${Math.round(ill * 100)}% אבל מעונן (${Math.round(cloud)}%) — הלילה יהיה חשוך: אורות המזח והנמל חשובים יותר, אגי זוהר`]);
    else if (ill <= 0.15) out.push(["🌑", "ליל מולד חשוך — השחר והדמדומים חשובים יותר מהלילה"]); }
  if (f && f.tags.some(t => /שובר|שפך|סלעים|מזח/.test(t))) out.push(["📍", `במקום: ${f.tags.filter(t => /שובר|שפך|סלעים|מזח|לגונה|מפרצון/.test(t)).slice(0, 3).join(", ")} — קצה המבנה, פתחים ותעלות הם הנקודות החמות`]);
  return out;
}

/* ---------- why here today: food / ambush / comfort (engine.js whereToday, docs/strike-point/18) ---------- */
const NEED = { food: ["🍽️", "אוכל"], ambush: ["🎯", "מארב"], comfort: ["🌡️", "נוחות"] }, CONF_T = { high: "גבוה", mid: "בינוני", low: "נמוך" };
function whyHereItems(s, b, key = state.day) {
  if (!s || s.na || (state.boat && canBoat(b))) return null;
  const rows = (FC && FC.data[b.group]) || [], w = E.whereToday(b, s.x, s.id, rows, (window.BEACH_FEATURES || {})[b.name], +key.slice(5, 7));
  // v3.9.1: a lake beach keeps only lake reasoning — rules that speak of the sea, its fish or its tide are dropped (filter by b.water)
  if (b.water === "lake") { const SEA = /קלאמרי|ברקודה|סרף|שרטונ|שונית|גאות|מהים|ים גבוה|ים צלול|דניס|לברק/; w.pro = w.pro.filter(r => !SEA.test(r.text)); w.con = w.con.filter(r => !SEA.test(r.text)); }
  return w.pro.length || w.con.length ? w : null;
}
const whyLi = (r, against) => `<li${against ? ' class="is-con"' : ""}><span aria-hidden="true">${against ? "✋" : NEED[r.need][0]}</span> ${against ? "<b>נגד:</b> " : ""}${esc(r.text)} <small class="conf conf-${r.conf}" title="${NEED[r.need][1]} · רמת ביטחון במחקר">${CONF_T[r.conf]}</small></li>`;
const whyList = w => `<ul>${w.pro.map(r => whyLi(r)).join("")}${w.con.map(r => whyLi(r, true)).join("")}</ul>`;
function whyHereHtml(s, b, past) {
  const w = whyHereItems(s, b); if (!w) return "";
  return `<details class="advice why-here" ${past ? "" : "open"}><summary>למה כאן היום</summary>${whyList(w)}
    <p class="hint">מה הטורף מחפש: אוכל, מארב ונוחות, מול המבנה של החוף ותנאי היום. מודל ידע ומחקר, עדיין לא מאומת בתפיסות.</p></details>`;
}
// short version for the dashboard's recommended-window card
function whyHereBrief(s, b) {
  const w = whyHereItems(s, b); if (!w) return "";
  return `<div class="why-here dash-why"><b>למה כאן היום</b>${whyList(w)}<small class="hint">מודל ידע ומחקר, עדיין לא מאומת בתפיסות</small></div>`;
}

/* ---------- today ---------- */
function dayChips(el, active, onPick) {
  const k0 = todayKey();
  el.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const k = E.addDays(k0, i), d = new Date(E.ilTime(k, 12));
    return `<button type="button" class="chip ${k === active ? "is-on" : ""}" data-k="${k}">${i === 0 ? "היום" : i === 1 ? "מחר" : DAY[d.getUTCDay()]} <small>${+k.slice(8)}/${+k.slice(5, 7)}</small></button>`;
  }).join("");
  el.querySelectorAll("button").forEach(btn => btn.onclick = () => onPick(btn.dataset.k));
}
const fmtNum = (v, d = 0) => v == null || isNaN(v) ? "—" : (+v).toFixed(d);
const safeCls = v => v >= 75 ? "sf-good" : v >= 50 ? "sf-ok" : v >= 30 ? "sf-weak" : "sf-danger";
const safeName = v => v >= 75 ? "טוב" : v >= 50 ? "סביר" : v >= 30 ? "חלש" : "מסוכן";
// v3.4: evidence strength of a scored factor (engine EVIDENCE, after Hooked)
// v3.9.1: is the session's 40 ceiling the official warning's doing? Then the top banner already says it and the card stays quiet.
const cappedByWarning = (b, x) => ((FC && FC.data[b.group]) || []).some(r => r.T >= x.T0 && r.T < x.T1 && zoneWarning(b, r.T));
const evChip = ev => { const e = ev && E.EVIDENCE && E.EVIDENCE[ev]; return e ? ` <small class="ev ev-${e.c}" title="חוזק הראיה: ${esc(e.d)}">${e.t}</small>` : ""; };
function sessionCard(s, b) {
  if (s.na) return `<article class="sess is-na"><h3>${s.name}</h3><p>אין נתונים לשעות האלה</p></article>`;
  const lv = E.level(s.score), x = s.x, fish = E.fishFor(b, +state.day.slice(5, 7), x.sst);
  const lures = E.luresFor(fish.now, s.tip.layer).slice(0, 3);
  const past = x.T1 < Date.now();
  const fishLayer = fish.now.filter(r => !r.sp.bait && (r.sp.layer === "all" || r.sp.layer === s.tip.layer)).slice(0, 5).map(r => r.sp);
  return `<article class="sess ${lv.c}${past ? " is-past" : ""}">
    <header><h3>${s.name}${past ? ' <small class="past-tag">עבר</small>' : ""}</h3><span class="sess-time">${E.hm(s.start)}–${E.hm(s.end)}</span></header>
    <div class="sess-score"><b>${s.score}</b><span>${lv.t}</span>${s.safe ? `<em class="safe-chip ${safeCls(s.safe.avg)}" title="בטיחות ונוחות: רוח, משבים, גלים, גשם, ראות, חום ואור. מינימום בחלון: ${s.safe.min}">בטיחות ${s.safe.avg}</em>` : ""}</div>
    ${s.safe && s.safe.min < 30 ? `<p class="danger">⛔ תנאים מסוכנים בחלק מהחלון (בטיחות ${s.safe.min}) — לא לעלות על שוברים וסלעים</p>` : s.safe && s.safe.min < 50 && !cappedByWarning(b, x) ? `<p class="caution">⚠️ תנאים קשים בחלק מהחלון (בטיחות ${s.safe.min})</p>` : ""}
    <p class="sess-tip"><span class="tip-ico" aria-hidden="true">${s.tip.layer === "upper" ? "⬆" : "⬇"}</span>${esc(s.tip.text)}</p>
    ${whyHereHtml(s, b, past)}
    ${(() => { const adv = adviceFor(s, b); return adv.length ? `<details class="advice" ${past ? "" : "open"}><summary>מה עושים בתנאים האלה</summary><ul>${adv.map(([i, t]) => `<li><span aria-hidden="true">${i}</span> ${ltrNums(esc(t))}</li>`).join("")}</ul></details>` : ""; })()}
    <dl class="sess-cond">
      ${x.waveMax != null ? `<div><dt>גל</dt><dd>${fmtNum(x.wave)}–${fmtNum(x.waveMax)} ס״מ</dd></div>` : ""}
      <div><dt>רוח</dt><dd>${fmtNum(x.wind)} קמ״ש</dd></div>
      <div><dt>לחץ</dt><dd>${fmtNum(x.p0)} ${x.dpS < -0.3 ? "↘" : x.dpS > 0.3 ? "↗" : "→"}</dd></div>
      ${x.sst != null ? `<div><dt>מים</dt><dd>${fmtNum(x.sst, 1)}°</dd></div>` : ""}
      ${x.cur != null && b.water !== "lake" ? `<div><dt>זרם</dt><dd>${fmtNum(x.cur, 1)} קמ״ש</dd></div>` : ""}
    </dl>
    ${fishLayer.length ? `<p class="sess-fish"><b>דגים לשכבה הזו:</b> ${fishLayer.map(f => `<button type="button" class="fish-link" data-fish="${f.id}">${esc(f.name)}</button>`).join(" · ")}</p>` : ""}
    ${lures.length ? `<p class="sess-lures"><b>דמויים:</b> ${lures.map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ")}</p>` : ""}
    <details class="why"><summary>למה ${s.score}?</summary><ul>${s.factors.map(f => `<li><span class="${f.pts > 0 ? "pos" : f.pts < 0 ? "neg" : ""}">${f.pts > 0 ? "+" : ""}${f.pts ? f.pts.toFixed(1) : ""}</span> ${esc(f.label)}${evChip(f.ev)}</li>`).join("")}</ul>${s.factors.some(f => f.ev) ? `<p class="hint">התווית: חוזק הראיה במחקר שלנו מול ציוני Strike Point. חזק = פוענח · בינוני = נמצאה השפעה, לא מדויקת · חלש = השפעה קטנה · השערה = לא נמדד.</p>` : ""}</details>
  </article>`;
}
// official IMS forecast for the beach's zone and day; warnings; Kinneret level
// v3.9.1: the live official warnings that concern this beach (sea warnings for its water; heat/rain/flood warnings that name its area)
const AREA_RE = { "צפון": /גליל מערבי|הכרמל|חיפה|מישור החוף הצפוני|צפון הארץ/, "שרון": /השרון|מישור החוף/, "מרכז": /מישור החוף|גוש דן|תל אביב|המרכז/,
  "דרום": /מישור החוף הדרומי|אשדוד|אשקלון|הנגב המערבי|הדרום/, "אילת": /אילת|הערבה/, "כנרת": /כנרת|כנרות|עמק הירדן|גליל תחתון|עמק בית שאן/ };
function beachWarnings(b) {
  const o = FC && FC.official; if (!o || !o.warnings) return [];
  const nowT = Date.now(), live = w => { const sp = warnSpan(w); return !sp || nowT < sp[1]; }; // v3.7: expired warnings are not shown
  return o.warnings.filter(w => live(w) && ((SEA_WARN.test(w.title + w.text) && warnWater(w).includes(b.water)) || (AREA_RE[b.region] || /$^/).test(w.text)));
}
function officialHtml(b, key) {
  const o = FC && FC.official; if (!o) return "";
  let h = "";
  const z = o.sea && o.sea.zones[ZONE[b.region]];
  if (z) {
    const per = z.periods.filter(p => p.from.slice(0, 10) === key || p.to.slice(0, 10) === key).slice(0, 2);
    if (per.length) h += `<div class="official"><b>תחזית רשמית — ${esc(z.name)}</b> <small>(השירות המטאורולוגי)</small><ul>` + per.map(p =>
      `<li><span>${p.from.slice(11)}–${p.to.slice(11)}</span> גלים ${p.wave_cm ? p.wave_cm.join("–") + " ס״מ" : "—"} · רוח ${p.wind_kmh ? p.wind_kmh.join("–") + " קמ״ש" : "—"}${p.wind_dir ? " מ" + DIR8(p.wind_dir[0]) + (p.wind_dir[1] !== p.wind_dir[0] ? " עד " + DIR8(p.wind_dir[1]) : "") : ""}${p.water ? " · מים " + p.water + "°" : ""}</li>`).join("") + "</ul></div>";
  }
  // sea warnings always; other warnings (heat, rain, floods) only when they name this beach's area
  const warn = beachWarnings(b);
  if (warn.length) h += `<details class="warnings"><summary>⚠️ ${warn.length} אזהרות רשמיות פעילות</summary><ul>${warn.map(w => `<li>${esc(w.text || w.title)}</li>`).join("")}</ul><a href="https://ims.gov.il/he/IMSWarnings" target="_blank" rel="noopener">לאתר השירות המטאורולוגי</a></details>`;
  if (b.water === "lake" && o.kinneret) { const k = o.kinneret, below = k.lower_red - k.level;
    h += `<p class="kinneret">מפלס הכנרת: <b>${k.level.toFixed(2)} מ׳</b> (${k.date.split("-").reverse().join("/")})${k.change7d != null ? ` · שבוע: ${k.change7d > 0 ? "+" : ""}${(k.change7d * 100).toFixed(1)} ס״מ` : ""}${below > 0 ? ` · ${below.toFixed(2)} מ׳ מתחת לקו האדום התחתון` : ""}</p>`; }
  return h;
}
function navHtml(b) {
  const ll = `${b.lat},${b.lon}`;
  return `<p class="nav-links"><a href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">ניווט ב-Waze</a> · <a href="https://www.google.com/maps/dir/?api=1&destination=${ll}" target="_blank" rel="noopener">Google Maps</a>${b.parking ? ` · 🅿️ חניה כ-${b.parking.m} מ׳${b.parking.fee ? " (" + b.parking.fee + ")" : ""}` : ""}</p>` +
    (b.depth ? `<p class="depth">🌊 עומק: ${b.depth.to5 ? `5 מ׳ במרחק ~${b.depth.to5} מ׳` : "—"}${b.depth.to10 ? ` · 10 מ׳ במרחק ~${b.depth.to10} מ׳` : ""}${b.depth.at300 != null ? ` · ב-300 מ׳: ${b.depth.at300} מ׳` : ""} <small>(EMODnet, תא ~115 מ׳)</small></p>` : "") +
    (b.zone ? `<p class="zone">🌡️ ${esc(b.zone)}</p>` : "");
}
// v3.6: solunar periods of the day (weak evidence: information only, not in the score)
function solunarHtml(b) {
  if (typeof SunCalc === "undefined" || !E.solunar) return "";
  const p = E.solunar(state.day, b.lat, b.lon); if (!p.length) return "";
  const t = q => `${E.hm(E.il(q.from).hf)}–${E.hm(E.il(q.to).hf)}`;
  return `<p>🌙 שעות ירח (סולונאר): ${p.map(q => `<span class="sol-${q.k}">${q.k === "major" ? "<b>עיקרית</b>" : "משנית"} <bdi dir="ltr">${t(q)}</bdi> <small>(${q.what})</small></span>`).join(" · ")}${evChip("w")}</p>`;
}
/* ---------- beach header: name, features, actions, key times and conditions as tiles, details folded ---------- */
function beachHeadHtml(b, r, gold, best, boat) {
  const ll = `${b.lat},${b.lon}`, f = (window.BEACH_FEATURES || {})[b.name];
  const today = state.day === todayKey(), rows = r.rows, T = today ? Date.now() : E.ilTime(state.day, 7);
  const now = rows.reduce((m, x) => !m || Math.abs(x.T - T) < Math.abs(m.T - T) ? x : m, null);
  const tide = r.tides.length ? r.tides.slice(0, 2).map(t => `${t.type === "high" ? "גאות" : "שפל"} ${E.hm(E.il(t.T).hf)}`).join(" · ") : null;
  const ltr = v => /^[\d:.\-–· °]+$/.test(v) ? `<bdi dir="ltr">${v}</bdi>` : v; // times and ranges read left to right
  const rw = E.rainWatch(rows, state.day, r.win), hh = h => String(h % 24).padStart(2, "0") + ":00"; // v3.4: rain and the best dry window
  const tile = (icon, label, val, sub, key) => `<div class="tile${key ? " is-key" : ""}"><span>${icon} ${label}</span><b>${ltr(val)}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const tiles = [
    best ? tile("🏆", "השעה הכי טובה", `${String(best.h).padStart(2, "0")}:00`, best.s ? best.s.name : "", true) : null,
    rw ? tile("☔", rw.level === "wet" ? "גשם צפוי" : "סיכוי לגשם", `${Math.round(rw.maxProb)}%`, rw.dry ? `חלון יבש ${hh(rw.dry.start)}–${hh(rw.dry.end)}` : `${hh(rw.wetFrom)}–${hh(rw.wetTo)} · מעיל`)
      : tile("✨", "שעת הזהב", `${E.hm(gold[0][0])}–${E.hm(gold[0][1])}`, `ערב ${E.hm(gold[1][0])}–${E.hm(gold[1][1])}`),
    tile("🌅", "זריחה · שקיעה", `${E.hm(r.win.sunrise)} · ${E.hm(r.win.sunset)}`, `אור ראשון ${E.hm(r.win.dawn)} · אחרון ${E.hm(r.win.dusk)}`),
    tide ? tile("〰️", "גאות ושפל", tide.split(" · ")[0], tide.split(" · ")[1] || "") : null,
    now && now.sst != null ? tile("🌡️", "מים", `${fmtNum(now.sst, 1)}°`, today ? "עכשיו" : "בבוקר") : null,
    now && now.wave != null && b.water !== "lake" ? tile("🌊", "גלים", `${fmtNum(now.wave)} ס״מ`, now.per ? `מחזור ${fmtNum(now.per)} שנ׳` : "") : null,
    now && now.wind != null ? tile("💨", "רוח", `${fmtNum(now.wind)} קמ״ש`, now.dir != null ? "מ" + DIR8(now.dir) : "") : null,
    now && now.p != null ? tile("🧭", "לחץ", `${fmtNum(now.p)}`, "hPa") : null
  ].filter(Boolean).slice(0, 8);
  const more = [
    b.depth ? `<p>🌊 עומק: ${b.depth.to5 ? `5 מ׳ במרחק ~${b.depth.to5} מ׳` : "—"}${b.depth.to10 ? ` · 10 מ׳ במרחק ~${b.depth.to10} מ׳` : ""}${b.depth.at300 != null ? ` · ב-300 מ׳: ${b.depth.at300} מ׳` : ""} <small class="hint">(EMODnet, תא ~115 מ׳)</small></p>` : "",
    b.zone ? `<p>🌡️ ${esc(b.zone)}</p>` : "",
    `<p>🕯️ אור ראשון ${E.hm(r.win.dawn)} · זריחה ${E.hm(r.win.sunrise)} · שקיעה ${E.hm(r.win.sunset)} · אור אחרון ${E.hm(r.win.dusk)}${r.tides.length ? " · " + r.tides.map(t => `${t.type === "high" ? "גאות" : "שפל"} ${E.hm(E.il(t.T).hf)}`).join(" · ") : ""}</p>`,
    solunarHtml(b)
  ].join("");
  return `<div class="bh-top"><div><h2>${esc(b.name)}${vipTag(b)}</h2><p class="bh-sub">${esc(b.region)} · ${esc(TYPE_NAMES[b.type] || "")}</p></div></div>
    ${b.note ? `<p class="bh-note">${esc(b.note)}</p>` : ""}
    ${featuresHtml(b)}
    ${b.legal ? `<p class="legal">⚖️ ${esc(b.legal)}</p>` : ""}
    <div class="bh-actions"><a class="primary" href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">🚗 ניווט ב-Waze</a><a href="https://www.google.com/maps/dir/?api=1&destination=${ll}" target="_blank" rel="noopener">🗺️ Google Maps</a>${b.parking ? `<span>🅿️ חניה ~${b.parking.m} מ׳${b.parking.fee ? " · " + esc(b.parking.fee) : ""}</span>` : ""}</div>
    <div class="tiles">${tiles.join("")}</div>
    ${canBoat(b) ? `<label class="boat-toggle"><input type="checkbox" id="boatToggle" ${boat ? "checked" : ""}> מצב סירה (בטא): תנאי ים פתוח ~11 ק״מ מהחוף</label>` : ""}
    <details class="bh-more"><summary>עוד על החוף: עומק, אזור חם ושעות האור</summary>${more}</details>
    ${officialHtml(b, state.day)}`;
}

/* ---------- v3.7: "before you go" card — crowding, legal notes, webcams, model agreement, share, emergency ----------
   Information only: none of it changes the activity index (the Strike Point-calibrated index stays the truth). */
// Jewish holidays and festivals in Israel (Hebcal, free, CORS) — fetched once a day; Friday afternoon, Saturday, holidays and the summer
// vacation are busy days on the beaches.
let HOLI = null, holiP = null;
function loadHolidays() {
  if (HOLI || holiP) return holiP;
  const key = "compass-holidays", c = store.get(key, null), t = todayKey();
  if (c && c.at === t) { HOLI = c.items; return Promise.resolve(); }
  const end = E.addDays(t, 14);
  holiP = fetch(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&i=on&lg=he&start=${t}&end=${end}`).then(r => r.json())
    .then(j => { HOLI = (j.items || []).map(x => ({ date: x.date.slice(0, 10), title: x.hebrew || x.title, yt: !!x.yomtov, big: /CH''M|Chanukah|Pesach|Sukkot|Shavuot|Rosh Hashana|Purim|Independence/.test(x.title) }));
      store.set(key, { at: t, items: HOLI }); }).catch(() => { HOLI = []; }).finally(() => { holiP = null; if (state.tab === "today") renderTripCard(); });
  return holiP;
}
function crowdTxt(key) {
  const d = new Date(E.ilTime(key, 12)), wd = d.getUTCDay(), mo = +key.slice(5, 7), hol = (HOLI || []).filter(h => h.date === key && (h.yt || h.big));
  const why = [...hol.map(h => h.title), wd === 6 ? "שבת" : wd === 5 ? "שישי" : "", [7, 8].includes(mo) ? "חופש גדול" : ""].filter(Boolean);
  if (!why.length) return "";
  return `👥 ${[...new Set(why)].join(" · ")} — עומס צפוי בחופים ובחניות: להגיע מוקדם או לבחור חוף שקט${wd === 6 || hol.some(h => h.yt) ? "; רוב חנויות הדיג סגורות" : ""}`;
}
// model agreement: wind (ECMWF, ICON, GFS) and waves (ECMWF WAM, Météo-France, NOAA) per group, fetched once per group and hour
const MODELS = {}, modelsP = {};
function loadModels(b) {
  const g = GROUPS[b.group]; if (!g) return null;
  const ck = b.group + Math.floor(Date.now() / 36e5); if (MODELS[ck] || modelsP[ck]) return MODELS[ck] || null;
  const w = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&hourly=wind_speed_10m&models=ecmwf_ifs025,icon_seamless,gfs_seamless&forecast_days=8&timezone=GMT`).then(r => r.json());
  const m = g.water === "lake" ? Promise.resolve(null) : fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${g.mlat}&longitude=${g.mlon}&hourly=wave_height&models=ecmwf_wam025,meteofrance_wave,ncep_gfswave025&forecast_days=8&timezone=GMT`).then(r => r.json()).catch(() => null);
  modelsP[ck] = Promise.all([w, m]).then(([W, M]) => { MODELS[ck] = { W, M }; }).catch(() => { MODELS[ck] = { W: null, M: null }; })
    .finally(() => { delete modelsP[ck]; if (state.tab === "today" && state.beach === b.name) renderTripCard(); });
  return null;
}
function spread(h, prefix, T0, T1, scale) {
  if (!h || !h.hourly) return null;
  const keys = Object.keys(h.hourly).filter(k => k.startsWith(prefix)); if (keys.length < 2) return null;
  let worst = 0, n = 0;
  h.hourly.time.forEach((t, i) => { const T = Date.parse(t + "Z"); if (T < T0 || T >= T1) return;
    const v = keys.map(k => h.hourly[k][i]).filter(x => x != null).map(x => x * scale); if (v.length < 2) return; n++; worst = Math.max(worst, Math.max(...v) - Math.min(...v)); });
  return n ? worst : null;
}
function agreementTxt(b, s) {
  const M = MODELS[b.group + Math.floor(Date.now() / 36e5)]; if (!M || !s || !s.x) return "";
  const wi = spread(M.W, "wind_speed_10m", s.x.T0, s.x.T1, 1), wa = spread(M.M, "wave_height", s.x.T0, s.x.T1, 100);
  if (wi == null && wa == null) return "";
  const bad = (wa != null && wa >= 50) || (wi != null && wi >= 15), mid = (wa != null && wa >= 25) || (wi != null && wi >= 8);
  const lv = bad ? ["נמוכה", "is-warn"] : mid ? ["בינונית", ""] : ["גבוהה", "is-ok"];
  return `<span class="${lv[1]}">🎯 הסכמה בין מודלי התחזית ל${esc(s.name)}: <b>${lv[0]}</b></span>${wa != null ? ` · פער גלים עד ${Math.round(wa)} ס״מ` : ""}${wi != null ? ` · פער רוח עד ${Math.round(wi)} קמ״ש` : ""}${bad ? " — התחזית לא יציבה: לבדוק שוב לפני היציאה" : ""}`;
}
const EMERGENCY = [["101", "מד״א"], ["100", "משטרה"], ["04-7771900", "מרכז הרעלות"], ["*3639", "רשות הטבע והגנים"]];
// v3.7: "may I fish here?" — the phone's location against the closed areas (reserves, ports, military, seasonal) and the declared bathing
// beaches; boundaries are indicative (OpenStreetMap and regulation text), the regulation governs
let closedP = null;
const inRing = (p, ring) => { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j];
  if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const inGeom = (p, g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []).some(poly => inRing(p, poly[0]) && !poly.slice(1).some(h => inRing(p, h)));
const distM = (a, b) => { const R = 6371000, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r * Math.cos((a[1] + b[1]) / 2 * r); return R * Math.hypot(dLat, dLon); };
function nearM(p, g) { let best = Infinity; (g.type === "Polygon" ? [g.coordinates] : g.coordinates).forEach(poly => poly[0].forEach(q => { best = Math.min(best, distM(p, q)); })); return best; }
function checkHere(b) {
  const out = $("#checkHereOut"); if (!out) return;
  if (!navigator.geolocation) { out.textContent = "הדפדפן לא נותן מיקום."; return; }
  out.textContent = "בודק מיקום…";
  navigator.geolocation.getCurrentPosition(async pos => {
    const p = [pos.coords.longitude, pos.coords.latitude];
    try {
      const G = await (closedP || (closedP = fetch("data/closed_areas.geojson?v=1").then(r => r.json())));
      const inside = G.features.filter(f => inGeom(p, f.geometry)), near = G.features.filter(f => !inside.includes(f) && nearM(p, f.geometry) <= 150);
      const L = window.LEGAL || {}, nb = BEACHES.map(q => ({ q, d: distM(p, [q.lon, q.lat]) })).sort((x, y) => x.d - y.d)[0], bath = nb && nb.d < 1500 && L.bathing && L.bathing[nb.q.name];
      const lines = [...inside.map(f => `⛔ אתם בתוך: <b>${esc(f.properties.name)}</b> — ${esc(f.properties.rule || "")}`), ...near.map(f => `⚠️ ליד (פחות מ-150 מ׳): ${esc(f.properties.name)} — לא להטיל לתוך התחום`)];
      if (bath && bath.bathing && bath.dist_m < 300) lines.push(`🏖️ קרוב לחוף רחצה מוכרז (${esc(bath.name)}) — אסור לדוג בתחומו`);
      out.innerHTML = (lines.length ? lines.join("<br>") : "✅ לא נמצא כאן שטח סגור, שמורה או חוף רחצה מוכרז לפי המפות שלנו.") + ` <small>(דיוק המיקום ~${Math.round(pos.coords.accuracy)} מ׳; הגבולות משוערים — שלטים בשטח והתקנות קובעים)</small>`;
    } catch (e) { out.textContent = "לא הצלחנו לטעון את מפת השטחים הסגורים (אין חיבור?)."; }
  }, () => { out.textContent = "לא התקבל מיקום — אשרו גישה למיקום בהגדרות הדפדפן."; }, { enableHighAccuracy: true, timeout: 15000 });
}
function renderTripCard() {
  const el = $("#tripCard"); if (!el || !FC) return;
  const b = beachByName(state.beach), r = beachDay(b, state.day), s = ahead(r.sessions, state.day).filter(q => !q.na).sort((p, q) => q.score - p.score)[0];
  loadHolidays(); loadModels(b);
  const L = window.LEGAL || {}, bath = L.bathing && L.bathing[b.name], areas = (L.areas && L.areas[b.name]) || [], cams = (L.webcams && L.webcams[b.name]) || [];
  const mo = +state.day.slice(5, 7), lines = [];
  const cr = crowdTxt(state.day); if (cr) lines.push(esc(cr));
  const ag = agreementTxt(b, s); if (ag) lines.push(ag);
  // declared bathing place: the 2016 order (sec. 27) forbids fishing in it with no time limit; in practice it is enforced in the bathing season
  if (bath && bath.bathing) { const sz = ((L.meta && L.meta.season && L.meta.season[b.water]) || bath.season || "03-25..10-10").split(".."), md = state.day.slice(5), inSeason = md >= sz[0] && md <= sz[1];
    lines.push(`🏖️ חוף רחצה מוכרז — ${esc(bath.name)}${bath.dist_m ? ` (~${bath.dist_m} מ׳)` : ""}: לפי צו מקומות רחצה (2016) <b>אסור לדוג בתחום חוף רחצה מוכרז</b>${inSeason ? " — בעונת הרחצה האכיפה מלאה, בעיקר בשעות המצילים" : "; מחוץ לעונת הרחצה האכיפה נדירה, אבל האיסור בצו לא מוגבל בזמן"}. לדוג מחוץ לתחום החוף.`); }
  for (const a of areas.slice(0, 3)) lines.push(`${a.kind === "reserve" ? "🐢" : a.kind === "military" ? "🚫" : "⚓"} ${esc(a.name)}${a.dist_m ? ` (~${a.dist_m} מ׳)` : " — נקודת החוף בתוך התחום"}: ${esc(a.rule || "בדקו את ההגבלות במקום")}`);
  if (cams.length) lines.push(`📹 מצלמות חוף: ${cams.slice(0, 3).map(c => `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a>`).join(" · ")}`);
  const ll = `${b.lat},${b.lon}`;
  el.innerHTML = `<h2>🧭 לפני שיוצאים</h2>${lines.length ? `<ul class="trip-lines">${lines.map(t => `<li>${t}</li>`).join("")}</ul>` : ""}
    <div class="trip-actions"><button type="button" id="sharePlan">📤 שיתוף התוכנית</button><button type="button" id="shareLoc">📍 שליחת המיקום שלי</button><button type="button" id="checkHere">🛑 מותר לדוג כאן?</button></div><p class="hint" id="checkHereOut" role="status" aria-live="polite"></p>
    <details class="sos"><summary>🆘 חירום</summary><p class="sos-nums">${EMERGENCY.map(([n, t]) => `<a href="tel:${n.replace(/-/g, "")}" class="sos-n"><b dir="ltr">${n}</b> ${t}</a>`).join("")}</p>
    <p class="hint">עקיצה של דג ארסי (דרקון, זהרון, סיכן, עקרבנון): מים חמים ככל שאפשר לסבול (43–45°) 30–90 דקות. בליעה של דג רעיל או קוצר נשימה — 101 מיד. נפילה מסלע או שובר: לא להזיז את הנפגע.</p></details>`;
  $("#sharePlan").onclick = () => {
    const ret = s ? E.hm(Math.min(24, s.end + 0.5)) : "";
    const text = `יוצא לדוג ב${b.name}${s ? ` — ${s.name} ${E.hm(s.start)}–${E.hm(s.end)}` : ""}${ret ? `, חוזר בערך ב-${ret}` : ""}.\nניווט: https://waze.com/ul?ll=${ll}&navigate=yes`;
    if (navigator.share) navigator.share({ title: "מצפן הדייג", text }).catch(() => {}); else open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  $("#checkHere").onclick = () => checkHere(b);
  $("#shareLoc").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
      const text = `המיקום שלי עכשיו (דיג ב${b.name}): https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      if (navigator.share) navigator.share({ title: "המיקום שלי", text }).catch(() => {}); else open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    }, () => alert("לא התקבל מיקום — אשרו גישה למיקום בהגדרות הדפדפן."), { enableHighAccuracy: true, timeout: 15000 });
  };
}
function renderToday() {
  if (!FC) return;
  const b = beachByName(state.beach); if (!state.day) state.day = todayKey();
  dayChips($("#dayChips"), state.day, k => { state.day = k; renderToday(); });
  const boat = state.boat && canBoat(b);
  const r = beachDay(b, state.day, boat);
  const gold = E.goldenHours(state.day, b.lat, b.lon), best = E.bestHour(state.day === todayKey() ? r.rows.filter(q => q.T >= Date.now() - HOUR_MS) : r.rows, state.day, ahead(r.sessions, state.day), r.safeOf);
  $("#beachHead").innerHTML = beachHeadHtml(b, r, gold, best, boat);
  const bt = $("#boatToggle"); if (bt) bt.onchange = () => { state.boat = bt.checked; renderToday(); };
  $("#sessions").innerHTML = r.sessions.map(s => sessionCard(s, b)).join("");
  $$("#sessions .lure-link").forEach(btn => btn.onclick = () => lureCard(btn.dataset.code));
  $$("#sessions .fish-link").forEach(btn => btn.onclick = () => fishCard(btn.dataset.fish));
  // hourly safety strip (Cormorant mechanics), all 24 hours
  const capHours = [];
  $("#hourly").innerHTML = r.rows.map(x => {
    const sf = E.safety(x, safetyCtx(b, x)), c = sf.score, h = E.il(x.T).h, f = sf.f, cap = zoneWarning(b, x.T); if (cap) capHours.push(h);
    const tip = `${sf.level} · רוח ${fmtNum(x.wind / 1.852)} קשר${x.gust != null ? `, משבים ${fmtNum(x.gust / 1.852)}` : ""} · גל ${fmtNum(x.wave)} ס״מ${x.mm ? ` · גשם ${fmtNum(x.mm, 1)} מ״מ` : ""}${cap ? " · אזהרה רשמית: תקרה 40" : ""}`;
    return `<div class="hr ${sf.cls}${best && best.h === h ? " is-best" : ""}${cap ? " is-capped" : ""}" title="${esc(tip)}"><span class="hr-bar" style="--v:${c}"></span><b>${c}</b><small>${h}:00</small></div>`;
  }).join("");
  // v3.9.1: one line says what the dashed columns mean, instead of 24 identical "40"s explaining themselves
  let capNote = $("#hourlyCap"); if (!capNote) { capNote = document.createElement("p"); capNote.id = "hourlyCap"; capNote.className = "hourly-cap"; $("#hourly").before(capNote); }
  capNote.hidden = !capHours.length;
  capNote.innerHTML = capHours.length ? `אזהרה רשמית בתוקף ${capHours.length >= r.rows.length ? "כל היום" : `<bdi dir="ltr">${String(capHours[0]).padStart(2, "0")}:00–${String(capHours[capHours.length - 1] + 1).padStart(2, "0")}:00</bdi>`}: מדד הבטיחות מוגבל ל-40 בשעות האלה (העמודות המקווקוות)` : "";
  const src = FC.sgGroups.includes(b.group) ? "StormGlass + Open-Meteo" : "Open-Meteo";
  $("#srcNote").textContent = `מקור הנתונים לחוף הזה: ${src} · ${Date.now() - FC.at > 3 * HOUR_MS ? `⚠️ נתונים ישנים מ-${new Date(FC.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} — אין חיבור לרשת?` : `עודכן ${new Date(FC.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`}` +
    (FC.ocean && FC.ocean.g && FC.ocean.g[b.group] ? " · חזיתות וכלורופיל מלוויין: NASA JPL MUR SST ו-Copernicus Sentinel-3 OLCI, דרך NOAA CoastWatch" : "") + (FC.marineDown && b.water !== "lake" ? " · ⚠️ שרת נתוני הים לא ענה — גלים, טמפ׳ מים וגאות חסרים כרגע" : "");
  renderSpots(b); renderTripCard();
  if (window.FISHING_DASHBOARD) {
    $("#fishingDashboard").setAttribute("aria-busy", "false");
    FISHING_DASHBOARD.render({ b, r, E, key: state.day, onFish: fishCard, onLure: lureCard, onTab: setTab, onBeach: name => { pickBeach(name); fillPicker(); window.scrollTo({top:0,behavior:"smooth"}); }, loadLeaflet, beaches: BEACHES, lureImage: lureTypeImage, whyHere: s => whyHereBrief(s, b), warnings: beachWarnings(b), warnAt: T => zoneWarning(b, T), kinneret: FC.official && FC.official.kinneret || null });
  }
}

/* ---------- spots within a beach: 200 m strips ranked per fish (data/zones/<id>.json, built by zones_score.js) ---------- */
const zoneData = {}; let zoneIndex = null; // beach name → data/zones/<id>.json (index.json, built by score_all.mjs)
// Leaflet is loaded only when a beach has spots (vendor copy, cached for offline use; map tiles need the network)
let leafletP = null, spotMap = null;
const loadLeaflet = () => leafletP || (leafletP = new Promise((ok, no) => {
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "vendor/leaflet/leaflet.css"; document.head.append(css);
  const js = document.createElement("script"); js.src = "vendor/leaflet/leaflet.js"; js.onload = () => ok(window.L); js.onerror = () => { leafletP = null; no(); }; document.head.append(js);
}));
const move = (p, bearing, d) => { const R = 6371000, b = bearing * Math.PI / 180, la = p[0] * Math.PI / 180, lo = p[1] * Math.PI / 180, r = d / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(r) + Math.cos(la) * Math.sin(r) * Math.cos(b));
  return [la2 * 180 / Math.PI, (lo + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(la), Math.cos(r) - Math.sin(la) * Math.sin(la2))) * 180 / Math.PI]; };
const fmtLL = s => `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`;
let spotsRev = 0; // v3.7: only the latest call may draw (fish/day/beach changes while data or Leaflet is still loading)
async function renderSpots(b) {
  const rev = ++spotsRev, el = $("#spots");
  if (!zoneIndex) { try { zoneIndex = await (await fetch("data/zones/index.json?v=1")).json(); } catch (e) { zoneIndex = {}; } }
  if (rev !== spotsRev) return;
  const id = zoneIndex[b.name];
  if (!id) { el.hidden = true; el.innerHTML = ""; if (spotMap) { spotMap.remove(); spotMap = null; } return; }
  if (!zoneData[id]) { try { zoneData[id] = await (await fetch(`data/zones/${id}.json?v=${id === "hashmal" ? 3 : 1}`)).json(); } catch (e) { el.hidden = true; return; } }
  if (rev !== spotsRev || state.beach !== b.name) return;
  const z = zoneData[id], month = +state.day.slice(5, 7), winter = [11, 12, 1, 2, 3].includes(month);
  const inSeason = new Set(E.fishFor(b, month).now.map(r => r.sp.id));
  const ids = Object.keys(z.species).sort((p, q) => inSeason.has(q) - inSeason.has(p));
  let sid = store.get("compass-spot-fish", "");
  if (!z.species[sid]) sid = ids.find(k => k === state.target) || ids[0];
  const sp = z.species[sid], sc = sp[winter ? "scoresWinter" : "scores"];
  // daily adjustment (docs/strike-point/18 stage 3): the day's best session sets the conditions, and strips that fit them today go up a little
  const bs = beachDay(b, state.day).sessions.filter(s => !s.na).sort((p, q) => q.score - p.score)[0];
  const ctx = bs && !(state.boat && canBoat(b)) ? E.stripContext(b, bs.x, (FC && FC.data[b.group]) || [], (window.BEACH_FEATURES || {})[b.name], month) : null;
  const adj = z.strips.map(s => ctx && s.ok ? E.stripAdjust(s, ctx, bs.id, sid) : { d: 0, why: [] });
  const vv = z.strips.map((s, i) => sc[i] == null ? null : Math.max(0, Math.min(100, sc[i] + adj[i].d)));
  const ranked = z.strips.map((s, i) => ({ s, i, v: vv[i], a: adj[i] })).filter(r => r.v != null).sort((p, q) => q.v - p.v);
  const top = ranked.slice(0, 3), pos = new Map(top.map((r, k) => [r.i, k + 1])), anyUp = adj.some(a => a.d > 0);
  const vs = ranked.map(r => r.v), lo = Math.min(...vs), hi = Math.max(...vs), t = v => hi > lo ? (v - lo) / (hi - lo) : 0.5; // stretched per fish so differences show
  const fill = v => `hsl(${Math.round(55 - 55 * t(v))} 90% ${Math.round(58 - 10 * t(v))}%)`; // yellow → red = more suitable
  // v3.6: how deep it is over this fish's casting range in this strip (and, when data/seabed.js is loaded, the seabed)
  const tsp = SPECIES.find(q => q.id === sid), sb = window.SEABED && window.SEABED[id];
  const stripExtra = (s, i) => { const plan = tsp ? castPlanTxt(tsp, E.depthProfile(s.z200 != null ? { to5: s.to5, z200: s.z200 } : { to5: s.to5 }), b.type, "ברצועה") : "";
    const bed = sb && sb.s && sb.s[i] ? seabedTxt(sb.s[i]) : "";
    return (plan ? `<p class="cast-plan">📏 ${plan}</p>` : "") + (bed ? `<p class="seabed">🪨 ${bed}</p>` : ""); };
  const upTxt = a => a && a.d ?`${a.d > 0 ? "↑" : "↓"} היום ${a.d > 0 ? "+" : ""}${a.d}: ${a.why.map(w => esc(w.slice(2))).join(" · ")}` : "";
  const card = (r, n) => { const s = r.s, ll = `${s.lat},${s.lon}`;
    return `<li class="spot ${E.level(r.v).c}"><header><span class="rk">${n}</span><b>${esc(s.place)}</b><span class="rv">${r.v}</span></header>
      ${r.a && r.a.d ? `<p class="up-today${r.a.d < 0 ? " is-down" : ""}">${upTxt(r.a)}</p>` : ""}
      ${s.outside ? `<p class="caution">מחוץ לחוף חשמל — דרומית לתחנת הכוח. בדקו גישה ואיסורים במקום.</p>` : ""}${s.shelter ? `<p class="caution">מים מוגנים מאחורי שובר או במעגן — בדקו שמותר לדוג במקום.</p>` : ""}
      <p>${s.desc.map(esc).join(" · ")}${s.partial ? " · <i>נתונים חלקיים</i>" : ""}</p>${stripExtra(s, r.i)}
      <p class="spot-ll">📍 נקודת עמידה (קו המים): <bdi dir="ltr">${fmtLL(s)}</bdi> <button type="button" class="copy-ll" data-ll="${fmtLL(s)}">העתקה</button></p>
      <p class="nav-links"><a href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">Waze</a> · <a href="https://www.google.com/maps/search/?api=1&query=${ll}" target="_blank" rel="noopener">Google Maps</a> · <button type="button" class="show-on-map" data-i="${r.i}">הצגה במפה</button></p></li>`; };
  el.hidden = false;
  if (spotMap) { spotMap.remove(); spotMap = null; }
  el.innerHTML = `<h2>נקודות בחוף</h2>
    <p class="hint">רצועות של 200 מ׳ לאורך החוף, מדורגות לדג שבחרתם לפי צבע המים, צלילות, עומק, מבנים ומים חמים. הציון יחסי לחוף הזה. הוא מתאר תנאים, לא תפיסות.${ctx ? ` רצועה שמתאימה לתנאי היום (${esc(bs.name)}: גל ${fmtNum(ctx.w)} ס״מ) מקבלת כמה נקודות ומסומנת ↑ היום.` : ""}</p>
    <label class="spot-pick"><span>דג מטרה</span><select id="spotFish">${ids.map(k => `<option value="${k}" ${k === sid ? "selected" : ""}>${esc(z.species[k].name)}${inSeason.has(k) ? "" : " (לא בעונה)"}</option>`).join("")}</select></label>
    <p class="spot-why"><button type="button" class="fish-link" data-fish="${sid}">📖 על ה${esc(sp.name)}</button> · <b>מה מחפשים:</b> ${esc(sp.why)}${winter ? " · בחורף נלקחת בחשבון פלומת המים החמים." : ""}</p>
    <div class="spot-map-box" id="spotMap" dir="ltr" role="region" aria-label="מפת לוויין של רצועות החוף"><p class="hint">טוען מפה…</p></div>
    <p class="spot-legend"><span class="lg-bar"></span> צהוב = פחות מתאים, אדום = יותר מתאים · <span class="lg-pin">1</span> שלוש הרצועות המובילות · ${anyUp ? `<span class="lg-up">↑ היום</span> עלתה היום בגלל התנאים · ` : ""}${z.strips.some(s => s.ok && s.outside) ? `<span class="lg-out"></span> מחוץ לחוף · ` : ""}<span class="lg-closed"></span> סגור · לחיצה על רצועה מציגה פרטים</p>
    <div id="spotPicked"></div>
    <ol class="spot-list">${top.map((r, k) => card(r, k + 1)).join("")}</ol>
    <p class="spot-look">👀 <b>בשטח, חפשו:</b> ${esc(sp.look)}</p>
    <details class="about"><summary>איך זה מחושב?</summary><p>${esc(z.method)}</p><p>נקודת העמידה היא קו המים בתמונות הלוויין (דיוק של כ-30 מ׳; קו המים זז עם הגלים והעונה). הרצועה הצבועה מגיעה עד כ-220 מ׳ לתוך הים. תמונות לוויין: ${z.scenes.map(d => d.split("-").reverse().join("/")).join(", ")} · טמפ׳: Landsat ${z.landsat.map(d => d.split("-").reverse().join("/")).join(", ")} · עודכן ${z.generated.split("-").reverse().join("/")}. רשמו ביומן את המרחק מהחוף ואיפה דגתם, כדי שנוכל לכייל את הדירוג לפי תפיסות אמיתיות.</p>${sb ? `<p>סוג הקרקעית: מפת בתי הגידול של חקר ימים ואגמים לישראל (ISRAMARBIO: קנרי, תום ולובינבסקי; המכון הגיאולוגי; משרד האנרגיה), נדגם ב-7 נקודות עד 300 מ׳ מהחוף בכל רצועה. המפה מ-2015, ולכן שוברים חדשים לא מופיעים בה.</p>` : ""}<p>עומק בטווח ההטלה: קו ישר בין נקודות העומק של EMODnet (רשת של ~115 מ׳), הערכה גסה.</p></details>`;
  const pick = i => { const s = z.strips[i];
    $("#spotPicked").innerHTML = s.ok ? `<ol class="spot-list picked">${card({ s, i, v: vv[i], a: adj[i] }, "•")}</ol>` : `<p class="hint">${esc(s.place)}: ${esc(s.reason)}</p>`; wire(); };
  const wire = () => {
    $$("#spots .copy-ll").forEach(btn => btn.onclick = () => { try { navigator.clipboard.writeText(btn.dataset.ll); btn.textContent = "הועתק ✓"; } catch (e) { /* clipboard blocked */ } });
    $$("#spots .show-on-map").forEach(btn => btn.onclick = () => { const f = spotMap && spotMap._spot; if (!f) return; f.focus(+btn.dataset.i); $("#spotMap").scrollIntoView({ behavior: "smooth", block: "center" }); });
  };
  wire();
  $$("#spots .fish-link").forEach(btn => btn.onclick = () => fishCard(btn.dataset.fish));
  $("#spotFish").onchange = e => { store.set("compass-spot-fish", e.target.value); renderSpots(b); };
  let L; try { L = await loadLeaflet(); } catch (e) { if (rev === spotsRev && $("#spotMap")) $("#spotMap").innerHTML = '<p class="hint">המפה לא נטענה (אין חיבור). הנקודות והקואורדינטות למטה עדיין תקפות.</p>'; return; }
  const box = $("#spotMap"); if (rev !== spotsRev || !box || state.beach !== b.name || spotMap) return; box.innerHTML = "";
  const map = spotMap = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.25 });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }).addTo(map);
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  L.control.layers({ "לוויין": sat, "מפה": osm }, null, { position: "topleft" }).addTo(map);
  const along = z.az + 90, layers = {}, pts = [];
  const popup = (s, v, n, i) => `<div dir="rtl" class="spot-pop"><b>${n ? "#" + n + " · " : ""}${esc(s.place)}</b> · ציון ${v} ל${esc(sp.name)}<br>${adj[i].d ? upTxt(adj[i]) + "<br>" : ""}${s.desc.slice(0, 3).map(esc).join(" · ")}<br><bdi dir="ltr">${fmtLL(s)}</bdi><br><a href="https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes" target="_blank" rel="noopener">ניווט ב-Waze</a></div>`;
  z.strips.forEach((s, i) => {
    const p0 = s.ok ? [s.lat, s.lon] : s.ref, a = move(p0, along, -100), c = move(p0, along, 100);
    const poly = [a, c, move(c, z.az, 220), move(a, z.az, 220)];
    if (!s.ok) { if (s.closed) L.polygon(poly, { color: "#555", weight: 1, fillColor: "#777", fillOpacity: 0.5, dashArray: "3 3" }).bindTooltip(s.reason).addTo(map); return; }
    const v = vv[i], n = pos.get(i);
    const pg = L.polygon(poly, { color: "#fff", weight: n ? 2.5 : 1, opacity: 0.9, fillColor: fill(v), fillOpacity: 0.5, dashArray: s.outside ? "6 4" : null }).addTo(map);
    pg.bindPopup(popup(s, v, n, i)); pg.on("click", () => pick(i));
    layers[i] = pg; pts.push([s.lat, s.lon], move(p0, z.az, 220));
    if (n) L.marker([s.lat, s.lon], { icon: L.divIcon({ className: "spot-pin", html: `<b>${n}</b>`, iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 1000, title: `#${n} ${s.place}` })
      .bindPopup(popup(s, v, n, i)).on("click", () => pick(i)).addTo(map);
  });
  map.fitBounds(L.latLngBounds(pts), { padding: [28, 28] });
  map._spot = { focus: i => { const pg = layers[i]; if (!pg) return; map.setView(pg.getBounds().getCenter(), 17); pg.openPopup(); pick(i); } };
  // where am I: the strip nearest to the phone's location
  const Loc = L.Control.extend({ options: { position: "topright" }, onAdd() { const btn = L.DomUtil.create("button", "spot-locate"); btn.type = "button"; btn.textContent = "📍 איפה אני";
    L.DomEvent.disableClickPropagation(btn); btn.onclick = () => map.locate({ setView: false, enableHighAccuracy: true }); return btn; } });
  new Loc().addTo(map);
  let me = null;
  map.on("locationfound", e => { if (me) me.remove(); me = L.circle(e.latlng, { radius: Math.max(e.accuracy, 8), color: "#1a73e8", weight: 2, fillOpacity: 0.25 }).addTo(map);
    let best = null; z.strips.forEach((s, i) => { if (!s.ok) return; const d = map.distance(e.latlng, [s.lat, s.lon]); if (!best || d < best.d) best = { d, i }; });
    if (best && best.d < 600) { map.setView(e.latlng, 17); pick(best.i); $("#spotPicked").insertAdjacentHTML("afterbegin", `<p class="hint">אתם בערך ב-${esc(z.strips[best.i].place)} (${Math.round(best.d)} מ׳ מנקודת הרצועה).</p>`); }
    else $("#spotPicked").innerHTML = `<p class="hint">אתם לא בחוף הזה כרגע${best ? ` (${(best.d / 1000).toFixed(1)} ק״מ מהרצועה הקרובה)` : ""}.</p>`; });
  map.on("locationerror", () => { $("#spotPicked").innerHTML = '<p class="hint">לא הצלחנו לקבל מיקום. בדקו שהרשאת מיקום פתוחה לאתר.</p>'; });
}

/* ---------- ranking ---------- */
function renderRank() {
  if (!FC) return;
  if (!state.rankDay) state.rankDay = todayKey();
  dayChips($("#rankDays"), state.rankDay, k => { state.rankDay = k; renderRank(); });
  $("#rankRegion").innerHTML = `<option value="all">כל האזורים</option>` + REGIONS.map(r => `<option ${r === state.rankRegion ? "selected" : ""}>${r}</option>`).join("");
  $("#rankRegion").onchange = e => { state.rankRegion = e.target.value; renderRank(); };
  $("#rankSession").value = state.rankSession; $("#rankSession").onchange = e => { state.rankSession = e.target.value; renderRank(); };
  const rows = BEACHES.filter(b => state.rankRegion === "all" || b.region === state.rankRegion).map(b => {
    const r = beachDay(b, state.rankDay), ok = ahead(r.sessions.filter(s => !s.na), state.rankDay);
    const s = state.rankSession === "best" ? ok.sort((a, c) => c.score - a.score)[0] : ok.find(q => q.id === state.rankSession);
    return { b, s };
  }).filter(x => x.s).sort((a, c) => c.s.score - a.s.score);
  renderGoToday(rows);
  $("#rankList").innerHTML = rows.map(({ b, s }, i) => {
    const lv = E.level(s.score);
    return `<li><button type="button" class="rank-row ${lv.c}" data-b="${esc(b.name)}"><span class="rk">${i + 1}</span><span class="rn">${esc(b.name)}${vipTag(b)} <small>${esc(b.region)}</small></span>
      <span class="rs">${s.name} ${E.hm(s.start)}${s.safe ? ` · <em class="safe-chip ${safeCls(s.safe.avg)}">בטיחות ${s.safe.avg}</em>` : ""}</span><span class="rv">${s.score}</span>${closedAt(b) ? `<span class="rl" title="${esc(closedAt(b).name)}: ${esc(closedAt(b).rule || "")}">⛔</span>` : ""}${b.legal ? `<span class="rl" title="${esc(b.legal)}">⚖️</span>` : ""}</button></li>`;
  }).join("");
  $$("#rankList .rank-row, #goToday .go-row").forEach(btn => btn.onclick = () => { state.day = state.rankDay; pickBeach(btn.dataset.b); fillPicker(); setTab("today"); });
}
/* ---------- where to go today (docs/strike-point/18 stage 2): the three best beaches of the region for a fish and a session ----------
   "when" = the session's activity index, "where" = whereToday's rules against the beach's structure, "season" = the fish must be in season there.
   Shown as levels, not numbers; a session whose safety minimum is below 30 is never recommended (engine.js goToday). */
function renderGoToday(rows) {
  const el = $("#goToday"); if (!el) return;
  const month = +state.rankDay.slice(5, 7), sel = $("#rankFish");
  if (state.rankFish == null) state.rankFish = store.get("compass-rank-fish", state.target || "");
  const fishes = lgTargets().slice().sort((a, c) => a.name.localeCompare(c.name, "he"));
  if (!fishes.some(f => f.id === state.rankFish)) state.rankFish = "";
  sel.innerHTML = `<option value="">כל הדגים בעונה</option>` + fishes.map(f => `<option value="${f.id}" ${f.id === state.rankFish ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  sel.onchange = e => { state.rankFish = e.target.value; store.set("compass-rank-fish", state.rankFish); renderRank(); };
  const fish = fishes.find(f => f.id === state.rankFish), safeOk = s => !s.safe || s.safe.min >= 30;
  // "best session" here = the best SAFE session of the beach (the ranking list below keeps the plain best, with its safety chip)
  const cands = rows.map(({ b, s }) => {
    if (state.rankSession === "best" && !safeOk(s)) s = ahead(beachDay(b, state.rankDay).sessions, state.rankDay).filter(q => !q.na && safeOk(q)).sort((a, c) => c.score - a.score)[0] || s;
    return { b, s, w: whyHereItems(s, b, state.rankDay), safeMin: s.safe ? s.safe.min : null, inSeason: fish ? E.fishFor(b, month, s.x.sst).now.some(r => r.sp.id === fish.id) : undefined };
  });
  const top = E.goToday(cands.filter(c => !closedAt(c.b)), 3), where = state.rankRegion === "all" ? "כל האזורים" : state.rankRegion;
  const allUnsafe = cands.length && cands.every(c => c.safeMin != null && c.safeMin < 30);
  const sessName = state.rankSession === "best" ? "הסשן הטוב ביום" : { morning: "בוקר", midday: "צהריים", evening: "ערב" }[state.rankSession];
  el.innerHTML = `<h2>לאן לנסוע היום <small>${esc(where)} · ${sessName}${fish ? " · " + esc(fish.name) : ""}</small></h2>` + (top.length ? `<ol>${top.map((c, i) =>
    `<li><button type="button" class="go-row ${c.lv.c}" data-b="${esc(c.b.name)}"><span class="rk">${i + 1}</span><span class="gn"><b>${esc(c.b.name)}</b>${vipTag(c.b)} <small>${esc(c.b.region)} · ${c.s.name} ${E.hm(c.s.start)}</small>
      ${c.reason ? `<span class="go-reason"><span aria-hidden="true">${NEED[c.reason.need][0]}</span> ${esc(c.reason.text)}</span>` : `<span class="go-reason">תנאים טובים לסשן, בלי יתרון מיוחד במבנה החוף</span>`}</span><span class="go-lv">${c.lv.t}</span></button></li>`).join("")}</ol>
    <p class="hint">מתי (מדד הפעילות של הסשן) + איפה (המבנה של החוף מול תנאי היום) + עונה. מודל ידע ומחקר, עדיין לא מאומת בתפיסות. הרשימה המלאה למטה.</p>`
    : `<p class="hint">${allUnsafe ? `${sessName === "הסשן הטוב ביום" ? "כל הסשנים" : "הסשן"} ב${esc(where)} ביום הזה עם בטיחות מתחת ל-30 — אין המלצה. בדקו את שכבת הבטיחות בכרטיס החוף.` : fish ? `אין חוף ב${esc(where)} שבו ה${esc(fish.name)} בעונה ביום הזה.` : state.rankDay === todayKey() ? "הסשנים של היום כבר הסתיימו באזור — בחרו את מחר." : "אין סשן זמין ביום הזה באזור."}</p>`);
}

/* ---------- fish ---------- */
const TYPE_NAMES = { sand: "חוף חולי", rock: "חוף סלעי", mixed: "חול וסלע", marina: "מרינה", port: "נמל", breakwater: "שובר גלים", estuary: "שפך נחל", reef: "שונית", lake: "חוף אגם" };
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
// v3.5 (data/species-plus.js, after Hooked): water range, body size, invasive flag, natural baits
const waterTxt = sp => sp.t4 ? `${sp.t4[1]}–${sp.t4[2]}°` : sp.temp ? `${sp.temp[0]}–${sp.temp[1]}°` : "";
const SIZE_UNIT = { TL: "אורך כולל", FL: "עד מזלג הזנב", SL: "בלי הזנב", ML: "אורך המעטפת", WD: "רוחב", CW: "רוחב השריון" };
const bodyTxt = sp => { const b = sp.body; if (!b || !b.max) return ""; return [b.common ? `נפוץ ~${b.common}` : "", `עד ${b.max} ס״מ`, b.kg ? `${b.kg < 1 ? Math.round(b.kg * 1000) + " ג׳" : (+b.kg.toFixed(1)) + " ק״ג"}` : ""].filter(Boolean).join(" · "); };
const invTag = sp => sp.invasive ? ` <em class="inv-tag" title="מין פולש">פולש</em>` : "";
const baitsFor = id => (window.BAITS || []).filter(b => b.fish.includes(id));
// v3.6: rig drawing from the rig numbers (cm). running = sinker slides on the main line, leader to the hook on the bottom;
// paternoster = hooks on short snoods above the sinker; popup = the bait floats up off the bottom on a long leader.
const RIG_NAMES = { running: "משקולת רצה (קרקעית)", paternoster: "פטרנוסטר — קרסים מעל המשקולת", popup: "פופ-אפ — הפיתיון מרחף מעל הקרקעית" };
const ltrIso = s => "⁦" + s + "⁩"; // number ranges inside right-to-left SVG text keep their order
function rigSvg(r) {
  const hooks = (r.hooks || []).filter(h => h > 0); if (!hooks.length || !RIG_NAMES[r.t]) return "";
  const hook = (x, y) => `<path d="M${x} ${y} v7 a4 4 0 0 1 -8 0" class="rg-hook"/>`, sinker = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="9" class="rg-sink"/>`;
  let g = "";
  if (r.t === "running") {
    const max = Math.max(...hooks, r.leader || 0, 40), X = cm => 92 + cm / max * 190, by = 112;
    g = `<path d="M14 18 L64 ${by - 4}" class="rg-line"/>${sinker(64, by - 10)}<circle cx="86" cy="${by}" r="3.5" class="rg-swv"/><path d="M86 ${by} H${X(Math.max(...hooks))}" class="rg-lead"/>` +
      hooks.map(h => hook(X(h), by) + `<text x="${X(h)}" y="${by + 26}" class="rg-t" text-anchor="middle">${h} ס״מ</text>`).join("") +
      `<text x="64" y="${by - 26}" class="rg-t" text-anchor="middle">${r.g ? ltrIso(r.g) + " ג׳" : "משקולת"}</text><path d="M4 ${by + 10} H296" class="rg-bed"/>`;
  } else {
    const max = Math.max(...hooks, 40) * 1.08, by = 120, Y = cm => by - 6 - cm / max * 100, x0 = r.t === "popup" ? 120 : 150;
    g = `<path d="M${x0} 8 V${by - 8}" class="${r.t === "popup" ? "rg-lead" : "rg-line"}"/>${sinker(x0, by - 4)}<path d="M4 ${by + 6} H296" class="rg-bed"/>` +
      (r.t === "popup" ? `<circle cx="${x0}" cy="${Y(Math.max(...hooks)) - 10}" r="6" class="rg-float"/>` : "") +
      hooks.map(h => { const y = Y(h), sx = x0 + 14 + (r.snood || 8) * 2.2; return `<path d="M${x0} ${y} L${sx} ${y + 4}" class="rg-lead"/>${hook(sx, y + 4)}<text x="${x0 - 8}" y="${y + 4}" class="rg-t" text-anchor="start">${h} ס״מ</text>`; }).join("") +
      `<text x="${x0 + 14}" y="${by + 1}" class="rg-t" text-anchor="end">${r.g ? ltrIso(r.g) + " ג׳" : ""}</text>`;
  }
  return `<figure class="rig"><svg viewBox="0 0 300 150" role="img" aria-label="${esc(RIG_NAMES[r.t])}">${g}</svg><figcaption>${esc(RIG_NAMES[r.t])}${r.leader ? ` · ליידר ${r.leader} ס״מ` : ""}${r.snood ? ` · זרועות ${r.snood} ס״מ` : ""} · ${r.t === "running" ? "המספרים: מרחק הקרס מהמשקולת" : "המספרים: גובה הקרס מעל המשקולת"}</figcaption></figure>`;
}
// v3.6: seabed of a strip (data/seabed.js): what it means for the fish and for the lure
const SEABED_TXT = { sand: ["חול", "דניס, מליטה וטרכינוטוס; ג׳יג ובובות על הקרקעית בלי חשש להיתקע"],
  mud: ["בוץ / חול דק", "מוסר, שפמנון וטריגון; פיתיון על הקרקעית, ג׳יג נשאר נקי"],
  coarse: ["חצץ וחול גס", "מליטה, סרגוס ודניס; קרקעית נקייה יחסית"],
  mixed: ["חול וסלע", "קצה הסלע הוא הנקודה החמה: סרגוס, לוקוס ולברק; לעבוד על החול שליד הסלע"],
  rock: ["סלע", "דגי סלע: לוקוס, סרגוס, סלפה ותמנון; דמויים נתקעים — קרס בודד, פיתיון שטח או מצוף, משקולת זולה"],
  seagrass: ["עשב ים", "דיונונים, תמנונים וסרגוסים; לעבוד מעל העשב ולא בתוכו"] };
const seabedTxt = q => { const t = SEABED_TXT[q.c]; if (!t) return ""; return `קרקעית: <b>${t[0]}</b>${q.rock150 && q.c === "sand" ? " · יש סלע בטווח 150 מ׳" : ""} — ${t[1]}`; };
// v3.6: gear table, rig and the cast plan at the chosen beach
// numbers, ranges and hook sizes (#6, 2/0) keep left-to-right order inside Hebrew text (input already escaped)
const ltrNums = h => h.replace(/[#\d][\d.\/#]*(?:\s*[–-]\s*[#\d][\d.\/#]*)?/g, m => `<bdi dir="ltr">${m}</bdi>`);
function castPlanTxt(sp, prof, type, where) {
  const c = E.castPlan(sp, prof, type); if (!c) return "";
  const z0 = Math.max(0.5, c.z[0]), z1 = Math.max(0.5, c.z[1]), z = `<bdi dir="ltr">~${z0 === z1 ? z0 : `${z0}–${z1}`}</bdi>`;
  let t = `${where}: בהטלה של <bdi dir="ltr">${c.cast[0]}–${c.cast[1]}</bdi> מ׳ העומק ${z} מ׳.`;
  if (c.need) t += c.need.structure ? ` ה${esc(sp.name)} חי בדרך כלל מ-${c.need.z} מ׳ — מקצה השובר או המזח המים עמוקים יותר מאשר מהחוף.`
    : c.need.reach ? ` ה${esc(sp.name)} חי בדרך כלל מ-${c.need.z} מ׳ — העומק הזה מתחיל רק ב-~${c.need.dist} מ׳: הטלה ארוכה, או שובר ומזח.`
    : ` ה${esc(sp.name)} חי בדרך כלל מ-${c.need.z} מ׳ — מחוץ לטווח הטלה מהחוף הזה: ראש מזח, קצה שובר עמוק או סירה.`;
  return t;
}
function gearHtml(sp, b) {
  const g = sp.gear; if (!g) return "";
  const rows = [["חכה וגלגלת", g.rod], ["חוט ראשי", g.line], ["ליידר", g.leader], ["קרסים", g.hooks], ["משקולת", g.sinker],
    g.cast ? ["טווח הטלה", `${g.cast[0]}–${g.cast[1]} מ׳`] : null, g.depth ? ["עומק שבו הוא חי", `${g.depth[0]}–${g.depth[1]} מ׳`] : null].filter(r => r && r[1]);
  const plan = b && b.water !== "lake" && sp.waters.includes(b.water) ? castPlanTxt(sp, E.depthProfile(b.depth), b.type, `ב${esc(b.name)}`) : "";
  return `<section class="gear"><h4>🎣 ציוד וטווח הטלה</h4><dl class="gear-tbl">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${ltrNums(esc(v))}</dd></div>`).join("")}</dl>
    ${g.rig ? rigSvg(g.rig) : ""}${plan ? `<p class="cast-plan">📏 ${plan} <small class="hint">(עומק לפי EMODnet, רשת של ~115 מ׳ — הערכה גסה)</small></p>` : ""}</section>`;
}
function fishRow({ sp, peak, tempNote, temp }, month, water) {
  const cal = MONTHS.map((m, i) => `<i class="${sp.p && sp.p.includes(i + 1) ? "pk" : sp.m.includes(i + 1) ? "in" : ""} ${i + 1 === month ? "now" : ""}" title="${m}"></i>`).join("");
  const lures = [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT").map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ");
  return `<article class="fish-card">${art(sp.id, "is-card")}
    <header><h3>${esc(sp.name)}${peak ? ' <em class="peak">שיא</em>' : ""}${invTag(sp)}</h3><span class="layer">${sp.layer === "upper" ? "מים עליונים" : sp.layer === "bottom" ? "חלק תחתון" : "בכל גוף המים"}${sp.zone ? " · " + esc(sp.zone) : ""}</span></header>
    ${sp.lat ? `<p class="latin"><i>${esc(sp.lat)}</i>${sp.aka && sp.aka.length ? " · נקרא גם: " + sp.aka.map(esc).join(", ") : ""}</p>` : ""}
    <div class="cal" aria-label="עונה">${cal}</div>
    ${sp.active && sp.active.length ? `<p class="active">🕑 הכי פעיל: ${sp.active.map(a => ACTIVE_NAMES[a]).join(", ")}${waterTxt(sp) ? ` · מים ${waterTxt(sp)}` : ""}</p>` : waterTxt(sp) ? `<p class="active">מים ${waterTxt(sp)}</p>` : ""}
    ${lures ? `<p class="lures">${lures}</p>` : ""}
    ${tempNote ? `<p class="warn">🌡️ ${tempNote}</p>` : temp && temp.d > 0 && !temp.out ? `<p class="soft">🌡️ ${temp.text}</p>` : ""}
    ${sp.hazard ? `<p class="warn">⚠️ ${esc(sp.hazard)}</p>` : ""}
    ${sp.min ? `<p class="min">מינימום חוקי: ${sp.min} ס״מ</p>` : ""}
    ${sp.legal && sp.legal[water] ? `<p class="warn">⚖️ ${esc(sp.legal[water])}</p>` : ""}
    <details class="fish-details"><summary>איך לעבוד ומה לבחור</summary>
      <p>${sp.size ? esc(sp.size) + " · " : ""}${esc(sp.work || "")}${sp.when ? " · " + esc(sp.when) : ""}</p>
      ${sp.colors ? `<p class="colors">צבעים: ${esc(sp.colors)}</p>` : ""}
      ${sp.note ? `<p class="note">${esc(sp.note)}</p>` : ""}
      ${sp.src ? `<p class="latin">מקור העונה: ${esc(sp.src)}</p>` : ""}
    </details>
    ${window.FISH_INFO && FISH_INFO[sp.id] ? `<button type="button" class="fish-more" data-fish="${sp.id}">להכיר את ה${esc(sp.name)}</button>` : ""}
  </article>`;
}
/* ---------- where to fish for a chosen species ---------- */
function renderTarget() {
  const sel = $("#targetFish");
  if (!sel.options.length) sel.innerHTML = `<option value="">בחרו דג…</option>` + SPECIES.filter(s => !s.caution && !(s.protectedIn && s.protectedIn.length === s.waters.length)).sort((a, b) => a.name.localeCompare(b.name, "he")).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  sel.value = state.target; sel.onchange = () => { state.target = sel.value; store.set("compass-target", sel.value); renderTarget(); };
  const sp = SPECIES.find(s => s.id === state.target), out = $("#targetList");
  if (!sp || !FC) { out.innerHTML = ""; return; }
  const month = E.il(Date.now()).mo, key = todayKey();
  const rows = BEACHES.map(b => {
    const sst = FC.data[b.group] ? (FC.data[b.group].find(r => Math.abs(r.T - Date.now()) < 36e5) || {}).sst : null;
    const fit = E.speciesFit(b, sp, month, sst); if (!fit) return null;
    const day = beachDay(b, key), act = sp.active || [];
    // sessions that match the fish's active hours (dawn → morning, dusk/night → evening, day → midday)
    const want = new Set([...(act.includes("dawn") ? ["morning"] : []), ...(act.includes("day") ? ["midday"] : []), ...(act.includes("dusk") || act.includes("night") ? ["evening"] : [])]);
    const ss = ahead(day.sessions, key).filter(s => !s.na && (!want.size || want.has(s.id))).sort((a, c) => c.score - a.score)[0];
    if (!ss) return null;
    return { b, fit, s: ss, rank: Math.round(0.6 * fit.score + 0.4 * ss.score) };
  }).filter(Boolean).filter(r => r.fit.score >= 40 && !closedAt(r.b)).sort((a, c) => c.rank - a.rank).slice(0, 15);
  out.innerHTML = rows.length ? rows.map((r, i) => `<li><button type="button" class="rank-row ${E.level(r.rank).c}" data-b="${esc(r.b.name)}"><span class="rk">${i + 1}</span><span class="rn">${esc(r.b.name)}${vipTag(r.b)} <small>${esc(r.b.region)} · ${r.fit.why.join(", ")}</small></span>
    <span class="rs">${r.s.name} ${E.hm(r.s.start)}</span><span class="rv">${r.rank}</span>${r.b.legal ? `<span class="rl" title="${esc(r.b.legal)}">⚖️</span>` : ""}</button></li>`).join("") : "<li class='empty'>אין חוף מתאים היום לדג הזה.</li>";
  $$("#targetList .rank-row").forEach(btn => btn.onclick = () => { state.day = key; pickBeach(btn.dataset.b); fillPicker(); setTab("today"); });
}
function renderFish() {
  const b = beachByName(state.beach), month = E.il(Date.now()).mo;
  const sst = FC && FC.data[b.group] ? (FC.data[b.group].find(r => Math.abs(r.T - Date.now()) < 36e5) || {}).sst : null;
  const f = E.fishFor(b, month, sst);
  $("#fishHead").innerHTML = `<h2>דגים ב${esc(b.name)}${vipTag(b)} <small>${esc(b.region)} · ${esc(TYPE_NAMES[b.type] || "")}</small></h2>
    ${sst != null ? `<p>טמפ׳ המים עכשיו: <b>${sst.toFixed(1)}°</b></p>` : ""}
    ${b.legal ? `<p class="legal">⚖️ ${esc(b.legal)}</p>` : ""}
    ${b.reports && b.reports.length ? `<p class="reports">דווחו כאן בעבר: ${b.reports.map(esc).join(" · ")}</p>` : ""}`;
  $("#fishNow").innerHTML = f.now.map(r => fishRow(r, month, b.water)).join("") || "<p>אין דגים בעונה לפי הנתונים שלנו.</p>";
  $("#fishOff").innerHTML = f.off.map(r => fishRow(r, month, b.water)).join("");
  $("#fishProtected").innerHTML = (f.protected.length ? `<h3>מוגנים כאן — אסור לדוג</h3><p>${f.protected.map(r => `<b>${esc(r.name || r.sp && r.sp.name)}</b> (${esc(r.note || r.caution || "")})`).join(" · ")}</p>` : "") +
    (f.caution.length ? `<h3>⚠️ דגי זהירות</h3><ul>${f.caution.map(s => `<li><b>${esc(s.name)}</b>${invTag(s)} <i>${esc(s.lat || "")}</i> — ${esc(s.caution)}${s.aid ? `<details class="aid"><summary>עזרה ראשונה</summary><p>${esc(s.aid)}</p></details>` : ""}</li>`).join("")}</ul>` : "");
  $$("#tab-fish .lure-link").forEach(btn => btn.onclick = () => lureCard(btn.dataset.code));
  $$("#tab-fish .fish-more").forEach(btn => btn.onclick = () => fishCard(btn.dataset.fish));
  renderTarget();
}

// Category pictures are illustrative examples, rather than an exact model specification.
const LURE_TYPE_IMAGES = {
  JIG: "studio/zeake-r-sardine-20g", MJ: "studio/jigpara-tg-14g",
  SP: "studio/bassday-spm-90", FP: "studio/bassday-sugapen",
  MIN: "studio/ima-nabarone", SOFT: "studio/black-minnow-red-head",
  POP: "types/pop", EGI: "types/egi", BOMB: "types/bomb", SPOON: "types/spoon",
  SABIKI: "types/sabiki", TAI: "types/tai", SURF: "types/surf", FLOAT: "types/float", LEDGER: "types/ledger"
};
function lureTypeImage(code, eager = false) {
  const file = LURE_TYPE_IMAGES[code];
  return file ? `<img src="assets/lures/${file}.webp?v=1" alt="הדמיה לדוגמה: ${esc(LURE_TYPES[code] || code)}" loading="${eager ? "eager" : "lazy"}" decoding="async" width="1200" height="600">` : "";
}

/* ---------- lure card: weights, colours, how to work it; link to the arsenal when it has this type ---------- */
function lureCard(code) {
  const i = LURE_INFO[code] || {}, dlg = $("#lureDialog");
  dlg.innerHTML = `<form method="dialog">${LURE_TYPE_IMAGES[code] ? `<div class="lure-type-dialog-photo">${lureTypeImage(code, true)}</div><p class="type-photo-note">הדמיה להמחשת סוג הדמוי</p>` : ""}<h3>${esc(LURE_TYPES[code] || code)}</h3><dl>
    ${i.w ? `<dt>משקל / גודל</dt><dd>${esc(i.w)}</dd>` : ""}${i.c && i.c !== "—" ? `<dt>צבעים</dt><dd>${esc(i.c)}</dd>` : ""}
    ${i.r ? `<dt>איך עובדים</dt><dd>${esc(i.r)}</dd>` : ""}${i.where ? `<dt>איפה ומתי</dt><dd>${esc(i.where)}</dd>` : ""}</dl>
    <div class="dlg-actions">${lgArsenalFor(code).length ? `<button type="button" id="toArsenal" class="primary">לדמויים שלך מהסוג הזה</button>` : ""}<button value="close">סגירה</button></div></form>`;
  const go = $("#toArsenal"); if (go) go.onclick = () => { dlg.close(); openArsenal(code); };
  dlg.showModal();
}

/* ---------- visual lure kit for a fish: icon, main/extra, weight, colour swatches, retrieve, timing, own lures ---------- */
// realistic picture when there is one (assets/fish/<id>.webp, listed in data/fish-photos.js), otherwise our illustration
const art = (id, cls = "") => {
  const sp = SPECIES.find(s => s.id === id), alt = sp ? esc(sp.name) : "";
  if ((window.FISH_PHOTOS || []).includes(id)) return `<div class="fish-pic is-photo ${cls}"><img src="assets/fish/${id}.webp?v=${window.FISH_PHOTOS_V || 1}" alt="${alt}" loading="lazy" decoding="async"></div>`;
  return window.FISH_ART && FISH_ART.has(id) ? `<div class="fish-pic ${cls}">${FISH_ART.fish(id)}</div>` : "";
};
function lureKitHtml(sp) {
  const codes = [...sp.lures.map(c => [c, 1]), ...(sp.lures2 || []).map(c => [c, 2])].filter(([c]) => c !== "BAIT");
  // the fish's own size / retrieve text applies when it has a single main lure; otherwise each type shows its own
  const mains = codes.filter(([, r]) => r === 1).length;
  return codes.map(([c, rank]) => { const one = rank === 1 && mains === 1, i = LURE_INFO[c] || {}, colors = sp.colors || i.c || "", own = typeof lgArsenalFor === "function" ? lgArsenalFor(c, sp) : [];
    return `<article class="kit-card ${rank === 1 ? "is-main" : ""}"><button type="button" class="kit-open lure-link${LURE_TYPE_IMAGES[c] ? "" : " no-img"}" data-code="${c}" aria-label="פרטים על ${esc(LURE_TYPES[c])}">${lureTypeImage(c) || "<span aria-hidden=\"true\">🎣</span>"}</button>
      <div class="kit-body"><header><b>${esc(LURE_TYPES[c])}</b><span>${rank === 1 ? "ראשי" : "משלים"}</span></header>
      <p><span class="k">⚖️</span> ${esc(one && sp.size ? sp.size : i.w || "—")}</p>
      <p><span class="k">🎨</span> ${window.FISH_ART ? FISH_ART.swatches(colors) : ""} ${esc(colors || "—")}</p>
      <p><span class="k">🔁</span> ${esc(one && sp.work ? sp.work : i.r || "—")}</p>
      ${(rank === 1 && sp.when) || i.where ? `<p><span class="k">🕑</span> ${esc([rank === 1 ? sp.when : "", i.where].filter(Boolean).join(" · "))}</p>` : ""}
      ${own.length ? `<p class="kit-own">בארסנל שלך: ${own.map(l => esc(l.name)).join(" · ")}</p>` : ""}</div></article>`; }).join("");
}

/* ---------- full fish profile (data/fish-info.js, built by build_fish_info.js from our fish dossiers) ---------- */
const FISH_SECTIONS = [["זיהוי", "🔎"], ["איפה", "📍"], ["מתי", "📅"], ["תנאים", "🌊"], ["שיטות ודמויים", "🎣"], ["פיתיון", "🪱"], ["חוק", "⚖️"], ["בטיחות", "⚠️"], ["טיפים", "💡"]];
const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
function fishCard(id) {
  const sp = SPECIES.find(s => s.id === id), info = (window.FISH_INFO || {})[id], dlg = $("#fishDialog"); if (!sp || !info) return;
  const b = beachByName(state.beach), month = E.il(Date.now()).mo, x = info.intel || {};
  const cal = MONTHS.map((m, i) => `<span class="${sp.p && sp.p.includes(i + 1) ? "pk" : sp.m.includes(i + 1) ? "in" : ""}${i + 1 === month ? " now" : ""}">${m}</span>`).join("");
  const facts = [
    sp.active && sp.active.length ? ["הכי פעיל", sp.active.map(a => ACTIVE_NAMES[a]).join(", ")] : x["הכי פעיל"] ? ["הכי פעיל", x["הכי פעיל"]] : null,
    sp.t4 ? ["מים", `אידיאלי ${sp.t4[1]}–${sp.t4[2]}° · חי ${sp.t4[0]}–${sp.t4[3]}°`] : sp.temp ? ["מים", `${sp.temp[0]}–${sp.temp[1]}°`] : x["טמפ׳ מים מועדפת"] ? ["מים", x["טמפ׳ מים מועדפת"]] : null,
    bodyTxt(sp) ? ["גודל", bodyTxt(sp) + (sp.body.unit && SIZE_UNIT[sp.body.unit] ? ` (${SIZE_UNIT[sp.body.unit]})` : "")] : null,
    sp.invasive ? ["מין פולש", "כן"] : null,
    ["שכבה", sp.layer === "upper" ? "מים עליונים" : sp.layer === "bottom" ? "חלק תחתון" : "כל גוף המים"],
    sp.min ? ["מינימום", sp.min + " ס״מ"] : x["גודל מינימלי"] ? ["מינימום", x["גודל מינימלי"]] : null,
    x["רבייה"] ? ["רבייה", x["רבייה"]] : null
  ].filter(Boolean);
  const lures = [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT").map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ");
  const sec = name => {
    let items = (info.sections || {})[name] || [];
    if (name === "שיטות ודמויים" && x["דמויים / מערכות"]) items = [...items, `**ציוד מומלץ:** ${x["דמויים / מערכות"]}`];
    if (name === "חוק") items = [...items, ...[sp.legal && sp.legal[b.water], x["מוגן / אזהרה"], sp.caution].filter(Boolean).map(t => "**שימו לב:** " + t)];
    if (name === "בטיחות" && sp.hazard) items = [...items, "**שימו לב:** " + sp.hazard];
    const bs = name === "פיתיון" ? baitsFor(sp.id) : [];
    const extra = bs.length ? `<ul class="bait-list">${bs.map(q => `<li><b>${esc(q.name)}</b> <small>קרס ${esc(q.hook)}</small> — ${esc(q.how)}</li>`).join("")}</ul>` : "";
    return items.length || extra ? `<section><h4>${FISH_SECTIONS.find(s => s[0] === name)[1]} ${name}</h4>${items.length ? `<ul>${items.map(t => `<li>${rich(t)}</li>`).join("")}</ul>` : ""}${extra}</section>` : "";
  };
  const aka = info.aka || sp.aka || [];
  dlg.innerHTML = `<form method="dialog">${art(sp.id, "is-hero")}<header><h3>${esc(sp.name)}</h3>${info.lat || sp.lat ? `<p class="latin"><i>${esc(info.lat || sp.lat)}</i>${aka.length ? " · נקרא גם: " + aka.map(esc).join(", ") : ""}</p>` : ""}</header>
    <div class="fish-cal" aria-label="עונה">${cal}</div><p class="hint">כהה = שיא · בהיר = בעונה · מסגרת = החודש</p>
    <dl class="fish-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${/^[\d–\-°. ]+$/.test(v) ? `<bdi dir="ltr">${esc(v)}</bdi>` : esc(v)}</dd></div>`).join("")}</dl>
    ${(() => { const kit = lureKitHtml(sp); return kit ? `<section class="kit"><h4>🎯 הדמויים שמתאימים ל${esc(sp.name)}</h4>${sp.bait || sp.lures.includes("BAIT") ? `<p class="hint">נתפס בעיקר בפיתיון טבעי — הדמויים כאן הם אפשרות משלימה.</p>` : ""}<div class="kit-grid">${kit}</div></section>` : ""; })()}
    ${gearHtml(sp, b)}
    ${FISH_SECTIONS.map(([n]) => sec(n)).join("")}
    <p class="hint">${info.src === "own" ? "פרופיל שכתבנו מהמחקר שלנו." : "סיכום במילים שלנו מתיקי הדגים שאספנו ומהמחקר על התקנות."} העונה והשעות לפי נתוני האפליקציה.${sp.t4 || sp.body ? " טמפ׳ המים, הגודל, גודלי הקרס ומספרי הציוד והריג לפי נתוני Hooked." : ""}</p>
    <div class="dlg-actions">${sp.caution || (sp.protectedIn && sp.protectedIn.length === sp.waters.length) ? "" : `<button type="button" id="fishWhere" class="primary">איפה לדוג אותו היום</button>`}<button value="close">סגירה</button></div></form>`;
  dlg.querySelectorAll(".lure-link").forEach(btn => btn.onclick = () => { dlg.close(); lureCard(btn.dataset.code); });
  const go = $("#fishWhere");
  if (go) go.onclick = () => { dlg.close(); state.target = id; store.set("compass-target", id); setTab("fish"); const t = $("#targetFish"); if (t) { t.value = id; renderTarget(); t.scrollIntoView({ behavior: "smooth", block: "start" }); } };
  dlg.showModal(); dlg.scrollTop = 0;
}

/* ---------- lures tab: ONE list by lure type — your own lures sit inside their type's card; one filter bar for all ---------- */
const lg = { month: E.il(Date.now()).mo, fish: store.get("compass-lg-fish", ""), group: store.get("compass-lg-group", "all"), q: "", mine: false };
const lgTargets = () => SPECIES.filter(s => !s.caution && !(s.protectedIn && s.protectedIn.length === s.waters.length));
const lgStatus = (sp, m) => sp.p && sp.p.includes(m) ? "pk" : sp.m.includes(m) ? "in" : "off";
const WATER_NAME = { med: "ים תיכון", eilat: "אילת", lake: "כנרת" };
// the lure type each of your own lures belongs to
function productCode(l) {
  if (l.type === "jig") { const g = (l.subtitle.match(/(\d+)\s*גרם/) || [])[1]; return g && +g <= 15 ? "MJ" : "JIG"; }
  if (l.type === "soft") return "SOFT"; if (l.type === "topwater") return "FP";
  return l.typeLabel === "פנסיל" ? "SP" : "MIN";
}
function lgArsenalFor(code, sp) { // your own lures of this type; those listing the fish first
  const list = (window.ARSENAL_LURES || []).filter(l => productCode(l) === code);
  return list.sort((a, b) => (b.fish.includes(sp && sp.name) ? 1 : 0) - (a.fish.includes(sp && sp.name) ? 1 : 0));
}
const LURE_GROUPS = [["all", "הכל", null], ["metal", "ג׳יגים וכפיות", ["JIG", "MJ", "SPOON", "TAI", "NICKEL", "BUCK", "VIB"]], ["hard", "מינו ופנסילים", ["MIN", "SP", "PINTAIL", "NEEDLE"]],
  ["top", "פני המים", ["FP", "POP", "BOMB"]], ["soft", "סיליקון", ["SOFT", "GRUB", "SHRIMP", "EEL"]], ["egi", "אגי", ["EGI"]], ["rigs", "מערכות ופיתיון", ["SURF", "FLOAT", "LEDGER", "SABIKI"]]];
function ownLureHtml(l, sp, m) {
  const fits = sp && l.fish.includes(sp.name), inSeason = !l.months || l.months.includes(m);
  const demo = typeof motionGraphic === "function" && typeof profiles !== "undefined" && profiles[l.id];
  return `<article class="own-lure${fits ? " is-fit" : ""}" id="card-${l.id}">
    <button type="button" class="own-photo" data-lure-photo="${l.id}" aria-label="תמונה מוגדלת של ${esc(l.name)}"><img src="assets/lures/studio/${esc(l.image)}?v=1" alt="" loading="lazy" decoding="async"></button>
    <div class="own-body"><header><b><bdi dir="ltr">${esc(l.name)}</bdi></b><span class="own-badge ${inSeason ? "is-in" : "is-off"}">${!l.months ? "כל השנה" : inSeason ? `בעונה ב${MONTHS[m - 1]}` : `לא בעונה ב${MONTHS[m - 1]}`}</span></header>
      <p class="own-sub">${esc(l.subtitle)}${fits ? ` · <b>מתאים ל${esc(sp.name)}</b>` : ""}</p>
      <details class="own-instructions"><summary>אופן עבודה ודגי מטרה</summary><ol class="own-steps">${l.methods.map(t => `<li>${esc(t)}</li>`).join("")}</ol>
      <p class="own-fish">🐟 ${l.fish.map(esc).join(" · ")}</p>
      ${l.note ? `<p class="own-note">${esc(l.note)}</p>` : ""}</details></div>
    ${demo ? `<details class="own-demo"><summary>▶ הדגמת עבודה</summary>${motionGraphic(l)}</details>` : ""}</article>`;
}
// v3.5: natural baits (data/species-plus.js BAITS) — for the chosen fish, or all of them; shown under the lure types
function baitGuideHtml(sp) {
  if (!["all", "rigs"].includes(lg.group)) return "";
  const list = (window.BAITS || []).filter(b => !sp || b.fish.includes(sp.id)); if (!list.length) return "";
  const nm = id => { const f = SPECIES.find(q => q.id === id); return f ? f.name : id; };
  return `<details class="lg-baits" ${sp ? "open" : ""}><summary>🪱 פיתיונות טבעיים${sp ? ` ל${esc(sp.name)}` : ""} <small>(${list.length})</small></summary><ul>${list.map(b => `<li><b>${esc(b.name)}</b> <small>קרס ${esc(b.hook)}</small><p>${esc(b.how)}</p>${sp ? "" : `<p class="bait-fish">🐟 ${b.fish.map(nm).map(esc).join(" · ")}</p>`}</li>`).join("")}</ul><p class="hint">גודלי הקרס לפי נתוני Hooked; ההסברים שלנו.</p></details>`;
}
function typeCardHtml(c, m, sp, all) {
  const i = LURE_INFO[c] || {};
  const fish = all.map(s => ({ s, rank: s.lures.includes(c) ? 1 : (s.lures2 || []).includes(c) ? 2 : 0 })).filter(x => x.rank);
  const now = fish.filter(x => lgStatus(x.s, m) !== "off").sort((a, b) => (lgStatus(a.s, m) === "pk" ? 0 : 1) - (lgStatus(b.s, m) === "pk" ? 0 : 1) || a.rank - b.rank);
  const heat = MONTHS.map((n, k) => fish.filter(x => x.s.m.includes(k + 1)).length), mx = Math.max(1, ...heat);
  const own = lgArsenalFor(c, sp), rank = sp ? (sp.lures.includes(c) ? 1 : 2) : 0;
  const single = sp && rank === 1 && sp.lures.filter(x => x !== "BAIT").length === 1; // the fish's own size / retrieve text fits only a single main lure
  const colors = (sp && sp.colors) || i.c || "";
  const chip = x => `<button type="button" class="lg-chip is-${lgStatus(x.s, m)}${x.rank === 1 ? " is-main" : ""}" data-lgf="${x.s.id}" title="${x.rank === 1 ? "דמוי ראשי" : "דמוי משלים"} ל${esc(x.s.name)}">${esc(x.s.name)}${lgStatus(x.s, m) === "pk" ? " ★" : ""}</button>`;
  return `<article class="lg-type lure-type-card${rank === 1 ? " is-main" : ""}" id="type-${c}" data-lure-type="${c}">
    ${LURE_TYPE_IMAGES[c] ? `<button type="button" class="type-photo kit-open" data-code="${c}" aria-label="תמונה ופרטים על ${esc(LURE_TYPES[c])}">${lureTypeImage(c)}<span class="type-photo-note">הדמיה לדוגמה · לפרטים</span></button>` : ""}
    <header><h3>${esc(LURE_TYPES[c])}</h3>${sp ? `<span class="rank-badge${rank === 1 ? " is-main" : ""}">${rank === 1 ? "ראשי" : "משלים"} ל${esc(sp.name)}</span>` : `<span class="lg-count">${now.length ? `${now.length} דגים בעונה` : "אין דגים בעונה"}</span>`}${own.length ? `<span class="own-count">${own.length} שלך</span>` : ""}</header>
    <dl class="type-facts"><div><dt>משקל / גודל</dt><dd>${esc(single && sp.size ? sp.size : i.w || "—")}</dd></div><div><dt>צבעים מומלצים</dt><dd>${window.FISH_ART ? FISH_ART.swatches(colors) : ""} ${esc(colors || "—")}</dd></div></dl>
    <div class="type-retrieve"><span>איך עובדים</span><p>${esc(single && sp.work ? sp.work : i.r || "—")}</p></div><details class="type-extra"><summary>מתי, איפה ועונתיות</summary><p class="type-location"><b>מתי ואיפה</b>${esc([single ? sp.when : "", i.where].filter(Boolean).join(" · ") || "—")}</p>
    <div class="type-season"><div><b>עונתיות לאורך השנה</b><span>נבחר: ${MONTHS[m - 1]}</span></div><div class="lg-heat" aria-label="מספר דגי מטרה בעונה בכל חודש">${heat.map((v, k) => `<span class="${k + 1 === m ? "now" : ""}" style="--h:${(v / mx).toFixed(2)}" title="${MONTHS[k]}: ${v} דגים"></span>`).join("")}</div><div class="type-season-labels" aria-hidden="true"><span>ינואר</span><span>דצמבר</span></div></div></details>
    <section class="type-targets" aria-label="דגי מטרה"><h4>מה אפשר לתפוס ב${MONTHS[m - 1]}?</h4><div class="lg-fishes">${now.length ? now.slice(0, 5).map(chip).join("") : `<span class="hint">אין דגי מטרה בעונה בחודש הזה.</span>`}</div>
    ${now.length > 5 ? `<details class="type-more-fish"><summary>עוד ${now.length - 5} דגי מטרה</summary><div class="lg-fishes">${now.slice(5).map(chip).join("")}</div></details>` : ""}</section>
    ${own.length ? `<section class="type-own" aria-label="הדמויים שלך מהסוג הזה"><h4>הדגמים שלך <span>${own.length}</span></h4>${own.map(l => ownLureHtml(l, sp, m)).join("")}</section>` : ""}
  </article>`;
}
function openLurePhoto(id) {
  const l = (window.ARSENAL_LURES || []).find(x => x.id === id), d = $("#lurePhotoDialog"); if (!l || !d) return;
  d.innerHTML = `<form method="dialog"><header class="product-head"><div><span class="overline">מבט מקרוב</span><h2><bdi dir="ltr">${esc(l.name)}</bdi></h2><p>${esc(l.subtitle)}</p></div><button class="product-close" value="close" aria-label="סגירת תצוגת הדמוי">✕</button></header><div class="product-stage"><img src="assets/lures/studio/${esc(l.image)}?v=1" alt="הדמיה מוגדלת של ${esc(l.name)}" width="1200" height="600"></div><p class="product-caption">הדמיית מוצר לפי תמונת הדגם</p></form>`;
  d.showModal(); d.onclick = e => { if (e.target === d) d.close(); };
}
function renderLureGuide() {
  const box = $("#lureGuide"); if (!box) return;
  const m = lg.month, all = lgTargets(), sp = all.find(s => s.id === lg.fish);
  const months = MONTHS.map((n, i) => `<button type="button" class="nm${i + 1 === E.il(Date.now()).mo ? " is-now" : ""}${i + 1 === m ? " is-sel" : ""}" data-lgm="${i + 1}">${n}</button>`).join("");
  const opts = [...all].sort((a, b) => ({ pk: 0, in: 1, off: 2 }[lgStatus(a, m)] - { pk: 0, in: 1, off: 2 }[lgStatus(b, m)]) || a.name.localeCompare(b.name, "he"))
    .map(s => `<option value="${s.id}" ${s.id === lg.fish ? "selected" : ""}>${esc(s.name)}${lgStatus(s, m) === "pk" ? " · שיא" : lgStatus(s, m) === "off" ? " · לא בעונה" : ""} (${s.waters.map(w => WATER_NAME[w]).join("/")})</option>`).join("");
  const used = c => all.some(s => s.lures.includes(c) || (s.lures2 || []).includes(c));
  let codes = sp ? [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT" && LURE_TYPES[c])
    : Object.keys(LURE_TYPES).filter(c => c !== "BAIT" && used(c)).sort((a, b) => all.filter(s => lgStatus(s, m) !== "off" && (s.lures.includes(b) || (s.lures2 || []).includes(b))).length - all.filter(s => lgStatus(s, m) !== "off" && (s.lures.includes(a) || (s.lures2 || []).includes(a))).length);
  const grp = LURE_GROUPS.find(g => g[0] === lg.group) || LURE_GROUPS[0];
  if (grp[2]) codes = codes.filter(c => grp[2].includes(c));
  if (lg.mine) codes = codes.filter(c => lgArsenalFor(c).length);
  const q = lg.q.trim().toLowerCase();
  if (q) codes = codes.filter(c => [LURE_TYPES[c], ...Object.values(LURE_INFO[c] || {}), ...lgArsenalFor(c).flatMap(l => [l.name, l.subtitle, ...l.fish]), ...all.filter(s => s.lures.includes(c) || (s.lures2 || []).includes(c)).map(s => s.name)].join(" ").toLowerCase().includes(q));
  const ownN = codes.reduce((a, c) => a + lgArsenalFor(c).length, 0);
  let head = "";
  if (sp) {
    const st = lgStatus(sp, m), info = (window.FISH_INFO || {})[sp.id], tips = info && info.sections ? (info.sections["שיטות ודמויים"] || []) : [];
    head = `<div class="lg-fish">${art(sp.id, "is-hero")}
      <h3>${esc(sp.name)} <small class="lg-st is-${st}">${st === "pk" ? "שיא העונה" : st === "in" ? "בעונה" : "לא בעונה"} ב${MONTHS[m - 1]}</small></h3>
      <div class="fish-cal">${MONTHS.map((n, i) => `<span class="${lgStatus(sp, i + 1) === "pk" ? "pk" : lgStatus(sp, i + 1) === "in" ? "in" : ""}${i + 1 === m ? " now" : ""}">${n}</span>`).join("")}</div>
      <p class="lg-meta">🕑 ${sp.active && sp.active.length ? sp.active.map(a => ACTIVE_NAMES[a]).join(", ") : "—"} · ${sp.layer === "upper" ? "⬆ מים עליונים" : sp.layer === "bottom" ? "⬇ ליד הקרקעית" : "↕ כל גוף המים"}${sp.temp ? ` · מים <bdi dir="ltr">${sp.temp[0]}–${sp.temp[1]}°</bdi>` : ""}${sp.min ? ` · מינימום ${sp.min} ס״מ` : ""}</p>
      ${sp.lures.includes("BAIT") || sp.bait ? `<p class="lg-bait">🪱 נתפס בעיקר בפיתיון טבעי${sp.work ? ": " + esc(sp.work) : ""}. הדמויים כאן הם האפשרות המשלימה.</p>` : ""}
      ${tips.length ? `<details class="lg-tips"><summary>מהתיק של ה${esc(sp.name)}: שיטות ודמויים</summary><ul>${tips.map(t => `<li>${rich(t)}</li>`).join("")}</ul></details>` : ""}
      <p class="lg-actions"><button type="button" class="fish-link" data-fish="${sp.id}">📖 כל המידע על ה${esc(sp.name)}</button> · <button type="button" class="fish-link" id="lgWhere">📍 איפה לדוג אותו היום</button> · <button type="button" class="fish-link" id="lgClear">✕ כל הדמויים</button></p></div>`;
  }
  box.innerHTML = `<div class="lg-head"><span class="section-kicker">כל הדמויים במקום אחד</span><h2>הדמויים</h2>
    <p class="hint">בוחרים דג או סוג דמוי, ומוצאים איך לעבוד איתו. הדגמים שלך מופיעים בכל כרטיס.</p></div>
    <div class="lg-filters">
      <div class="now-months lg-months" role="group" aria-label="חודש">${months}</div>
      <div class="lg-row"><label class="spot-pick lg-pick"><span>דג מטרה</span><select id="lgFish"><option value="">כל הדגים</option>${opts}</select></label>
        <label class="lg-search"><span>חיפוש</span><input id="lgSearch" type="search" value="${esc(lg.q)}" placeholder="סוג, דמוי, מותג או דג" autocomplete="off"></label></div>
      <div class="lg-groups" role="group" aria-label="סוג הדמוי">${LURE_GROUPS.map(g => `<button type="button" class="lg-chip lg-group${g[0] === lg.group ? " is-sel" : ""}" data-lgg="${g[0]}" aria-pressed="${g[0] === lg.group}">${g[1]}</button>`).join("")}
        <label class="lg-mine"><input type="checkbox" id="lgMine" ${lg.mine ? "checked" : ""}> רק סוגים שיש לי בארסנל</label></div>
    </div>
    ${head}
    <div class="lg-results"><p class="lg-count-line" role="status">${codes.length} סוגי דמויים${ownN ? ` · ${ownN} מהארסנל שלך` : ""}</p><span class="lg-legend">★ שיא העונה · קו תחתון: דמוי ראשי</span></div>
    <div class="lg-types">${codes.map(c => typeCardHtml(c, m, sp, all)).join("") || `<p class="hint">אין דמויים שמתאימים לסינון הזה.</p>`}</div>
    ${baitGuideHtml(sp)}`;
  box.querySelectorAll("[data-lgm]").forEach(b => b.onclick = () => { lg.month = +b.dataset.lgm; renderLureGuide(); });
  box.querySelectorAll("[data-lgg]").forEach(b => b.onclick = () => { lg.group = b.dataset.lgg; store.set("compass-lg-group", lg.group); renderLureGuide(); });
  box.querySelectorAll("[data-lgf]").forEach(b => b.onclick = () => { lg.fish = b.dataset.lgf; store.set("compass-lg-fish", lg.fish); renderLureGuide(); box.scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#lgFish").onchange = e => { lg.fish = e.target.value; store.set("compass-lg-fish", lg.fish); renderLureGuide(); };
  const s = $("#lgSearch"); s.oninput = () => { lg.q = s.value; renderLureGuide(); const n = $("#lgSearch"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $("#lgMine").onchange = e => { lg.mine = e.target.checked; renderLureGuide(); };
  box.querySelectorAll(".fish-link[data-fish]").forEach(b => b.onclick = () => fishCard(b.dataset.fish));
  box.querySelectorAll(".kit-open").forEach(b => b.onclick = () => lureCard(b.dataset.code));
  box.querySelectorAll("[data-lure-photo]").forEach(b => b.onclick = () => openLurePhoto(+b.dataset.lurePhoto));
  const clr = $("#lgClear"); if (clr) clr.onclick = () => { lg.fish = ""; store.set("compass-lg-fish", ""); renderLureGuide(); };
  const wh = $("#lgWhere"); if (wh) wh.onclick = () => { state.target = sp.id; store.set("compass-target", sp.id); setTab("fish"); const t = $("#targetFish"); if (t) { t.value = sp.id; renderTarget(); t.scrollIntoView({ behavior: "smooth", block: "start" }); } };
  centerLureMonth();
  renderMethods();
  if (typeof initAnimations === "function") initAnimations(); // the demos of your own lures (script.js)
}

/* ---------- fishing methods guide (lures tab) — our own summary; fish come from species.js by lure codes ---------- */
const METHODS = [
  { id: "spin", name: "ספינינג מהחוף", icon: "🎣", codes: ["JIG", "MIN", "SP", "FP", "POP", "SPOON", "BOMB"],
    what: "הטלה ואיסוף של דמוי מלאכותי — השיטה הכי נפוצה לטורפים מהחוף ומהשובר.",
    gear: "חכה 2.7–3.3 מ׳ (10–60 ג׳), גלגלת 3000–5000, חוט קלוע 0.12–0.20 מ״מ, ליידר פלורוקרבון 0.35–0.60 מ״מ.",
    when: "שחר ודמדומים; ים נוח עד עובד. בשחר על פני המים, באור מלא לעומק.",
    tips: ["לזוז לאורך החוף עד שמוצאים פעילות — ציפורים, רתיחות, דגי פיתיון קופצים.", "להחליף צבע ומשקל לפני שמחליפים מקום."] },
  { id: "lrf", name: "LRF — ספינינג קל", icon: "🪶", codes: ["MJ", "SOFT"],
    what: "דמויים זעירים על ציוד קל מאוד, לדגים קטנים וזהירים ליד מבנים.",
    gear: "חכה 1.8–2.4 מ׳ (0.5–10 ג׳), גלגלת 1000–2500, קלוע 0.04–0.08 מ״מ, ליידר 0.16–0.25 מ״מ, ראשי ג׳יג 0.5–5 ג׳.",
    when: "ים שקט ומים צלולים, ליד שוברים, מזחים ומרינות; ערב ולילה ליד אורות.",
    tips: ["גרירה איטית ליד הקרקעית והסלעים, עם עצירות.", "חוט דק = יותר נגיעות; לשחרר מהר דגים קטנים."] },
  { id: "jig", name: "ג׳יגינג", icon: "⚓", codes: ["JIG", "TAI"],
    what: "ג׳יג מתכת או טאי-ראבר שמורידים לעומק ומעלים בהקפצות — מהשובר או אנכית מסירה.",
    gear: "מהחוף: ג׳יג 20–60 ג׳ על ציוד ספינינג חזק. מסירה: חכת ג׳יגינג, ג׳יג 60–300 ג׳ או טאי-ראבר 40–200 ג׳.",
    when: "כשהלהקות עמוק או רחוק; אור מלא; ברוח — משקל כבד יותר.",
    tips: ["לספור את שקיעת הג׳יג כדי לחזור לאותו עומק.", "רוב התקיפות בירידה — להיות מוכנים להרמה."] },
  { id: "surf", name: "סרף קסטינג", icon: "🏖️", codes: ["SURF"],
    what: "פיתיון טבעי על משקולת, בהטלה רחוקה מחוף חולי לתעלה שאחרי קו השבירה.",
    gear: "חכה 4–4.5 מ׳, משקולת 60–150 ג׳ (עוגן בים עובד), ליידר ארוך וקרס חזק, מעמד לחכה.",
    when: "1–2 ימים אחרי סערה, כשהגלים נרגעים והמים עדיין עכורים; שחר, ערב ולילה.",
    tips: ["להטיל לשקע הכהה שאחרי השבירה הראשונה או השנייה.", "להרים על משיכה ברורה, לא על נקישות."] },
  { id: "bottom", name: "דיג תחתית", icon: "⬇️", codes: ["BAIT", "LEDGER"],
    what: "פיתיון על הקרקעית — משקולת זזה או קבועה — ליד סלעים, שוברים ובכנרת.",
    gear: "חכה בינונית, משקולת קלה ככל האפשר לזרם, חוט קרס דק וקרס קטן לפי הדג.",
    when: "ערב ולילה; ליד מבנים ושפכים; בכנרת — שחר וערב.",
    tips: ["פיתיון טרי קטן תופס יותר.", "בסלעים — משקולת שבירה כדי לא לאבד את כל המערכת."] },
  { id: "float", name: "מצוף", icon: "🔴", codes: ["FLOAT"],
    what: "פיתיון בעומק קבוע מתחת למצוף — לבורי, סלפה, סיכן ודגי כנרת.",
    gear: "חכה ארוכה וקלה, מצוף דק שקצהו בלבד בולט, משקולות קטנות לאורך החוט, קרס קטן.",
    when: "ים שקט, מרינות ומים מוגנים; ביום.",
    tips: ["תערובת משיכה במעט ובקביעות מחזיקה את הלהקה במקום.", "פיתיון נעלם בלי תנועת מצוף — להוסיף משקולת ולהקטין קרס."] },
  { id: "egi", name: "אגינג (קלאמרי)", icon: "🦑", codes: ["EGI"],
    what: "אגי — דמוי שרימפס עם כתר קוצים — לקלאמרי, ספיה ותמנון.",
    gear: "חכה 2.4–2.7 מ׳ רכה, קלוע דק 0.10–0.14 מ״מ, ליידר 0.25–0.30 מ״מ, אגי 2.5–3.5.",
    when: "ערבי חורף ואביב, ליד תאורה, מים צלולים וים שקט. אסור באילת (כל הרכיכות מוגנות).",
    tips: ["2–3 הקפצות, שקיעה וריחוף — רוב התקיפות בזמן הריחוף.", "משיכה רציפה בקרב, בלי לתת רפיון."] }
];
function renderMethods() {
  const box = $("#methodsGuide"); if (!box) return;
  const m = lg.month, all = lgTargets();
  box.innerHTML = `<div class="lg-head"><span class="section-kicker">שיטות</span><h2>מדריך שיטות דיג</h2><p class="hint">לכל שיטה: מה זה, ציוד, מתי, טיפים, ולאילו דגים היא מתאימה. הדגים שבעונה ב${MONTHS[m - 1]} מודגשים.</p></div>
    <div class="lg-types">${METHODS.map(me => { const fish = all.filter(s => [...s.lures, ...(s.lures2 || [])].some(c => me.codes.includes(c)))
        .sort((a, c) => ({ pk: 0, in: 1, off: 2 }[lgStatus(a, m)] - { pk: 0, in: 1, off: 2 }[lgStatus(c, m)]));
      return `<article class="lg-type method"><header><h3>${me.icon} ${esc(me.name)}</h3></header><p class="lg-line">${esc(me.what)}</p>
        <details class="method-details"><summary>ציוד, עבודה וטיפים</summary><p class="lg-line"><b>ציוד:</b> ${esc(me.gear)}</p><p class="lg-line"><b>מתי:</b> ${esc(me.when)}</p>
        <ul class="method-tips">${me.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="lg-line"><b>דמויים:</b> ${me.codes.filter(c => LURE_TYPES[c]).map(c => esc(LURE_TYPES[c])).join(" · ")}</p></details>
        <p class="lg-fishes">${fish.slice(0, 5).map(s => `<button type="button" class="lg-chip is-${lgStatus(s, m)}" data-lgf="${s.id}">${esc(s.name)}${lgStatus(s, m) === "pk" ? " ★" : ""}</button>`).join("")}</p>${fish.length > 5 ? `<details class="method-more"><summary>עוד ${fish.length - 5} דגי מטרה</summary><p class="lg-fishes">${fish.slice(5).map(s => `<button type="button" class="lg-chip is-${lgStatus(s, m)}" data-lgf="${s.id}">${esc(s.name)}${lgStatus(s, m) === "pk" ? " ★" : ""}</button>`).join("")}</p></details>` : ""}</article>`; }).join("")}</div>`;
  box.querySelectorAll("[data-lgf]").forEach(bt => bt.onclick = () => { lg.fish = bt.dataset.lgf; store.set("compass-lg-fish", lg.fish); renderLureGuide(); $("#lureGuide").scrollIntoView({ behavior: "smooth", block: "start" }); });
}

/* ---------- link into the lure arsenal (script.js) ---------- */
function openArsenal(code) {
  setTab("lures"); lg.fish = ""; lg.group = "all"; lg.q = ""; lg.mine = false; renderLureGuide();
  const card = document.getElementById("type-" + code); if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- catch log (local, with beach and casting distance for future zone calibration) ---------- */
const LOG_KEY = "compass-catches";
// a catch outside the loaded forecast (older than a day): fetch that hour from Open-Meteo's past data (up to ~3 months back)
async function pastCond(id, b, date, T) {
  const g = GROUPS[b.group]; if (!g || T > Date.now() + 36e5 || Date.now() - T > 90 * 864e5) return;
  const span = `&start_date=${E.addDays(date, -1)}&end_date=${date}&timezone=GMT`, at = h => h.time.findIndex(t => Math.abs(Date.parse(t + "Z") - T) < 31 * 6e4);
  try {
    const w = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lon}&hourly=pressure_msl,wind_speed_10m${span}`)).json();
    const m = g.water === "lake" ? null : await (await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${g.mlat}&longitude=${g.mlon}&hourly=wave_height,sea_surface_temperature${span}`)).json().catch(() => null);
    const k = at(w.hourly), j = m && m.hourly ? at(m.hourly) : -1; if (k < 0) return;
    const cond = { p: w.hourly.pressure_msl[k], wind: w.hourly.wind_speed_10m[k], wave: j >= 0 && m.hourly.wave_height[j] != null ? m.hourly.wave_height[j] * 100 : null, sst: j >= 0 ? m.hourly.sea_surface_temperature[j] : null, src: "past" };
    const all = store.get(LOG_KEY, []), c = all.find(x => x.id === id); if (!c || c.cond) return;
    c.cond = cond; store.set(LOG_KEY, all); if ($("#logList")) renderLog();
  } catch (e) { /* offline: the catch stays without conditions */ }
}
const condTxt = c => c.cond ? ` · <span class="log-cond">${[c.cond.wave != null ? `גל ${Math.round(c.cond.wave)} ס״מ` : "", c.cond.wind != null ? `רוח ${Math.round(c.cond.wind)} קמ״ש` : "", c.cond.p != null ? `${Math.round(c.cond.p)} hPa` : "", c.cond.sst != null ? `מים ${Math.round(c.cond.sst)}°` : ""].filter(Boolean).join(" · ")}</span>` : "";
// v3.7: a trip without a catch is logged too (needed to test the index against real outcomes); each entry stores the index, the session,
// the safety score, the tide phase and the moon at that hour; legal checks (minimum size, protected species, daily bag reminder); backup.
const NONE = "__none";
const spByName = n => SPECIES.find(s => s.name === n);
function snapshot(b, date, T) {
  try {
    const d = beachDay(b, date), hr = E.il(T).hf, s = d.sessions.find(q => !q.na && hr >= q.start - 0.25 && hr <= q.end + 0.25);
    const row = d.rowsAll.find(q => Math.abs(q.T - T) < 31 * 6e4), ph = b.water === "lake" ? null : E.tidePhase(d.tidesAll, T);
    return { sess: s ? s.id : null, score: s ? s.score : null, safe: row ? d.safeOf(row) : null, tide: ph == null ? null : Math.round(ph * 100) / 100,
      moon: typeof SunCalc !== "undefined" ? Math.round(SunCalc.getMoonIllumination(new Date(T)).fraction * 100) / 100 : null };
  } catch (e) { return null; }
}
const logLine = c => {
  const trip = c.fish === NONE;
  return `<li${trip ? ' class="trip"' : ""}><b>${trip ? "יציאה בלי תפיסה" : esc(c.fish)}</b>${c.released ? ' <em class="rel-tag">שוחרר</em>' : ""} · ${esc(c.beach)} · ${esc(c.date)} ${esc(c.time || "")}${c.hours ? ` · ${esc(c.hours)} שעות` : ""}${c.lure ? " · " + esc(LURE_TYPES[c.lure] || c.lure) : ""}${c.len ? ` · ${esc(c.len)} ס״מ` : ""}${c.dist ? ` · ${esc(c.dist)} מ׳ מהחוף` : ""}${condTxt(c)}${c.snap && c.snap.score != null ? ` · <span class="log-cond">מדד ${esc(c.snap.score)}</span>` : ""}${c.notes ? `<br><small>${esc(c.notes)}</small>` : ""}
      <button type="button" class="del" data-id="${esc(c.id)}" aria-label="מחיקה">✕</button></li>`; };
function renderLog() {
  const list = store.get(LOG_KEY, []);
  const fishSel = $("#logFish");
  if (!fishSel.options.length) fishSel.innerHTML = `<option value="">דג</option><option value="${NONE}">— יציאה בלי תפיסה —</option>` + SPECIES.map(s => `<option>${esc(s.name)}</option>`).join("") + "<option>אחר</option>";
  const bSel = $("#logBeach");
  if (!bSel.options.length) bSel.innerHTML = REGIONS.map(r => `<optgroup label="${r}">${BEACHES.filter(b => b.region === r).map(b => `<option>${esc(b.name)}</option>`).join("")}</optgroup>`).join("");
  bSel.value = state.beach;
  const lSel = $("#logLure");
  if (!lSel.options.length) lSel.innerHTML = `<option value="">דמוי / פיתיון</option>` + Object.entries(LURE_TYPES).map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
  const trips = list.filter(c => c.fish === NONE).length, fish = list.length - trips;
  $("#logList").innerHTML = list.length ? `<li class="log-sum">${fish} תפיסות · ${trips} יציאות בלי תפיסה</li>` + list.slice().reverse().map(logLine).join("") : `<li class="empty">עוד אין תפיסות ביומן.</li>`;
  $$("#logList .del").forEach(btn => btn.onclick = () => { if (!confirm("למחוק את הרשומה?")) return; store.set(LOG_KEY, store.get(LOG_KEY, []).filter(c => c.id !== btn.dataset.id)); renderLog(); });
}
const logMsg = (t, cls) => { const m = $("#logMsg"); if (m) { m.innerHTML = t; m.className = "log-msg" + (cls ? " " + cls : ""); } };
// ask the browser to keep the log (Safari deletes site data after 7 days without a visit unless the app is on the home screen)
async function keepLog() { try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* not supported */ } }
function setupLog() {
  const now = E.il(Date.now());
  $("#logDate").value = now.key; $("#logTime").value = `${String(now.h).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;
  // catches saved earlier without conditions (offline, or older than the loaded forecast): fill them in once
  store.get(LOG_KEY, []).filter(c => !c.cond && c.date && c.time).slice(-15).forEach(c => { const b = beachByName(c.beach); if (b) pastCond(c.id, b, c.date, E.ilTime(c.date, +c.time.slice(0, 2) + +c.time.slice(3) / 60)); });
  $("#logForm").onsubmit = e => {
    e.preventDefault();
    const c = { id: String(Date.now()), date: $("#logDate").value, time: $("#logTime").value, beach: $("#logBeach").value, fish: $("#logFish").value, lure: $("#logLure").value,
      len: $("#logLen").value, dist: $("#logDist").value, hours: $("#logHours").value, released: $("#logReleased").checked, notes: $("#logNotes").value.trim() };
    if (!c.fish) { $("#logFish").focus(); return; }
    const b = beachByName(c.beach), sp = spByName(c.fish), notes = [];
    if (c.fish === NONE) { c.len = ""; c.released = false; }
    // legal checks: a protected species or a fish under the minimum size is logged as released, with the reason
    if (sp && sp.protectedIn && sp.protectedIn.includes(b.water)) { c.released = true; notes.push(`⛔ ${esc(sp.name)} מוגן כאן — חובה לשחרר מיד למים.`); }
    if (sp && sp.caution) notes.push(`⚠️ ${esc(sp.name)}: ${esc(sp.caution)}`);
    if (sp && sp.min && c.len && +c.len < sp.min && !c.released) { c.released = true; notes.push(`📏 ${esc(c.len)} ס״מ — מתחת לגודל המינימלי החוקי (${sp.min} ס״מ). נרשם כשוחרר: יש להחזיר למים.`); }
    // conditions and the index at catch time, for later calibration
    const rows = FC && FC.data[b.group], T = E.ilTime(c.date, +c.time.slice(0, 2) + +c.time.slice(3) / 60);
    if (rows) { const r = rows.find(q => Math.abs(q.T - T) < 31 * 6e4); if (r) c.cond = { p: r.p, wave: r.wave, wind: r.wind, sst: r.sst }; }
    if (FC) c.snap = snapshot(b, c.date, T);
    const all = store.get(LOG_KEY, []); all.push(c); store.set(LOG_KEY, all); keepLog();
    const kept = all.filter(q => q.date === c.date && q.fish !== NONE && !q.released).length;
    if (kept >= 2) notes.push(`🧺 ${kept} דגים נשמרו היום. תזכורת: לדייג חובב מותרים בערך 5 ק״ג ביום (או שני דגים גדולים) — בדקו את התקנות העדכניות.`);
    logMsg(notes.length ? notes.join("<br>") : c.fish === NONE ? "נרשמה יציאה בלי תפיסה — גם זה עוזר לכייל את המדד." : "נשמר ביומן ✓", notes.some(n => /⛔|📏/.test(n)) ? "is-warn" : "");
    $("#logNotes").value = ""; $("#logLen").value = ""; $("#logReleased").checked = false; renderLog();
    if (!c.cond && b) pastCond(c.id, b, c.date, T);
  };
  const csvCell = v => { let t = String(v == null ? "" : v); if (/^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; }; // no formulas in Excel
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  $("#logExport").onclick = () => {
    const all = store.get(LOG_KEY, []); if (!all.length) return;
    const head = ["date", "time", "beach", "fish", "released", "lure", "length_cm", "distance_m", "hours", "pressure", "wave_cm", "wind_kmh", "sst", "session", "index", "safety", "tide_phase", "moon", "notes"];
    const csv = [head.join(",")].concat(all.map(c => [c.date, c.time, c.beach, c.fish === NONE ? "(no catch)" : c.fish, c.released ? 1 : 0, c.lure, c.len, c.dist, c.hours, c.cond && c.cond.p, c.cond && c.cond.wave, c.cond && c.cond.wind, c.cond && c.cond.sst,
      c.snap && c.snap.sess, c.snap && c.snap.score, c.snap && c.snap.safe, c.snap && c.snap.tide, c.snap && c.snap.moon, c.notes].map(csvCell).join(","))).join("\n");
    download(new Blob(["﻿" + csv], { type: "text/csv" }), "fishing-compass-catches.csv");
  };
  $("#logBackup").onclick = () => { const all = store.get(LOG_KEY, []); if (!all.length) { logMsg("היומן ריק — אין מה לגבות."); return; }
    download(new Blob([JSON.stringify({ app: "fishing-compass", v: 1, at: new Date().toISOString(), catches: all })], { type: "application/json" }), `fishing-compass-backup-${todayKey()}.json`);
    logMsg(`גובו ${all.length} רשומות. שמרו את הקובץ בענן או שלחו אותו לעצמכם.`); };
  $("#logRestore").onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()), inc = Array.isArray(j) ? j : j.catches; if (!Array.isArray(inc)) throw new Error("bad file");
      const str = v => v == null ? "" : String(v).slice(0, 300), all = store.get(LOG_KEY, []), ids = new Set(all.map(c => c.id)); let n = 0;
      for (const c of inc) { if (!c || !c.id || ids.has(String(c.id))) continue;
        all.push({ id: str(c.id), date: str(c.date).slice(0, 10), time: str(c.time).slice(0, 5), beach: str(c.beach), fish: str(c.fish), lure: str(c.lure), len: str(c.len), dist: str(c.dist), hours: str(c.hours),
          released: !!c.released, notes: str(c.notes), cond: c.cond && typeof c.cond === "object" ? c.cond : undefined, snap: c.snap && typeof c.snap === "object" ? c.snap : undefined }); n++; }
      all.sort((a, c) => (a.date + a.time).localeCompare(c.date + c.time)); store.set(LOG_KEY, all); keepLog(); renderLog();
      logMsg(`שוחזרו ${n} רשומות חדשות (${inc.length - n} כבר היו ביומן).`);
    } catch (err) { logMsg("הקובץ לא נקרא — צריך קובץ גיבוי של מצפן הדייג (JSON).", "is-warn"); }
    e.target.value = "";
  };
}

function centerLureMonth() {
  const strip = document.querySelector("#lureGuide .lg-months"), selected = strip && strip.querySelector(".is-sel");
  if (!selected || strip.clientWidth === 0 || strip.scrollWidth <= strip.clientWidth) return;
  strip.scrollLeft += selected.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - selected.offsetWidth) / 2;
}
function setupLureNavigation() {
  const links = [...document.querySelectorAll('[data-tab="lures"] .subnav a')];
  const update = () => {
    const methods = document.getElementById("methodsGuide"), pane = document.querySelector('[data-tab="lures"]');
    if (!methods || pane.hidden) return;
    const active = methods.getBoundingClientRect().top < innerHeight * .45 ? "#methodsGuide" : "#lureGuide";
    links.forEach(a => { if (a.hash === active) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", centerLureMonth);
  update();
}

/* ---------- start ---------- */
async function load(force) {
  clampDays();
  $("#loadState").hidden = false; $("#loadState").textContent = "טוען תחזית…";
  try {
    FC = await FORECAST.loadForecast(GROUPS, force); cache.clear();
    $("#loadState").hidden = true;
    renderToday(); if (state.tab === "rank") renderRank(); if (state.tab === "fish") renderFish();
  } catch (e) {
    $("#loadState").textContent = "לא הצלחנו לטעון תחזית. בדקו חיבור לאינטרנט ונסו שוב.";
    $("#fishingDashboard").setAttribute("aria-busy", "false");
    if (window.FISHING_DASHBOARD) FISHING_DASHBOARD.fail();
  }
}
// v3.7: a day that has passed (the app was left open or resumed after midnight) moves to today
function clampDays() { const t = todayKey(); if (state.day && state.day < t) state.day = t; if (state.rankDay && state.rankDay < t) state.rankDay = t; }
function init() {
  state.beach = beachByName(state.beach).name; // a stored beach that no longer exists falls back to a real one
  $$(".tabbar button").forEach(b => b.onclick = () => setTab(b.dataset.go));
  fillPicker(); setupLog(); setTab(state.tab); setupLureNavigation();
  $$("[data-dashboard-nav]").forEach(bt => {
    const target = bt.dataset.dashboardNav;
    bt.innerHTML = bt.textContent.replace(/[▥⌖↗]/g, "").trim() + (window.FISHING_DASHBOARD ? FISHING_DASHBOARD.icon(target === "forecast" ? "chart" : target === "map" ? "map" : "lure") : "");
    bt.onclick = () => {
      if (target === "lures") { setTab("lures"); return; }
      const dest = document.querySelector(target === "map" ? "#overviewMap" : "#fishingDashboard");
      if (!dest) { if (target === "map") setTab("rank"); return; }
      $$("[data-dashboard-nav]").forEach(other => { other.classList.toggle("is-selected", other === bt); if(other === bt) other.setAttribute("aria-current", "location"); else other.removeAttribute("aria-current"); });
      dest.scrollIntoView({behavior:"smooth",block:"start"});
    };
  });
  const expanded = $(".dashboard-details"); if(expanded) expanded.addEventListener("toggle", () => { if(expanded.open && spotMap) requestAnimationFrame(() => spotMap.invalidateSize()); });
  $("#refresh").onclick = () => load(true);
  load(false);
  document.addEventListener("visibilitychange", () => { if (document.hidden) return; const stale = state.day && state.day < todayKey(); clampDays();
    if (FC && Date.now() - FC.at > 30 * 60 * 1000) load(true); else if (stale && FC) { cache.clear(); renderToday(); if (state.tab === "rank") renderRank(); } });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
