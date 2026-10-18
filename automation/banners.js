/* ============================================================
   automation/banners.js  |  homepage hero carousel images

   For each slide in data/banners.json:
     1. find the brand's own product page (first candidate that loads,
        or a link on the brand homepage matching `find`)
     2. open it at desktop size and phone size, pick the hero banner
        (largest image near the top; known banner URLs are tried first)
     3. crop to 1920x760 (desktop) and 780x1040 (mobile) JPEGs in
        /images/banners/, scooter kept in frame by object-position
   Anything that fails keeps last week's image and link.
   If a slide has no image at all yet, its model photo from /images is used.

   Run: node automation/banners.js            (fetch from brand sites)
        node automation/banners.js --offline  (only fill missing images from model photos)
   ============================================================ */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const FILE = (process.argv.find(a => a.startsWith('--file=')) || '--file=data/banners.json').slice(7);
const CFG = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const SCOOTERS = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const OFFLINE = process.argv.includes('--offline');
const OUT = 'automation/out';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('images/banners', { recursive: true });

const UA_D = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const UA_M = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';
const SIZE = { d: { w: 1920, h: 760 }, m: { w: 780, h: 1040 } };
const report = { ranAt: new Date().toISOString(), slides: [] };

async function ok(ctx, url) {
  try { const r = await ctx.request.get(url, { timeout: 30000, maxRedirects: 5 }); return r.ok(); } catch (e) { return false; }
}

async function resolveUrl(ctx, s) {
  for (const u of s.pages || []) if (await ok(ctx, u)) return u;
  if (s.find && s.home) {
    const p = await ctx.newPage();
    try {
      await p.goto(s.home, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const re = new RegExp(s.find, 'i');
      const href = await p.evaluate(src => {
        const re = new RegExp(src, 'i');
        const a = [...document.querySelectorAll('a[href]')].find(a => re.test(a.href) || re.test(a.textContent.replace(/\s+/g, ' ')));
        return a ? a.href : null;
      }, s.find);
      if (href && re.test(href) && await ok(ctx, href)) return href.split('#')[0];
    } catch (e) {} finally { await p.close(); }
  }
  if (s.home && await ok(ctx, s.home)) return s.home;
  return null;
}

// largest picture near the top of the page, desktop wants landscape, mobile tolerates portrait
async function heroImage(ctx, url, kind) {
  const p = await ctx.newPage();
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(2500);
    return await p.evaluate(kind => {
      const H = innerHeight * 1.4, out = [];
      const add = (src, r, nw, nh) => {
        if (!src || src.startsWith('data:') || /logo|icon|sprite|line-art|\.svg(\?|$)/i.test(src)) return;
        if (r.bottom < 0 || r.top > H || r.width < innerWidth * 0.55) return;
        out.push({ src, area: r.width * Math.min(r.height, H), ratio: (nw || r.width) / (nh || r.height), nw: nw || r.width });
      };
      document.querySelectorAll('img').forEach(i => add(i.currentSrc || i.src, i.getBoundingClientRect(), i.naturalWidth, i.naturalHeight));
      document.querySelectorAll('video[poster]').forEach(v => add(v.poster, v.getBoundingClientRect()));
      document.querySelectorAll('section,div,picture,a').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage, m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
        if (m) add(new URL(m[1], location.href).href, el.getBoundingClientRect());
      });
      const og = document.querySelector('meta[property="og:image"]');
      const good = out.filter(c => kind === 'd' ? c.ratio >= 1.25 && c.nw >= 1000 : c.nw >= 380).sort((a, b) => b.area - a.area);
      return good.length ? good[0].src : (og ? og.content : null);
    }, kind);
  } catch (e) { return null; } finally { await p.close(); }
}

// crop with the browser itself: no image libraries needed
async function render(browser, dataUrl, kind, dest, focus) {
  const { w, h } = SIZE[kind];
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  try {
    await p.setContent(`<html><body style="margin:0;background:#0b0f14"><img id="i" src="${dataUrl}" style="width:${w}px;height:${h}px;object-fit:cover;object-position:${focus || (kind === 'd' ? '60% 50%' : '50% 45%')};display:block"></body></html>`);
    const nat = await p.evaluate(() => new Promise(r => { const i = document.getElementById('i'); const f = () => r([i.naturalWidth, i.naturalHeight]); i.complete ? f() : (i.onload = f, i.onerror = () => r([0, 0])); }));
    if (nat[0] < (kind === 'd' ? 1000 : 380)) return false;
    const buf = await p.screenshot({ type: 'jpeg', quality: 78 });
    if (buf.length < 12000) return false; // blank or broken
    fs.writeFileSync(dest, buf);
    return true;
  } finally { await p.close(); }
}

async function fetchAsDataUrl(ctx, src) {
  const r = await ctx.request.get(src, { timeout: 45000 });
  if (!r.ok()) throw new Error('HTTP ' + r.status());
  const type = (r.headers()['content-type'] || 'image/jpeg').split(';')[0];
  if (!/^image\//.test(type)) throw new Error('not an image: ' + type);
  if (/svg/.test(type) || /\.svg(\?|$)/i.test(src)) throw new Error('vector art, not a banner photo');
  return `data:${type};base64,${(await r.body()).toString('base64')}`;
}

function modelPhoto(s) {
  if (s.fallbackPhoto && fs.existsSync('.' + s.fallbackPhoto)) { const e = path.extname(s.fallbackPhoto).slice(1).replace('jpg', 'jpeg'); return `data:image/${e};base64,${fs.readFileSync('.' + s.fallbackPhoto).toString('base64')}`; }
  const m = SCOOTERS.find(x => x.id === s.modelId) || SCOOTERS.find(x => x.brandSlug === s.brandId);
  const f = m && (m.heroImg || m.cardImg);
  if (!f || !fs.existsSync('.' + f)) return null;
  const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync('.' + f).toString('base64')}`;
}

(async () => {
  const browser = await chromium.launch();
  const ctxD = await browser.newContext({ userAgent: UA_D, viewport: { width: 1920, height: 1080 }, locale: 'en-IN' });
  const ctxM = await browser.newContext({ userAgent: UA_M, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'en-IN' });
  const today = new Date().toISOString().slice(0, 10);

  for (const s of CFG.slides) {
    const r = { id: s.id, url: s.url, d: 'kept', m: 'kept' };
    // images supplied by us ("supplied": true) are never replaced by the weekly fetch
    if (s.supplied) { report.slides.push({ id: s.id, url: s.url, d: 'supplied, not fetched', m: 'supplied, not fetched' }); continue; }
    if (!OFFLINE) {
      const url = await resolveUrl(ctxD, s);
      if (url) { s.url = url; r.url = url; } else r.urlNote = 'no page loaded, kept ' + s.url;
      for (const kind of ['d', 'm']) {
        const ctx = kind === 'd' ? ctxD : ctxM;
        const tries = [];
        if (kind === 'm' && s.mobileFromDesktop && s.source && s.source.d) { tries.push(s.source.d); } else {
        if (s.images && s.images[kind]) tries.push(s.images[kind]);
        if (url) { const h = await heroImage(ctx, url, kind); if (h) tries.push(h); }
        if (kind === 'm' && s.source && s.source.d) tries.push(s.source.d); // desktop banner, recropped
        }
        for (const src of tries) {
          try {
            if (await render(browser, await fetchAsDataUrl(ctx, src), kind, '.' + s.img[kind], kind === 'm' && src === (s.source || {}).d ? s.mobileFocus : null)) {
              s.source = Object.assign({}, s.source, { [kind]: src }); r[kind] = src; break;
            }
          } catch (e) { r[kind + 'Error'] = String(e.message || e).slice(0, 120); }
        }
      }
      if (r.d !== 'kept' || r.m !== 'kept') s.checked = today;
    }
    // first run safety net: a slide must never be empty
    for (const kind of ['d', 'm']) {
      if (fs.existsSync('.' + s.img[kind])) continue;
      const photo = modelPhoto(s);
      if (photo && await render(browser, photo, kind, '.' + s.img[kind])) r[kind] = 'model photo (fallback)';
      else r[kind] = 'MISSING';
    }
    report.slides.push(r);
    console.log(s.id, '|', r.url, '| d:', String(r.d).slice(0, 90), '| m:', String(r.m).slice(0, 90));
  }
  await browser.close();
  fs.writeFileSync(FILE, JSON.stringify(CFG, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, path.basename(FILE)), JSON.stringify(report, null, 1));
})();
