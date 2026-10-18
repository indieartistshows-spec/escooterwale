/* automation/product-candidates.js
   Collects clean product photos from brand websites for models whose current photo is wrong
   (an ad banner with text, an infographic, a branded graphic). For each model it opens the
   brand's product page in a browser, scrolls so lazy images load, gathers every large image,
   ranks them (model name in the file name or alt text, larger first, no logos or icons) and
   saves the top few to images/candidates/<model id>/ with a list of where each came from.
   A person then picks the right one. Nothing on the site changes until a photo is chosen.
   Run: node automation/product-candidates.js   (in GitHub Actions, see .github/workflows/candidates.yml) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const TARGETS = [
  { id: 'ather-energy-450s-2point9-kwh', pages: ['https://www.atherenergy.com/450', 'https://www.atherenergy.com/450s'], words: ['450s', '450'] },
  { id: 'ather-energy-450x-3point7-kwh', pages: ['https://www.atherenergy.com/450', 'https://www.atherenergy.com/450x'], words: ['450x', '450'] },
  { id: 'hero-vida-vx2-go-2point2-kwh', pages: ['https://www.vidaworld.com/vx2-go-electric-scooter.html', 'https://www.vidaworld.com/vx2.html'], words: ['vx2', 'go'] },
  { id: 'hero-vida-vx2-plus-3point4-kwh', pages: ['https://www.vidaworld.com/vx2-go-3-4-kwh-electric-scooter.html', 'https://www.vidaworld.com/vx2-plus-electric-scooter.html', 'https://www.vidaworld.com/vx2.html'], words: ['vx2', 'plus'] },
  { id: 'pure-ev-epluto-7g-2point0-kwh', pages: ['https://www.pureenergy.co.in/electric-scooters/epluto-7g', 'https://www.pureenergy.co.in/epluto-7g'], words: ['epluto', 'pluto', '7g'] },
  { id: 'pure-ev-etranceplus-4point5-kwh', pages: ['https://www.pureenergy.co.in/electric-scooters/etrance-neo', 'https://www.pureenergy.co.in/electric-scooters/etrance-plus'], words: ['etrance', 'trance'] },
  { id: 'pure-ev-etron-plus-3point0-kwh', pages: ['https://www.pureenergy.co.in/electric-scooters/etron-plus', 'https://www.pureenergy.co.in/electric-scooters/etron', 'https://www.pureenergy.co.in'], words: ['etron', 'tron'] }
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const OUT = 'images/candidates';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: 'en-IN' });
  const report = { ranAt: new Date().toISOString(), models: {} };
  for (const t of TARGETS) {
    const found = new Map(), tried = [];
    for (const url of t.pages) {
      const p = await ctx.newPage();
      try {
        const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        tried.push(url + ' ' + (r ? r.status() : 'no response'));
        if (!r || r.status() >= 400) continue;
        await p.waitForTimeout(2500);
        for (let y = 0; y < 12; y++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(400); }
        await p.waitForTimeout(1500);
        const imgs = await p.evaluate(() => {
          const out = [];
          for (const i of document.images) {
            const src = i.currentSrc || i.src;
            if (src) out.push({ src, alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight });
          }
          for (const e of document.querySelectorAll('*')) {
            const bg = getComputedStyle(e).backgroundImage;
            const m = bg && bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (m) { const r = e.getBoundingClientRect(); out.push({ src: new URL(m[1], location.href).href, alt: 'background', w: r.width, h: r.height }); }
          }
          return out;
        });
        for (const i of imgs) {
          if (!/^https?:/.test(i.src) || /\.svg(\?|$)|logo|icon|sprite|favicon|badge|flag/i.test(i.src) || i.w < 500 || i.h < 300) continue;
          const key = i.src.split('?')[0];
          const text = (i.src + ' ' + i.alt).toLowerCase();
          const score = t.words.reduce((a, w) => a + (text.includes(w) ? 3 : 0), 0) + Math.min(i.w * i.h / 1e6, 3) + (/banner|hero|kv|offer|text|lifestyle/.test(text) ? -1 : 0);
          if (!found.has(key) || found.get(key).score < score) found.set(key, { ...i, score, page: url });
        }
      } catch (e) { tried.push(url + ' error ' + e.message.slice(0, 80)); } finally { await p.close(); }
    }
    const best = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 8);
    const dir = path.join(OUT, t.id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const saved = [];
    for (const [n, c] of best.entries()) {
      try {
        const r = await ctx.request.get(c.src, { timeout: 30000 });
        if (!r.ok()) continue;
        const buf = await r.body();
        const meta = await sharp(buf).metadata();
        if (!meta.width || meta.width < 500) continue;
        const f = path.join(dir, `${n + 1}.webp`);
        await sharp(buf).resize({ width: Math.min(meta.width, 1600), withoutEnlargement: true }).webp({ quality: 85 }).toFile(f);
        saved.push({ file: '/' + f, src: c.src, page: c.page, alt: c.alt, size: meta.width + 'x' + meta.height, score: +c.score.toFixed(2) });
      } catch (e) { /* skip */ }
    }
    report.models[t.id] = { tried, saved };
    console.log(t.id, saved.length, 'candidates');
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
})();
