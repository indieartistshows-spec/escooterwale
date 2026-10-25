/* tools/optimize-html.js  |  last step of the build, run over every finished page
   - fonts: self-hosted and preloaded (no Google Fonts request, no render-blocking @import),
     not preloaded so the hero banner gets the bandwidth;
     drops the dead Typekit placeholder
   - cache busting: every local .js/.css gets ?v=<content hash>, so vercel.json can cache
     them for a year and a new build is still picked up straight away
   - GA and Clarity load after the page load event
   - homepages get styles.css inlined (no render-blocking request on the most tested page)
   - images in page markup below the first screen get loading="lazy" decoding="async"
   Safe to run more than once. Usage: node tools/optimize-html.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'automation', 'i18n', 'tools', '.github', 'images', 'data']);

// fonts are self-hosted (see @font-face at the top of styles.css). They are not preloaded on
// purpose: on slow mobile a preload competes with the hero banner and costs about 0.4 s of LCP.

let _css = null;
const inlineCss = () => _css || (_css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim());
const hashes = {};
const hashOf = f => hashes[f] || (hashes[f] = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
const pages = walk(ROOT);
for (const file of pages) {
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  // fonts: strip every old Google Fonts / Typekit tag, the self-hosted ones load from styles.css
  // only our two families: other pages (yellow-brother) keep their own Google fonts
  h = h.replace(/<noscript>\s*<link[^>]*fonts\.googleapis\.com\/css2\?family=(Open\+Sans|Nunito)[^>]*>\s*<\/noscript>/g, '')
    .replace(/<link[^>]*(fonts\.googleapis\.com\/css2\?family=(Open\+Sans|Nunito)|use\.typekit\.net)[^>]*>\s*/g, '')
    .replace(/<!--[^>]*(Proxima Nova via Adobe|typekit)[^>]*-->\s*/g, '')
    .replace(/<link rel="preload" href="\/fonts\/[^"]+"[^>]*>/g, '');
  if (!/fonts\.googleapis\.com\/css2/.test(h)) h = h.replace(/<link rel="(dns-prefetch|preconnect)" href="(https:)?\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*/g, '');

  // analytics load after the page has: GA and Clarity were the biggest downloads competing
  // with the hero banner on mobile. gtag() calls made before then are queued and sent.
  h = h.replace(/<script async src="(https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+)"><\/script>/,
    (m, src) => `<script data-late-ga>addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='${src}';document.head.appendChild(s)},1)})</script>`);
  h = h.replace(/\(function\(c,l,a,r,i,t,y\)\{([\s\S]*?)\}\)\(window, document, "clarity", "script", "([a-z0-9]+)"\);/,
    (m, body, id) => `addEventListener('load',function(){setTimeout(function(){(function(c,l,a,r,i,t,y){${body}})(window, document, "clarity", "script", "${id}")},1500)});`);

  // Google AdSense site tag (GK, Oct 2026): in the <head> of every page, as AdSense asks
  if (!h.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'))
    h = h.replace(/<head(\s[^>]*)?>/i, m => `${m}\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2946997043388287" crossorigin="anonymous"></script>`);

  // homepages: styles inlined, so the first paint does not wait for styles.css
  if (/^(index\.html|[a-z]{2}\/index\.html)$/.test(path.relative(ROOT, file).split(path.sep).join('/'))) {
    const css = `<style data-inline-css>${inlineCss()}</style>`;
    h = h.includes('data-inline-css') ? h.replace(/<style data-inline-css>[\s\S]*?<\/style>/, () => css)
      : h.replace(/<link rel="stylesheet" href="\/?styles\.css(\?v=[a-z0-9]+)?"\s*\/?>/, () => css);
  }

  // cache busting for local scripts and styles
  h = h.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)=")([^":?#]+\.(?:js|css))(\?v=[a-z0-9]+)?(")/g, (m, a, ref, _v, z) => {
    const abs = ref.startsWith('/') ? path.join(ROOT, ref) : path.join(path.dirname(file), ref);
    return fs.existsSync(abs) ? `${a}${ref}?v=${hashOf(abs)}${z}` : m;
  });

  // lazy images: everything except the first two <img> on the page (logo and hero)
  let n = 0;
  h = h.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/g, (m, rest) => (++n <= 2 || /fetchpriority/.test(rest)) ? m : `<img loading="lazy" decoding="async"${rest}>`);

  if (h !== before) { fs.writeFileSync(file, h); changed++; }
}
console.log(`optimize-html: ${changed} of ${pages.length} pages updated`);
