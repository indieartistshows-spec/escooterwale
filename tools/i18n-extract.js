/* tools/i18n-extract.js  |  lists every translatable segment on the English site
   -> i18n/segments.json { key: { pages: n, sample } } */
const fs = require('fs'), path = require('path');
const { parseHTML } = require('linkedom');
const C = require('../i18n-core.js');
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CODE', 'PRE', 'TEMPLATE']);
const ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'data-label', 'data-short'];

function englishPages() {
  const root = fs.readdirSync('.').filter(f => f.endsWith('.html') && !['scooter-detail.html', 'brand.html', 'city.html', 'article.html'].includes(f));
  const dirs = ['scooters', 'brands', 'cities', 'best', 'articles', 'compare'].flatMap(d => fs.existsSync(d) ? fs.readdirSync(d).map(x => path.join(d, x, 'index.html')).filter(f => fs.existsSync(f)) : []);
  return root.concat(dirs);
}
function* segments(doc) {
  const walk = function* (n) {
    if (n.nodeType === 1) {
      if (SKIP_TAGS.has(n.tagName) || n.getAttribute('translate') === 'no' || (n.classList && n.classList.contains('notranslate'))) return;
      for (const a of ATTRS) if (n.hasAttribute && n.hasAttribute(a)) yield n.getAttribute(a);
    }
    if (n.nodeType === 3) { yield n.textContent; return; }
    for (const c of n.childNodes || []) yield* walk(c);
  };
  yield doc.title;
  for (const m of doc.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]')) yield m.getAttribute('content');
  yield* walk(doc.body);
}
module.exports = { englishPages, segments, SKIP_TAGS, ATTRS };
if (require.main === module) {
  const all = {};
  for (const f of englishPages()) {
    const { document } = parseHTML(fs.readFileSync(f, 'utf8'));
    for (const s of segments(document)) {
      if (!s || !C.translatable(s)) continue;
      const { key } = C.toKey(s);
      (all[key] = all[key] || { pages: 0 }).pages++;
    }
  }
  fs.mkdirSync('i18n', { recursive: true });
  fs.writeFileSync('i18n/segments.json', JSON.stringify(all, null, 1));
  const keys = Object.keys(all), words = keys.reduce((a, k) => a + k.split(' ').length, 0);
  console.log(`${englishPages().length} pages, ${keys.length} unique segments, ${words} words`);
}
