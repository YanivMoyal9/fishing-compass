/* מצפן הדייג — איורי דגים ואייקוני דמויים (SVG שנוצר בקוד, בסגנון אחיד, בלי תמונות חיצוניות).
   FISH_ART.fish(id) → SVG של הדג · FISH_ART.lure(code) → אייקון הדמוי · FISH_ART.swatches(text) → דוגמיות צבע */
(function () {
let uid = 0;
// ---- per-species look: template, body height, colours (back, belly, fins), pattern and extras
// t: fish | elong | deep | grouper | mullet | catfish | squid | cuttle | octo | ray | lion | puffer | mahi
// tail: fork | lunate | round | trunc · pat: bars | stripes | spots | waves | blotch | ring | band2 | tailspot | dots
const S = {
  bluefish: { t: "fish", h: 21, back: "#3c6f86", belly: "#dfe8ec", fin: "#6a8c99", tail: "fork", extra: ["pecspot"] },
  seabass: { t: "fish", h: 22, back: "#5f7480", belly: "#e9eef0", fin: "#7d8f97", tail: "trunc", extra: ["opspot", "twodorsal"] },
  bluerunner: { t: "fish", h: 25, back: "#4d6f6a", belly: "#e3eae6", fin: "#7f948a", tail: "fork", extra: ["scutes", "opspot"] },
  needlefish: { t: "elong", h: 8, back: "#2f6a7e", belly: "#e6eef1", fin: "#5c8794", tail: "fork", extra: ["beak"] },
  bonito: { t: "fish", h: 22, back: "#284e78", belly: "#e3e9ef", fin: "#557089", tail: "lunate", pat: "oblique", patc: "#16314f" },
  tunny: { t: "fish", h: 23, back: "#2b5373", belly: "#e7ecf0", fin: "#557089", tail: "lunate", pat: "waves", patc: "#18334c", extra: ["chestdots"] },
  barracuda: { t: "elong", h: 12, back: "#55707b", belly: "#e8edef", fin: "#7c929a", tail: "fork", pat: "bars", patc: "rgba(40,60,70,.25)", n: 18, extra: ["jaw", "twodorsal"] },
  yellowstripe: { t: "elong", h: 10, back: "#6e8a86", belly: "#eef1ee", fin: "#9fae9f", tail: "fork", pat: "stripes", patc: "#e0b93a", n: 1, extra: ["jaw", "twodorsal"] },
  threadfin: { t: "deep", h: 36, back: "#9fb4bb", belly: "#eef3f4", fin: "#a9bcc2", tail: "fork", extra: ["threads"] },
  grouper: { t: "grouper", h: 28, back: "#6b4a34", belly: "#b98f6c", fin: "#5a3c29", tail: "round", pat: "blotch", patc: "rgba(240,215,170,.55)" },
  seabream: { t: "deep", h: 32, back: "#8e9aa0", belly: "#eef1f2", fin: "#9aa4a8", tail: "fork", pat: "bars", patc: "rgba(40,50,60,.35)", n: 8, extra: ["tailspot"] },
  sillago: { t: "elong", h: 11, back: "#b9a98c", belly: "#f1ece2", fin: "#cbbd9f", tail: "trunc", extra: ["twodorsal"] },
  squid: { t: "squid", back: "#d98b8b", belly: "#f4d6cf", fin: "#e3a59f" },
  cuttlefish: { t: "cuttle", back: "#9a7a5f", belly: "#e8d9c6", fin: "#c9b49a" },
  leerfish: { t: "fish", h: 26, back: "#5d6c73", belly: "#eef1f2", fin: "#6f7f86", tail: "fork", extra: ["wavyline"] },
  meagre: { t: "fish", h: 25, back: "#7a7466", belly: "#e7e2d8", fin: "#8a7f6c", tail: "trunc", extra: ["twodorsal"] },
  mahi: { t: "mahi", h: 26, back: "#2f8a6d", belly: "#e8d24f", fin: "#2b6fa0", tail: "fork", pat: "spots", patc: "#2b6fa0" },
  gilthead: { t: "deep", h: 31, back: "#8d9aa2", belly: "#f0f2f3", fin: "#99a3a8", tail: "fork", extra: ["goldbrow", "opspot"] },
  mullet: { t: "mullet", h: 18, back: "#5d6f78", belly: "#e9eef0", fin: "#7a8a91", tail: "fork", pat: "stripes", patc: "rgba(60,75,85,.35)", n: 5, extra: ["twodorsal"] },
  striped: { t: "deep", h: 27, back: "#a7aeb2", belly: "#f1f3f4", fin: "#b2b8bb", tail: "fork", pat: "bars", patc: "rgba(45,55,65,.45)", n: 7 },
  redmullet: { t: "fish", h: 18, back: "#d4545a", belly: "#f6ddd8", fin: "#e6888a", tail: "fork", extra: ["barbels", "twodorsal"] },
  rabbitfish: { t: "deep", h: 28, back: "#7d7e64", belly: "#d9d6c0", fin: "#8b8a6c", tail: "trunc", pat: "dots", patc: "rgba(240,235,200,.6)" },
  salema: { t: "deep", h: 25, back: "#8f9aa0", belly: "#eef0ef", fin: "#a3aaa8", tail: "fork", pat: "stripes", patc: "#d9b84a", n: 7 },
  chub: { t: "fish", h: 18, back: "#3d6e78", belly: "#e7ecee", fin: "#6d8890", tail: "fork", pat: "waves", patc: "#1d3c45", extra: ["sidespots", "twodorsal"] },
  oblada: { t: "deep", h: 25, back: "#8b979c", belly: "#eef1f2", fin: "#9aa3a7", tail: "fork", extra: ["saddle"] },
  bogue: { t: "fish", h: 15, back: "#7e9a8f", belly: "#eef2ef", fin: "#a0b2a6", tail: "fork", pat: "stripes", patc: "#d8bf5a", n: 4, extra: ["bigeye"] },
  lavnun: { t: "fish", h: 12, back: "#6f8e98", belly: "#eef2f3", fin: "#9fb1b7", tail: "fork" },
  gt: { t: "fish", h: 30, back: "#4b5559", belly: "#c7cdcf", fin: "#3f474a", tail: "fork", extra: ["scutes", "steep"] },
  emperor: { t: "fish", h: 25, back: "#7c7a63", belly: "#e6e2d2", fin: "#c0685a", tail: "fork" },
  lizardfish: { t: "elong", h: 11, back: "#9b8466", belly: "#ebe2d2", fin: "#b39d7e", tail: "fork", pat: "blotch", patc: "rgba(70,50,35,.45)", extra: ["jaw"] },
  eilatgrouper: { t: "grouper", h: 27, back: "#c0473f", belly: "#e98d7e", fin: "#a83a33", tail: "round", pat: "dots", patc: "#5aa9e0" },
  barbel: { t: "fish", h: 19, back: "#7c7448", belly: "#e7dfba", fin: "#9a8a52", tail: "fork", extra: ["barbels"] },
  tilapia: { t: "deep", h: 28, back: "#76806f", belly: "#e2e4d8", fin: "#7e8676", tail: "trunc", pat: "bars", patc: "rgba(40,50,40,.2)", n: 6 },
  catfish: { t: "catfish", h: 16, back: "#4a4c4a", belly: "#b9b7ad", fin: "#3b3c3a" },
  carp: { t: "deep", h: 27, back: "#8a6d34", belly: "#e8d49b", fin: "#9c7a3c", tail: "fork", extra: ["barbels", "scales"] },
  amberjack: { t: "fish", h: 23, back: "#3f6a85", belly: "#eef1f3", fin: "#d5b453", tail: "fork", pat: "stripes", patc: "#e2c24d", n: 1, extra: ["eyeband"] },
  pagrus: { t: "deep", h: 29, back: "#d47c78", belly: "#f6e1dc", fin: "#e09892", tail: "fork", pat: "dots", patc: "rgba(110,170,230,.7)" },
  dentex: { t: "deep", h: 28, back: "#b08d8a", belly: "#efe4e1", fin: "#c09c98", tail: "fork", pat: "dots", patc: "rgba(80,140,210,.55)", extra: ["steep"] },
  pandora: { t: "deep", h: 26, back: "#d9827f", belly: "#f7e2de", fin: "#e8a19c", tail: "fork" },
  kingfish: { t: "elong", h: 15, back: "#3f6377", belly: "#e9eef1", fin: "#5f7d8c", tail: "lunate", pat: "bars", patc: "rgba(30,50,65,.45)", n: 16 },
  whitegrouper: { t: "grouper", h: 27, back: "#7a7466", belly: "#cdc6b6", fin: "#635d51", tail: "round", pat: "stripes", patc: "rgba(240,235,220,.45)", n: 3 },
  horsemackerel: { t: "fish", h: 16, back: "#56778a", belly: "#eaeff2", fin: "#7a95a3", tail: "fork", extra: ["scutes", "opspot"] },
  pompano: { t: "deep", h: 30, back: "#9fb0b6", belly: "#f0f3f4", fin: "#47565c", tail: "fork", pat: "sidedots", patc: "#2f3a3f", extra: ["longlobes"] },
  sweeper: { t: "deep", h: 30, back: "#a2643c", belly: "#e7b98d", fin: "#8c5530", tail: "trunc", extra: ["bigeye"] },
  octopus: { t: "octo", back: "#b8664f", belly: "#e8b3a1", fin: "#cf8a73" },
  annularbream: { t: "deep", h: 29, back: "#b4ae8c", belly: "#f3f0e2", fin: "#d8c56c", tail: "fork", extra: ["tailband"] },
  twobandedbream: { t: "deep", h: 29, back: "#9aa1a3", belly: "#f0f2f2", fin: "#a5aaab", tail: "fork", extra: ["napeband", "tailband"] },
  zebrabream: { t: "deep", h: 30, back: "#c4a95d", belly: "#f1e7c8", fin: "#b99a4a", tail: "fork", pat: "bars", patc: "rgba(45,35,25,.65)", n: 5 },
  lionfish: { t: "lion", h: 22, back: "#b9573b", belly: "#f3ddd2", fin: "#c96a4c" },
  toadfish: { t: "puffer", h: 20, back: "#7c8a6a", belly: "#f1f2ec", fin: "#9aa486", pat: "spots", patc: "rgba(40,45,30,.55)" },
  stingray: { t: "ray", back: "#8a7a64", belly: "#e6dccd", fin: "#7a6a55" }
};
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function fishBody(p, id) {
  const L = p.t === "elong" ? 172 : 160, x0 = p.t === "elong" ? 10 : 18, H = p.h, pk = p.t === "deep" ? 0.85 : p.t === "grouper" ? 1 : 1;
  const steep = (p.extra || []).includes("steep") || p.t === "mahi";
  const top = 50 - H, bot = 50 + H * (p.t === "deep" ? 0.95 : 0.82), ped = Math.max(4, H * 0.22), nx = x0, ny = 50 + (p.t === "mullet" ? 2 : 3);
  const body = `M${nx},${ny} C${nx + (steep ? 2 : 8)},${steep ? top + 2 : 50 - H * 0.75} ${x0 + 40},${top} ${x0 + 70 * pk},${top} C${L - 40},${top} ${L - 18},${50 - ped - 2} ${L},${50 - ped} L${L},${50 + ped} C${L - 18},${50 + ped + 2} ${L - 45},${bot} ${x0 + 70},${bot} C${x0 + 35},${bot} ${nx + 6},${50 + H * 0.5} ${nx},${ny} Z`;
  const T = Math.max(14, H * 0.95), tx = L, tail = {
    fork: `M${tx - 2},${50 - ped} L${tx + 26},${50 - T} L${tx + 16},50 L${tx + 26},${50 + T} L${tx - 2},${50 + ped} Z`,
    lunate: `M${tx - 2},${50 - ped} Q${tx + 14},${50 - T * 0.5} ${tx + 28},${50 - T} Q${tx + 16},50 ${tx + 28},${50 + T} Q${tx + 14},${50 + T * 0.5} ${tx - 2},${50 + ped} Z`,
    round: `M${tx - 2},${50 - ped} C${tx + 30},${50 - T} ${tx + 30},${50 + T} ${tx - 2},${50 + ped} Z`,
    trunc: `M${tx - 2},${50 - ped} L${tx + 22},${50 - T * 0.8} L${tx + 24},${50 + T * 0.8} L${tx - 2},${50 + ped} Z`
  }[p.tail || "fork"];
  return { body, tail, x0, L, H, top, bot, ped };
}
function fishSvg(id, opt = {}) {
  const p = S[id]; if (!p) return "";
  const u = "fa" + (++uid), size = opt.size ? ` width="${opt.size}"` : "";
  if (["squid", "cuttle", "octo", "ray"].includes(p.t)) return specialSvg(p, u, size);
  const g = fishBody(p, id), ex = p.extra || [], r = rnd(id.length * 7919 + id.charCodeAt(0));
  const { x0, L, H, top, bot } = g, eyeR = ex.includes("bigeye") ? 5.2 : H > 25 ? 3.6 : 3, ex0 = x0 + (p.t === "elong" ? 16 : 14), ey = 50 - H * 0.28;
  let pat = "";
  const n = p.n || 6;
  if (p.pat === "bars") for (let i = 0; i < n; i++) { const x = x0 + 34 + i * ((L - x0 - 50) / n); pat += `<rect x="${x}" y="${top - 2}" width="${(L - x0) / n * 0.24}" height="${bot - top + 4}" fill="${p.patc}"/>`; }
  if (p.pat === "stripes") for (let i = 0; i < n; i++) { const y = n === 1 ? 50 - H * 0.08 : top + 6 + i * ((bot - top - 10) / n); pat += `<rect x="${x0}" y="${y}" width="${L}" height="${n === 1 ? 3.2 : 1.8}" fill="${p.patc}"/>`; }
  if (p.pat === "oblique") for (let i = 0; i < 7; i++) { const x = x0 + 30 + i * 17; pat += `<path d="M${x},${top} L${x + 22},${50 - 2}" stroke="${p.patc}" stroke-width="2.6"/>`; }
  if (p.pat === "waves") for (let i = 0; i < 9; i++) { const x = x0 + 60 + i * 11; pat += `<path d="M${x},${top + 2} q6,8 0,16 q-6,8 0,14" stroke="${p.patc}" stroke-width="2" fill="none"/>`; }
  if (p.pat === "spots" || p.pat === "dots") for (let i = 0; i < (p.pat === "dots" ? 40 : 22); i++) { const x = x0 + 22 + r() * (L - x0 - 30), y = top + 4 + r() * (bot - top - 8); pat += `<circle cx="${x}" cy="${y}" r="${p.pat === "dots" ? 1.4 : 2.2}" fill="${p.patc}"/>`; }
  if (p.pat === "blotch") for (let i = 0; i < 14; i++) { const x = x0 + 20 + r() * (L - x0 - 30), y = top + 4 + r() * (bot - top - 8); pat += `<ellipse cx="${x}" cy="${y}" rx="${4 + r() * 5}" ry="${3 + r() * 3}" fill="${p.patc}"/>`; }
  if (p.pat === "sidedots") for (let i = 0; i < 4; i++) pat += `<circle cx="${x0 + 55 + i * 22}" cy="${50 - 2}" r="3" fill="${p.patc}"/>`;
  if (ex.includes("sidespots")) for (let i = 0; i < 14; i++) pat += `<circle cx="${x0 + 40 + r() * 100}" cy="${52 + r() * 12}" r="1.4" fill="rgba(40,60,70,.45)"/>`;
  if (ex.includes("chestdots")) for (let i = 0; i < 5; i++) pat += `<circle cx="${x0 + 34 + i * 5}" cy="${58 + (i % 2) * 3}" r="1.6" fill="#18334c"/>`;
  if (ex.includes("tailspot")) pat += `<ellipse cx="${L - 6}" cy="50" rx="5" ry="${g.ped + 3}" fill="#1e2428"/>`;
  if (ex.includes("tailband")) pat += `<rect x="${L - 12}" y="${top}" width="7" height="${bot - top}" fill="#1e2428"/>`;
  if (ex.includes("napeband")) pat += `<path d="M${x0 + 34},${top} L${x0 + 40},${bot}" stroke="#1e2428" stroke-width="8"/>`;
  if (ex.includes("saddle")) pat += `<rect x="${L - 16}" y="${top}" width="10" height="${bot - top}" fill="#1e2428"/><rect x="${L - 19}" y="${top}" width="3" height="${bot - top}" fill="#fff"/>`;
  if (ex.includes("scales")) for (let i = 0; i < 26; i++) pat += `<path d="M${x0 + 30 + (i % 9) * 13},${top + 8 + Math.floor(i / 9) * 13} q5,5 0,10" stroke="rgba(90,60,20,.35)" fill="none"/>`;
  // fins
  const dorsal = p.t === "mahi" ? `<path d="M${x0 + 18},${top + 2} C${x0 + 60},${top - 12} ${L - 30},${top - 8} ${L - 8},${50 - g.ped - 1} L${L - 20},${top + 6} Z"/>`
    : p.t === "catfish" ? "" : ex.includes("twodorsal") ? `<path d="M${x0 + 52},${top + 1} L${x0 + 64},${top - 11} L${x0 + 80},${top + 1} Z"/><path d="M${x0 + 92},${top + 2} L${x0 + 100},${top - 9} L${x0 + 118},${top + 3} Z"/>`
    : p.t === "grouper" || p.t === "deep" ? `<path d="M${x0 + 40},${top + 2} C${x0 + 60},${top - 12} ${x0 + 105},${top - 10} ${L - 22},${top + 8} L${L - 30},${top + 10} Z"/>`
    : `<path d="M${x0 + 48},${top + 1} L${x0 + 62},${top - 13} L${x0 + 92},${top + 2} Z"/>`;
  const anal = p.t === "catfish" ? "" : `<path d="M${x0 + 92},${bot - 1} L${x0 + 102},${bot + 9} L${x0 + 118},${bot - 2} Z"/>`;
  const pec = `<path d="M${x0 + 32},${52} q14,4 20,12 q-14,0 -20,-6 Z" opacity=".85"/>`;
  let extras = "";
  if (ex.includes("beak")) extras += `<path d="M${x0 + 1},${50} L${x0 - 9},49 L${x0 + 1},${52.5} Z" fill="${p.back}"/>`;
  if (ex.includes("jaw")) extras += `<path d="M${x0},${52} L${x0 + 18},${54}" stroke="#2c3a40" stroke-width="1.2"/>`;
  if (ex.includes("barbels")) extras += `<path d="M${x0 + 6},${54} q-6,8 -2,14 M${x0 + 9},${54} q-2,8 2,13" stroke="${p.fin}" stroke-width="1.3" fill="none"/>`;
  if (ex.includes("threads")) extras += `<path d="M${x0 + 70},${top + 2} C${x0 + 90},${top - 20} ${x0 + 130},${top - 18} ${L + 20},${top - 8} M${x0 + 80},${bot - 1} C${x0 + 100},${bot + 18} ${x0 + 140},${bot + 16} ${L + 22},${bot + 6}" stroke="${p.fin}" stroke-width="1.4" fill="none"/>`;
  if (ex.includes("longlobes")) extras += `<path d="M${L + 20},${50 - 18} L${L + 34},${50 - 26} M${L + 20},${50 + 18} L${L + 34},${50 + 26}" stroke="${p.fin}" stroke-width="3"/>`;
  if (ex.includes("scutes")) extras += `<path d="M${L - 50},${50} L${L - 2},${50}" stroke="rgba(30,40,45,.55)" stroke-width="2.4" stroke-dasharray="3 1.5"/>`;
  if (ex.includes("wavyline")) extras += `<path d="M${x0 + 30},${50 - 6} q12,-8 24,0 t24,4 t24,-2 t24,4" stroke="#2c3a40" stroke-width="1.6" fill="none"/>`;
  if (ex.includes("eyeband")) extras += `<path d="M${x0 + 4},${50 - H * 0.55} L${x0 + 34},${50 + 2}" stroke="#7a5a2a" stroke-width="3" opacity=".7"/>`;
  if (ex.includes("goldbrow")) extras += `<path d="M${ex0 - 6},${ey - 6} q6,-3 12,0" stroke="#e1b84a" stroke-width="2.4" fill="none"/>`;
  if (ex.includes("opspot")) extras += `<circle cx="${x0 + 30}" cy="${ey + 2}" r="2.6" fill="#24313a"/>`;
  if (ex.includes("pecspot")) extras += `<circle cx="${x0 + 33}" cy="${52}" r="2.6" fill="#1d2a31"/>`;
  if (p.t === "catfish") extras += `<path d="M${x0 + 2},${51} q-14,6 -16,18 M${x0 + 3},${50} q-16,-4 -18,-14 M${x0 + 6},${53} q-6,10 -4,16" stroke="#3b3c3a" stroke-width="1.4" fill="none"/><path d="M${x0 + 40},${top + 1} L${L - 10},${50 - g.ped - 1} L${L - 10},${top + 4} Z M${x0 + 50},${bot - 1} L${L - 10},${50 + g.ped + 1} L${L - 10},${bot - 3} Z" fill="${p.fin}"/>`;
  if (p.t === "lion") extras += lionFins(x0, top, bot, p);
  if (p.t === "puffer") extras += `<path d="M${x0 + 4},${53} q4,2 8,0" stroke="#2c3a40" fill="none"/>`;
  const gill = `<path d="M${x0 + 26},${50 - H * 0.55} q6,${H * 0.55} 0,${H * 1.05}" stroke="rgba(0,0,0,.18)" stroke-width="1.4" fill="none"/>`;
  return `<svg class="fish-art" viewBox="-12 ${50 - 50} 232 100"${size} role="img" aria-hidden="true"><defs>
    <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.back}"/><stop offset=".55" stop-color="${mix(p.back, p.belly)}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient>
    <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".45" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${u}c"><path d="${g.body}"/></clipPath></defs>
    <g fill="${p.fin}" opacity=".95">${dorsal}${anal}<path d="${g.tail}"/></g>
    <path d="${g.body}" fill="url(#${u}b)"/>
    <g clip-path="url(#${u}c)">${pat}<rect x="0" y="0" width="220" height="100" fill="url(#${u}s)"/></g>
    <g fill="${p.fin}">${pec}</g>${gill}${extras}
    <circle cx="${ex0}" cy="${ey}" r="${eyeR}" fill="#fff"/><circle cx="${ex0 - 0.6}" cy="${ey}" r="${eyeR * 0.62}" fill="#15202a"/><circle cx="${ex0 - 1.4}" cy="${ey - 1}" r="${eyeR * 0.22}" fill="#fff"/>
  </svg>`;
}
function lionFins(x0, top, bot, p) {
  let s = "";
  for (let i = 0; i < 11; i++) { const x = x0 + 34 + i * 9; s += `<path d="M${x},${top + 2} L${x + 3 + i},${top - 18 - (i % 3) * 4}" stroke="${p.fin}" stroke-width="1.6"/>`; }
  s += `<path d="M${x0 + 34},52 C${x0 + 60},70 ${x0 + 90},88 ${x0 + 120},92 C${x0 + 90},76 ${x0 + 62},62 ${x0 + 34},52 Z" fill="${p.fin}" opacity=".55"/>`;
  for (let i = 0; i < 8; i++) s += `<path d="M${x0 + 22 + i * 15},${top + 2} L${x0 + 26 + i * 15},${bot - 2}" stroke="#fff" stroke-width="3" opacity=".75"/>`;
  return s;
}
function specialSvg(p, u, size) {
  const grad = `<linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.back}"/><stop offset="1" stop-color="${p.belly}"/></linearGradient>`;
  let inner = "";
  if (p.t === "squid") inner = `<path d="M30,50 C50,36 120,38 170,46 L190,40 L196,50 L190,60 L170,54 C120,62 50,64 30,50 Z" fill="url(#${u}b)"/>${[-8, -4, 0, 4, 8].map(d => `<path d="M32,${50 + d / 2} C18,${50 + d} 8,${50 + d * 1.6} -6,${50 + d * 2}" stroke="${p.fin}" stroke-width="2.4" fill="none"/>`).join("")}<circle cx="40" cy="47" r="3.5" fill="#15202a"/>`;
  if (p.t === "cuttle") inner = `<path d="M40,50 C40,30 170,28 176,50 C170,72 40,70 40,50 Z" fill="${p.fin}"/><path d="M46,50 C48,34 166,34 168,50 C166,66 48,66 46,50 Z" fill="url(#${u}b)"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${70 + i * 9},38 q4,6 0,12" stroke="rgba(60,40,25,.35)" fill="none"/>`).join("")}${[-6, -2, 2, 6].map(d => `<path d="M42,${50 + d / 2} C30,${50 + d} 20,${50 + d * 1.4} 10,${50 + d * 1.8}" stroke="${p.fin}" stroke-width="2.6" fill="none"/>`).join("")}<circle cx="52" cy="46" r="3.4" fill="#15202a"/>`;
  if (p.t === "octo") inner = `<path d="M30,46 C30,22 74,18 84,40 C88,50 84,58 76,60 L40,60 C32,58 30,52 30,46 Z" fill="url(#${u}b)"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${44 + i * 4},58 C${70 + i * 8},${62 + (i % 2) * 8} ${110 + i * 6},${52 + (i % 3) * 10} ${150 + i * 7},${48 + (i % 4) * 9} q8,-4 6,-10" stroke="${p.fin}" stroke-width="${4.2 - i * 0.3}" fill="none" stroke-linecap="round"/>`).join("")}<circle cx="68" cy="46" r="3.6" fill="#fff"/><circle cx="67.4" cy="46" r="2.2" fill="#15202a"/>`;
  if (p.t === "ray") inner = `<path d="M100,14 C140,30 176,46 186,50 C176,54 140,70 100,86 C60,70 24,54 14,50 C24,46 60,30 100,14 Z" fill="url(#${u}b)"/><path d="M118,50 L210,50" stroke="${p.fin}" stroke-width="2.4"/><circle cx="82" cy="44" r="2.6" fill="#15202a"/><circle cx="82" cy="56" r="2.6" fill="#15202a"/>`;
  return `<svg class="fish-art" viewBox="-12 0 232 100"${size} role="img" aria-hidden="true"><defs>${grad}</defs>${inner}</svg>`;
}
function mix(a, b) { const h = s => s.match(/\w\w/g).map(x => parseInt(x, 16)); try { const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round((v + B[i]) / 2).toString(16).padStart(2, "0")).join(""); } catch (e) { return b; } }

// ---- lure-type icons (64×32)
const LI = {
  JIG: '<path d="M8,16 C14,8 40,8 50,16 C40,24 14,24 8,16 Z" fill="#c9d3d8" stroke="#53636b"/><path d="M14,12 L44,12" stroke="#7d90c4" stroke-width="3"/><path d="M50,16 L58,16 M58,16 q4,0 4,4 q0,4 -4,3" stroke="#53636b" fill="none" stroke-width="1.6"/>',
  MJ: '<path d="M16,16 C20,10 36,10 42,16 C36,22 20,22 16,16 Z" fill="#e9c35a" stroke="#7a6022"/><path d="M42,16 L50,16 q4,0 4,4 q0,4 -4,3" stroke="#53636b" fill="none" stroke-width="1.5"/>',
  SP: '<path d="M6,16 C10,10 46,10 54,16 C46,22 10,22 6,16 Z" fill="#d7dee2" stroke="#4f6068"/><path d="M8,15 C20,11 40,11 52,15" stroke="#3b6aa0" stroke-width="2.5"/><circle cx="14" cy="15" r="1.6"/>',
  FP: '<path d="M2,24 Q16,20 32,24 T62,24" stroke="#6fb3d1" fill="none" stroke-width="1.5"/><path d="M8,18 C12,12 46,12 54,18 C46,24 12,24 8,18 Z" fill="#f2f4f5" stroke="#4f6068"/><circle cx="15" cy="17" r="1.6"/>',
  POP: '<path d="M10,16 L16,9 C30,8 46,11 54,16 C46,21 30,24 16,23 Z" fill="#fff" stroke="#4f6068"/><path d="M10,16 L16,9 L16,23 Z" fill="#e05a45"/><path d="M4,12 l3,2 M3,17 h4 M4,21 l3,-2" stroke="#6fb3d1"/>',
  MIN: '<path d="M12,16 C16,9 44,9 52,16 C44,23 16,23 12,16 Z" fill="#cfd8dc" stroke="#4f6068"/><path d="M12,17 L4,23 L10,18 Z" fill="#9fb3bb" stroke="#4f6068"/><path d="M14,13 C24,10 40,10 50,14" stroke="#37645f" stroke-width="2.5"/><circle cx="18" cy="15" r="1.7"/>',
  SOFT: '<path d="M8,16 C12,10 34,10 44,14 L52,8 L56,16 L52,24 L44,18 C34,22 12,22 8,16 Z" fill="#f1f1ea" stroke="#5c6a6f"/><circle cx="8" cy="16" r="5" fill="#9aa3a6"/><circle cx="13" cy="14" r="1.4"/>',
  EGI: '<path d="M10,16 C14,10 40,10 48,16 C40,22 14,22 10,16 Z" fill="#f08a3c" stroke="#8a4318"/><path d="M14,12 L40,12" stroke="#f7c4a0" stroke-width="2"/><path d="M48,16 l8,-5 M48,16 l9,-1 M48,16 l9,2 M48,16 l8,5" stroke="#53636b"/><path d="M10,16 L4,10 M12,18 L6,24" stroke="#8a4318"/>',
  BOMB: '<ellipse cx="20" cy="16" rx="12" ry="6" fill="#e8eef1" stroke="#4f6068"/><path d="M32,16 L50,16" stroke="#7a8a91"/><path d="M50,16 l8,-3 l-2,3 l2,3 Z" fill="#fff" stroke="#7a8a91"/>',
  SPOON: '<path d="M12,16 C12,8 40,8 46,16 C40,24 12,24 12,16 Z" fill="#e8c860" stroke="#7a6022"/><path d="M46,16 L52,16 q4,0 4,4 q0,4 -4,3" stroke="#53636b" fill="none" stroke-width="1.5"/><path d="M18,13 q8,-2 16,0" stroke="#fff3c4" stroke-width="1.6" fill="none"/>',
  SABIKI: '<path d="M6,4 L6,28" stroke="#7a8a91"/>' + [8, 14, 20].map(y => `<path d="M6,${y} L20,${y + 1}" stroke="#7a8a91"/><path d="M20,${y + 1} l6,-2 l-1,2 l1,2 Z" fill="#f5b8c8"/>`).join("") + '<rect x="3" y="27" width="6" height="4" fill="#53636b"/>',
  BAIT: '<path d="M8,20 C16,8 24,26 32,14 S48,22 56,12" stroke="#c8796b" stroke-width="5" fill="none" stroke-linecap="round"/>',
  TAI: '<circle cx="18" cy="16" r="8" fill="#e0533f" stroke="#7a2a20"/><path d="M26,14 C36,10 48,12 58,10 M26,16 C36,16 48,18 58,18 M26,18 C36,22 48,24 58,26" stroke="#f08a3c" stroke-width="2" fill="none"/>',
  SURF: '<path d="M30,2 L30,14" stroke="#7a8a91"/><path d="M22,14 L38,14 L34,26 L26,26 Z" fill="#9aa3a6" stroke="#53636b"/><path d="M26,26 l-6,5 M34,26 l6,5 M30,26 l0,6" stroke="#53636b"/>',
  FLOAT: '<path d="M2,18 Q16,14 32,18 T62,18" stroke="#6fb3d1" fill="none" stroke-width="1.5"/><path d="M32,2 L32,8" stroke="#53636b"/><ellipse cx="32" cy="14" rx="5" ry="8" fill="#e8483a"/><path d="M27,15 L37,15" stroke="#fff" stroke-width="2"/><path d="M32,22 L32,30" stroke="#53636b"/>',
  LEDGER: '<path d="M4,10 L60,10" stroke="#7a8a91"/><ellipse cx="30" cy="10" rx="6" ry="4" fill="#6c757a"/><path d="M44,10 L44,20 q0,4 -4,4" stroke="#53636b" fill="none"/>'
};
const lureIcon = code => LI[code] ? `<svg class="lure-ico" viewBox="0 0 64 32" role="img" aria-hidden="true" fill="#15202a">${LI[code]}</svg>` : "";
// ---- colour words → swatches
const CW = [["כסף", "#c7cfd4"], ["כסוף", "#c7cfd4"], ["כחול", "#2f62a8"], ["ורוד", "#f08fb1"], ["לבן", "#ffffff"], ["זהב", "#d8b343"], ["ירוק", "#3c8f5a"], ["כתום", "#f0832c"], ["אדום", "#d6403a"],
  ["זוהר", "#c8f56a"], ["צהוב", "#f2d23a"], ["שחור", "#1f2427"], ["חום", "#8a5a33"], ["סרדין", "#7da0b4"], ["טבעי", "#9aa88c"], ["בורי", "#8d9aa0"], ["שקוף", "rgba(220,235,240,.6)"], ["סגול", "#7b4fa3"], ["כרום", "#dfe6ea"], ["תכלת", "#7cc4e4"]];
function swatches(text) {
  if (!text) return ""; const seen = new Set(), out = [];
  for (const [w, c] of CW) if (text.includes(w) && !seen.has(c)) { seen.add(c); out.push(`<i class="sw" style="background:${c}" title="${w}"></i>`); }
  return out.length ? `<span class="swatches">${out.join("")}</span>` : "";
}
window.FISH_ART = { fish: fishSvg, lure: lureIcon, swatches, has: id => !!S[id] };
})();
