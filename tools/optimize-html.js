/* tools/optimize-html.js  |  last step of the build, run over every finished page
   - fonts: one non-blocking Google Fonts request (only the weights we use) instead of
     render-blocking @imports and duplicate links; drops the dead Typekit placeholder
   - cache busting: every local .js/.css gets ?v=<content hash>, so vercel.json can cache
     them for a year and a new build is still picked up straight away
   - images in page markup below the first screen get loading="lazy" decoding="async"
   Safe to run more than once. Usage: node tools/optimize-html.js */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'automation', 'i18n', 'tools', '.github', 'images', 'data']);

const FONT = 'https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,600;0,6..12,700;0,6..12,800;1,6..12,400&family=Open+Sans:wght@400;500;600;700;800&display=swap';
const FONT_TAGS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONT}" media="print" onload="this.media='all'" data-fonts><noscript><link rel="stylesheet" href="${FONT}"></noscript>`;

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
  // fonts: strip every old Google Fonts / Typekit tag, then add the single async one
  h = h.replace(/<noscript>\s*<link[^>]*fonts\.googleapis\.com\/css2[^>]*>\s*<\/noscript>/g, '')
    .replace(/<link[^>]*(fonts\.googleapis\.com\/css2|use\.typekit\.net)[^>]*>\s*/g, '')
    .replace(/<link rel="(dns-prefetch|preconnect)" href="(https:)?\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*/g, '')
    .replace(/<!--[^>]*(Proxima Nova via Adobe|typekit)[^>]*-->\s*/g, '');
  if (!h.includes('data-fonts')) h = h.replace(/(<link rel="stylesheet" href="[^"]*styles\.css[^"]*"\s*\/?>)/, FONT_TAGS + '$1');

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
