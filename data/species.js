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
  { id: "mullet", name: "בורי", waters: ["med", "lake"], habitats: ["sand", "marina", "port", "breakwater", "estuary", "lake"], layer: "upper", m: ALL, p: [3, 4, 5, 9, 10, 11], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "מצוף, לחם ובצק", when: "", min: 20, note: "בכנרת מינימום 45 ס״מ" },
  { id: "striped", name: "מרמיר", waters: MED, habitats: ["sand"], layer: "bottom", m: span(5, 10), bait: true,
    lures: ["BAIT"], lures2: ["MJ"], size: "", work: "תולעים על החול", when: "קיץ", min: 11 },
  { id: "redmullet", name: "ברבוניה", waters: MED, habitats: ["sand"], layer: "bottom", m: ALL, p: [6, 7, 8, 9], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "תולעת חרוזית, קרס קטן", when: "", min: 11 },
  // bait / float fish added 25/10 (seasons cross-checked with the Cormorant fish table and our research)
  { id: "rabbitfish", name: "סיכן", waters: ALLSEA, habitats: ["rock", "mixed", "marina", "port", "breakwater", "reef"], layer: "upper", m: span(3, 12), p: span(6, 10), temp: [18, 30], bait: true,
    lures: ["BAIT"], lures2: ["SOFT"], size: "", work: "מצוף רגיש, לחם או בצק, קרס קטן", when: "שעות היום, מים שקטים", min: null, note: "קוצים ארסיים — לאחוז עם מגבת" },
  { id: "salema", name: "סלפה", waters: MED, habitats: ["rock", "mixed", "marina", "breakwater"], layer: "upper", m: ALL, temp: [15, 28], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "מצוף, לחם, בצק או אצות", when: "שעות היום", min: null },
  { id: "chub", name: "קוליאס", waters: MED, habitats: ["port", "breakwater", "marina"], layer: "all", m: span(11, 4), p: [1, 2, 3], temp: [15, 24],
    lures: ["SABIKI", "MJ"], lures2: [], size: "סביקי 10–40 ג׳ · מיקרו-ג׳יג 3–15 ג׳", work: "דגי להקה, גם לפיתיון חי", when: "שחר ודמדומים", min: null },
  { id: "oblada", name: "אובלדה", waters: MED, habitats: ["rock", "mixed", "breakwater", "marina"], layer: "upper", m: span(3, 11), temp: [16, 29], bait: true,
    lures: ["BAIT"], lures2: ["SOFT", "MJ"], size: "", work: "מצוף או LRF, חשדנית — חוט דק", when: "", min: 11 },
  { id: "bogue", name: "גובוס", waters: MED, habitats: ["marina", "port", "breakwater"], layer: "upper", m: ALL, temp: [15, 28], bait: true,
    lures: ["BAIT"], lures2: ["SABIKI"], size: "", work: "מצוף, בצק או שרימפס; סביקי", when: "", min: 11 },
  { id: "lavnun", name: "לבנון (סרדין הכנרת)", waters: ["lake"], habitats: ["lake"], layer: "upper", m: [11, 12, 1, 2, 3], p: [12, 1, 2], temp: [14, 26], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "מצוף עדין, בצק או לחם, קרס זעיר", when: "חורף, להקות ליד החוף", min: 12, note: "בכנרת אסור 'מערך חכות' (כמה קרסים בטור) — בפועל סביקי אסור" },
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
    lures: ["BAIT"], lures2: [], size: "", work: "בויליס, תירס", when: "נובמבר–אפריל", min: null },
  // ---- added 25/10: species from the Cormorant fish catalogue and our research (descriptions in our own words)
  { id: "amberjack", name: "סריולה", waters: MED, habitats: ["port", "breakwater", "rock", "mixed"], layer: "all", m: span(6, 11), p: [8, 9, 10], temp: [19, 29],
    lures: ["POP", "FP"], lures2: ["JIG", "BAIT"], size: "פופר / פנסיל 14–20 ס״מ · ג׳יג אנכי 60–300 ג׳ (מסירה)", work: "טורף חזק שעומד ליד מבנים — ציוד כבד, בלם סגור", when: "שחר ודמדומים", min: null, lat: "Seriola dumerili", active: ["dawn", "dusk"] },
  { id: "pagrus", name: "פגרוס", waters: MED, habitats: ["rock", "reef"], layer: "bottom", m: ALL, temp: [15, 24],
    lures: ["TAI", "BAIT"], lures2: ["JIG"], size: "טאי-ראבר / אינצ׳יקו 40–200 ג׳ (מסירה)", work: "גרירה איטית מעל הקרקעית; מהחוף — פיתיון ליד סלע", when: "שחר ודמדומים", min: 15, lat: "Pagrus pagrus", aka: ["פארידה"], active: ["dawn", "dusk"] },
  { id: "dentex", name: "שינן", waters: MED, habitats: ["rock", "reef"], layer: "bottom", m: ALL, temp: [15, 26],
    lures: ["JIG", "TAI"], lures2: ["SOFT", "BAIT"], size: "ג׳יג אנכי / טאי-ראבר 60–200 ג׳ · שאד 7–30 ג׳", work: "בעיקר מסירה מעל רכסים; טורף — דג חי עובד טוב", when: "שחר ודמדומים", min: 15, lat: "Dentex dentex / D. gibbosus", aka: ["פארידה"], active: ["dawn", "dusk"] },
  { id: "pandora", name: "ג׳רבידה", waters: MED, habitats: ["sand", "rock", "reef"], layer: "bottom", m: [11, 12, 1, 2, 3, 4], temp: [15, 26],
    lures: ["BAIT"], lures2: ["SOFT", "TAI"], size: "", work: "פיתיון (שרימפס, תולעים, רצועת דיונון) על קרקעית; LRF קל", when: "", min: 11, lat: "Pagellus erythrinus", aka: ["ורדית מצויה"], active: ["dawn", "dusk"], bait: true },
  { id: "kingfish", name: "פלמידה לבנה", waters: ALLSEA, habitats: ["port", "breakwater", "rock", "mixed", "reef"], layer: "upper", m: span(7, 11), p: [9, 10], temp: [21, 30],
    lures: ["MIN", "SP"], lures2: ["JIG", "FP"], size: "מינו / סטיקבייט שוקע 15–60 ג׳ · ג׳יג 15–60 ג׳", work: "מהיר; ליידר תיל או פלורו עבה — שיניים חדות", when: "שחר ודמדומים", min: 30, lat: "Scomberomorus commerson", aka: ["סקומברן זריז"], active: ["dawn", "dusk"], note: "מינימום 30 ס״מ (בתקנות: 'פלמידה לבנה')" },
  { id: "whitegrouper", name: "לוקוס לבן (דקר המכמורת)", waters: MED, habitats: ["sand", "estuary", "marina"], layer: "bottom", m: span(4, 11), temp: [17, 29],
    lures: ["SOFT"], lures2: ["MIN", "JIG"], size: "שאד 7–30 ג׳ · ג׳יג אנכי (מסירה)", work: "בעיקר מסירה מעל חול; מהחוף נתפסים צעירים — לרוב מתחת למינימום", when: "שחר ודמדומים", min: 40, lat: "Epinephelus aeneus", active: ["dawn", "dusk"], note: "מינימום 40 ס״מ · מומלץ לשחרר במאי–יוני (רבייה)" },
  { id: "horsemackerel", name: "טרכון (טרולוס)", waters: MED, habitats: ["port", "breakwater", "marina"], layer: "all", m: [11, 12, 1, 2, 3, 4], temp: [15, 26],
    lures: ["SABIKI", "MJ"], lures2: ["SOFT"], size: "סביקי 10–40 ג׳ · מיקרו-ג׳יג 3–15 ג׳", work: "דג להקה בנמלים, בעיקר בלילה ליד אורות; גם פיתיון חי", when: "ערב ולילה", min: 11, lat: "Trachurus spp.", note: "בתקנות 'טרכון' הוא הדג הזה (מינימום 11 ס״מ) — לא הקרנגיד שהדייגים מכנים טרכון", active: ["dusk", "night"] },
  { id: "pompano", name: "טרכינוטוס", waters: MED, habitats: ["sand", "mixed", "breakwater"], layer: "upper", m: span(6, 10), temp: [20, 29],
    lures: ["MJ", "SPOON"], lures2: ["JIG", "MIN", "SOFT"], size: "מיקרו-ג׳יג / כפית 5–20 ג׳", work: "בקו הגלים, איסוף מהיר", when: "שחר ודמדומים", min: null, lat: "Trachinotus ovatus", active: ["dawn", "dusk"] },
  { id: "sweeper", name: "גרזנון", waters: MED, habitats: ["rock", "breakwater", "marina"], layer: "all", m: ALL, temp: [17, 30],
    lures: ["SOFT"], lures2: ["BAIT"], size: "סיליקון LRF 1–5 ג׳", work: "דג לילה במחבואים ובנמלים; קרס קטן", when: "לילה", min: null, lat: "Pempheris rhomboidea", aka: ["גרזית"], active: ["night"] },
  { id: "octopus", name: "תמנון", waters: MED, habitats: ["rock", "breakwater", "marina", "reef"], layer: "bottom", m: [11, 12, 1, 2, 3], temp: [14, 27],
    lures: ["EGI"], lures2: ["BAIT"], size: "אגי / ג׳יג תמנונים", work: "גרירה איטית על הקרקעית, להרים בעדינות", when: "חורף", min: null, lat: "Octopus vulgaris", legal: { eilat: "כל הרכיכות מוגנות באילת" }, active: ["day", "night"] },
  { id: "annularbream", name: "סרגוס הטבעת", waters: MED, habitats: ["rock", "breakwater", "marina"], layer: "bottom", m: ALL, temp: [15, 28], bait: true,
    lures: ["BAIT"], lures2: ["SOFT"], size: "", work: "פיתיון קטן או LRF ליד סלעים", when: "", min: 11, lat: "Diplodus annularis", active: ["dawn", "dusk"] },
  { id: "twobandedbream", name: "סרגוס כתפי", waters: MED, habitats: ["rock", "breakwater", "marina"], layer: "bottom", m: [11, 12, 1, 2, 3, 4], temp: [15, 27], bait: true,
    lures: ["BAIT"], lures2: ["SOFT"], size: "", work: "פיתיון (תולעים, שרימפס, סרטן) ליד סלע; LRF", when: "", min: null, lat: "Diplodus vulgaris", active: ["dawn", "dusk"] },
  { id: "zebrabream", name: "סרגוס הפסים", waters: MED, habitats: ["rock", "reef"], layer: "bottom", m: [11, 12, 1, 2, 3, 4], temp: [15, 26], bait: true,
    lures: ["BAIT"], lures2: [], size: "", work: "סרטן או שרימפס על הקרקעית ליד סלע", when: "", min: 11, lat: "Diplodus cervinus", active: ["dawn", "dusk"], note: "מומלץ לשחרר במאי–יוני (רבייה)" },
  // caution species — shown in the protected / caution list, never recommended
  { id: "lionfish", name: "זהרון", waters: MED, habitats: ["rock", "reef", "breakwater"], layer: "bottom", m: ALL, caution: "ארסי! קוצים שגורמים לכאב חזק — לאחוז רק בכפפה עבה. מין פולש: אין גודל מינימלי ואין מגבלת שלל", lures: [], lures2: [], lat: "Pterois miles" },
  { id: "toadfish", name: "ארנבון כסוף", waters: MED, habitats: ["sand", "rock", "mixed", "breakwater", "marina", "port"], layer: "all", m: ALL, caution: "רעיל קטלנית לאכילה (טטרודוטוקסין) — לא אוכלים בשום מצב. שיניים חותכות חוטים — לשחרר בזהירות", lures: [], lures2: [], lat: "Lagocephalus sceleratus" },
  { id: "stingray", name: "טריגון", waters: MED, habitats: ["sand", "estuary"], layer: "bottom", m: ALL, caution: "מוגן (כל הכרישים והבטאים) — לשחרר מיד. עוקץ ארסי בזנב", protectedIn: ["med"], lures: [], lures2: [], lat: "Dasyatis pastinaca" }
];
// enrichment of the original species (25/10): Latin name, aliases, active hours, colours, missing peak / temperature / legal minimum
const ENRICH = {"bluefish":{"lat":"Pomatomus saltatrix","aka":["כחלן"],"active":["dawn","dusk"],"colors":"לבן, סרדין, כרום"},"seabass":{"lat":"Dicentrarchus labrax","active":["dawn","dusk","night"],"colors":"טבעי במים צלולים · צהוב או זוהר במים עכורים"},"bluerunner":{"lat":"Caranx crysos / Caranx spp.","aka":["קרנגיד","ג׳ק","צנינית"],"active":["dawn","dusk"],"p":[7,8,9],"colors":"כסף / כחול, זוהר בשחר"},"needlefish":{"lat":"Belone belone / Tylosurus spp.","aka":["חרטומן"],"active":["day","dusk"],"p":[6,7,8],"colors":"שקוף, כסף, ירוק"},"bonito":{"lat":"Sarda sarda","aka":["בלמידה"],"active":["dawn","dusk"],"colors":"כסף, כחול-כסף, סרדין"},"tunny":{"lat":"Euthynnus alletteratus","aka":["טונה קטנה"],"active":["dawn","dusk"],"p":[8,9,10],"colors":"כסף, כחול"},"barracuda":{"lat":"Sphyraena spp.","aka":["אספירנה","מליטה"],"active":["dawn","dusk","night"],"colors":"סרדין, כסף, לבן; בלילה זוהר"},"yellowstripe":{"colors":"כסף, זוהר","lat":"Sphyraena chrysotaenia","aka":["ברקודה צהובת פס"],"active":["dawn","dusk"]},"threadfin":{"colors":"כסף","lat":"Alectis alexandrina","aka":["דבשתן ים-תיכוני"],"active":["dawn","dusk"]},"grouper":{"lat":"Epinephelus marginatus","aka":["דאור (דקר הסלעים)","דקר אבות","דקר הסלעים","דאור"],"active":["dawn","dusk"],"colors":"טבעי, חום / ירוק"},"seabream":{"lat":"Diplodus sargus","aka":["סרגוס מצוי"],"active":["dawn","dusk","night"],"colors":"טבעי, סרטן"},"sillago":{"colors":"כסף, ורוד","lat":"Sillago sihama (זיהוי לא מאומת)","active":["day"]},"squid":{"lat":"Loligo vulgaris","aka":["קלמרי","דיונון"],"active":["dusk","night"],"p":[1,2,3,12],"colors":"כתום, ורוד; בלילה זוהר"},"cuttlefish":{"lat":"Sepia officinalis","aka":["ספיה","דיונונית"],"active":["dusk","night"],"p":[1,2,3,4],"colors":"חום, טבעי"},"leerfish":{"lat":"Lichia amia","aka":["ליכיה","ליצ׳ה"],"active":["dawn","dusk"],"p":[11,12],"colors":"לבן, בורי"},"meagre":{"lat":"Argyrosomus regius","active":["dusk","night"],"colors":"לבן, טבעי, זוהר בלילה"},"mahi":{"lat":"Coryphaena hippurus","aka":["דורדו","מהי מהי"],"active":["dawn","day"],"p":[9,10],"colors":"ירוק-צהוב, כחול"},"gilthead":{"lat":"Sparus aurata","aka":["ספרוס זהוב","ספרוס"],"active":["dawn","dusk","night"],"temp":[14,26]},"mullet":{"lat":"Mugil cephalus","aka":["בורי (קיפון)","קיפון","קיפון גדול-ראש"],"active":["dawn","day","dusk"],"temp":[14,30]},"striped":{"lat":"Lithognathus mormyrus","aka":["מורמיר"],"active":["dawn","dusk","night"],"p":[4,5,10],"temp":[16,28]},"redmullet":{"lat":"Mullus barbatus / Mullus surmuletus","aka":["מולית (ברבוניה)","מולית אדומה","מולית הפסים","סולטן אברהים"],"active":["dawn","day","dusk"],"temp":[15,27]},"rabbitfish":{"lat":"Siganus rivulatus / Siganus luridus","active":["day"]},"salema":{"lat":"Sarpa salpa","active":["day"]},"chub":{"lat":"Scomber colias","aka":["מקרל"],"active":["dawn","dusk"],"colors":"כסף, נוצות זוהרות"},"oblada":{"lat":"Oblada melanura","aka":["אובלד","אובלד שחור זנב","מנורן"],"active":["dawn","dusk"]},"bogue":{"lat":"Boops boops","aka":["גובס גליל","גובוס גלילי","בננה","רופוס"],"active":["dawn","day","dusk"]},"lavnun":{"lat":"Mirogrex terraesanctae","aka":["לבנון","סרדין הכנרת"],"active":["dawn","dusk"]},"gt":{"colors":"לבן, כסף, כחול","lat":"Caranx ignobilis","aka":["טרווס ענק"],"active":["dawn","dusk"]},"emperor":{"lat":"Lethrinus spp.","aka":["שורי ערפילי"],"active":["dawn","dusk","night"],"temp":[21,28]},"barbel":{"lat":"Luciobarbus longiceps / Carasobarbus canis","active":["dawn","dusk","night"],"colors":"טבעי, חום, זהב"},"tilapia":{"lat":"Sarotherodon galilaeus / Oreochromis spp.","aka":["מושט","אמנון הגליל","דג פטרוס","אמנון הירדן"],"active":["dawn","day","dusk"],"colors":"זהב, כסף"},"catfish":{"lat":"Clarias gariepinus","active":["dusk","night"],"p":[6,7,8],"temp":[18,31]},"carp":{"lat":"Cyprinus carpio","aka":["שפריון"],"active":["dawn","dusk","night"],"temp":[15,28]},"lizardfish":{"lat":"Synodontidae / Saurida","active":["day"]},"eilatgrouper":{"lat":"Epinephelus spp.","active":["dawn","dusk"]}};
// rigs for bait / float fish
const RIGS = {"gilthead":"SURF","striped":"SURF","meagre":"SURF","redmullet":"SURF","mullet":"FLOAT","salema":"FLOAT","rabbitfish":"FLOAT","oblada":"FLOAT","bogue":"FLOAT","lavnun":"FLOAT","tilapia":"FLOAT","carp":"LEDGER","catfish":"LEDGER","barbel":"LEDGER","annularbream":"FLOAT","twobandedbream":"SURF","zebrabream":"SURF","pandora":"SURF"};
for (const [id, r] of Object.entries(RIGS)) { const s = window.SPECIES.find(q => q.id === id); if (s && !(s.lures2 || []).includes(r)) s.lures2 = (s.lures2 || []).concat(r); }
for (const [id, x] of Object.entries(ENRICH)) { const s = window.SPECIES.find(q => q.id === id); if (s) Object.assign(s, x); }
// seasons (26/10): the collected data is primary — Cormorant monthly calendar (0–3 per month, ≥2 = season, 3 = peak), the current month
// from Strike Point where it lists the fish (levels 1–2 = peak, 3–4 = season); species without a calendar keep the research seasons
const SEASONS = {"bluefish":{"m":[1,10,11,12],"p":[10,11,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"seabass":{"m":[1,2,3,10,11,12],"p":[1,2,10,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"bluerunner":{"m":[6,7,8,9,10],"p":[7,8,9,10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"needlefish":{"m":[5,6,7,8,9,10],"p":[6,7,8,10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"bonito":{"m":[1,2,9,10,11,12],"p":[11,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"tunny":{"m":[7,8,9,10,11],"p":[8,9],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"barracuda":{"m":[4,5,6,7,8,9,10,11],"p":[9,10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"yellowstripe":{"m":[5,6,7,8,9,10,11],"p":[],"src":"המחקר · אוקטובר: Strike Point"},"threadfin":{"m":[6,7,8,9,10],"p":[],"src":"המחקר · אוקטובר: Strike Point"},"grouper":{"m":[4,5,6,7,8,9,10,11],"p":[10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"seabream":{"m":[1,2,3,4,5,9,10,11,12],"p":[1,2,10,11,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"sillago":{"m":[6,7,8,9,10],"p":[10],"src":"המחקר · אוקטובר: Strike Point"},"squid":{"m":[1,2,3,4,10,11,12],"p":[1,2,3,10,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"cuttlefish":{"m":[1,2,3,4,10,11,12],"p":[1,2,3,10,12],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"leerfish":{"m":[1,10,11,12],"p":[11,12],"src":"לוח חודשי: קורמורן"},"meagre":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"mahi":{"m":[8,9,10,11],"p":[9,10],"src":"לוח חודשי: קורמורן"},"gilthead":{"m":[1,2,3,4,10,11,12],"p":[1,2,11,12],"src":"לוח חודשי: קורמורן"},"mullet":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[10,11],"src":"לוח חודשי: קורמורן"},"striped":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[4,5,10],"src":"לוח חודשי: קורמורן"},"redmullet":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"rabbitfish":{"m":[3,4,5,6,7,8,9,10,11,12],"p":[6,7,8,9,10],"src":"לוח חודשי: קורמורן"},"salema":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"chub":{"m":[1,2,3,4,11,12],"p":[1,2,3],"src":"לוח חודשי: קורמורן"},"oblada":{"m":[3,4,5,6,7,8,9,10,11],"p":[],"src":"לוח חודשי: קורמורן"},"bogue":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"lavnun":{"m":[1,2,3,11,12],"p":[1,2,12],"src":"לוח חודשי: קורמורן"},"gt":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[10],"src":"המחקר · אוקטובר: Strike Point"},"emperor":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"lizardfish":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[10],"src":"המחקר · אוקטובר: Strike Point"},"eilatgrouper":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"המחקר"},"barbel":{"m":[3,4,5,6,7,8,9,10,11],"p":[10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"tilapia":{"m":[5,6,7,8,9,10],"p":[10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"catfish":{"m":[4,5,6,7,8,9,10],"p":[6,7,8,10],"src":"לוח חודשי: קורמורן · אוקטובר: Strike Point"},"carp":{"m":[3,4,5,6,9,10,11],"p":[],"src":"לוח חודשי: קורמורן"},"amberjack":{"m":[6,7,8,9,10,11],"p":[8,9,10],"src":"לוח חודשי: קורמורן"},"pagrus":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"dentex":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"pandora":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"kingfish":{"m":[7,8,9,10,11],"p":[9,10],"src":"לוח חודשי: קורמורן"},"whitegrouper":{"m":[4,5,6,7,8,9,10,11],"p":[],"src":"לוח חודשי: קורמורן"},"horsemackerel":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"pompano":{"m":[6,7,8,9,10],"p":[],"src":"לוח חודשי: קורמורן"},"sweeper":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"octopus":{"m":[1,2,3,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"annularbream":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"twobandedbream":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"zebrabream":{"m":[1,2,3,4,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"lionfish":{"m":[1,2,3,4,5,6,7,8,9,10,11,12],"p":[],"src":"לוח חודשי: קורמורן"},"toadfish":{"m":[4,5,6,7,8,9,10,11],"p":[6,7,8,9],"src":"לוח חודשי: קורמורן"},"stingray":{"m":[4,5,6,7,8,9,10],"p":[],"src":"לוח חודשי: קורמורן"}};
for (const [id, x] of Object.entries(SEASONS)) { const q = window.SPECIES.find(z => z.id === id); if (q) { q.m = x.m; q.p = x.p.length ? x.p : undefined; q.src = x.src; } }
window.ACTIVE_NAMES = { dawn: "שחר", day: "יום", dusk: "דמדומים", night: "לילה" };
window.LURE_TYPES = {
  JIG: "ג׳יג מתכת", MJ: "מיקרו-ג׳יג", SP: "פנסיל שוקע", FP: "פנסיל צף / WTD", POP: "פופר", MIN: "מינו", SOFT: "סיליקון",
  EGI: "אגי", BOMB: "ריג בומבט", SPOON: "כפית / ספינר", SABIKI: "סביקי", BAIT: "פיתיון טבעי",
  TAI: "טאי-ראבר / אינצ׳יקו", SURF: "מערכת סרף", FLOAT: "מערכת מצוף", LEDGER: "מערכת קרקעית לאגם"
};
// per lure type: weight range, colours by condition, how to work it, where
window.LURE_INFO = {
  JIG: { w: "15–60 ג׳ מהחוף · 60–300 ג׳ אנכי מסירה", c: "כסף, כחול-כסף; ורוד או זוהר בשחר ובמים עכורים", r: "הטלה רחוקה, לתת לשקוע, איסוף מהיר עם הקפצות", where: "להקות פלגיות, רוח ומרחק" },
  MJ: { w: "3–15 ג׳", c: "כסף, זהב, ורוד", r: "הקפצות קצרות ליד הקרקעית או באמצע", where: "שוברים ונמלים, דגים קטנים וזהירים" },
  SP: { w: "10–30 ג׳ · 8–12 ס״מ", c: "כסף, סרדין; שקוף במים צלולים", r: "איסוף רציף בשכבה העליונה, עצירות קצרות", where: "זרם חוזר, ים עובד" },
  FP: { w: "10–60 ג׳ · 9–15 ס״מ", c: "לבן, כסף, טבעי", r: "זיגזג ('הליכת כלב') על פני המים", where: "שחר, ים נוח" },
  POP: { w: "15–80 ג׳", c: "לבן, כחול-כסף, צבעים בולטים", r: "משיכות קצרות שמתיזות מים, עצירות", where: "טורפים רודפים על פני המים" },
  MIN: { w: "8–30 ג׳ · 9–14 ס״מ", c: "טבעי (בורי, סרדין), לבן, כסף; צהוב או זוהר במים עכורים", r: "איסוף בינוני עם עצירות; ג׳רקים", where: "שחר, שקיעה ולילה ליד שוברים ושפכים" },
  SOFT: { w: "LRF 1–7 ג׳ · שאד 7–30 ג׳", c: "לבן, טבעי, זוהר בלילה; חום / ירוק לדקרים", r: "גרירה איטית ליד הקרקעית והסלעים", where: "סלעים, קרקעית, לילה" },
  EGI: { w: "מידה 2.5–3.5 (10–25 ג׳)", c: "כתום, ורוד, זוהר; גוף מחזיר אור", r: "2–3 הקפצות, שקיעה וריחוף", where: "ערבי חורף ואביב ליד תאורה, מים צלולים (אסור באילת)" },
  BOMB: { w: "בומברדה 15–40 ג׳ + דמוי זעיר", c: "סקוויד לבן / שקוף, נוצות", r: "איסוף אחיד בשכבה העליונה", where: "דגים רחוקים ובררנים" },
  SPOON: { w: "ים 7–40 ג׳ · כנרת 1–3 ג׳", c: "כסף, זהב", r: "הטלה ומשיכה רציפה", where: "טורפים להקתיים; בכנרת — בינית ואמנון" },
  SABIKI: { w: "10–40 ג׳", c: "נוצות וזוהר", r: "הקפצות עדינות", where: "דגי להקה קטנים ופיתיון חי (אסור בכנרת — 'מערך חכות')" },
  TAI: { w: "40–200 ג׳", c: "כתום, אדום, ירוק זוהר", r: "הורדה לקרקעית וגרירה איטית קבועה", where: "מסירה מעל רכסים" },
  SURF: { w: "משקולת 60–150 ג׳", c: "—", r: "הטלה רחוקה מהחול, תולעים או סרטנים, חכה על תמוכה", where: "חוף חולי, בוקר, ערב ולילה" },
  FLOAT: { w: "1–10 ג׳", c: "—", r: "מצוף רגיש, לחם או בצק, האכלה קלה", where: "מים שקטים: נמלים, שפכים, כנרת" },
  LEDGER: { w: "10–40 ג׳", c: "—", r: "משקולת זזה, תירס / בויליס / תולעים", where: "כנרת" },
  BAIT: { w: "—", c: "—", r: "לפי הדג: תולעים, שרימפס, סרטן, דיונון, לחם", where: "" }
};
// lure code -> type filter of the arsenal (script.js); codes without an arsenal lure open the info card only
window.LURE_TO_ARSENAL = { JIG: "jig", MJ: "jig", SP: "minnow", MIN: "minnow", FP: "topwater", POP: "topwater", SOFT: "soft" };
// seasons where the sources disagree (shown on the fish card)
window.SEASON_DISPUTE = {};
})();
