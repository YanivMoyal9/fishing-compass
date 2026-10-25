/* מצפן הדייג — ממשק: היום · חופים · דגים · דמויים · יומן */
(function () {
const E = window.ENGINE;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const REGIONS = ["צפון", "שרון", "מרכז", "דרום", "אילת", "כנרת"];
const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } } };
const state = { tab: store.get("compass-tab", "today"), beach: store.get("compass-beach", "חברת חשמל"), day: null, rankSession: "best", rankRegion: "all" };
let FC = null;
const todayKey = () => E.il(Date.now()).key;

/* ---------- calculation per beach and day ---------- */
const cache = new Map();
function beachDay(b, key) {
  const ck = b.name + key + (FC ? FC.at : 0); if (cache.has(ck)) return cache.get(ck);
  const rows = (FC && FC.data[b.group]) || [];
  const win = E.windows(key, b.lat, b.lon), lake = b.water === "lake";
  const tides = lake ? [] : E.tideExtremes(rows), moon = E.moonEvents(key, 1, b.lat, b.lon);
  const sessions = win.sessions.map(s => {
    const x = E.sessionInputs(rows, key, s); if (!x) return { ...s, na: true };
    const idx = lake ? E.lakeIndex(x, s, moon) : E.seaIndex(x, s, tides, moon);
    return { ...s, x, ...idx, tip: E.tip(rows, key, s, lake) };
  });
  const res = { win, sessions, tides: tides.filter(t => E.il(t.T).key === key), rows: rows.filter(r => E.il(r.T).key === key) };
  cache.set(ck, res); return res;
}
const beachByName = n => BEACHES.find(b => b.name === n) || BEACHES[0];

/* ---------- tabs ---------- */
function setTab(t) {
  state.tab = t; store.set("compass-tab", t);
  $$("[data-tab]").forEach(el => el.hidden = el.dataset.tab !== t);
  $$(".tabbar button").forEach(b => { const on = b.dataset.go === t; b.classList.toggle("is-on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
  if (t === "rank") renderRank(); if (t === "fish") renderFish(); if (t === "log") renderLog();
  window.scrollTo({ top: 0 });
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
function sessionCard(s, b) {
  if (s.na) return `<article class="sess is-na"><h3>${s.name}</h3><p>אין נתונים לשעות האלה</p></article>`;
  const lv = E.level(s.score), x = s.x, fish = E.fishFor(b, +state.day.slice(5, 7), x.sst);
  const lures = E.luresFor(fish.now, s.tip.layer).slice(0, 3);
  const past = x.T1 < Date.now();
  const fishLayer = fish.now.filter(r => !r.sp.bait && (r.sp.layer === "all" || r.sp.layer === s.tip.layer)).slice(0, 5).map(r => r.sp.name);
  return `<article class="sess ${lv.c}${past ? " is-past" : ""}">
    <header><h3>${s.name}${past ? ' <small class="past-tag">עבר</small>' : ""}</h3><span class="sess-time">${E.hm(s.start)}–${E.hm(s.end)}</span></header>
    <div class="sess-score"><b>${s.score}</b><span>${lv.t}</span></div>
    <p class="sess-tip"><span class="tip-ico" aria-hidden="true">${s.tip.layer === "upper" ? "⬆" : "⬇"}</span>${esc(s.tip.text)}</p>
    <dl class="sess-cond">
      ${x.waveMax != null ? `<div><dt>גל</dt><dd>${fmtNum(x.wave)}–${fmtNum(x.waveMax)} ס״מ</dd></div>` : ""}
      <div><dt>רוח</dt><dd>${fmtNum(x.wind)} קמ״ש</dd></div>
      <div><dt>לחץ</dt><dd>${fmtNum(x.p0)} ${x.dpS < -0.3 ? "↘" : x.dpS > 0.3 ? "↗" : "→"}</dd></div>
      ${x.sst != null ? `<div><dt>מים</dt><dd>${fmtNum(x.sst, 1)}°</dd></div>` : ""}
    </dl>
    ${fishLayer.length ? `<p class="sess-fish"><b>דגים לשכבה הזו:</b> ${fishLayer.map(esc).join(" · ")}</p>` : ""}
    ${lures.length ? `<p class="sess-lures"><b>דמויים:</b> ${lures.map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ")}</p>` : ""}
    <details class="why"><summary>למה ${s.score}?</summary><ul>${s.factors.map(f => `<li><span class="${f.pts > 0 ? "pos" : f.pts < 0 ? "neg" : ""}">${f.pts > 0 ? "+" : ""}${f.pts ? f.pts.toFixed(1) : ""}</span> ${esc(f.label)}</li>`).join("")}</ul></details>
  </article>`;
}
function renderToday() {
  if (!FC) return;
  const b = beachByName(state.beach); if (!state.day) state.day = todayKey();
  dayChips($("#dayChips"), state.day, k => { state.day = k; renderToday(); });
  const r = beachDay(b, state.day);
  $("#beachHead").innerHTML = `<h2>${esc(b.name)} <small>${esc(b.region)}</small></h2>
    <p class="beach-meta">${esc(TYPE_NAMES[b.type] || "")}${b.note ? " · " + esc(b.note) : ""}</p>
    ${b.legal ? `<p class="legal">⚖️ ${esc(b.legal)}</p>` : ""}
    <p class="astro">אור ראשון ${E.hm(r.win.dawn)} · זריחה ${E.hm(r.win.sunrise)} · שקיעה ${E.hm(r.win.sunset)} · אור אחרון ${E.hm(r.win.dusk)}${r.tides.length ? " · " + r.tides.map(t => `${t.type === "high" ? "גאות" : "שפל"} ${E.hm(E.il(t.T).hf)}`).join(" · ") : ""}</p>`;
  $("#sessions").innerHTML = r.sessions.map(s => sessionCard(s, b)).join("");
  $$("#sessions .lure-link").forEach(btn => btn.onclick = () => openArsenal(btn.dataset.code));
  // hourly comfort strip
  $("#hourly").innerHTML = r.rows.filter(x => { const h = E.il(x.T).h; return h >= 4 && h <= 21; }).map(x => {
    const c = E.comfort(x), h = E.il(x.T).h;
    return `<div class="hr" title="רוח ${fmtNum(x.wind)} · גל ${fmtNum(x.wave)}"><span class="hr-bar" style="--v:${c}"></span><b>${c}</b><small>${h}:00</small></div>`;
  }).join("");
  const src = FC.sgGroups.includes(b.group) ? "StormGlass + Open-Meteo" : "Open-Meteo";
  $("#srcNote").textContent = `מקור הנתונים לחוף הזה: ${src} · עודכן ${new Date(FC.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
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
      <span class="rs">${s.name} ${E.hm(s.start)}</span><span class="rv">${s.score}</span>${b.legal ? `<span class="rl" title="${esc(b.legal)}">⚖️</span>` : ""}</button></li>`;
  }).join("");
  $$("#rankList .rank-row").forEach(btn => btn.onclick = () => { state.day = state.rankDay; pickBeach(btn.dataset.b); fillPicker(); setTab("today"); });
}

/* ---------- fish ---------- */
const TYPE_NAMES = { sand: "חוף חולי", rock: "חוף סלעי", mixed: "חול וסלע", marina: "מרינה", port: "נמל", breakwater: "שובר גלים", estuary: "שפך נחל", reef: "שונית", lake: "חוף אגם" };
const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
function fishRow({ sp, peak, tempNote }, month, water) {
  const cal = MONTHS.map((m, i) => `<i class="${sp.p && sp.p.includes(i + 1) ? "pk" : sp.m.includes(i + 1) ? "in" : ""} ${i + 1 === month ? "now" : ""}" title="${m}"></i>`).join("");
  const lures = [...sp.lures, ...(sp.lures2 || [])].filter(c => c !== "BAIT").map(c => `<button type="button" class="lure-link" data-code="${c}">${esc(LURE_TYPES[c])}</button>`).join(" ");
  return `<article class="fish-card">
    <header><h3>${esc(sp.name)}${peak ? ' <em class="peak">שיא</em>' : ""}</h3><span class="layer">${sp.layer === "upper" ? "מים עליונים" : sp.layer === "bottom" ? "חלק תחתון" : "בכל גוף המים"}${sp.zone ? " · " + esc(sp.zone) : ""}</span></header>
    <div class="cal" aria-label="עונה">${cal}</div>
    ${sp.bait ? `<p>${esc(sp.work)}</p>` : `<p class="lures">${lures}</p><p>${esc(sp.size)}${sp.work ? " · " + esc(sp.work) : ""}${sp.when ? " · " + esc(sp.when) : ""}</p>`}
    ${tempNote ? `<p class="warn">🌡️ ${tempNote}</p>` : ""}
    ${sp.min ? `<p class="min">מינימום חוקי: ${sp.min} ס״מ</p>` : ""}
    ${sp.note ? `<p class="note">${esc(sp.note)}</p>` : ""}
    ${sp.legal && sp.legal[water] ? `<p class="warn">⚖️ ${esc(sp.legal[water])}</p>` : ""}
  </article>`;
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
  $("#fishProtected").innerHTML = f.protected.length ? `<h3>מוגנים כאן — אסור לדוג</h3><p>${f.protected.map(r => `<b>${esc(r.sp.name)}</b> (${esc(r.sp.note || "")})`).join(" · ")}</p>` : "";
  $$("#tab-fish .lure-link").forEach(btn => btn.onclick = () => openArsenal(btn.dataset.code));
}

/* ---------- link into the lure arsenal (script.js) ---------- */
function openArsenal(code) {
  setTab("lures");
  const t = LURE_TO_ARSENAL[code], chip = t && document.querySelector(`#typeFilters [data-type="${t}"]`);
  if (chip) chip.click();
  const cat = $("#catalog"); if (cat) cat.scrollIntoView({ behavior: "smooth" });
}

/* ---------- catch log (local, with beach and casting distance for future zone calibration) ---------- */
const LOG_KEY = "compass-catches";
function renderLog() {
  const list = store.get(LOG_KEY, []);
  const fishSel = $("#logFish");
  if (!fishSel.options.length) fishSel.innerHTML = `<option value="">דג</option>` + SPECIES.map(s => `<option>${esc(s.name)}</option>`).join("") + "<option>אחר</option>";
  const bSel = $("#logBeach");
  if (!bSel.options.length) bSel.innerHTML = REGIONS.map(r => `<optgroup label="${r}">${BEACHES.filter(b => b.region === r).map(b => `<option>${esc(b.name)}</option>`).join("")}</optgroup>`).join("");
  bSel.value = state.beach;
  const lSel = $("#logLure");
  if (!lSel.options.length) lSel.innerHTML = `<option value="">דמוי / פיתיון</option>` + Object.entries(LURE_TYPES).map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
  $("#logList").innerHTML = list.length ? list.slice().reverse().map(c => `<li><b>${esc(c.fish)}</b> · ${esc(c.beach)} · ${esc(c.date)} ${esc(c.time || "")}${c.lure ? " · " + esc(LURE_TYPES[c.lure] || c.lure) : ""}${c.len ? ` · ${esc(c.len)} ס״מ` : ""}${c.dist ? ` · ${esc(c.dist)} מ׳ מהחוף` : ""}${c.notes ? `<br><small>${esc(c.notes)}</small>` : ""}
      <button type="button" class="del" data-id="${c.id}" aria-label="מחיקה">✕</button></li>`).join("") : `<li class="empty">עוד אין תפיסות ביומן.</li>`;
  $$("#logList .del").forEach(btn => btn.onclick = () => { store.set(LOG_KEY, store.get(LOG_KEY, []).filter(c => c.id !== btn.dataset.id)); renderLog(); });
}
function setupLog() {
  const now = E.il(Date.now());
  $("#logDate").value = now.key; $("#logTime").value = `${String(now.h).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;
  $("#logForm").onsubmit = e => {
    e.preventDefault();
    const c = { id: String(Date.now()), date: $("#logDate").value, time: $("#logTime").value, beach: $("#logBeach").value, fish: $("#logFish").value, lure: $("#logLure").value,
      len: $("#logLen").value, dist: $("#logDist").value, notes: $("#logNotes").value.trim() };
    if (!c.fish) { $("#logFish").focus(); return; }
    // conditions at catch time, for later calibration of the index
    const b = beachByName(c.beach), rows = FC && FC.data[b.group];
    if (rows) { const T = E.ilTime(c.date, +c.time.slice(0, 2) + +c.time.slice(3) / 60), r = rows.find(q => Math.abs(q.T - T) < 31 * 6e4); if (r) c.cond = { p: r.p, wave: r.wave, wind: r.wind, sst: r.sst }; }
    const all = store.get(LOG_KEY, []); all.push(c); store.set(LOG_KEY, all);
    $("#logNotes").value = ""; $("#logLen").value = ""; renderLog();
  };
  $("#logExport").onclick = () => {
    const all = store.get(LOG_KEY, []); if (!all.length) return;
    const head = ["date", "time", "beach", "fish", "lure", "length_cm", "distance_m", "pressure", "wave_cm", "wind_kmh", "sst", "notes"];
    const csv = [head.join(",")].concat(all.map(c => [c.date, c.time, c.beach, c.fish, c.lure, c.len, c.dist, c.cond && c.cond.p, c.cond && c.cond.wave, c.cond && c.cond.wind, c.cond && c.cond.sst, c.notes]
      .map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(","))).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "fishing-compass-catches.csv"; a.click();
  };
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
  }
}
function init() {
  $$(".tabbar button").forEach(b => b.onclick = () => setTab(b.dataset.go));
  fillPicker(); setupLog(); setTab(state.tab);
  $("#refresh").onclick = () => load(true);
  load(false);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && FC && Date.now() - FC.at > 30 * 60 * 1000) load(true); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
