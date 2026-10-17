/* ============================================================
   i18n-runtime.js  |  keeps a translated page translated.
   The page scripts re-render parts of the page in English after
   load (cards, tables, prices). This watches the DOM and swaps
   every English text node and attribute for its translation,
   and keeps internal links inside the chosen language.
   Translations for this page are inlined (window.__SW_DICT__);
   anything missing is looked up in the full /i18n/<lang>.json.
   ============================================================ */
(function () {
  const L = window.__SW_LANG__, C = window.SW_I18N_CORE;
  if (!L || !C) return;
  let dict = window.__SW_DICT__ || {};
  let full = null, loading = false, pending = [];
  const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEMPLATE: 1, svg: 1 };
  const ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'data-label', 'data-short'];
  const LANG_RE = /^\/(hi|mr|ta|te|kn|gu|bn|or)(?=\/|$)/;
  const ASSET = /\.(js|css|png|jpe?g|webp|avif|svg|ico|txt|xml|json|pdf|woff2?)(\?|#|$)/i;

  function loadFull() {
    if (full || loading) return; loading = true;
    fetch('/i18n/' + L + '.json').then(r => r.json()).then(d => { full = d; dict = Object.assign({}, full, dict); const p = pending; pending = []; p.forEach(fix); }).catch(() => {});
  }
  function tr(text) {
    const out = C.translate(text, dict);
    if (out == null && C.translatable(text)) loadFull();
    return out;
  }
  function fixLink(a) {
    const h = a.getAttribute('href');
    if (!h || h[0] !== '/' || h.startsWith('//') || LANG_RE.test(h) || ASSET.test(h) || h.startsWith('/images/')) return;
    a.setAttribute('href', '/' + L + (h === '/' ? '' : h));
  }
  function fix(n) {
    if (!n) return;
    if (n.nodeType === 3) {
      if (n.__swDone === n.textContent) return;
      const t = tr(n.textContent);
      if (t != null) n.textContent = t; else if (!full) pending.push(n);
      n.__swDone = n.textContent; return;
    }
    if (n.nodeType !== 1 || SKIP[n.tagName] || n.getAttribute('translate') === 'no') return;
    for (const a of ATTRS) if (n.hasAttribute(a)) { const t = tr(n.getAttribute(a)); if (t != null && t !== n.getAttribute(a)) n.setAttribute(a, t); }
    if (n.tagName === 'A') fixLink(n);
    for (const c of n.childNodes) fix(c);
  }
  function fixHead() {
    const t = tr(document.title); if (t != null && t !== document.title) document.title = t;
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(m => { const v = tr(m.getAttribute('content') || ''); if (v != null) m.setAttribute('content', v); });
  }
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') fix(m.target);
      else if (m.type === 'attributes') { if (m.attributeName === 'href' && m.target.tagName === 'A') fixLink(m.target); else fix(m.target); }
      else m.addedNodes.forEach(fix);
      if (m.target && (m.target.tagName === 'TITLE' || (m.target.parentNode && m.target.parentNode.tagName === 'TITLE'))) fixHead();
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'title', 'alt', 'placeholder', 'aria-label', 'content'] });
  const all = () => { fix(document.body); fixHead(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', all); else all();
})();
