/* tools/screens.js — full-page screenshots of a fixed page set.
   Usage: node tools/screens.js <outDir> [baseUrl]
   Used for visual regression: compare two runs with tools/visual-diff.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const out = process.argv[2] || 'shots-tmp/current';
const BASE = process.argv[3] || 'http://127.0.0.1:8877';
const PAGES = (process.env.SHOT_PAGES || [
  '/', '/listings', '/scooters/ather-energy-450x-3point7-kwh', '/scooters/ola-electric-s1-x-2-kwh',
  '/brands/ampere', '/cities/hyderabad', '/best/under-1-5l', '/compare/ola-electric-s1-x-3-kwh-vs-ather-energy-450s-2point9-kwh',
  '/guide-subsidy', '/guide-subsidy-deadlines', '/electric-scooter-price', '/emi', '/trending', '/launches'
].join(',')).split(',');
const VIEWPORTS = [{ name: 'd', width: 1280, height: 900 }, { name: 'm', width: 375, height: 812 }];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const manifest = {};
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
    // block third-party requests (fonts, analytics, YouTube) so runs are deterministic and fast
    if (!process.env.SHOT_ALLOW_EXTERNAL) await ctx.route(u => !u.href.startsWith(BASE), r => r.abort());
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
      // freeze randomness so shuffling sections render identically between runs
      await page.addInitScript(() => { let s = 42; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647); });
      try {
        await page.goto(BASE + p, { waitUntil: 'load', timeout: 45000 });
        await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
        await page.waitForTimeout(600);
        const name = (p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home') + '.' + vp.name + '.png';
        await page.screenshot({ path: path.join(out, name), fullPage: true });
        manifest[name] = p;
        if (errs.length) console.log(`  JS error on ${p} [${vp.name}]: ${errs[0]}`);
      } catch (e) { console.log(`  failed ${p} [${vp.name}]: ${String(e).slice(0, 100)}`); }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`screenshots written to ${out}`);
})();
