/* tools/build-og.js | a share image for every page (WhatsApp, LinkedIn, X, Facebook previews).
   1. Takes a 1200x630 screenshot of the top of every English page from the finished build and
      saves it as images/og/<page>.jpg. A screenshot is kept for 6 days, so the weekly build
      refreshes them all and mid-week rebuilds only shoot new pages. --force reshoots all.
   2. Writes og:image, og:image:width/height/alt, twitter:card and twitter:image into every page,
      English and every language. A language page uses the image of its English page.
   Runs inside tools/build-all.js after the language pages, before optimize-html.js.
   Run alone: node tools/build-og.js [--force] [--tags-only] */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const BASE = 'https://www.escooterwale.in', OUT = 'images/og', PORT = 8879, MAX_AGE = 6 * 864e5;
const LANGS = ['hi', 'mr', 'ta', 'te', 'kn', 'gu', 'bn', 'or'];
const SKIP_DIR = new Set(['node_modules', 'images', 'reports', 'shots', 'shots-tmp', 'automation', 'tools', 'i18n', 'fonts', 'data', 'api', '.git', '.cache', '.github']);
const FORCE = process.argv.includes('--force'), TAGS_ONLY = process.argv.includes('--tags-only');

function pages(dir = '.', out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f), st = fs.statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIR.has(f) && !f.startsWith('.')) pages(p, out); }
    else if (f.endsWith('.html')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
// file → site path:  index.html → /,  best/x/index.html → /best/x,  emi.html → /emi
const urlOf = f => '/' + f.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
const langOf = u => { const m = u.match(/^\/([a-z]{2})(\/|$)/); return m && LANGS.includes(m[1]) ? m[1] : null; };
const englishOf = u => { const l = langOf(u); return l ? (u.slice(l.length + 1) || '/') : u; };
const slug = u => u === '/' ? 'home' : u.slice(1).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const isPage = s => /<html/i.test(s) && !/<meta[^>]+http-equiv=["']refresh/i.test(s);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const all = pages().filter(f => !f.endsWith('.template'));
  const english = all.filter(f => !langOf(urlOf(f)) && f !== '404.html' && !/^guide-shell/.test(f));
  let shot = 0, kept = 0, failed = [];

  if (!TAGS_ONLY) {
    const srv = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { stdio: 'ignore' });
    execSync('node -e "setTimeout(()=>{},800)"');
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.route(/googletagmanager|google-analytics|clarity\.ms|youtube\.com\/embed|doubleclick/, r => r.abort());
    const page = await ctx.newPage();
    try {
      for (const f of english) {
        const u = urlOf(f), file = path.join(OUT, slug(u) + '.jpg');
        if (!isPage(fs.readFileSync(f, 'utf8'))) continue;
        if (!FORCE && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < MAX_AGE) { kept++; continue; }
        try {
          await page.goto(`http://127.0.0.1:${PORT}${u}`, { waitUntil: 'load', timeout: 30000 });
          await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}.mt-cart,.mob-nav,.bottom-nav,[class*="toast"]{display:none!important}' });
          await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(900);
          await page.screenshot({ path: file, type: 'jpeg', quality: 78 });
          shot++;
        } catch (e) { failed.push(u + ': ' + e.message.slice(0, 80)); }
      }
    } finally { await browser.close(); srv.kill(); }
  }

  // tags on every page
  let tagged = 0;
  for (const f of all) {
    let s = fs.readFileSync(f, 'utf8');
    if (!isPage(s) || !/<head[\s>]/i.test(s)) continue;
    const eu = englishOf(urlOf(f)), file = path.join(OUT, slug(eu) + '.jpg');
    const img = fs.existsSync(file) ? `${BASE}/${file}?v=${crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8)}` : `${BASE}/og-image.jpg`;
    const title = ((s.match(/<meta property="og:title" content="([^"]*)"/) || s.match(/<title>([^<]*)<\/title>/) || [])[1] || 'EScooterwale').trim();
    const tags = `<meta property="og:image" content="${img}"/>\n<meta property="og:image:width" content="1200"/>\n<meta property="og:image:height" content="630"/>\n<meta property="og:image:alt" content="${title}"/>\n<meta name="twitter:card" content="summary_large_image"/>\n<meta name="twitter:image" content="${img}"/>`;
    const before = s;
    s = s.replace(/\s*<meta (?:property="og:image(?::width|:height|:alt|:type)?"|name="twitter:(?:image|card)")[^>]*>/g, '');
    s = s.replace(/(<\/title>)/i, `$1\n${tags}`);
    if (!/og:image/.test(s)) s = s.replace(/(<head[^>]*>)/i, `$1\n${tags}`);
    if (s !== before) { fs.writeFileSync(f, s); tagged++; }
  }
  console.log(`share images: ${shot} taken, ${kept} still fresh, ${failed.length} failed; ${tagged} pages tagged`);
  if (failed.length) console.log('  ' + failed.slice(0, 10).join('\n  '));
})().catch(e => { console.error(e); process.exit(1); });
