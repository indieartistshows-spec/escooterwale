/* ============================================================
   automation/fetch-images.js
   Downloads model photos and brand logos from the brands' own websites,
   for models listed in automation/image-sources.json:
     { "models": { "<scooter id>": { "urls": [direct image urls], "page": "official product page" } },
       "logos":  { "<brand id>":   { "urls": [...], "page": "brand homepage", "initials": "OLA", "color": "#16a663" } } }
   Model photo -> images/<id>.webp (max 1800 px wide). Tries the direct urls first, then the
   page's og:image, then the largest product-looking <img> on the page (in a real browser, so
   pages built by JavaScript work). Images under 500 px wide, or that look like logos/icons, are skipped.
   Logo -> images/logos/<id>-48.png from the site's apple-touch-icon / icon, else a plain
   initials badge in the brand colour.
   Existing files are kept unless --force. Report: automation/out/images.json
   ============================================================ */
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

const SRC = JSON.parse(fs.readFileSync('automation/image-sources.json', 'utf8'));
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
fs.mkdirSync('automation/out', { recursive: true });
fs.mkdirSync('images/logos', { recursive: true });
const report = { models: {}, logos: {} };
const BAD = /logo|icon|favicon|sprite|badge|whatsapp|facebook|instagram|youtube|twitter|linkedin|arrow|play-?btn|loader|placeholder/i;

async function getBuf(req, url, referer) {
  const r = await req.get(url, { headers: { 'User-Agent': UA, Referer: referer || new URL(url).origin + '/', Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*' }, timeout: 30000 });
  if (!r.ok()) throw new Error(`HTTP ${r.status()}`);
  return Buffer.from(await r.body());
}

async function toPhoto(buf) {
  const img = sharp(buf, { animated: false });
  const m = await img.metadata();
  if (!m.width || m.width < 500) throw new Error(`too small (${m.width}x${m.height})`);
  if (m.height > m.width * 1.6) throw new Error(`portrait banner (${m.width}x${m.height})`);
  return { out: await img.resize({ width: Math.min(1800, m.width), withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(), w: m.width, h: m.height };
}

async function pageCandidates(ctx, url, nameHint) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    for (let y = 0; y < 6; y++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(300); }
    return await page.evaluate(hint => {
      const out = [];
      const meta = n => (document.querySelector(`meta[property="${n}"],meta[name="${n}"]`) || {}).content;
      const words = (hint || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const imgs = [...document.images].map(i => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: (i.alt || '').toLowerCase() }))
        .filter(i => i.src && /^https?:/.test(i.src) && i.w >= 500 && i.h >= 250 && i.h <= i.w * 1.4);
      const score = i => i.w * i.h * (words.some(w => i.alt.includes(w) || i.src.toLowerCase().includes(w)) ? 3 : 1);
      imgs.sort((a, b) => score(b) - score(a));
      out.push(...imgs.slice(0, 4).map(i => i.src));
      const og = meta('og:image') || meta('twitter:image');
      if (og) out.push(new URL(og, location.href).href);
      return out;
    }, nameHint);
  } finally { await page.close(); }
}

async function iconCandidates(ctx, url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    return await page.evaluate(() => [...document.querySelectorAll('link[rel~="apple-touch-icon"],link[rel~="icon"],link[rel="shortcut icon"]')]
      .map(l => ({ href: new URL(l.href, location.href).href, size: parseInt((l.sizes && l.sizes.value) || '0') || 0, apple: /apple/.test(l.rel) }))
      .filter(l => !/\.svg(\?|$)/i.test(l.href))
      .sort((a, b) => (b.apple - a.apple) || (b.size - a.size)).map(l => l.href));
  } catch (e) { return []; } finally { await page.close(); }
}

function initialsSvg(text, color) {
  const t = String(text || '?').slice(0, 3).toUpperCase(), fs_ = t.length >= 3 ? 15 : t.length === 2 ? 19 : 24;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${color || '#334155'}"/><text x="48" y="50" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${fs_ * 2}" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${t.replace(/&/g, '&amp;')}</text></svg>`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, locale: 'en-IN', viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const req = ctx.request;

  for (const [id, s] of Object.entries(SRC.models || {})) {
    const file = `images/${id}.webp`;
    if (!FORCE && fs.existsSync(file)) { report.models[id] = { ok: true, kept: true }; continue; }
    const tried = [];
    let done = null;
    const tryUrls = async urls => {
      for (const u of urls) {
        if (done || !u || tried.find(t => t.url === u)) continue;
        if (BAD.test(u.split('?')[0].split('/').pop())) { tried.push({ url: u, err: 'looks like a logo/icon' }); continue; }
        try { const p = await toPhoto(await getBuf(req, u, s.page)); fs.writeFileSync(file, p.out); done = { url: u, w: p.w, h: p.h }; }
        catch (e) { tried.push({ url: u, err: String(e.message || e).slice(0, 100) }); }
      }
    };
    await tryUrls(s.urls || []);
    if (!done && s.page) { try { await tryUrls(await pageCandidates(ctx, s.page, s.name || id)); } catch (e) { tried.push({ url: s.page, err: 'page: ' + String(e.message || e).slice(0, 100) }); } }
    report.models[id] = done ? { ok: true, ...done } : { ok: false, tried };
    console.log(`${done ? 'ok  ' : 'FAIL'} ${id} ${done ? done.url : ''}`);
  }

  for (const [id, b] of Object.entries(SRC.logos || {})) {
    const file = `images/logos/${id}-48.png`;
    if (!FORCE && fs.existsSync(file)) { report.logos[id] = { ok: true, kept: true }; continue; }
    let done = null;
    const urls = [...(b.urls || []), ...(b.page ? await iconCandidates(ctx, b.page) : [])];
    for (const u of urls) {
      try {
        const buf = await getBuf(req, u, b.page);
        const m = await sharp(buf).metadata();
        if (!m.width || m.width < 32) throw new Error('too small');
        fs.writeFileSync(file, await sharp(buf).resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer());
        done = { url: u, from: 'site icon' }; break;
      } catch (e) {}
    }
    if (!done) { fs.writeFileSync(file, await sharp(initialsSvg(b.initials, b.color)).resize(48, 48).png().toBuffer()); done = { from: 'initials badge' }; }
    report.logos[id] = { ok: true, ...done };
    console.log(`logo ${id}: ${done.from} ${done.url || ''}`);
  }

  await browser.close();
  fs.writeFileSync('automation/out/images.json', JSON.stringify(report, null, 1));
  const failed = Object.entries(report.models).filter(([, r]) => !r.ok).map(([id]) => id);
  console.log(`images: ${Object.keys(report.models).length - failed.length} ok, ${failed.length} failed${failed.length ? ': ' + failed.join(', ') : ''}`);
})();
