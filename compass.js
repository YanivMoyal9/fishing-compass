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
    const idx = lake ? E.lakeIndex(x, s, moon) : E.seaIndex(x, s, tides, moon);
    // safety layer for the session's hours (Cormorant mechanics): average for display, minimum for the danger flag
    const T0 = E.ilTime(key, Math.floor(s.start)), T1 = E.ilTime(key, Math.ceil(s.end));
    const sf = rows.filter(r => r.T >= T0 && r.T < T1).map(safeOf);
    const safe = sf.length ? { avg: Math.round(sf.reduce((a, c) => a + c, 0) / sf.length), min: Math.min(...sf) } : null;
    return { ...s, x, ...idx, tip: E.tip(rows, key, s, lake), safe };
  });
  const res = { win, sessions, safeOf, tides: tides.filter(t => E.il(t.T).key === key), rows: rows.filter(r => E.il(r.T).key === key) };
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
function zoneWarning(b) {
  const o = FC && FC.official; if (!o || !o.warnings) return false;
  return o.warnings.some(w => /גלים|ים סוער|ים גבוה|סערה|רוחות חזקות/.test(w.title + w.text) || (b.water === "lake" && /כנרת|כנרות/.test(w.text) && /רוח|סערה|גלים/.test(w.text)));
}
function lakeWaveAt(T) {
  const z = FC && FC.official && FC.official.sea && FC.official.sea.zones["211"]; if (!z) return null;
  const p = z.periods.find(q => { const a = Date.parse(q.from.replace(" ", "T") + ":00+02:00"), c = Date.parse(q.to.replace(" ", "T") + ":00+02:00"); return T >= a && T < c; });
  return p && p.wave_cm ? p.wave_cm[1] / 100 : null;
}
function safetyCtx(b, r) { return { lake: b.water === "lake", light: lightAt(b, r.T), lakeWave: b.water === "lake" ? lakeWaveAt(r.T) : null, warning: zoneWarning(b) }; }
const beachByName = n => BEACHES.find(b => b.name === n) || BEACHES[0];

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
  const mo = +state.day.slice(5, 7);
  if (f && f.tags.includes("מים חמים בחורף") && [11, 12, 1, 2, 3].includes(mo)) out.push(["🌡️", "חורף — המים החמים בקטע הזה מרכזים טורפים (ראו נקודות בחוף)"]);
  if (s.id === "evening" && typeof SunCalc !== "undefined") { const ill = SunCalc.getMoonIllumination(new Date(x.T1)).fraction;
    if (ill >= 0.85) out.push(["🌕", "ירח כמעט מלא — יותר פעילות בלילה: קלאמרי, וברקודה מתחת לאורות"]);
    else if (ill <= 0.15) out.push(["🌑", "ליל מולד חשוך — השחר והדמדומים חשובים יותר מהלילה"]); }
  if (f && f.tags.some(t => /שובר|שפך|סלעים|מזח/.test(t))) out.push(["📍", `במקום: ${f.tags.filter(t => /שובר|שפך|סלעים|מזח|לגונה|מפרצון/.test(t)).slice(0, 3).join(", ")} — קצה המבנה, פתחים ותעלות הם הנקודות החמות`]);
  return out;
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
function sessionCard(s, b) {
  if (s.na) return `<article class="sess is-na"><h3>${s.name}</h3><p>אין נתונים לשעות האלה</p></article>`;
  const lv = E.level(s.score), x = s.x, fish = E.fishFor(b, +state.day.slice(5, 7), x.sst);
  const lures = E.luresFor(fish.now, s.tip.layer).slice(0, 3);
  const past = x.T1 < Date.now();
  const fishLayer = fish.now.filter(r => !r.sp.bait && (r.sp.layer === "all" || r.sp.layer === s.tip.layer)).slice(0, 5).map(r => r.sp);
  return `<article class="sess ${lv.c}${past ? " is-past" : ""}">
    <header><h3>${s.name}${past ? ' <small class="past-tag">עבר</small>' : ""}</h3><span class="sess-time">${E.hm(s.start)}–${E.hm(s.end)}</span></header>
    <div class="sess-score"><b>${s.score}</b><span>${lv.t}</span>${s.safe ? `<em class="safe-chip ${safeCls(s.safe.avg)}" title="בטיחות ונוחות: רוח, משבים, גלים, גשם, ראות, חום ואור. מינימום בחלון: ${s.safe.min}">בטיחות ${s.safe.avg}</em>` : ""}</div>
    ${s.safe && s.safe.min < 30 ? `<p class="danger">⛔ תנאים מסוכנים בחלק מהחלון (בטיחות ${s.safe.min}) — לא לעלות על שוברים וסלעים</p>` : s.safe && s.safe.min < 50 ? `<p class="caution">⚠️ תנאים קשים בחלק מהחלון (בטיחות ${s.safe.min})</p>` : ""}
    <p class="sess-tip"><span class="tip-ico" aria-hidden="true">${s.tip.layer === "upper" ? "⬆" : "⬇"}</span>${esc(s.tip.text)}</p>
    ${(() => { const adv = adviceFor(s, b); return adv.length ? `<details class="advice" ${past ? "" : "open"}><summary>מה עושים בתנאים האלה</summary><ul>${adv.map(([i, t]) => `<li><span aria-hidden="true">${i}</span> ${esc(t)}</li>`).join("")}</ul></details>` : ""; })()}
    <dl class="sess-cond">
      ${x.waveMax != null ? `<div><dt>גל</dt><dd>${fmtNum(x.wave)}–${fmtNum(x.waveMax)} ס״מ</dd></div>` : ""}
      <div><dt>רוח</dt><dd>${fmtNum(x.wind)} קמ״ש</dd></div>
      <div><dt>לחץ</dt><dd>${fmtNum(x.p0)} ${x.dpS < -0.3 ? "↘" : x.dpS > 0.3 ? "↗" : "→"}</dd></div>
      ${x.sst != null ? `<div><dt>מים</dt><dd>${fmtNum(x.sst, 1)}°</dd></div>` : ""}
    </dl>
    ${fishLayer.length ? `<p class="sess-fish"><b>דגים לשכבה הזו:</b> ${fishLayer.map(f => `<button type="button" class="fish-link" data-fish="${f.id}">${esc(f.name)}</button>`).join(" · ")}</p>` : ""}
    ${lures.length ? `<p class="sess-lures"><b>דמויים:</b> ${lures.map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ")}</p>` : ""}
    <details class="why"><summary>למה ${s.score}?</summary><ul>${s.factors.map(f => `<li><span class="${f.pts > 0 ? "pos" : f.pts < 0 ? "neg" : ""}">${f.pts > 0 ? "+" : ""}${f.pts ? f.pts.toFixed(1) : ""}</span> ${esc(f.label)}</li>`).join("")}</ul></details>
  </article>`;
}
// official IMS forecast for the beach's zone and day; warnings; Kinneret level
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
  const AREA = { "צפון": /גליל מערבי|הכרמל|חיפה|מישור החוף הצפוני|צפון הארץ/, "שרון": /השרון|מישור החוף/, "מרכז": /מישור החוף|גוש דן|תל אביב|המרכז/,
    "דרום": /מישור החוף הדרומי|אשדוד|אשקלון|הנגב המערבי|הדרום/, "אילת": /אילת|הערבה/, "כנרת": /כנרת|כנרות|עמק הירדן|גליל תחתון|עמק בית שאן/ };
  const warn = (o.warnings || []).filter(w => /גלים|ים סוער|ים גבוה|סערה|רוחות חזקות/.test(w.title + w.text) || AREA[b.region].test(w.text));
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
/* ---------- beach header: name, features, actions, key times and conditions as tiles, details folded ---------- */
function beachHeadHtml(b, r, gold, best, boat) {
  const ll = `${b.lat},${b.lon}`, f = (window.BEACH_FEATURES || {})[b.name];
  const today = state.day === todayKey(), rows = r.rows, T = today ? Date.now() : E.ilTime(state.day, 7);
  const now = rows.reduce((m, x) => !m || Math.abs(x.T - T) < Math.abs(m.T - T) ? x : m, null);
  const tide = r.tides.length ? r.tides.slice(0, 2).map(t => `${t.type === "high" ? "גאות" : "שפל"} ${E.hm(E.il(t.T).hf)}`).join(" · ") : null;
  const ltr = v => /^[\d:.\-–· °]+$/.test(v) ? `<bdi dir="ltr">${v}</bdi>` : v; // times and ranges read left to right
  const tile = (icon, label, val, sub, key) => `<div class="tile${key ? " is-key" : ""}"><span>${icon} ${label}</span><b>${ltr(val)}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const tiles = [
    best ? tile("🏆", "השעה הכי טובה", `${String(best.h).padStart(2, "0")}:00`, best.s ? best.s.name : "", true) : null,
    tile("✨", "שעת הזהב", `${E.hm(gold[0][0])}–${E.hm(gold[0][1])}`, `ערב ${E.hm(gold[1][0])}–${E.hm(gold[1][1])}`),
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
    `<p>🕯️ אור ראשון ${E.hm(r.win.dawn)} · זריחה ${E.hm(r.win.sunrise)} · שקיעה ${E.hm(r.win.sunset)} · אור אחרון ${E.hm(r.win.dusk)}${r.tides.length ? " · " + r.tides.map(t => `${t.type === "high" ? "גאות" : "שפל"} ${E.hm(E.il(t.T).hf)}`).join(" · ") : ""}</p>`
  ].join("");
  return `<div class="bh-top"><div><h2>${esc(b.name)}</h2><p class="bh-sub">${esc(b.region)} · ${esc(TYPE_NAMES[b.type] || "")}</p></div></div>
    ${b.note ? `<p class="bh-note">${esc(b.note)}</p>` : ""}
    ${featuresHtml(b)}
    ${b.legal ? `<p class="legal">⚖️ ${esc(b.legal)}</p>` : ""}
    <div class="bh-actions"><a class="primary" href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">🚗 ניווט ב-Waze</a><a href="https://www.google.com/maps/dir/?api=1&destination=${ll}" target="_blank" rel="noopener">🗺️ Google Maps</a>${b.parking ? `<span>🅿️ חניה ~${b.parking.m} מ׳${b.parking.fee ? " · " + esc(b.parking.fee) : ""}</span>` : ""}</div>
    <div class="tiles">${tiles.join("")}</div>
    ${canBoat(b) ? `<label class="boat-toggle"><input type="checkbox" id="boatToggle" ${boat ? "checked" : ""}> מצב סירה (בטא): תנאי ים פתוח ~11 ק״מ מהחוף</label>` : ""}
    <details class="bh-more"><summary>עוד על החוף: עומק, אזור חם ושעות האור</summary>${more}</details>
    ${officialHtml(b, state.day)}`;
}

function renderToday() {
  if (!FC) return;
  const b = beachByName(state.beach); if (!state.day) state.day = todayKey();
  dayChips($("#dayChips"), state.day, k => { state.day = k; renderToday(); });
  const boat = state.boat && canBoat(b);
  const r = beachDay(b, state.day, boat);
  const gold = E.goldenHours(state.day, b.lat, b.lon), best = E.bestHour(r.rows, state.day, r.sessions, r.safeOf);
  $("#beachHead").innerHTML = beachHeadHtml(b, r, gold, best, boat);
  const bt = $("#boatToggle"); if (bt) bt.onchange = () => { state.boat = bt.checked; renderToday(); };
  $("#sessions").innerHTML = r.sessions.map(s => sessionCard(s, b)).join("");
  $$("#sessions .lure-link").forEach(btn => btn.onclick = () => lureCard(btn.dataset.code));
  $$("#sessions .fish-link").forEach(btn => btn.onclick = () => fishCard(btn.dataset.fish));
  // hourly safety strip (Cormorant mechanics), all 24 hours
  $("#hourly").innerHTML = r.rows.map(x => {
    const sf = E.safety(x, safetyCtx(b, x)), c = sf.score, h = E.il(x.T).h, f = sf.f;
    const tip = `${sf.level} · רוח ${fmtNum(x.wind / 1.852)} קשר${x.gust != null ? `, משבים ${fmtNum(x.gust / 1.852)}` : ""} · גל ${fmtNum(x.wave)} ס״מ${x.mm ? ` · גשם ${fmtNum(x.mm, 1)} מ״מ` : ""}`;
    return `<div class="hr ${sf.cls}${best && best.h === h ? " is-best" : ""}" title="${esc(tip)}"><span class="hr-bar" style="--v:${c}"></span><b>${c}</b><small>${h}:00</small></div>`;
  }).join("");
  const src = FC.sgGroups.includes(b.group) ? "StormGlass + Open-Meteo" : "Open-Meteo";
  $("#srcNote").textContent = `מקור הנתונים לחוף הזה: ${src} · עודכן ${new Date(FC.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
  renderSpots(b);
  if (window.FISHING_DASHBOARD) {
    $("#fishingDashboard").setAttribute("aria-busy", "false");
    FISHING_DASHBOARD.render({ b, r, E, key: state.day, onFish: fishCard, onLure: lureCard, onTab: setTab, onBeach: name => { pickBeach(name); fillPicker(); window.scrollTo({top:0,behavior:"smooth"}); }, loadLeaflet, beaches: BEACHES, lureImage: lureTypeImage });
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
async function renderSpots(b) {
  const el = $("#spots");
  if (!zoneIndex) { try { zoneIndex = await (await fetch("data/zones/index.json?v=1")).json(); } catch (e) { zoneIndex = {}; } }
  const id = zoneIndex[b.name];
  if (!id) { el.hidden = true; el.innerHTML = ""; if (spotMap) { spotMap.remove(); spotMap = null; } return; }
  if (!zoneData[id]) { try { zoneData[id] = await (await fetch(`data/zones/${id}.json?v=${id === "hashmal" ? 3 : 1}`)).json(); } catch (e) { el.hidden = true; return; } }
  if (state.beach !== b.name) return;
  const z = zoneData[id], month = +state.day.slice(5, 7), winter = [11, 12, 1, 2, 3].includes(month);
  const inSeason = new Set(E.fishFor(b, month).now.map(r => r.sp.id));
  const ids = Object.keys(z.species).sort((p, q) => inSeason.has(q) - inSeason.has(p));
  let sid = store.get("compass-spot-fish", "");
  if (!z.species[sid]) sid = ids.find(k => k === state.target) || ids[0];
  const sp = z.species[sid], sc = sp[winter ? "scoresWinter" : "scores"];
  const ranked = z.strips.map((s, i) => ({ s, i, v: sc[i] })).filter(r => r.v != null).sort((p, q) => q.v - p.v);
  const top = ranked.slice(0, 3), pos = new Map(top.map((r, k) => [r.i, k + 1]));
  const vs = ranked.map(r => r.v), lo = Math.min(...vs), hi = Math.max(...vs), t = v => hi > lo ? (v - lo) / (hi - lo) : 0.5; // stretched per fish so differences show
  const fill = v => `hsl(${Math.round(55 - 55 * t(v))} 90% ${Math.round(58 - 10 * t(v))}%)`; // yellow → red = more suitable
  const card = (r, n) => { const s = r.s, ll = `${s.lat},${s.lon}`;
    return `<li class="spot ${E.level(r.v).c}"><header><span class="rk">${n}</span><b>${esc(s.place)}</b><span class="rv">${r.v}</span></header>
      ${s.outside ? `<p class="caution">מחוץ לחוף חשמל — דרומית לתחנת הכוח. בדקו גישה ואיסורים במקום.</p>` : ""}${s.shelter ? `<p class="caution">מים מוגנים מאחורי שובר או במעגן — בדקו שמותר לדוג במקום.</p>` : ""}
      <p>${s.desc.map(esc).join(" · ")}${s.partial ? " · <i>נתונים חלקיים</i>" : ""}</p>
      <p class="spot-ll">📍 נקודת עמידה (קו המים): <bdi dir="ltr">${fmtLL(s)}</bdi> <button type="button" class="copy-ll" data-ll="${fmtLL(s)}">העתקה</button></p>
      <p class="nav-links"><a href="https://waze.com/ul?ll=${ll}&navigate=yes" target="_blank" rel="noopener">Waze</a> · <a href="https://www.google.com/maps/search/?api=1&query=${ll}" target="_blank" rel="noopener">Google Maps</a> · <button type="button" class="show-on-map" data-i="${r.i}">הצגה במפה</button></p></li>`; };
  el.hidden = false;
  if (spotMap) { spotMap.remove(); spotMap = null; }
  el.innerHTML = `<h2>נקודות בחוף</h2>
    <p class="hint">רצועות של 200 מ׳ לאורך החוף, מדורגות לדג שבחרתם לפי צבע המים, צלילות, עומק, מבנים ומים חמים. הציון יחסי לחוף הזה. הוא מתאר תנאים, לא תפיסות.</p>
    <label class="spot-pick"><span>דג מטרה</span><select id="spotFish">${ids.map(k => `<option value="${k}" ${k === sid ? "selected" : ""}>${esc(z.species[k].name)}${inSeason.has(k) ? "" : " (לא בעונה)"}</option>`).join("")}</select></label>
    <p class="spot-why"><button type="button" class="fish-link" data-fish="${sid}">📖 על ה${esc(sp.name)}</button> · <b>מה מחפשים:</b> ${esc(sp.why)}${winter ? " · בחורף נלקחת בחשבון פלומת המים החמים." : ""}</p>
    <div class="spot-map-box" id="spotMap" dir="ltr" role="region" aria-label="מפת לוויין של רצועות החוף"><p class="hint">טוען מפה…</p></div>
    <p class="spot-legend"><span class="lg-bar"></span> צהוב = פחות מתאים, אדום = יותר מתאים · <span class="lg-pin">1</span> שלוש הרצועות המובילות · ${z.strips.some(s => s.ok && s.outside) ? `<span class="lg-out"></span> מחוץ לחוף · ` : ""}<span class="lg-closed"></span> סגור · לחיצה על רצועה מציגה פרטים</p>
    <div id="spotPicked"></div>
    <ol class="spot-list">${top.map((r, k) => card(r, k + 1)).join("")}</ol>
    <p class="spot-look">👀 <b>בשטח, חפשו:</b> ${esc(sp.look)}</p>
    <details class="about"><summary>איך זה מחושב?</summary><p>${esc(z.method)}</p><p>נקודת העמידה היא קו המים בתמונות הלוויין (דיוק של כ-30 מ׳; קו המים זז עם הגלים והעונה). הרצועה הצבועה מגיעה עד כ-220 מ׳ לתוך הים. תמונות לוויין: ${z.scenes.map(d => d.split("-").reverse().join("/")).join(", ")} · טמפ׳: Landsat ${z.landsat.map(d => d.split("-").reverse().join("/")).join(", ")} · עודכן ${z.generated.split("-").reverse().join("/")}. רשמו ביומן את המרחק מהחוף ואיפה דגתם, כדי שנוכל לכייל את הדירוג לפי תפיסות אמיתיות.</p></details>`;
  const pick = i => { const s = z.strips[i];
    $("#spotPicked").innerHTML = s.ok ? `<ol class="spot-list picked">${card({ s, i, v: sc[i] }, "•")}</ol>` : `<p class="hint">${esc(s.place)}: ${esc(s.reason)}</p>`; wire(); };
  const wire = () => {
    $$("#spots .copy-ll").forEach(btn => btn.onclick = () => { try { navigator.clipboard.writeText(btn.dataset.ll); btn.textContent = "הועתק ✓"; } catch (e) { /* clipboard blocked */ } });
    $$("#spots .show-on-map").forEach(btn => btn.onclick = () => { const f = spotMap && spotMap._spot; if (!f) return; f.focus(+btn.dataset.i); $("#spotMap").scrollIntoView({ behavior: "smooth", block: "center" }); });
  };
  wire();
  $$("#spots .fish-link").forEach(btn => btn.onclick = () => fishCard(btn.dataset.fish));
  $("#spotFish").onchange = e => { store.set("compass-spot-fish", e.target.value); renderSpots(b); };
  let L; try { L = await loadLeaflet(); } catch (e) { $("#spotMap").innerHTML = '<p class="hint">המפה לא נטענה (אין חיבור). הנקודות והקואורדינטות למטה עדיין תקפות.</p>'; return; }
  const box = $("#spotMap"); if (!box || state.beach !== b.name || spotMap) return; box.innerHTML = "";
  const map = spotMap = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.25 });
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }).addTo(map);
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
  L.control.layers({ "לוויין": sat, "מפה": osm }, null, { position: "topleft" }).addTo(map);
  const along = z.az + 90, layers = {}, pts = [];
  const popup = (s, v, n) => `<div dir="rtl" class="spot-pop"><b>${n ? "#" + n + " · " : ""}${esc(s.place)}</b> · ציון ${v} ל${esc(sp.name)}<br>${s.desc.slice(0, 3).map(esc).join(" · ")}<br><bdi dir="ltr">${fmtLL(s)}</bdi><br><a href="https://waze.com/ul?ll=${s.lat},${s.lon}&navigate=yes" target="_blank" rel="noopener">ניווט ב-Waze</a></div>`;
  z.strips.forEach((s, i) => {
    const p0 = s.ok ? [s.lat, s.lon] : s.ref, a = move(p0, along, -100), c = move(p0, along, 100);
    const poly = [a, c, move(c, z.az, 220), move(a, z.az, 220)];
    if (!s.ok) { if (s.closed) L.polygon(poly, { color: "#555", weight: 1, fillColor: "#777", fillOpacity: 0.5, dashArray: "3 3" }).bindTooltip(s.reason).addTo(map); return; }
    const v = sc[i], n = pos.get(i);
    const pg = L.polygon(poly, { color: "#fff", weight: n ? 2.5 : 1, opacity: 0.9, fillColor: fill(v), fillOpacity: 0.5, dashArray: s.outside ? "6 4" : null }).addTo(map);
    pg.bindPopup(popup(s, v, n)); pg.on("click", () => pick(i));
    layers[i] = pg; pts.push([s.lat, s.lon], move(p0, z.az, 220));
    if (n) L.marker([s.lat, s.lon], { icon: L.divIcon({ className: "spot-pin", html: `<b>${n}</b>`, iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 1000, title: `#${n} ${s.place}` })
      .bindPopup(popup(s, v, n)).on("click", () => pick(i)).addTo(map);
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
    const r = beachDay(b, state.rankDay), ok = r.sessions.filter(s => !s.na);
    const s = state.rankSession === "best" ? ok.sort((a, c) => c.score - a.score)[0] : ok.find(q => q.id === state.rankSession);
    return { b, s };
  }).filter(x => x.s).sort((a, c) => c.s.score - a.s.score);
  $("#rankList").innerHTML = rows.map(({ b, s }, i) => {
    const lv = E.level(s.score);
    return `<li><button type="button" class="rank-row ${lv.c}" data-b="${esc(b.name)}"><span class="rk">${i + 1}</span><span class="rn">${esc(b.name)} <small>${esc(b.region)}</small></span>
      <span class="rs">${s.name} ${E.hm(s.start)}${s.safe ? ` · <em class="safe-chip ${safeCls(s.safe.avg)}">בטיחות ${s.safe.avg}</em>` : ""}</span><span class="rv">${s.score}</span>${b.legal ? `<span class="rl" title="${esc(b.legal)}">⚖️</span>` : ""}</button></li>`;
  }).join("");
  $$("#rankList .rank-row").forEach(btn => btn.onclick = () => { state.day = state.rankDay; pickBeach(btn.dataset.b); fillPicker(); setTab("today"); });
}

/* ---------- fish ---------- */
const TYPE_NAMES = { sand: "חוף חולי", rock: "חוף סלעי", mixed: "חול וסלע", marina: "מרינה", port: "נמל", breakwater: "שובר גלים", estuary: "שפך נחל", reef: "שונית", lake: "חוף אגם" };
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
function fishRow({ sp, peak, tempNote }, month, water) {
  const cal = MONTHS.map((m, i) => `<i class="${sp.p && sp.p.includes(i + 1) ? "pk" : sp.m.includes(i + 1) ? "in" : ""} ${i + 1 === month ? "now" : ""}" title="${m}"></i>`).join("");
  const lures = [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT").map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ");
  return `<article class="fish-card">${art(sp.id, "is-card")}
    <header><h3>${esc(sp.name)}${peak ? ' <em class="peak">שיא</em>' : ""}</h3><span class="layer">${sp.layer === "upper" ? "מים עליונים" : sp.layer === "bottom" ? "חלק תחתון" : "בכל גוף המים"}${sp.zone ? " · " + esc(sp.zone) : ""}</span></header>
    ${sp.lat ? `<p class="latin"><i>${esc(sp.lat)}</i>${sp.aka && sp.aka.length ? " · נקרא גם: " + sp.aka.map(esc).join(", ") : ""}</p>` : ""}
    <div class="cal" aria-label="עונה">${cal}</div>
    ${sp.active && sp.active.length ? `<p class="active">🕑 הכי פעיל: ${sp.active.map(a => ACTIVE_NAMES[a]).join(", ")}${sp.temp ? ` · מים ${sp.temp[0]}–${sp.temp[1]}°` : ""}</p>` : sp.temp ? `<p class="active">מים ${sp.temp[0]}–${sp.temp[1]}°</p>` : ""}
    ${lures ? `<p class="lures">${lures}</p>` : ""}
    ${tempNote ? `<p class="warn">🌡️ ${tempNote}</p>` : ""}
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
    const ss = day.sessions.filter(s => !s.na && (!want.size || want.has(s.id))).sort((a, c) => c.score - a.score)[0];
    if (!ss) return null;
    return { b, fit, s: ss, rank: Math.round(0.6 * fit.score + 0.4 * ss.score) };
  }).filter(Boolean).filter(r => r.fit.score >= 40).sort((a, c) => c.rank - a.rank).slice(0, 15);
  out.innerHTML = rows.length ? rows.map((r, i) => `<li><button type="button" class="rank-row ${E.level(r.rank).c}" data-b="${esc(r.b.name)}"><span class="rk">${i + 1}</span><span class="rn">${esc(r.b.name)} <small>${esc(r.b.region)} · ${r.fit.why.join(", ")}</small></span>
    <span class="rs">${r.s.name} ${E.hm(r.s.start)}</span><span class="rv">${r.rank}</span>${r.b.legal ? `<span class="rl" title="${esc(r.b.legal)}">⚖️</span>` : ""}</button></li>`).join("") : "<li class='empty'>אין חוף מתאים היום לדג הזה.</li>";
  $$("#targetList .rank-row").forEach(btn => btn.onclick = () => { state.day = key; pickBeach(btn.dataset.b); fillPicker(); setTab("today"); });
}
function renderFish() {
  const b = beachByName(state.beach), month = E.il(Date.now()).mo;
  const sst = FC && FC.data[b.group] ? (FC.data[b.group].find(r => Math.abs(r.T - Date.now()) < 36e5) || {}).sst : null;
  const f = E.fishFor(b, month, sst);
  $("#fishHead").innerHTML = `<h2>דגים ב${esc(b.name)} <small>${esc(b.region)} · ${esc(TYPE_NAMES[b.type] || "")}</small></h2>
    ${sst != null ? `<p>טמפ׳ המים עכשיו: <b>${sst.toFixed(1)}°</b></p>` : ""}
    ${b.legal ? `<p class="legal">⚖️ ${esc(b.legal)}</p>` : ""}
    ${b.reports && b.reports.length ? `<p class="reports">דווחו כאן בעבר: ${b.reports.map(esc).join(" · ")}</p>` : ""}`;
  $("#fishNow").innerHTML = f.now.map(r => fishRow(r, month, b.water)).join("") || "<p>אין דגים בעונה לפי הנתונים שלנו.</p>";
  $("#fishOff").innerHTML = f.off.map(r => fishRow(r, month, b.water)).join("");
  $("#fishProtected").innerHTML = (f.protected.length ? `<h3>מוגנים כאן — אסור לדוג</h3><p>${f.protected.map(r => `<b>${esc(r.name || r.sp && r.sp.name)}</b> (${esc(r.note || r.caution || "")})`).join(" · ")}</p>` : "") +
    (f.caution.length ? `<h3>⚠️ דגי זהירות</h3><ul>${f.caution.map(s => `<li><b>${esc(s.name)}</b> <i>${esc(s.lat || "")}</i> — ${esc(s.caution)}</li>`).join("")}</ul>` : "");
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
    return `<article class="kit-card ${rank === 1 ? "is-main" : ""}"><button type="button" class="kit-open lure-link" data-code="${c}" aria-label="פרטים על ${esc(LURE_TYPES[c])}">${lureTypeImage(c)}</button>
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
    sp.temp ? ["מים", `${sp.temp[0]}–${sp.temp[1]}°`] : x["טמפ׳ מים מועדפת"] ? ["מים", x["טמפ׳ מים מועדפת"]] : null,
    ["שכבה", sp.layer === "upper" ? "מים עליונים" : sp.layer === "bottom" ? "חלק תחתון" : "כל גוף המים"],
    sp.min ? ["מינימום", sp.min + " ס״מ"] : x["גודל מינימלי"] ? ["מינימום", x["גודל מינימלי"]] : null,
    x["רבייה"] ? ["רבייה", x["רבייה"]] : null
  ].filter(Boolean);
  const lures = [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT").map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ");
  const sec = name => {
    let items = (info.sections || {})[name] || [];
    if (name === "שיטות ודמויים" && x["דמויים / מערכות"]) items = [...items, `**ציוד מומלץ:** ${x["דמויים / מערכות"]}`];
    if (name === "חוק") items = [...items, ...[sp.legal && sp.legal[b.water], x["מוגן / אזהרה"], sp.caution].filter(Boolean).map(t => "**שימו לב:** " + t)];
    const extra = "";
    return items.length || extra ? `<section><h4>${FISH_SECTIONS.find(s => s[0] === name)[1]} ${name}</h4>${items.length ? `<ul>${items.map(t => `<li>${rich(t)}</li>`).join("")}</ul>` : ""}${extra}</section>` : "";
  };
  const aka = info.aka || sp.aka || [];
  dlg.innerHTML = `<form method="dialog">${art(sp.id, "is-hero")}<header><h3>${esc(sp.name)}</h3>${info.lat || sp.lat ? `<p class="latin"><i>${esc(info.lat || sp.lat)}</i>${aka.length ? " · נקרא גם: " + aka.map(esc).join(", ") : ""}</p>` : ""}</header>
    <div class="fish-cal" aria-label="עונה">${cal}</div><p class="hint">כהה = שיא · בהיר = בעונה · מסגרת = החודש</p>
    <dl class="fish-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${/^[\d–\-°. ]+$/.test(v) ? `<bdi dir="ltr">${esc(v)}</bdi>` : esc(v)}</dd></div>`).join("")}</dl>
    ${(() => { const kit = lureKitHtml(sp); return kit ? `<section class="kit"><h4>🎯 הדמויים שמתאימים ל${esc(sp.name)}</h4>${sp.bait || sp.lures.includes("BAIT") ? `<p class="hint">נתפס בעיקר בפיתיון טבעי — הדמויים כאן הם אפשרות משלימה.</p>` : ""}<div class="kit-grid">${kit}</div></section>` : ""; })()}
    ${FISH_SECTIONS.map(([n]) => sec(n)).join("")}
    <p class="hint">${info.src === "own" ? "פרופיל שכתבנו מהמחקר שלנו." : "סיכום במילים שלנו מתיקי הדגים שאספנו ומהמחקר על התקנות."} העונה והשעות לפי נתוני האפליקציה.</p>
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
const LURE_GROUPS = [["all", "הכל", null], ["metal", "ג׳יגים וכפיות", ["JIG", "MJ", "SPOON", "TAI"]], ["hard", "מינו ופנסילים", ["MIN", "SP"]],
  ["top", "פני המים", ["FP", "POP", "BOMB"]], ["soft", "סיליקון", ["SOFT"]], ["egi", "אגי", ["EGI"]], ["rigs", "מערכות ופיתיון", ["SURF", "FLOAT", "LEDGER", "SABIKI"]]];
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
    <button type="button" class="type-photo kit-open" data-code="${c}" aria-label="תמונה ופרטים על ${esc(LURE_TYPES[c])}">${lureTypeImage(c)}<span class="type-photo-note">הדמיה לדוגמה · לפרטים</span></button>
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
    <div class="lg-types">${codes.map(c => typeCardHtml(c, m, sp, all)).join("") || `<p class="hint">אין דמויים שמתאימים לסינון הזה.</p>`}</div>`;
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
function renderLog() {
  const list = store.get(LOG_KEY, []);
  const fishSel = $("#logFish");
  if (!fishSel.options.length) fishSel.innerHTML = `<option value="">דג</option>` + SPECIES.map(s => `<option>${esc(s.name)}</option>`).join("") + "<option>אחר</option>";
  const bSel = $("#logBeach");
  if (!bSel.options.length) bSel.innerHTML = REGIONS.map(r => `<optgroup label="${r}">${BEACHES.filter(b => b.region === r).map(b => `<option>${esc(b.name)}</option>`).join("")}</optgroup>`).join("");
  bSel.value = state.beach;
  const lSel = $("#logLure");
  if (!lSel.options.length) lSel.innerHTML = `<option value="">דמוי / פיתיון</option>` + Object.entries(LURE_TYPES).map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
  $("#logList").innerHTML = list.length ? list.slice().reverse().map(c => `<li><b>${esc(c.fish)}</b> · ${esc(c.beach)} · ${esc(c.date)} ${esc(c.time || "")}${c.lure ? " · " + esc(LURE_TYPES[c.lure] || c.lure) : ""}${c.len ? ` · ${esc(c.len)} ס״מ` : ""}${c.dist ? ` · ${esc(c.dist)} מ׳ מהחוף` : ""}${condTxt(c)}${c.notes ? `<br><small>${esc(c.notes)}</small>` : ""}
      <button type="button" class="del" data-id="${c.id}" aria-label="מחיקה">✕</button></li>`).join("") : `<li class="empty">עוד אין תפיסות ביומן.</li>`;
  $$("#logList .del").forEach(btn => btn.onclick = () => { store.set(LOG_KEY, store.get(LOG_KEY, []).filter(c => c.id !== btn.dataset.id)); renderLog(); });
}
function setupLog() {
  const now = E.il(Date.now());
  $("#logDate").value = now.key; $("#logTime").value = `${String(now.h).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;
  // catches saved earlier without conditions (offline, or older than the loaded forecast): fill them in once
  store.get(LOG_KEY, []).filter(c => !c.cond && c.date && c.time).slice(-15).forEach(c => { const b = beachByName(c.beach); if (b) pastCond(c.id, b, c.date, E.ilTime(c.date, +c.time.slice(0, 2) + +c.time.slice(3) / 60)); });
  $("#logForm").onsubmit = e => {
    e.preventDefault();
    const c = { id: String(Date.now()), date: $("#logDate").value, time: $("#logTime").value, beach: $("#logBeach").value, fish: $("#logFish").value, lure: $("#logLure").value,
      len: $("#logLen").value, dist: $("#logDist").value, notes: $("#logNotes").value.trim() };
    if (!c.fish) { $("#logFish").focus(); return; }
    // conditions at catch time, for later calibration of the index
    const b = beachByName(c.beach), rows = FC && FC.data[b.group], T = E.ilTime(c.date, +c.time.slice(0, 2) + +c.time.slice(3) / 60);
    if (rows) { const r = rows.find(q => Math.abs(q.T - T) < 31 * 6e4); if (r) c.cond = { p: r.p, wave: r.wave, wind: r.wind, sst: r.sst }; }
    const all = store.get(LOG_KEY, []); all.push(c); store.set(LOG_KEY, all);
    $("#logNotes").value = ""; $("#logLen").value = ""; renderLog();
    if (!c.cond && b) pastCond(c.id, b, c.date, T);
  };
  $("#logExport").onclick = () => {
    const all = store.get(LOG_KEY, []); if (!all.length) return;
    const head = ["date", "time", "beach", "fish", "lure", "length_cm", "distance_m", "pressure", "wave_cm", "wind_kmh", "sst", "notes"];
    const csv = [head.join(",")].concat(all.map(c => [c.date, c.time, c.beach, c.fish, c.lure, c.len, c.dist, c.cond && c.cond.p, c.cond && c.cond.wave, c.cond && c.cond.wind, c.cond && c.cond.sst, c.notes]
      .map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "fishing-compass-catches.csv"; a.click();
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
function init() {
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden && FC && Date.now() - FC.at > 30 * 60 * 1000) load(true); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
