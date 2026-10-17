/* ============================================================
   i18n-core.js  |  shared by the build (Node) and the browser.
   Turns a piece of visible English text into a translation key
   ("template") by masking numbers, prices and units as {0}, {1}…
   so "₹1,24,999 ex-showroom" and "₹89,999 ex-showroom" share one
   translation and weekly price changes never need re-translating.
   ============================================================ */
(function (root) {
  const LANGS = {
    hi: { name: 'हिन्दी', en: 'Hindi', font: 'Noto+Sans+Devanagari', family: 'Noto Sans Devanagari' },
    mr: { name: 'मराठी', en: 'Marathi', font: 'Noto+Sans+Devanagari', family: 'Noto Sans Devanagari' },
    ta: { name: 'தமிழ்', en: 'Tamil', font: 'Noto+Sans+Tamil', family: 'Noto Sans Tamil' },
    te: { name: 'తెలుగు', en: 'Telugu', font: 'Noto+Sans+Telugu', family: 'Noto Sans Telugu' },
    kn: { name: 'ಕನ್ನಡ', en: 'Kannada', font: 'Noto+Sans+Kannada', family: 'Noto Sans Kannada' },
    gu: { name: 'ગુજરાતી', en: 'Gujarati', font: 'Noto+Sans+Gujarati', family: 'Noto Sans Gujarati' },
    bn: { name: 'বাংলা', en: 'Bengali', font: 'Noto+Sans+Bengali', family: 'Noto Sans Bengali' },
    or: { name: 'ଓଡ଼ିଆ', en: 'Odia', font: 'Noto+Sans+Oriya', family: 'Noto Sans Oriya' }
  };
  // numbers with optional ₹, Indian/western grouping, decimals, ranges and a unit
  const NUM = /(?<![A-Za-z\d.])(?:₹\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:[–—-]|to)\s?\d[\d,]*(?:\.\d+)?)?(?:\s?(?:km\/h|kmph|kWh|km|kms|hrs?|hours?|mins?|L|kg|mm|Nm|kW|W|%|lakh|L\b|crore|cr|x|°C|units?|mo|yr|yrs)(?![A-Za-z]))?(?![A-Za-z\d])/g;
  const HAS_WORD = /[A-Za-z]{2,}/;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function toKey(text) {
    const vals = [];
    const key = norm(text).replace(NUM, m => { vals.push(m); return `{${vals.length - 1}}`; });
    return { key, vals };
  }
  function fill(tpl, vals) { return tpl.replace(/\{(\d+)\}/g, (m, i) => vals[+i] != null ? vals[+i] : m); }
  function translatable(text) { const t = norm(text); return t.length > 1 && HAS_WORD.test(t) && !/^https?:|^[\w.-]+@[\w.-]+$|^[{}()[\];=<>]/.test(t); }
  function translate(text, dict) {
    if (!dict || !translatable(text)) return null;
    const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0];
    const { key, vals } = toKey(text);
    const t = dict[key];
    return t == null ? null : lead + fill(t, vals) + trail;
  }
  const API = { LANGS, toKey, fill, translatable, translate, norm };
  root.SW_I18N_CORE = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
