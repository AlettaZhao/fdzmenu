import { useState, useRef, useEffect } from "react";

/*
 *  饭搭子 FanDaZi — 点餐小助手 v6.1
 *  Warm & refined · Chinese food culture inspired
 *
 *  v5 changes:
 *  - Backend migrated from Claude to Kimi (vision model auto-selected for images)
 *  - Extract DEFAULT_AVOIDS / DEFAULT_FLAVORS constants (less repetition)
 *  - Unified button copy and tip wording across steps
 *  - Clearer labels: "过敏 / 忌口", loading text, icons
 *  - Removed 'AI / 智能 / 海外' references from user-visible surface
 *  - Cache generated orders per language (saves API calls on Step 4 switch)
 *  - Confirm before re-recommending if user already picked dishes
 *
 *  v6 changes (code cleanup only — no user-visible behavior change):
 *  - Rename tog → toggle, addC → addCustom
 *  - Extract <PreferenceSection> component (dedupes 忌口 and 口味 cards)
 */

const C = {
  bg: "#FFFBF5", card: "#FFFFFF", accent: "#C43E1C", accentSoft: "#FFF1EC",
  accentDark: "#9A2E12", ink: "#1C1917", sub: "#78716C", muted: "#A8A29E",
  line: "#F0EBE3", green: "#16A34A", greenBg: "#F0FDF4", amber: "#B45309",
  amberBg: "#FFFBEB", red: "#DC2626", redBg: "#FEF2F2",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
  shadowUp: "0 -2px 16px rgba(0,0,0,0.06)", r: "16px", rs: "12px",
};
const font = `'Noto Sans SC','PingFang SC','Helvetica Neue',sans-serif`;
const fontSerif = `'Noto Serif SC','Songti SC',Georgia,serif`;

const GlobalCSS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${C.bg}; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
    @keyframes spin { to { transform: rotate(360deg) } }
    @keyframes popIn { 0% { transform: scale(0.85); opacity:0 } 60% { transform: scale(1.04) } 100% { transform: scale(1); opacity:1 } }
    @keyframes confettiFall { 0% { transform: translateY(-50px) rotate(0deg); opacity:1 } 80% { opacity:1 } 100% { transform: translateY(100vh) rotate(540deg); opacity:0 } }
    @keyframes bannerIn { 0%,100% { transform: translate(-50%,-50%) scale(0); opacity:0 } 12% { transform: translate(-50%,-50%) scale(1.08); opacity:1 } 75% { transform: translate(-50%,-50%) scale(1); opacity:1 } 100% { transform: translate(-50%,-50%) scale(0.9); opacity:0 } }
    @keyframes heartBeat { 0% { transform: scale(1) } 25% { transform: scale(1.3) } 50% { transform: scale(0.95) } 100% { transform: scale(1) } }
    .fav-btn:active { animation: heartBeat 0.3s ease; }
    .cat-scroll::-webkit-scrollbar { display: none; }
  `}</style>
);

// ── Primitives ──
const Pill = ({ children, active, onClick, style = {} }) => (
  <span onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "7px 16px", borderRadius: "100px", fontSize: "13px",
    fontWeight: active ? 600 : 500, fontFamily: font,
    cursor: "pointer", transition: "all 0.15s", userSelect: "none",
    background: active ? C.accent : C.card, color: active ? "#fff" : C.sub,
    border: `1.5px solid ${active ? C.accent : C.line}`,
    boxShadow: active ? `0 2px 8px ${C.accent}30` : "none", ...style,
  }}>{children}{active && <span style={{ fontSize: "11px", opacity: 0.9 }}>✕</span>}</span>
);

const SmallPill = ({ children, active, onClick, accent }) => (
  <span onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: "3px",
    padding: "5px 12px", borderRadius: "100px", fontSize: "12px",
    fontWeight: active ? 600 : 500, fontFamily: font, whiteSpace: "nowrap",
    cursor: "pointer", transition: "all 0.15s", userSelect: "none",
    background: active ? (accent || C.accent) : C.bg,
    color: active ? "#fff" : C.sub,
    border: `1px solid ${active ? (accent || C.accent) : C.line}`,
  }}>{children}</span>
);

const Button = ({ children, onClick, variant = "primary", disabled, style = {} }) => {
  const styles = {
    primary: { bg: C.accent, color: "#fff", shadow: `0 4px 14px ${C.accent}35`, border: "none" },
    secondary: { bg: C.line, color: C.ink, shadow: "none", border: "none" },
    outline: { bg: "transparent", color: C.accent, shadow: "none", border: `1.5px solid ${C.accent}` },
    green: { bg: C.green, color: "#fff", shadow: `0 4px 14px ${C.green}30`, border: "none" },
    ghost: { bg: "transparent", color: C.sub, shadow: "none", border: "none" },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "13px 24px", borderRadius: C.rs, fontWeight: 600, fontSize: "15px",
      fontFamily: font, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1, transition: "all 0.2s",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
      background: s.bg, color: s.color, boxShadow: s.shadow, border: s.border, ...style,
    }}>{children}</button>
  );
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, borderRadius: C.r, padding: "20px", marginBottom: "14px", boxShadow: C.shadow, ...style }}>{children}</div>
);

const SectionTitle = ({ icon, children }) => (
  <h3 style={{ fontSize: "15px", fontWeight: 700, fontFamily: font, color: C.ink, margin: "0 0 12px", display: "flex", alignItems: "center", gap: "8px" }}>
    <span style={{ fontSize: "17px" }}>{icon}</span>{children}
  </h3>
);

const StepBar = ({ current }) => {
  const steps = ["拍菜单", "看菜品", "设偏好", "选推荐", "去点餐"];
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1px", marginBottom: "22px", padding: "0 2px" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "1px" }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", fontSize: "10px", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: i < current ? C.green : i === current ? C.accent : C.line,
            color: i <= current ? "#fff" : C.muted, transition: "all 0.3s ease",
          }}>{i < current ? "✓" : i + 1}</div>
          <span style={{ fontSize: "10px", fontWeight: i === current ? 700 : 400, color: i <= current ? C.ink : C.muted, fontFamily: font, marginLeft: "2px" }}>{s}</span>
          {i < 4 && <div style={{ width: 12, height: 1.5, background: i < current ? C.green : C.line, borderRadius: 2, margin: "0 2px" }} />}
        </div>
      ))}
    </div>
  );
};

const Loading = ({ text }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "56px 20px" }}>
    <div style={{ position: "relative", width: 56, height: 56 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${C.line}`, borderTopColor: C.accent, animation: "spin 0.8s linear infinite" }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>🥢</span>
    </div>
    <p style={{ color: C.ink, fontSize: "15px", fontWeight: 600, textAlign: "center" }}>{text}</p>
  </div>
);

const Celebration = ({ show }) => {
  const [vis, setVis] = useState(false);
  useEffect(() => { if (show) { setVis(true); const t = setTimeout(() => setVis(false), 4200); return () => clearTimeout(t); } }, [show]);
  if (!vis) return null;
  const items = ["🎉","🍜","🥂","🍕","🎊","🥟","🍣","🥘","🍻","✨","🍔","🥗"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999 }}>
      {/* Confetti layer — sits behind the banner so falling emoji never overlap the card */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden" }}>
        {items.map((e, i) => (
          <div key={i} style={{ position: "absolute", top: -40, left: `${6 + (i * 8) % 88}%`, fontSize: `${18 + (i % 4) * 5}px`, animation: `confettiFall ${2 + (i % 3) * 0.7}s ease-in ${i * 0.12}s forwards` }}>{e}</div>
        ))}
      </div>
      {/* Banner — opaque background + higher z-index, so confetti can never bleed through */}
      <div style={{ position: "absolute", top: "36%", left: "50%", zIndex: 2, animation: "bannerIn 4s ease-in-out forwards", background: "#fff", borderRadius: "20px", padding: "28px 40px", boxShadow: "0 12px 48px rgba(0,0,0,0.15)", textAlign: "center", minWidth: "240px" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "14px", fontSize: "40px", lineHeight: 1, marginBottom: "12px" }}>
          <span>🎉</span>
          <span>🍽️</span>
          <span>🎉</span>
        </div>
        <p style={{ fontSize: "22px", fontWeight: 700, color: C.accent, fontFamily: fontSerif, margin: "0 0 4px" }}>点餐完成！</p>
        <p style={{ fontSize: "14px", color: C.sub }}>祝你用餐愉快，好好享受吧～</p>
      </div>
    </div>
  );
};

function safeParse(raw) {
  let t = raw.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = Math.min(t.indexOf('[') >= 0 ? t.indexOf('[') : Infinity, t.indexOf('{') >= 0 ? t.indexOf('{') : Infinity);
  if (first !== Infinity && first > 0) t = t.slice(first);
  try { return JSON.parse(t); } catch {}
  const a = t.match(/\[[\s\S]*\]/);
  if (a) try { return JSON.parse(a[0]); } catch {}
  const o = t.match(/\{[\s\S]*\}/);
  if (o) try { return JSON.parse(o[0]); } catch {}
  let f = t.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(f); } catch {}
  f = t.replace(/(?<=:\s*"[^"]*)\n/g, '\\n');
  try { return JSON.parse(f); } catch {}
  throw new Error("解析失败，请再试一次");
}

// ── Preference defaults (used when menu-specific tags can't be extracted) ──
const DEFAULT_AVOIDS = ["海鲜", "猪肉", "牛肉", "鸡肉", "羊肉", "乳制品", "坚果", "麸质", "蛋类", "香菜", "洋葱", "蘑菇"];
const DEFAULT_FLAVORS = ["辣", "酸", "甜", "咸鲜", "烧烤/煎烤", "汤类", "面食", "米饭", "蔬菜", "土豆", "芝士", "肉食"];

// ── Language config ──
const LANGS = [
  { key: "en", label: "English", flag: "🇬🇧", short: "英语", prompt: "in English, as a native English speaker would naturally say" },
  { key: "ja", label: "日本語", flag: "🇯🇵", short: "日语", prompt: "in Japanese (日本語), using polite keigo (丁寧語/です・ます). Write like a native Japanese speaker ordering at a restaurant" },
  { key: "it", label: "Italiano", flag: "🇮🇹", short: "意大利语", prompt: "in Italian (Italiano), using the polite Lei form. Write like a native Italian ordering at a trattoria" },
  { key: "fr", label: "Français", flag: "🇫🇷", short: "法语", prompt: "in French (Français), using the polite vous form. Write like a native French speaker at a restaurant" },
  { key: "de", label: "Deutsch", flag: "🇩🇪", short: "德语", prompt: "in German (Deutsch), using the polite Sie form. Write like a native German speaker ordering at a restaurant" },
  { key: "es", label: "Español", flag: "🇪🇸", short: "西班牙语", prompt: "in Spanish (Español), using the polite usted form. Write like a native Spanish speaker at a restaurant" },
  { key: "ko", label: "한국어", flag: "🇰🇷", short: "韩语", prompt: "in Korean (한국어), using polite 존댓말 (jondaenmal). Write like a native Korean speaker ordering at a restaurant" },
];

// ── Category display ──
const CAT_ICONS = {
  "前菜": "🥗", "开胃菜": "🥗", "沙拉": "🥗", "appetizer": "🥗", "starter": "🥗", "salad": "🥗", "antipasti": "🥗", "entrée": "🥗", "hors": "🥗",
  "主食": "🍝", "主菜": "🍝", "pasta": "🍝", "main": "🍝", "piatti": "🍝", "plat": "🍝", "secondi": "🍝", "primi": "🍝",
  "汤": "🍲", "soup": "🍲", "zuppa": "🍲", "soupe": "🍲", "suppe": "🍲", "potage": "🍲",
  "肉类": "🥩", "meat": "🥩", "carne": "🥩", "viande": "🥩", "fleisch": "🥩", "grill": "🥩",
  "海鲜": "🐟", "鱼": "🐟", "fish": "🐟", "seafood": "🐟", "pesce": "🐟", "poisson": "🐟", "fisch": "🐟", "fruits de mer": "🐟",
  "披萨": "🍕", "pizza": "🍕",
  "甜品": "🍰", "甜点": "🍰", "dessert": "🍰", "dolci": "🍰", "pâtisserie": "🍰",
  "饮品": "🥤", "饮料": "🥤", "drink": "🥤", "beverage": "🥤", "bevande": "🥤", "boisson": "🥤", "getränke": "🥤",
  "酒": "🍷", "wine": "🍷", "vino": "🍷", "vin": "🍷", "wein": "🍷", "beer": "🍺", "birra": "🍺", "bière": "🍺", "bier": "🍺",
  "咖啡": "☕", "coffee": "☕", "caffè": "☕", "café": "☕", "kaffee": "☕",
  "小吃": "🍢", "side": "🍢", "contorni": "🍢", "beilage": "🍢", "accompagnement": "🍢",
};

function getCatIcon(cat) {
  if (!cat) return "🍽";
  const lower = cat.toLowerCase().trim();
  for (const [key, icon] of Object.entries(CAT_ICONS)) {
    if (lower.includes(key.toLowerCase())) return icon;
  }
  return "🍽";
}

// ══════════════════ APP ══════════════════
export default function FanDaZi() {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadText, setLoadText] = useState("");
  const [error, setError] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  const [party, setParty] = useState(2);
  const [avoids, setAvoids] = useState([]);
  const [customAvoid, setCustomAvoid] = useState("");
  const [likes, setLikes] = useState([]);
  const [customLike, setCustomLike] = useState("");
  const [spice, setSpice] = useState(1);
  const [notes, setNotes] = useState("");

  const [menuItems, setMenuItems] = useState([]);
  const [menuTags, setMenuTags] = useState({ ingredients: [], flavors: [] });
  const [detectedLang, setDetectedLang] = useState("en");
  const [favorites, setFavorites] = useState([]);
  const [activeCat, setActiveCat] = useState("全部");

  const [recs, setRecs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [orderLang, setOrderLang] = useState("en");
  const [order, setOrder] = useState(null);
  const [orderCache, setOrderCache] = useState({}); // { [langKey]: orderObject } — cached per completed Step 4 session
  const [copied, setCopied] = useState(false);

  const fileRef = useRef();
  const spiceLabels = ["不辣", "微辣", "中辣", "重辣"];
  const spiceIcons = ["😌", "🌶️", "🌶️🌶️", "🔥"];

  const curLang = LANGS.find(l => l.key === orderLang) || LANGS[0];

  const toggle = (list, set, v) => set(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const addCustom = (val, list, set, clear) => { const v = val.trim(); if (v && !list.includes(v)) { set(p => [...p, v]); clear(""); } };

  // ── Derived: categories ──
  const categories = (() => {
    const cats = {};
    menuItems.forEach((item, idx) => {
      const cat = item.category || "其他";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(idx);
    });
    return cats;
  })();
  const categoryNames = Object.keys(categories);

  // ── Filtered items for overview ──
  const filteredIndices = activeCat === "❤️ 已收藏"
    ? favorites
    : activeCat === "全部"
      ? menuItems.map((_, i) => i)
      : (categories[activeCat] || []);

  // ── Price helpers ──
  const parsePrice = (s) => { if (!s) return null; const m = s.replace(/,/g, '.').match(/[\d.]+/); return m ? parseFloat(m[0]) : null; };
  const getCurrency = (s) => { if (!s) return ""; return s.replace(/[\d.,\s]/g, "").trim(); };
  const selTotal = selected.reduce((sum, i) => { const p = parsePrice(recs[i]?.price); return p !== null ? sum + p : sum; }, 0);
  const selCurr = selected.length > 0 ? getCurrency(recs[selected[0]]?.price) : "";
  const allPriced = selected.length > 0 && selected.every(i => parsePrice(recs[i]?.price) !== null);

  // ── Image compress ──
  // Creates a blob URL, waits for the image to decode, draws onto a canvas, and
  // revokes the blob URL before resolving — so we don't leak one URL per upload.
  const compress = (file, maxW = 1200, q = 0.6) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      URL.revokeObjectURL(url);
      resolve({ dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });

  // ── Multi-file upload ──
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      const compressed = await Promise.all(files.map(f => compress(f)));
      setImages(prev => [...prev, ...compressed]);
    } catch (err) {
      setError(err.message || "图片处理失败，请换一张试试");
    } finally {
      e.target.value = "";
    }
  };

  // ── AI request (backend proxy auto-selects Kimi model) ──
  // signal: optional AbortSignal — used by the Step 3 background prefetch so we can
  // cancel in-flight requests when the user changes their selection.
  const ask = async (msgs, retries = 1, signal) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max_tokens: 4096, messages: msgs }),
          signal,
        });
        if (!r.ok) throw new Error(`请求失败 (${r.status})`);
        const d = await r.json();
        const t = (d.content || []).map(c => c.text || "").join("");
        if (!t) throw new Error("返回为空，请再试一次");
        return t;
      } catch (err) {
        // Don't retry on user-triggered abort — propagate immediately
        if (err.name === 'AbortError') throw err;
        if (i === retries) throw err;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  // ── Detect menu language ──
  const detectLang = (items) => {
    const sample = items.slice(0, 10).map(i => i.name).join(" ");
    if (/[äöüß]/i.test(sample)) return "de";
    if (/[àâêéèëïîôùûüÿçœæ]/i.test(sample) && !/[ìòù]/i.test(sample)) return "fr";
    if (/[àèéìíîòóùú]/i.test(sample)) return "it";
    if (/[áéíóúñ¿¡]/i.test(sample)) return "es";
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(sample) && /[\u3040-\u30ff]/.test(sample)) return "ja";
    if (/[\uac00-\ud7af]/.test(sample)) return "ko";
    return "en";
  };

  // ── Step 0→1: Recognize + translate descriptions + extract tags ──
  const doRecognize = async () => {
    setLoading(true); setError(null);
    setLoadText(images.length > 1 ? `正在识别 ${images.length} 页菜单...` : "正在识别菜单...");
    try {
      const recognizeOne = async (img, idx) => {
        const raw = await ask([{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
          { type: "text", text: `You are a menu OCR expert. This is page ${idx + 1} of a restaurant menu. Extract ALL menu items.
Return ONLY a JSON array. Each element:
{"name":"dish name exactly as written on menu","price":"price with currency or null","category":"menu section as written (e.g. Antipasti, Primi, Desserts)","description":"original description or null","zhDesc":"用简短中文描述这道菜（食材和做法，10字以内）"}
Start with [ end with ]. No markdown.` }
        ]}]);
        return safeParse(raw);
      };

      let allItems;
      if (images.length === 1) {
        allItems = await recognizeOne(images[0], 0);
      } else {
        const results = await Promise.all(images.map((img, i) => recognizeOne(img, i)));
        const seen = new Set();
        allItems = [];
        results.flat().forEach(item => {
          if (Array.isArray(item)) return;
          const key = item.name?.toLowerCase().trim();
          if (key && !seen.has(key)) { seen.add(key); allItems.push(item); }
        });
      }
      if (!Array.isArray(allItems) || !allItems.length) throw new Error("没看清菜单，换个角度再拍一张试试");

      const lang = detectLang(allItems);
      setDetectedLang(lang);
      setOrderLang(lang);
      setMenuItems(allItems);
      setFavorites([]);
      setActiveCat("全部");
      setMenuTags({ ingredients: [], flavors: [] }); // fallback defaults; may be overwritten by background task

      // ── Navigate immediately; extract dynamic tags in the background ──
      // This removes a blocking round-trip from the Step 0 → Step 1 transition.
      // The user browses the menu on Step 1 while tags are being computed; tags only
      // matter on Step 2 (偏好设置), by which time they have usually already arrived.
      setStep(1);
      setLoading(false);

      (async () => {
        try {
          const itemList = allItems.map(m => `${m.name}${m.zhDesc ? "(" + m.zhDesc + ")" : ""}`).join("\n");
          const tagRaw = await ask([{ role: "user", content: `Based on this restaurant menu, identify what's available.

MENU:
${itemList}

Return ONLY JSON:
{
  "ingredients": ["only ingredient categories actually on this menu, in Chinese — choose from: 海鲜, 猪肉, 牛肉, 鸡肉, 羊肉, 乳制品, 坚果, 蛋类, 蘑菇, 甲壳类, 豆类, 麸质"],
  "flavors": ["only flavor profiles available on this menu, in Chinese — choose from: 辣, 酸, 甜, 咸鲜, 烧烤/煎烤, 奶油/浓郁, 清淡, 烟熏, 香草"]
}
Be precise — only include what genuinely appears. Start with { end with }.` }]);
          const tags = safeParse(tagRaw);
          if (tags && Array.isArray(tags.ingredients) && Array.isArray(tags.flavors)) {
            setMenuTags({ ingredients: tags.ingredients, flavors: tags.flavors });
          }
        } catch {
          // silent — default tags are already in place
        }
      })();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  // ── Step 2→3: Recommend ──
  const doRecommend = async () => {
    // If the user already picked dishes from a previous recommendation,
    // warn them that re-recommending will clear those picks.
    if (selected.length > 0) {
      const ok = window.confirm(`重新推荐会清空之前已选的 ${selected.length} 道菜，继续吗？`);
      if (!ok) return;
    }
    setLoading(true); setLoadText("饭搭子正在搭配中..."); setError(null);
    try {
      const min = Math.max(3, party + 1), max = Math.min(Math.max(5, party * 2), menuItems.length, 10);
      const favInfo = favorites.length > 0
        ? `\n\nUSER FAVORITES (user is interested in these — prioritize but ensure variety):\n${favorites.map(i => menuItems[i].name).join(", ")}`
        : "";
      const raw = await ask([{ role: "user", content: `You're a food expert helping ${party} Chinese travelers order abroad.

MENU:
${menuItems.map((m, i) => `${i + 1}. ${m.name}${m.price ? " " + m.price : ""}${m.zhDesc ? "（" + m.zhDesc + "）" : ""} [${m.category || "Other"}]`).join("\n")}

AVOID: ${avoids.join("、") || "无"}
LIKES: ${likes.join("、") || "无特别偏好"}
SPICE: ${spiceLabels[spice]}
NOTES: ${notes || "无"}${favInfo}

Pick ${min}-${max} dishes for ${party} people. Good variety (appetizer + main + maybe dessert). STRICTLY exclude avoided ingredients.
Return ONLY JSON array: [{"name":"exact menu name","price":"or null","zhName":"中文名","reason":"一句话推荐理由（中文）","taste":"口感描述，用中国人熟悉的比喻（中文）","ingredients":"主要食材（中文）","score":4,"warning":"忌口提醒或null"}]
score 1-5. Start with [ end with ].` }]);
      const r = safeParse(raw);
      if (!Array.isArray(r) || !r.length) throw new Error("推荐失败，请重试");
      r.forEach(x => x.score = parseInt(x.score) || 3);
      setRecs(r); setSelected([]); setStep(3);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  // Prompt used by both the user-initiated Step 3→4 transition AND the background
  // prefetch. Keep the two paths in a single helper so they can never drift.
  const buildOrderPrompt = (lang, dishes) => `Help Chinese tourists order at a restaurant. Write ${lang.prompt}.

Sound completely natural — like a local regular politely ordering. Colloquial but polite.

Party: ${party}
Dishes: ${dishes.map(d => d.name).join(", ")}
Allergies: ${avoids.join(", ") || "none"}
Requests: ${notes || "none"}

Return ONLY JSON:
{
  "order": "${lang.label} order for the waiter (greeting, party size, all dishes, allergies, requests — natural local style)",
  "chinese": "逐句中文对照翻译",
  "tips": "1-2条实用点餐小贴士（中文）"
}
Start { end }. Nothing else.`;

  // ── Step 3→4: Generate order ──
  const doOrder = async (langOverride) => {
    if (!selected.length) return;
    const lang = LANGS.find(l => l.key === (langOverride || orderLang)) || LANGS[0];
    setOrderLang(lang.key); // keep state in sync whether cache hit or API call
    const isFirstTransition = step !== 4; // only celebrate on the initial step-3→step-4 jump

    // Cache hit: switch language instantly without hitting the API.
    // On Step 3, the background prefetch may have already populated this for the
    // current orderLang — in which case this branch makes the transition feel instant.
    if (orderCache[lang.key]) {
      setOrder(orderCache[lang.key]);
      if (isFirstTransition) { setStep(4); setCelebrate(true); }
      return;
    }

    setCelebrate(false); // reset first so the animation can re-fire on a later re-generate
    setLoading(true); setLoadText(`正在生成${lang.short}话术...`); setError(null);
    try {
      const dishes = selected.map(i => recs[i]);
      const raw = await ask([{ role: "user", content: buildOrderPrompt(lang, dishes) }]);
      const res = safeParse(raw);
      if (!res.order) throw new Error("生成不完整，请重试");
      setOrder(res);
      setOrderCache(prev => ({ ...prev, [lang.key]: res }));
      setStep(4);
      if (isFirstTransition) setCelebrate(true); // only after a successful first generation
    } catch (e) { console.error("Order error:", e); setError(e.message); } finally { setLoading(false); }
  };

  // ── P2: Prefetch Step 4 order translation while the user is still in Step 3 ──
  // After 800ms of idle time on a non-empty selection, quietly generate the order
  // for the current orderLang and drop it into orderCache. When the user clicks
  // "生成点单口语", doOrder hits the cache branch above and transitions instantly.
  //
  // Invariants:
  // - Any change to selection / preferences wipes orderCache first, so doOrder
  //   never serves a stale translation that belongs to a previous selection.
  // - Every scheduled prefetch owns an AbortController; the effect cleanup cancels
  //   both the pending timer and any in-flight fetch, so rapid picking never
  //   stacks concurrent requests.
  // - retries=0 for prefetch: we don't want to burn tokens on transient failures;
  //   if the user actually clicks, doOrder runs with normal retry behavior.
  useEffect(() => {
    if (step !== 3) return;

    // Selection or preferences changed → any prior cached order is stale
    setOrderCache({});

    if (selected.length === 0) return;

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const lang = LANGS.find(l => l.key === orderLang) || LANGS[0];
      try {
        const dishes = selected.map(i => recs[i]).filter(Boolean);
        if (dishes.length === 0) return;
        const raw = await ask(
          [{ role: "user", content: buildOrderPrompt(lang, dishes) }],
          0,
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        const res = safeParse(raw);
        if (res && res.order) {
          // Guard against overwriting a value doOrder may have just written
          setOrderCache(prev => prev[lang.key] ? prev : { ...prev, [lang.key]: res });
        }
      } catch {
        // silent — prefetch is best-effort; doOrder handles real errors on click
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // buildOrderPrompt/ask are stable closures over the listed deps; excluding them
    // avoids re-firing the effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selected, orderLang, recs, party, avoids, notes]);

  const doCopy = (t) => { navigator.clipboard?.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const reset = () => {
    setStep(0); setImages([]); setMenuItems([]); setMenuTags({ ingredients: [], flavors: [] });
    setRecs([]); setSelected([]); setOrder(null); setOrderCache({}); setCelebrate(false);
    setOrderLang("en"); setDetectedLang("en"); setFavorites([]); setActiveCat("全部");
  };
  const Stars = ({ n }) => <span style={{ color: "#F59E0B", fontSize: "13px", letterSpacing: "2px" }}>{"★".repeat(Math.min(n, 5))}{"☆".repeat(Math.max(5 - n, 0))}</span>;

  // ── Preference section (shared by 忌口 and 喜欢口味) ──
  const PreferenceSection = ({ icon, title, hint, options, selected, setSelected, inputValue, setInputValue, inputPlaceholder }) => (
    <Card>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <p style={{ fontSize: "11px", color: C.muted, marginBottom: "8px" }}>{hint}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        {options.map(x =>
          <Pill key={x} active={selected.includes(x)} onClick={() => toggle(selected, setSelected, x)}>{x}</Pill>
        )}
        {selected.filter(x => !options.includes(x)).map(x =>
          <Pill key={x} active onClick={() => toggle(selected, setSelected, x)}>{x}</Pill>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={inputPlaceholder}
          onKeyDown={e => e.key === "Enter" && addCustom(inputValue, selected, setSelected, setInputValue)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: C.rs, border: `1px solid ${C.line}`, fontSize: "13px", fontFamily: font, outline: "none" }} />
        <Button variant="secondary" onClick={() => addCustom(inputValue, selected, setSelected, setInputValue)} style={{ padding: "8px 14px", fontSize: "13px" }}>添加</Button>
      </div>
    </Card>
  );

  // ── Menu item card (reusable) ──
  const MenuItem = ({ idx }) => {
    const item = menuItems[idx];
    const isFav = favorites.includes(idx);
    return (
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "10px",
        padding: "12px 14px", marginBottom: "6px", borderRadius: C.rs,
        background: isFav ? C.accentSoft : C.card,
        border: `1px solid ${isFav ? C.accent + "30" : "transparent"}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        transition: "all 0.15s",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{item.name}</span>
            {item.price && <span style={{ fontSize: "13px", fontWeight: 700, color: C.accent, flexShrink: 0 }}>{item.price}</span>}
          </div>
          {item.zhDesc && (
            <p style={{ fontSize: "12px", color: C.sub, margin: "3px 0 0", lineHeight: 1.4 }}>{item.zhDesc}</p>
          )}
        </div>
        <button className="fav-btn" onClick={() => toggle(favorites, setFavorites, idx)} style={{
          width: 30, height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
          background: isFav ? C.accent : C.bg, color: isFav ? "#fff" : C.muted,
          fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.2s",
          boxShadow: isFav ? `0 2px 8px ${C.accent}30` : "none",
        }}>
          {isFav ? "♥" : "♡"}
        </button>
      </div>
    );
  };

  // ══════════ RENDER ══════════
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font, color: C.ink, maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <GlobalCSS />
      <Celebration show={celebrate} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.accent} 0%, ${C.accentDark} 100%)`,
        padding: "32px 20px 24px", color: "#fff", textAlign: "center",
        borderRadius: "0 0 24px 24px", marginBottom: "18px",
        boxShadow: `0 8px 32px ${C.accent}20`, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, background: "repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 12px)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", marginBottom: "8px" }}>🥢</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, fontFamily: fontSerif, letterSpacing: "2px", margin: 0 }}>饭搭子</h1>
          <p style={{ fontSize: "10px", opacity: 0.5, letterSpacing: "3px", marginTop: "2px" }}>FANDAZI</p>
          <p style={{ fontSize: "12px", opacity: 0.85, marginTop: "6px" }}>拍菜单 · 懂你口味 · 帮你点餐</p>
        </div>
      </div>

      <div style={{ padding: "0 16px 40px" }}>
        <StepBar current={step} />

        {error && (
          <div style={{ background: C.redBg, border: "1px solid #FCA5A5", borderRadius: C.rs, padding: "12px 16px", marginBottom: "14px", color: C.red, fontSize: "13px", lineHeight: 1.5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>⚠️ {error}</span>
            <span onClick={() => setError(null)} style={{ cursor: "pointer", fontWeight: 700, fontSize: "16px", lineHeight: 1, flexShrink: 0 }}>×</span>
          </div>
        )}

        {loading ? <Loading text={loadText} /> : (
          <>
            {/* ═══ STEP 0 · 拍菜单 ═══ */}
            {step === 0 && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                {images.length > 0 && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: images.length === 1 ? "1fr" : "1fr 1fr", gap: "10px" }}>
                      {images.map((img, i) => (
                        <div key={i} style={{ position: "relative", borderRadius: C.rs, overflow: "hidden", border: `2px solid ${C.green}`, boxShadow: C.shadow, animation: "popIn 0.3s ease forwards", animationDelay: `${i * 0.08}s` }}>
                          <img src={img.dataUrl} alt={`菜单 ${i + 1}`} style={{ width: "100%", display: "block", maxHeight: images.length === 1 ? "280px" : "160px", objectFit: "cover" }} />
                          <span style={{ position: "absolute", bottom: 6, left: 6, padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.5)" }}>第{i + 1}页</span>
                          <button onClick={(e) => { e.stopPropagation(); setImages(p => p.filter((_, j) => j !== i)); }} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "12px", color: C.green, marginTop: "8px", textAlign: "center", fontWeight: 600 }}>
                      ✓ 已添加 {images.length} 页菜单
                    </p>
                  </div>
                )}

                <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${images.length ? C.line : C.muted}`, borderRadius: C.r, padding: images.length ? "16px" : "44px 20px", textAlign: "center", cursor: "pointer", background: C.card, transition: "all 0.15s" }}>
                  {images.length ? (
                    <><span style={{ fontSize: "20px" }}>＋</span><p style={{ fontSize: "13px", fontWeight: 600, margin: "4px 0 0", color: C.sub }}>继续添加下一页</p></>
                  ) : (
                    <><div style={{ fontSize: "40px", marginBottom: "10px" }}>📷</div><p style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>拍照或上传菜单</p><p style={{ fontSize: "13px", color: C.sub }}>可多选，支持一次添加多页</p></>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: "none" }} />

                {images.length > 0 && (
                  <div style={{ marginTop: "14px", display: "flex", gap: "10px" }}>
                    <Button onClick={() => setImages([])} variant="secondary" style={{ flex: 1 }}>重拍</Button>
                    <Button onClick={doRecognize} style={{ flex: 2 }}>🔍 开始识别{images.length > 1 ? ` (${images.length}页)` : ""}</Button>
                  </div>
                )}

                <div style={{ marginTop: "18px", padding: "12px 16px", background: C.amberBg, borderRadius: C.rs, fontSize: "12px", color: C.amber, lineHeight: 1.7 }}>
                  💡 <strong>饭搭子提醒</strong>　菜单每页都拍下来，饭搭子帮你看懂、挑菜、写好点餐话术，直接给服务员看就行
                </div>
              </div>
            )}

            {/* ═══ STEP 1 · 菜单总览 ═══ */}
            {step === 1 && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                {/* Success banner */}
                <div style={{ background: C.greenBg, borderRadius: C.rs, padding: "10px 16px", marginBottom: "14px", textAlign: "center", fontSize: "13px", color: C.green, lineHeight: 1.6 }}>
                  ✓ 共识别 <strong style={{ fontSize: "18px", color: C.accent, margin: "0 2px" }}>{menuItems.length}</strong> 道菜品
                  {categoryNames.length > 1 && <span style={{ color: C.sub }}> · {categoryNames.length} 个分类</span>}
                  {favorites.length > 0 && <span> · 已收藏 <strong style={{ color: C.accent }}>{favorites.length}</strong> 道</span>}
                  {favorites.length === 0 && (
                    <p style={{ fontSize: "11px", color: C.sub, marginTop: "2px", fontWeight: 400 }}>
                      点 ♡ 收藏感兴趣的菜，推荐时会优先
                    </p>
                  )}
                </div>

                {/* Category tabs */}
                <div className="cat-scroll" style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "10px", marginBottom: "10px" }}>
                  <SmallPill active={activeCat === "全部"} onClick={() => setActiveCat("全部")}>
                    全部 {menuItems.length}
                  </SmallPill>
                  {favorites.length > 0 && (
                    <SmallPill active={activeCat === "❤️ 已收藏"} onClick={() => setActiveCat("❤️ 已收藏")} accent={C.red}>
                      ❤️ 已收藏 {favorites.length}
                    </SmallPill>
                  )}
                  {categoryNames.map(cat => (
                    <SmallPill key={cat} active={activeCat === cat} onClick={() => setActiveCat(cat)}>
                      {getCatIcon(cat)} {cat} {categories[cat].length}
                    </SmallPill>
                  ))}
                </div>

                {/* Menu items */}
                {activeCat === "全部" && categoryNames.length > 1 ? (
                  categoryNames.map(cat => (
                    <div key={cat} style={{ marginBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", padding: "4px 0" }}>
                        <span style={{ fontSize: "15px" }}>{getCatIcon(cat)}</span>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: C.ink }}>{cat}</span>
                        <span style={{ fontSize: "11px", color: C.muted }}>({categories[cat].length})</span>
                        <div style={{ flex: 1, height: 1, background: C.line, marginLeft: "6px" }} />
                      </div>
                      {categories[cat].map(idx => <MenuItem key={idx} idx={idx} />)}
                    </div>
                  ))
                ) : filteredIndices.length > 0 ? (
                  filteredIndices.map(idx => <MenuItem key={idx} idx={idx} />)
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 20px", color: C.muted, fontSize: "14px" }}>
                    {activeCat === "❤️ 已收藏" ? "还没有收藏任何菜品，点 ♡ 添加吧" : "没有找到菜品"}
                  </div>
                )}

                {/* Bottom spacing for sticky bar */}
                <div style={{ height: "80px" }} />

                {/* Sticky bottom bar */}
                <div style={{
                  position: "sticky", bottom: 0, left: 0, right: 0,
                  background: "rgba(255,251,245,0.96)", backdropFilter: "blur(10px)",
                  padding: "12px 0 8px",
                  borderTop: `1px solid ${C.line}`,
                }}>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button variant="outline" onClick={() => { setStep(0); }} style={{ flex: 1, padding: "12px 16px", fontSize: "14px" }}>← 重拍</Button>
                    <Button onClick={() => setStep(2)} style={{ flex: 2, padding: "12px 16px", fontSize: "14px" }}>
                      继续 →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 2 · 偏好设置 ═══ */}
            {step === 2 && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                {favorites.length > 0 && (
                  <div style={{ background: C.accentSoft, borderRadius: C.rs, padding: "10px 16px", marginBottom: "14px", fontSize: "12px", color: C.accent, lineHeight: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>❤️ 已收藏 <strong>{favorites.length}</strong> 道菜，推荐时会优先</span>
                    <span onClick={() => setStep(1)} style={{ cursor: "pointer", textDecoration: "underline", fontSize: "11px" }}>查看</span>
                  </div>
                )}

                <Card>
                  <SectionTitle icon="👥">几个人吃？</SectionTitle>
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <button onClick={() => setParty(Math.max(1, party - 1))} style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px solid ${C.line}`, background: C.bg, fontSize: "18px", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: "32px", fontWeight: 700, color: C.accent, fontFamily: fontSerif }}>{party}</span>
                      <span style={{ fontSize: "13px", color: C.sub, marginLeft: "2px" }}>人</span>
                    </div>
                    <button onClick={() => setParty(Math.min(12, party + 1))} style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px solid ${C.line}`, background: C.bg, fontSize: "18px", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    <span style={{ fontSize: "11px", color: C.muted, marginLeft: "auto" }}>推荐 {Math.max(3, party + 1)}-{Math.min(Math.max(5, party * 2), 10)} 道</span>
                  </div>
                </Card>

                <PreferenceSection
                  icon="🚫"
                  title="过敏 / 忌口"
                  hint={menuTags.ingredients.length > 0 ? "这家菜单涉及的食材，勾选后会严格避开" : "勾选要避开的食材，支持自定义"}
                  options={menuTags.ingredients.length > 0 ? menuTags.ingredients : DEFAULT_AVOIDS}
                  selected={avoids}
                  setSelected={setAvoids}
                  inputValue={customAvoid}
                  setInputValue={setCustomAvoid}
                  inputPlaceholder="其他要避开的..."
                />

                <PreferenceSection
                  icon="😋"
                  title="喜欢的口味"
                  hint={menuTags.flavors.length > 0 ? "这家餐厅有这些口味风格" : "选几个你偏好的口味"}
                  options={menuTags.flavors.length > 0 ? menuTags.flavors : DEFAULT_FLAVORS}
                  selected={likes}
                  setSelected={setLikes}
                  inputValue={customLike}
                  setInputValue={setCustomLike}
                  inputPlaceholder="其他想吃的..."
                />

                <Card>
                  <SectionTitle icon="🌶">能吃多辣？</SectionTitle>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {spiceLabels.map((l, i) => <Pill key={i} active={spice === i} onClick={() => setSpice(i)}>{spiceIcons[i]} {l}</Pill>)}
                  </div>
                </Card>

                <Card>
                  <SectionTitle icon="📝">其他要求</SectionTitle>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="比如：酱汁另放、少盐、不要冰、要一个高脚椅..."
                    rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: C.rs, border: `1px solid ${C.line}`, fontSize: "13px", fontFamily: font, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
                </Card>

                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <Button variant="outline" onClick={() => setStep(1)} style={{ flex: 1 }}>← 看菜单</Button>
                  <Button onClick={doRecommend} style={{ flex: 2 }}>🍽 开始推荐</Button>
                </div>

                {/* Skip shortcut */}
                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <span onClick={doRecommend} style={{ fontSize: "12px", color: C.muted, cursor: "pointer", textDecoration: "underline" }}>
                    什么都吃，跳过直接推荐 →
                  </span>
                </div>
              </div>
            )}

            {/* ═══ STEP 3 · 菜品推荐 ═══ */}
            {step === 3 && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <p style={{ fontSize: "14px", color: C.sub, marginBottom: "16px", textAlign: "center", lineHeight: 1.6 }}>
                  为 <strong style={{ color: C.accent }}>{party} 人</strong> 挑了 <strong>{recs.length}</strong> 道菜
                  <br /><span style={{ fontSize: "12px", color: C.muted }}>点卡片选择要点的菜</span>
                </p>

                {recs.map((r, i) => {
                  const on = selected.includes(i);
                  return (
                    <div key={i} onClick={() => toggle(selected, setSelected, i)} style={{
                      background: on ? C.accentSoft : C.card, borderRadius: C.r, padding: "16px", marginBottom: "10px",
                      boxShadow: on ? `0 0 0 2px ${C.accent}, ${C.shadow}` : C.shadow,
                      cursor: "pointer", transition: "all 0.15s", position: "relative",
                      animation: "fadeUp 0.35s ease forwards", animationDelay: `${i * 0.06}s`, opacity: 0,
                    }}>
                      {on && <div style={{ position: "absolute", top: 12, right: 12, width: 22, height: 22, borderRadius: "50%", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, animation: "popIn 0.25s ease" }}>✓</div>}
                      <div style={{ paddingRight: on ? "32px" : 0, marginBottom: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <h4 style={{ fontSize: "15px", fontFamily: fontSerif, fontWeight: 700, margin: 0 }}>{r.name}</h4>
                          {r.price && <span style={{ fontSize: "14px", fontWeight: 700, color: C.ink, flexShrink: 0, marginLeft: 8 }}>{r.price}</span>}
                        </div>
                        <p style={{ fontSize: "13px", color: C.accent, fontWeight: 600, margin: "2px 0 0" }}>{r.zhName}</p>
                      </div>
                      <Stars n={r.score} />
                      <div style={{ marginTop: "6px", fontSize: "12px", color: C.sub, lineHeight: 1.7 }}>
                        <p style={{ margin: "0 0 2px" }}><strong style={{ color: C.ink }}>口感</strong>　{r.taste}</p>
                        <p style={{ margin: "0 0 2px" }}><strong style={{ color: C.ink }}>食材</strong>　{r.ingredients}</p>
                        <p style={{ margin: "3px 0 0", color: C.green, fontWeight: 500 }}>✨ {r.reason}</p>
                      </div>
                      {r.warning && r.warning !== "null" && r.warning !== "无" && r.warning !== null && (
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: C.red, background: C.redBg }}>⚠️ {r.warning}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {selected.length > 0 && (
                  <Card style={{ marginBottom: "14px", padding: "12px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: C.sub }}>已选 <strong style={{ color: C.ink }}>{selected.length}</strong> 道</span>
                      {allPriced ? (
                        <span style={{ fontSize: "18px", fontWeight: 700, color: C.accent, fontFamily: fontSerif }}>{selCurr} {selTotal.toFixed(2)}</span>
                      ) : (
                        <span style={{ fontSize: "12px", color: C.muted }}>部分价格未知</span>
                      )}
                    </div>
                  </Card>
                )}

                <div style={{ display: "flex", gap: "10px" }}>
                  <Button variant="outline" onClick={() => setStep(2)} style={{ flex: 1 }}>← 调整偏好</Button>
                  <Button variant="green" onClick={() => { setOrderCache({}); doOrder(); }} disabled={!selected.length} style={{ flex: 2 }}>
                    📋 生成话术 ({selected.length}道)
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4 · 完成点餐 ═══ */}
            {step === 4 && order && (
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <Card style={{ border: `2px solid ${C.accent}`, boxShadow: C.shadowUp, padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>{curLang.flag} 给服务员看</h3>
                    <Button variant="secondary" style={{ padding: "5px 12px", fontSize: "12px" }} onClick={() => doCopy(order.order)}>
                      {copied ? "✓ 已复制" : "📋 复制"}
                    </Button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
                    {LANGS.map(l => (
                      <SmallPill key={l.key} active={orderLang === l.key} onClick={() => {
                        if (l.key !== orderLang) doOrder(l.key);
                      }}>{l.flag} {l.short}</SmallPill>
                    ))}
                  </div>

                  <div style={{
                    background: C.bg, borderRadius: C.rs, padding: "14px",
                    fontSize: "15px", lineHeight: 1.9, fontFamily: fontSerif,
                    color: C.ink, whiteSpace: "pre-wrap",
                  }}>
                    {order.order}
                  </div>
                </Card>

                <Card>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px" }}>🇨🇳 中文对照</h3>
                  <p style={{ fontSize: "13px", lineHeight: 1.7, color: C.sub, margin: 0 }}>{order.chinese}</p>
                </Card>

                {order.tips && (
                  <div style={{ background: C.amberBg, borderRadius: C.rs, padding: "12px 14px", marginBottom: "14px", fontSize: "12px", color: C.amber, lineHeight: 1.6 }}>
                    💡 <strong>饭搭子提醒</strong>　{order.tips}
                  </div>
                )}

                <Card>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 8px" }}>🧾 已选 {selected.length} 道 · {party}人</h3>
                  {selected.map((idx, j) => {
                    const r = recs[idx];
                    return (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: j < selected.length - 1 ? `1px solid ${C.line}` : "none" }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: "13px" }}>{r.name}</span>
                          <span style={{ color: C.sub, fontSize: "12px", marginLeft: "6px" }}>{r.zhName}</span>
                        </div>
                        <span style={{ fontWeight: 600, fontSize: "13px", flexShrink: 0 }}>{r.price}</span>
                      </div>
                    );
                  })}
                  {allPriced && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", marginTop: "4px", borderTop: `2px solid ${C.ink}` }}>
                      <span style={{ fontWeight: 700, fontSize: "14px" }}>合计</span>
                      <span style={{ fontWeight: 700, fontSize: "17px", color: C.accent }}>{selCurr} {selTotal.toFixed(2)}</span>
                    </div>
                  )}
                </Card>

                <div style={{ textAlign: "center", padding: "20px", marginBottom: "14px", background: `linear-gradient(135deg, ${C.accentSoft}, ${C.amberBg})`, borderRadius: C.r }}>
                  <div style={{ fontSize: "26px", marginBottom: "4px" }}>🥢</div>
                  <p style={{ fontSize: "17px", fontWeight: 700, color: C.accent, fontFamily: fontSerif, margin: "0 0 2px" }}>祝你用餐愉快！</p>
                  <p style={{ fontSize: "12px", color: C.sub }}>Bon Appétit — 你的饭搭子</p>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <Button variant="outline" onClick={() => setStep(3)} style={{ flex: 1 }}>← 改选菜品</Button>
                  <Button variant="secondary" onClick={reset} style={{ flex: 1 }}>🔄 换一家</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
