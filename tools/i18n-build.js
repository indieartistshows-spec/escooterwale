/* ============================================================
   tools/i18n-build.js  |  builds /hi/, /mr/, /ta/, /te/, /kn/,
   /gu/, /bn/, /or/ versions of every English page.

   1. Renders each English page in a browser (so JS-built parts
      like cards and tables are captured, same as prerender.js)
   2. Translates every text node and attribute using the
      translation memory in i18n/<lang>.json (numbers masked, see
      i18n-core.js). Missing segments stay English for now and are
      written to i18n/missing.json for the weekly translation run.
   3. Writes /<lang>/<path> with lang attribute, its own canonical,
      hreflang links to every language, the right Noto font, links
      kept inside the language, and the runtime that translates
      anything the page scripts re-render.
   4. Adds the same hreflang block to the English page.
   Usage: node tools/i18n-build.js [--langs=hi,ta] [--extract-only]
   ============================================================ */
const fs = require('fs'), path = require('path');
const { spawn, execSync } = require('child_process');
const { chromium } = require('playwright');
const { parseHTML } = require('linkedom');
const C = require('../i18n-core.js');
const { englishPages } = require('./i18n-extract.js');

const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const BASE = 'https://www.escooterwale.in', ORIGIN = 'http://127.0.0.1:8878';
const argLangs = (process.argv.find(a => a.startsWith('--langs=')) || '').split('=')[1];
const ALL = Object.keys(C.LANGS);
// pages are only built for fully translated languages; the rest are tracked in missing.json
const LANGS = argLangs ? argLangs.split(',') : require('./i18n-live.js').liveLangs();
const EXTRACT_ONLY = process.argv.includes('--extract-only');
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CODE', 'PRE', 'TEMPLATE']);
const ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'data-label', 'data-short'];
const ASSET = /\.(js|css|png|jpe?g|webp|avif|svg|ico|txt|xml|json|pdf|woff2?)(\?|#|$)/i;

const urlOf = f => { const p = f.replace(/\\/g, '/'); if (p === 'index.html') return '/'; if (p.endsWith('/index.html')) return '/' + p.slice(0, -11); return '/' + p.replace(/\.html$/, ''); };
const langUrl = (l, u) => l === 'en' ? u : '/' + l + (u === '/' ? '' : u);
const langFile = (l, f) => path.join(l, f);

function hreflangBlock(u) {
  const links = ['en', ...LANGS].map(l => `<link rel="alternate" hreflang="${l === 'en' ? 'en-IN' : l + '-IN'}" href="${BASE}${langUrl(l, u)}"/>`);
  links.push(`<link rel="alternate" hreflang="x-default" href="${BASE}${u}"/>`);
  return `<!--hreflang-->\n${links.join('\n')}\n<!--/hreflang-->`;
}
function absolutise(html) {
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/gi).map((part, i) => {
    const fixTag = s => s.replace(/(\s(?:src|href))="(?!https?:|\/\/|\/|#|data:|mailto:|tel:|\$\{|javascript:)([^"]+)"/g, '$1="/$2"');
    if (i % 2 === 0) return fixTag(part);
    const m = part.match(/^(<(?:script|style)[^>]*>)([\s\S]*)(<\/(?:script|style)>)$/i);
    return m ? fixTag(m[1]) + m[2] + m[3] : part;
  }).join('');
}

function loadDicts() {
  const d = {};
  for (const l of ALL) { try { d[l] = JSON.parse(fs.readFileSync(`i18n/${l}.json`, 'utf8')); } catch (e) { d[l] = {}; } }
  return d;
}

async function renderAll(pages) {
  const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), '8878'], { stdio: 'ignore' });
  execSync('node -e "setTimeout(()=>{},800)"');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(u => !u.href.startsWith(ORIGIN), r => r.abort());
  const out = {}; const queue = [...pages];
  async function worker() {
    while (queue.length) {
      const f = queue.shift(), page = await ctx.newPage();
      try {
        await page.goto(ORIGIN + urlOf(f), { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(400);
        out[f] = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
      } catch (e) { console.log(`  ✗ render ${f}: ${String(e).slice(0, 80)}`); }
      await page.close();
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  await browser.close(); srv.kill();
  return out;
}

/* collect every translatable string in a rendered page, as keys */
function collectKeys(doc) {
  const keys = new Set();
  const add = s => { if (s && C.translatable(s)) keys.add(C.toKey(s).key); };
  add(doc.title);
  doc.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(m => add(m.getAttribute('content')));
  const walk = n => {
    if (n.nodeType === 3) return add(n.textContent);
    if (n.nodeType !== 1 || SKIP.has(n.tagName.toUpperCase()) || n.getAttribute('translate') === 'no') return;
    ATTRS.forEach(a => n.hasAttribute(a) && add(n.getAttribute(a)));
    n.childNodes.forEach(walk);
  };
  walk(doc.body);
  return keys;
}

function translateDoc(doc, dict, lang, u, missing) {
  const tr = s => { if (!s || !C.translatable(s)) return null; const t = C.translate(s, dict); if (t == null) missing.add(C.toKey(s).key); return t; };
  const walk = n => {
    if (n.nodeType === 3) { const t = tr(n.textContent); if (t != null) n.textContent = t; return; }
    if (n.nodeType !== 1 || SKIP.has(n.tagName.toUpperCase()) || n.getAttribute('translate') === 'no') return;
    ATTRS.forEach(a => { if (n.hasAttribute(a)) { const t = tr(n.getAttribute(a)); if (t != null) n.setAttribute(a, t); } });
    if (n.tagName === 'A') {
      const h = n.getAttribute('href');
      if (h && h[0] === '/' && !h.startsWith('//') && !ASSET.test(h) && !h.startsWith('/images/') && !/^\/(hi|mr|ta|te|kn|gu|bn|or)(\/|$)/.test(h)) n.setAttribute('href', '/' + lang + (h === '/' ? '' : h));
    }
    if (n.tagName === 'SELECT' && n.classList.contains('lang-sel')) n.querySelectorAll('option').forEach(o => o.value === lang ? o.setAttribute('selected', '') : o.removeAttribute('selected'));
    n.childNodes.forEach(walk);
  };
  walk(doc.body);
  const t = tr(doc.title); if (t != null) doc.title = t;
  doc.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]').forEach(m => { const v = tr(m.getAttribute('content')); if (v != null) m.setAttribute('content', v); });
  doc.documentElement.setAttribute('lang', lang);
  const canon = doc.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute('href', BASE + langUrl(lang, u));
  const og = doc.querySelector('meta[property="og:url"]'); if (og) og.setAttribute('content', BASE + langUrl(lang, u));
  const loc = doc.querySelector('meta[property="og:locale"]'); if (loc) loc.setAttribute('content', lang + '_IN');
}

(async () => {
  const pages = englishPages();
  console.log(`rendering ${pages.length} English pages`);
  const rendered = await renderAll(pages);
  const dicts = loadDicts();
  const allKeys = new Set(), missing = Object.fromEntries(LANGS.map(l => [l, new Set()]));

  for (const [f, html0] of Object.entries(rendered)) {
    const u = urlOf(f);
    // English page: add hreflang links in place (idempotent)
    let en = fs.readFileSync(f, 'utf8').replace(/<!--hreflang-->[\s\S]*?<!--\/hreflang-->\n?/, '');
    if (LANGS.length) en = en.replace('</head>', hreflangBlock(u) + '\n</head>');
    if (!EXTRACT_ONLY) fs.writeFileSync(f, en);

    let base = absolutise(html0).replace(/<!--hreflang-->[\s\S]*?<!--\/hreflang-->\n?/, '');
    const { document: d0 } = parseHTML(base);
    const keys = collectKeys(d0); keys.forEach(k => allKeys.add(k));
    if (EXTRACT_ONLY) continue;

    for (const l of LANGS) {
      const dict = dicts[l];
      const { document: doc } = parseHTML(base);
      translateDoc(doc, dict, l, u, missing[l]);
      const pageDict = {}; keys.forEach(k => { if (dict[k] != null) pageDict[k] = dict[k]; });
      const meta = C.LANGS[l];
      const head = `<script>window.__SW_LANG__=${JSON.stringify(l)};window.__SW_DICT__=${JSON.stringify(pageDict).replace(/</g, '\\u003c')};</script>
<script src="/i18n-core.js"></script>
<script src="/i18n-runtime.js"></script>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=${meta.font}:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>html[lang="${l}"] body,html[lang="${l}"] h1,html[lang="${l}"] h2,html[lang="${l}"] h3,html[lang="${l}"] h4,html[lang="${l}"] button,html[lang="${l}"] input,html[lang="${l}"] select{font-family:'${meta.family}','Open Sans','Nunito Sans',sans-serif}</style>
${hreflangBlock(u)}`;
      let out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      out = out.replace(/<head([^>]*)>/i, `<head$1>\n${head}`);
      const dest = langFile(l, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, out);
    }
  }

  // full translation memory per language (runtime fallback) and the to-do list for translators
  fs.mkdirSync('i18n', { recursive: true });
  const keysArr = [...allKeys].sort();
  fs.writeFileSync('i18n/keys.json', JSON.stringify(keysArr, null, 0));
  if (!EXTRACT_ONLY) {
    const miss = {};
    for (const l of ALL) miss[l] = LANGS.includes(l) ? [...missing[l]].sort() : keysArr.filter(k => dicts[l][k] == null);
    fs.writeFileSync('i18n/missing.json', JSON.stringify(miss, null, 1));
    // a language that is not live must not leave old pages behind
    for (const l of ALL) if (!LANGS.includes(l) && fs.existsSync(l)) fs.rmSync(l, { recursive: true, force: true });
    const counts = ALL.map(l => `${l}: ${keysArr.length - miss[l].length}/${keysArr.length}`).join(', ');
    console.log(`language pages written for ${LANGS.join(', ') || 'none (no language fully translated yet)'} | coverage ${counts}`);
  } else console.log(`${keysArr.length} keys extracted`);
})().catch(e => { console.error(e); process.exit(1); });
