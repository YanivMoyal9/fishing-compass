/* מצפן הדייג — טבלת המינים.
   seasons (m = עונה, p = שיא) לים התיכון לקוחות מבדיקת בעל האתר (ארסנל הז׳רז׳ור); השאר מהמחקר (docs/beaches/fish-lures-guide.md).
   lures: קודי סוגי דמוי (JIG, MJ, SP, FP, POP, MIN, SOFT, EGI, BOMB, SPOON, SABIKI, BAIT) — ראשי ואז משלים.
   layer: upper = מים עליונים, bottom = חלק תחתון, all = בכל גוף המים. temp = טווח מים מועדף (ביטחון נמוך-בינוני).
   waters: med / eilat / lake. habitats: sand, rock, mixed, marina, port, breakwater, estuary, reef, lake. */
(function () {
const span = (a, b) => { const r = []; let m = a; for (;;) { r.push(m); if (m === b) break; m = m % 12 + 1; } return r; };
const ALL = span(1, 12);
const MED = ["med"], ALLSEA = ["med", "eilat"];
const SHORE = ["sand", "rock", "mixed", "marina", "port", "breakwater", "estuary"];
const ROCKY = ["rock", "mixed", "marina", "port", "breakwater", "reef"];
window.SPECIES = [
  { id: "bluefish", name: "גומבר", waters: MED, habitats: SHORE, layer: "upper", m: ALL, p: [6, 10, 11, 12, 1], temp: [14, 25],
    lures: ["FP", "POP"], lures2: ["JIG", "MIN"], size: "פנסיל צף / פופר 12–15 ס״מ · ג׳יג 30–60 ג׳", work: "קצב מהיר וג׳רקים. ליידר עבה — שיניים חותכות", when: "שחר, ים עובד", min: null },
  { id: "seabass", name: "לברק", waters: MED, habitats: ["sand", "mixed", "estuary", "marina", "breakwater"], layer: "upper", zone: "זרם חוזר", m: span(11, 5), p: [3], temp: [14, 22],
    lures: ["MIN", "SOFT"], lures2: ["FP", "SP"], size: "מינו 9–12 ס״מ · שאד 7–12 ס״מ", work: "גלגול איטי מעל הזרם החוזר", when: "שחר ולילה, מים לבנים אחרי סערה", min: null },
  { id: "bluerunner", name: "טרכון", waters: MED, habitats: SHORE, layer: "all", m: span(5, 10), temp: [22, 30],
    lures: ["JIG", "MJ"], lures2: ["SP", "BOMB"], size: "ג׳יג עד 15 ג׳ · מיקרו-ג׳יג 7–15 ג׳", work: "בינוני-מהיר עם הקפצות. כשהם רחוקים — בומבט + סקוויד", when: "שחר ושקיעה, שוברים", min: null },
  { id: "needlefish", name: "חניתן", waters: ALLSEA, habitats: SHORE, layer: "upper", m: span(6, 10), temp: [22, 30],
    lures: ["SP"], lures2: ["MIN", "JIG"], size: "פנסיל שוקע דק 8–10 ס״מ", work: "מהיר, קרוב לפני המים. קרס יחיד חד", when: "יום בהיר", min: null },
  { id: "bonito", name: "פלמידה", waters: ALLSEA, habitats: ["sand", "mixed", "port", "breakwater", "marina"], layer: "upper", m: span(9, 3), p: [1, 2], temp: [17, 26],
    lures: ["JIG"], lures2: ["SP", "POP", "BOMB"], size: "ג׳יג 20–60 ג׳ · מינו שוקע 9–12 ס״מ", work: "מהיר ורציף. לזרוק לציפורים צוללות", when: "שחר, להקות", min: null },
  { id: "tunny", name: "טונית", waters: MED, habitats: ["sand", "mixed", "port", "breakwater", "marina"], layer: "upper", m: span(12, 3), temp: [18, 30],
    lures: ["JIG"], lures2: ["BOMB", "SP"], size: "ג׳יג צר 15–40 ג׳", work: "הכי מהיר שאפשר, פרופיל קטן כגודל הפיתיון", when: "שחר ובוקר, \"מרק\" על פני המים", min: null },
  { id: "barracuda", name: "ברקודה", waters: ALLSEA, habitats: ["rock", "mixed", "marina", "port", "breakwater", "reef"], layer: "upper", m: span(10, 5), p: [12, 1, 2], temp: [20, 30],
    lures: ["MIN"], lures2: ["SP", "FP"], size: "מינו 9–14 ס״מ", work: "איטי עם עצירות. ליידר עבה", when: "לילה ואור נמוך, נמלים ושוברים", min: 20,
    legal: { eilat: "הברקודה הגדולה מוגנת באילת — לשחרר" } },
  { id: "yellowstripe", name: "מליטה", waters: ALLSEA, habitats: SHORE.concat("reef"), layer: "bottom", m: span(5, 11), temp: [22, 30],
    lures: ["MJ"], lures2: ["MIN"], size: "מיקרו-ג׳יג 5–10 ג׳", work: "מהיר עם הקפצות", when: "שחר ושקיעה", min: 20, note: "מינימום 20 ס״מ — רוב הדגים קטנים מזה, לשחרר" },
  { id: "threadfin", name: "בן גוריון", waters: MED, habitats: ["marina", "port", "breakwater"], layer: "bottom", m: span(6, 10), temp: [22, 30],
    lures: ["MJ"], lures2: ["JIG", "MIN"], size: "ג׳יג קל עד 10 ג׳", work: "ג׳יגינג איטי ליד הקרקעית", when: "מרינות ונמלים", min: null },
  { id: "grouper", name: "לוקוס", waters: MED, habitats: ROCKY, layer: "bottom", m: ALL, p: [12, 1, 2], temp: [16, 26],
    lures: ["SOFT"], lures2: ["MIN"], size: "ראש ג׳יג 10–30 ג׳ + שאד 8–12 ס״מ", work: "צמוד לסלעים, הקפצות איטיות, למשוך מיד מהסלע", when: "כל השנה, שחר ושקיעה", min: 40,
    note: "מינימום 40 ס״מ. הדקר האלכסנדרוני מוגן" },
  { id: "seabream", name: "סרגוס", waters: MED, habitats: ROCKY, layer: "bottom", m: ALL, p: span(5, 8), temp: [15, 28],
    lures: ["MJ", "SOFT"], lures2: ["MIN"], size: "עד 4 ג׳ (LRF)", work: "עדין, צמוד לסלעים. פיתיון יעיל יותר", when: "ים עם תנועה", min: 11 },
  { id: "sillago", name: "טלויזיה", waters: MED, habitats: ["sand", "mixed"], layer: "bottom", m: span(6, 9), temp: [22, 30],
    lures: ["MJ"], lures2: ["SABIKI", "SOFT"], size: "1–5 ג׳", work: "גרירה איטית על החול", when: "קיץ, עד תחילת ספטמבר", min: null },
  { id: "squid", name: "קלאמרי", waters: MED, habitats: ["rock", "mixed", "marina", "port", "breakwater"], layer: "all", m: span(10, 6), temp: [13, 21],
    lures: ["EGI"], lures2: [], size: "אגי 2.5–3.5", work: "הקפצות, שקיעה וריחוף", when: "שקיעה ולילה, ליד אורות", min: null, legal: { eilat: "כל הרכיכות מוגנות באילת" } },
  { id: "cuttlefish", name: "סבידה", waters: MED, habitats: ["sand", "mixed", "marina", "port"], layer: "bottom", m: span(12, 5), temp: [13, 21],
    lures: ["EGI"], lures2: [], size: "אגי 2.5–3.0", work: "גרירה על החול עם עצירות", when: "חורף–אביב", min: null },
  { id: "leerfish", name: "אנטיאס", waters: MED, habitats: ["sand", "mixed", "estuary", "breakwater"], layer: "upper", m: span(9, 3), temp: [18, 27],
    lures: ["POP", "FP"], lures2: ["MIN"], size: "פופר / סטיקבייט 12–15 ס״מ", work: "שטח בשחר, משיכות ועצירות", when: "שחר, ליד להקות בורי", min: null },
  { id: "meagre", name: "מוסר", waters: MED, habitats: ["sand", "estuary", "breakwater", "port"], layer: "bottom", m: span(6, 10), temp: [17, 27],
    lures: ["SOFT", "MIN"], lures2: ["JIG"], size: "שאד גדול / מינו", work: "איטי, קרוב לקרקעית", when: "לילה, מים עכורים אחרי סערה", min: 40 },
  { id: "mahi", name: "דוראדו", waters: MED, habitats: ["port", "breakwater", "marina"], layer: "upper", m: span(9, 3), temp: [21, 30],
    lures: ["POP", "FP"], lures2: ["MIN"], size: "12–18 ס״מ", work: "ליד עצמים צפים", when: "סתיו", min: null },
  { id: "gilthead", name: "דניס", waters: MED, habitats: SHORE, layer: "bottom", m: ALL, p: [4, 5, 6, 9, 10, 11], bait: true,
    lures: ["BAIT"], lures2: ["SOFT", "MJ"], size: "", work: "פיתיון: שרימפס, סרטן", when: "", min: 15 },
  { id: "mullet", name: "בורי", waters: ["med", "lake"], habitats: ["marina", "port", "estuary", "lake"], layer: "upper", m: ALL, p: [3, 4, 5, 9, 10, 11], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "מצוף, לחם ובצק", when: "", min: 20, note: "בכנרת מינימום 45 ס״מ" },
  { id: "striped", name: "מרמיר", waters: MED, habitats: ["sand"], layer: "bottom", m: span(5, 10), bait: true,
    lures: ["BAIT"], lures2: ["MJ"], size: "", work: "תולעים על החול", when: "קיץ", min: 11 },
  { id: "redmullet", name: "ברבוניה", waters: MED, habitats: ["sand"], layer: "bottom", m: ALL, p: [6, 7, 8, 9], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "תולעת חרוזית, קרס קטן", when: "", min: 11 },
  // אילת
  { id: "gt", name: "ג׳י טי", waters: ["eilat"], habitats: ["reef", "breakwater", "mixed", "sand", "estuary"], layer: "upper", m: ALL, temp: [22, 30],
    lures: ["POP", "FP"], lures2: ["JIG"], size: "פופר / סטיקבייט 14–20 ס״מ, 60–150 ג׳", work: "ציוד כבד (PE 4–8)", when: "שחר, מעברי גאות, שולי שונית", min: null },
  { id: "emperor", name: "שורי", waters: ["eilat"], habitats: ["reef"], layer: "bottom", m: ALL, protectedIn: ["eilat"], lures: [], lures2: [], note: "מוגן באילת — אסור" },
  { id: "lizardfish", name: "דג לטאה", waters: ["eilat", "med"], habitats: ["sand", "reef"], layer: "bottom", m: ALL, protectedIn: ["eilat"], lures: ["MJ", "SOFT"], lures2: [], min: 16, note: "באילת מוגן. בים התיכון מינימום 16 ס״מ" },
  { id: "eilatgrouper", name: "דקרים (אילת)", waters: ["eilat"], habitats: ["reef"], layer: "bottom", m: ALL, protectedIn: ["eilat"], lures: [], lures2: [], note: "כל הדקרים מוגנים באילת" },
  // כנרת
  { id: "barbel", name: "בינית", waters: ["lake"], habitats: ["lake"], layer: "bottom", m: span(3, 12), p: [3, 4, 5], temp: [20, 30],
    lures: ["SOFT", "SPOON"], lures2: ["FP", "MIN"], size: "ראש ג׳יג 0.6–0.8 ג׳ + סיליקון זעיר · כפית/ספינר 1–3 ג׳", work: "UL, שחר", when: "שחר, לפני הזריחה", min: 30 },
  { id: "tilapia", name: "אמנון (מושט)", waters: ["lake"], habitats: ["lake"], layer: "upper", m: span(4, 10), p: span(5, 8), temp: [22, 31],
    lures: ["SPOON", "SOFT"], lures2: ["BAIT"], size: "כפית 1–3 ג׳ · סיליקון זעיר", work: "UL", when: "אביב–קיץ", min: 22, note: "אמנון הגליל 22 ס״מ, אמנון הירדן 20 ס״מ" },
  { id: "catfish", name: "שפמנון", waters: ["lake"], habitats: ["lake"], layer: "bottom", m: span(5, 10), bait: true,
    lures: ["BAIT"], lures2: ["SOFT"], size: "", work: "פיתיון בלילה (כבד עוף)", when: "לילה", min: null },
  { id: "carp", name: "קרפיון", waters: ["lake"], habitats: ["lake"], layer: "bottom", m: span(11, 4), bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "בויליס, תירס", when: "נובמבר–אפריל", min: null }
];
window.LURE_TYPES = {
  JIG: "ג׳יג מתכת", MJ: "מיקרו-ג׳יג", SP: "פנסיל שוקע", FP: "פנסיל צף / WTD", POP: "פופר", MIN: "מינו", SOFT: "סיליקון",
  EGI: "אגי", BOMB: "ריג בומבט", SPOON: "כפית / ספינר", SABIKI: "סביקי", BAIT: "פיתיון טבעי"
};
// lure code -> type filter of the arsenal (script.js)
window.LURE_TO_ARSENAL = { JIG: "jig", MJ: "jig", SP: "minnow", MIN: "minnow", FP: "topwater", POP: "topwater", SOFT: "soft" };
})();
