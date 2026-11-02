/* tools/site-audit.js  |  checks the BUILT site the way an SEO crawler (Semrush, Google) sees it,
   without a server: every page file is mapped to its live address (cleanUrls, no trailing slash,
   vercel.json rewrites and redirects, middleware.js query redirects).
   Reports:
     brokenLinks     internal <a href> to an address that does not exist (a 404)
     redirectLinks   internal <a href> that only reaches its page through a redirect
     hreflang        language links that are missing, redirect, 404, not reciprocal, or point at a
                     page whose canonical is a different address
     canonical       pages whose canonical is not their own address
     langMismatch    <html lang> that disagrees with the page's own hreflang
     schema          JSON-LD that does not parse, or misses fields Google requires for its type
   Usage: node tools/site-audit.js [--json out.json] [--max N]   exit 1 when brokenLinks, hreflang
   errors or schema errors are found (the weekly guard can call it). */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://www.escooterwale.in';
const LANGS = ['hi', 'mr', 'ta', 'te', 'kn', 'gu', 'bn', 'or'];
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const MAX = Number(opt('--max') || 15);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

// ---------- every page file -> its address ----------
const SKIP_DIRS = new Set(['node_modules', '.git', 'automation', 'tools', 'reports', 'i18n', 'api', 'shots', 'prev-site']);
const pages = new Map(); // url path -> file
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(f); continue; }
    if (!e.name.endsWith('.html')) continue;
    const rel = '/' + path.relative(ROOT, f).split(path.sep).join('/');
    let u = rel.endsWith('/index.html') ? rel.slice(0, -'/index.html'.length) : rel.slice(0, -'.html'.length);
    if (u === '' || u === '/index') u = '/';
    pages.set(u, f);
  }
})(ROOT);
const staticFile = p => { try { return fs.statSync(path.join(ROOT, decodeURIComponent(p))).isFile(); } catch (e) { return false; } };
const rewrites = new Map((vercel.rewrites || []).filter(r => !r.source.includes(':')).map(r => [r.source, r.destination]));

// simple vercel.json redirects (no params): source -> destination
const plainRedirects = new Map((vercel.redirects || []).filter(r => !r.has && !/[:(*]/.test(r.source)).map(r => [r.source, r.destination]));
const paramRedirects = (vercel.redirects || []).filter(r => !r.has && /:/.test(r.source)).map(r => {
  const names = []; const re = new RegExp('^' + r.source.replace(/:(\w+)(\(([^)]*)\))?/g, (m, n, g, alt) => { names.push(n); return alt ? `(${alt})` : '([^/]+)'; }) + '$');
  return { re, names, dest: r.destination };
});
let middlewareTarget = null;
try { // middleware.js is an ES module; take its pure target() function
  const src = fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8')
    .replace(/^import PAIRS from .*$/m, `const PAIRS = ${fs.readFileSync(path.join(ROOT, 'data/compare-pairs.json'), 'utf8')};`)
    .replace(/export const config[^\n]*\n/, '').replace(/export function target/, 'function target').replace(/export default function middleware[\s\S]*$/, '');
  middlewareTarget = new Function(src + '\nreturn target;')();
} catch (e) { console.warn('middleware not loaded:', e.message); }

/* resolve an internal address: { status: 200|301|404, to, page } */
function resolve(href) {
  const u = new URL(href, BASE + '/');
  let p = u.pathname;
  if (middlewareTarget && !/^\/(api|images|fonts)\//.test(p) && !/\.(js|css|webp|png|jpe?g|svg|ico|woff2?|json|xml|txt|webmanifest|map)$/.test(p)) {
    const t = middlewareTarget(u.href); if (t) return { status: 301, to: new URL(t).pathname + new URL(t).search };
  }
  for (const r of vercel.redirects || []) if (r.has) {
    if (r.source !== p) continue;
    const q = r.has[0]; if (q.type === 'query' && u.searchParams.has(q.key)) return { status: 308, to: '(query redirect)' };
  }
  if (plainRedirects.has(p)) return { status: 308, to: plainRedirects.get(p) };
  for (const r of paramRedirects) { const m = p.match(r.re); if (m) { let d = r.dest; r.names.forEach((n, i) => { d = d.replace(':' + n, m[i + 1]); }); return { status: 308, to: d }; } }
  if (p.length > 1 && p.endsWith('/')) return { status: 308, to: p.replace(/\/+$/, '') || '/' };
  if (p.endsWith('.html')) { const c = p === '/index.html' ? '/' : p.replace(/(\/index)?\.html$/, ''); return { status: 308, to: c }; }
  if (pages.has(p)) return { status: 200, page: p };
  if (rewrites.has(p)) return { status: 200, page: rewrites.get(p).replace(/\.html$/, '') };
  if (staticFile(p)) return { status: 200, page: p, static: true };
  if (p.startsWith('/api/')) return { status: 200, page: p, api: true };
  return { status: 404 };
}
const isInternal = h => h && !/^(mailto:|tel:|javascript:|#|data:|whatsapp:)/i.test(h) && (!/^https?:\/\//i.test(h) || /^https?:\/\/(www\.)?escooterwale\.in(\/|$)/i.test(h)) && !/^\/\//.test(h) && !/\$\{/.test(h);

// ---------- read every page ----------
const out = { pages: pages.size, brokenLinks: {}, redirectLinks: {}, redirectLinkCount: 0, hreflang: [], canonical: [], langMismatch: [], schema: [], schemaTypes: {} };
const info = new Map();
const attr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')); return m ? (m[2] != null ? m[2] : m[3]) : null; };
for (const [u, f] of pages) {
  const h = fs.readFileSync(f, 'utf8');
  const head = h.slice(0, h.indexOf('</head>') + 7 || 20000);
  const canon = (head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [])[0];
  const alts = [...head.matchAll(/<link[^>]+rel=["']alternate["'][^>]*hreflang[^>]*>/gi)].map(m => ({ lang: attr(m[0], 'hreflang'), href: attr(m[0], 'href') }));
  const htmlLang = attr((h.match(/<html[^>]*>/i) || [''])[0], 'lang');
  const robots = (head.match(/<meta[^>]+name=["']robots["'][^>]*>/i) || [''])[0];
  info.set(u, { canon: canon ? attr(canon, 'href') : null, alts, htmlLang, noindex: /noindex/i.test(attr(robots, 'content') || '') });
  // links (static HTML only, like a crawler without JS)
  const body = h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<template[\s\S]*?<\/template>/gi, '');
  for (const m of body.matchAll(/<a\s[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    const href = (m[2] != null ? m[2] : m[3]).trim();
    if (!isInternal(href)) continue;
    const r = resolve(href);
    if (r.status === 404) { const k = new URL(href, BASE + u).pathname; (out.brokenLinks[k] = out.brokenLinks[k] || []).push(u); }
    else if (r.status !== 200) { out.redirectLinkCount++; const k = new URL(href, BASE + u).pathname + new URL(href, BASE + u).search; (out.redirectLinks[k] = out.redirectLinks[k] || { to: r.to, n: 0, from: [] }); out.redirectLinks[k].n++; if (out.redirectLinks[k].from.length < 3) out.redirectLinks[k].from.push(u); }
  }
  // JSON-LD
  for (const m of h.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1]); } catch (e) { out.schema.push({ page: u, error: 'JSON does not parse: ' + e.message.slice(0, 80) }); continue; }
    checkSchema(j, u, '');
  }
}

// ---------- schema rules (Google rich results requirements, the common ones) ----------
function checkSchema(n, u, at) {
  if (Array.isArray(n)) return n.forEach((x, i) => checkSchema(x, u, at + '[' + i + ']'));
  if (!n || typeof n !== 'object') return;
  if (n['@graph']) checkSchema(n['@graph'], u, at + '@graph');
  const types = [].concat(n['@type'] || []);
  const err = msg => out.schema.push({ page: u, type: types.join(','), at, error: msg });
  for (const t of types) {
    out.schemaTypes[t] = (out.schemaTypes[t] || 0) + 1;
    if (t === 'Product') {
      if (!n.name) err('Product without name');
      if (!n.offers && !n.review && !n.aggregateRating) err('Product needs offers, review or aggregateRating');
      if (n.offers) for (const o of [].concat(n.offers)) {
        if (o['@type'] === 'AggregateOffer') { if (o.lowPrice == null) err('AggregateOffer without lowPrice'); if (!o.priceCurrency) err('AggregateOffer without priceCurrency'); }
        else { if (o.price == null || o.price === '' || isNaN(Number(o.price))) err('Offer price missing or not a number: ' + JSON.stringify(o.price)); if (!o.priceCurrency) err('Offer without priceCurrency'); }
      }
      if (n.aggregateRating) rating(n.aggregateRating, err, true);
      if (n.review) for (const r of [].concat(n.review)) review(r, err);
    }
    if (t === 'AggregateRating' && at.endsWith('@graph')) rating(n, err, true);
    if (t === 'Review' && !at.includes('review')) review(n, err);
    if (t === 'FAQPage') {
      const q = [].concat(n.mainEntity || []);
      if (!q.length) err('FAQPage without questions');
      q.forEach((x, i) => { if (!x.name) err(`FAQ question ${i} without name`); if (!x.acceptedAnswer || !x.acceptedAnswer.text) err(`FAQ question ${i} without acceptedAnswer.text`); });
    }
    if (t === 'BreadcrumbList') {
      const items = [].concat(n.itemListElement || []);
      if (!items.length) err('BreadcrumbList without items');
      items.forEach((x, i) => { if (x.position !== i + 1) err(`breadcrumb ${i} position ${x.position}`); if (!x.name) err(`breadcrumb ${i} without name`); if (i < items.length - 1 && !x.item) err(`breadcrumb ${i} without item URL`); });
    }
    if (t === 'ItemList') {
      [].concat(n.itemListElement || []).forEach((x, i) => { if (x['@type'] === 'ListItem' && x.position == null) err(`ListItem ${i} without position`); });
    }
    if ((t === 'Article' || t === 'NewsArticle' || t === 'BlogPosting') && !n.headline) err(t + ' without headline');
    if (t === 'VideoObject') { for (const k of ['name', 'thumbnailUrl', 'uploadDate']) if (!n[k]) err('VideoObject without ' + k); }
  }
  for (const [k, v] of Object.entries(n)) if (v && typeof v === 'object' && k !== '@graph') checkSchema(v, u, at + '.' + k);
}
function rating(r, err, needCount) {
  const v = Number(r.ratingValue);
  if (r.ratingValue == null || isNaN(v)) err('rating without numeric ratingValue');
  const best = r.bestRating != null ? Number(r.bestRating) : 5, worst = r.worstRating != null ? Number(r.worstRating) : 1;
  if (!isNaN(v) && (v > best || v < worst)) err(`ratingValue ${v} outside ${worst} to ${best} (set bestRating)`);
  if (needCount && r['@type'] === 'AggregateRating' && r.ratingCount == null && r.reviewCount == null) err('AggregateRating without ratingCount or reviewCount');
}
function review(r, err) {
  if (!r.author || (typeof r.author === 'object' && !r.author.name)) err('Review without author name');
  if (r.reviewRating) rating(r.reviewRating, err, false);
}

// ---------- hreflang ----------
const hrefPath = h => { try { const x = new URL(h); return x.host.replace(/^www\./, '') === 'escooterwale.in' ? x.pathname + x.search : null; } catch (e) { return null; } };
for (const [u, i] of info) {
  if (i.noindex) continue;
  const own = i.canon ? hrefPath(i.canon) : null;
  if (!i.canon) out.canonical.push({ page: u, problem: 'no canonical' });
  else if (own !== u) out.canonical.push({ page: u, problem: 'canonical is ' + i.canon });
  if (!i.alts.length) continue;
  const self = i.alts.find(a => hrefPath(a.href) === u);
  if (!self && own === u) out.hreflang.push({ page: u, problem: 'no self-referencing hreflang' });
  if (self && i.htmlLang && self.lang !== 'x-default' && self.lang.split('-')[0] !== i.htmlLang.split('-')[0]) out.langMismatch.push({ page: u, htmlLang: i.htmlLang, hreflang: self.lang });
  const seen = new Set();
  for (const a of i.alts) {
    if (seen.has(a.lang)) out.hreflang.push({ page: u, problem: 'duplicate hreflang ' + a.lang });
    seen.add(a.lang);
    const p = hrefPath(a.href); if (!p) { out.hreflang.push({ page: u, problem: `${a.lang} not on this site: ${a.href}` }); continue; }
    const r = resolve(p);
    if (r.status === 404) { out.hreflang.push({ page: u, lang: a.lang, problem: '404', href: p }); continue; }
    if (r.status !== 200) { out.hreflang.push({ page: u, lang: a.lang, problem: 'redirects to ' + r.to, href: p }); continue; }
    const ti = info.get(r.page);
    if (!ti) continue;
    if (ti.noindex) { out.hreflang.push({ page: u, lang: a.lang, problem: 'target is noindex', href: p }); continue; }
    if (ti.canon && hrefPath(ti.canon) !== p) out.hreflang.push({ page: u, lang: a.lang, problem: 'target canonical is ' + ti.canon, href: p });
    if (a.lang !== 'x-default' && r.page !== u && !ti.alts.some(b => hrefPath(b.href) === u)) out.hreflang.push({ page: u, lang: a.lang, problem: 'not reciprocal (target does not link back)', href: p });
  }
}

// ---------- report ----------
const group = (list, key) => { const g = {}; for (const x of list) { const k = key(x); g[k] = (g[k] || 0) + 1; } return Object.entries(g).sort((a, b) => b[1] - a[1]); };
const broken = Object.entries(out.brokenLinks).sort((a, b) => b[1].length - a[1].length);
console.log(`pages: ${out.pages}`);
console.log(`\nBROKEN internal links: ${broken.length} addresses, ${broken.reduce((s, x) => s + x[1].length, 0)} links`);
broken.slice(0, MAX).forEach(([k, from]) => console.log(`  ${k}  <- ${from.length} pages, e.g. ${[...new Set(from)].slice(0, 3).join(', ')}`));
const red = Object.entries(out.redirectLinks).sort((a, b) => b[1].n - a[1].n);
console.log(`\nInternal links through a REDIRECT: ${out.redirectLinkCount} links to ${red.length} addresses`);
red.slice(0, MAX).forEach(([k, v]) => console.log(`  ${k} -> ${v.to}  x${v.n}  e.g. ${v.from.join(', ')}`));
console.log(`\nHREFLANG problems: ${out.hreflang.length} on ${new Set(out.hreflang.map(x => x.page)).size} pages`);
group(out.hreflang, x => x.problem.replace(/https?:\/\/\S+|\/\S+/g, '<url>')).slice(0, MAX).forEach(([k, n]) => console.log(`  ${n}  ${k}`));
out.hreflang.slice(0, 5).forEach(x => console.log('   e.g.', JSON.stringify(x)));
console.log(`\nCANONICAL not self: ${out.canonical.length}`); out.canonical.slice(0, 5).forEach(x => console.log('  ', JSON.stringify(x)));
console.log(`\nLANG mismatch: ${out.langMismatch.length}`); out.langMismatch.slice(0, 5).forEach(x => console.log('  ', JSON.stringify(x)));
console.log(`\nSCHEMA errors: ${out.schema.length} on ${new Set(out.schema.map(x => x.page)).size} pages   (types: ${Object.entries(out.schemaTypes).map(([k, v]) => k + ' ' + v).join(', ')})`);
group(out.schema, x => (x.type || '') + ': ' + x.error.replace(/\d+(\.\d+)?/g, 'N')).slice(0, MAX).forEach(([k, n]) => console.log(`  ${n}  ${k}`));
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
process.exitCode = (broken.length || out.hreflang.length || out.schema.length) ? 1 : 0;
