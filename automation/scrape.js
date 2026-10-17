/* ============================================================
   automation/scrape.js
   Visits each brand's official model pages in a headless browser
   and extracts the brand-sourced fields for every model we list.

   Output: automation/out/scrape.json
     { ranAt, models: { id: { fields, source, notes, url } },
       cities: { id: { cityId: price } },
       brands: { brandId: { ok, error, pages } },
       candidates: [ { brand, name, kwh, price, url } ] }

   Nothing here writes to /data. merge.js decides what is applied.
   Run: node automation/scrape.js [--brand ather-energy]
   ============================================================ */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const X = require('./lib/extract');

const CFG = JSON.parse(fs.readFileSync('data/scrape-config.json', 'utf8'));
const SCOOTERS = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const BRANDS = CFG._brands || {};
const PINS = CFG._cityPincodes || {};
const only = (process.argv.find(a => a.startsWith('--brand=')) || '').split('=')[1];
const OUT = 'automation/out';
fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

async function capture(ctx, url, cityHook) {
  const page = await ctx.newPage();
  try {
    if (cityHook && cityHook.localStorage) await page.addInitScript(kv => { for (const [k, v] of Object.entries(kv)) try { localStorage.setItem(k, v); } catch (e) {} }, cityHook.localStorage);
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const status = resp ? resp.status() : 0;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // scroll so lazy spec sections render
    for (let y = 0; y < 8; y++) { await page.mouse.wheel(0, 1400); await page.waitForTimeout(350); }
    // open collapsed spec/price sections without following links
    await page.evaluate(() => {
      document.querySelectorAll('[aria-expanded="false"], details:not([open]) > summary').forEach(el => { try { if (el.tagName !== 'A') el.click(); } catch (e) {} });
    }).catch(() => {});
    if (cityHook && cityHook.click) for (const sel of cityHook.click) { await page.click(sel, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800); }
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => {
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent);
      const st = document.querySelector('#__NEXT_DATA__') || document.querySelector('script#__NUXT_DATA__');
      let state = st ? st.textContent : '';
      if (!state) state = [...document.querySelectorAll('script:not([src])')].map(s => s.textContent).filter(t => /kwh|price|range/i.test(t) && t.length < 400000).join('\n');
      return { text: document.body ? document.body.innerText : '', jsonLd, state: state.slice(0, 600000), title: document.title };
    });
    return { status, ...data };
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA, locale: 'en-IN', viewport: { width: 1366, height: 900 } });
  const result = { ranAt: new Date().toISOString(), models: {}, cities: {}, brands: {}, candidates: [] };

  const byBrand = {};
  for (const s of SCOOTERS) {
    if (only && s.brandSlug !== only) continue;
    (byBrand[s.brandSlug] = byBrand[s.brandSlug] || []).push(s);
  }

  for (const [brand, models] of Object.entries(byBrand)) {
    const bcfg = BRANDS[brand] || {};
    const urls = [...new Set(models.map(s => (CFG[s.id] || {}).url || s.brandUrl).filter(Boolean))];
    const pages = {};
    result.brands[brand] = { ok: true, pages: urls.length, errors: [] };
    for (const url of urls) {
      try {
        const p = await capture(ctx, url);
        if (p.status >= 400) throw new Error(`HTTP ${p.status}`);
        pages[url] = p;
        fs.writeFileSync(path.join(OUT, 'pages', brand + '-' + Buffer.from(url).toString('base64url').slice(-40) + '.txt'), `${url}\n${p.title}\n\n${p.text}`);
      } catch (e) {
        result.brands[brand].errors.push(`${url}: ${String(e.message || e).slice(0, 120)}`);
      }
    }
    if (!Object.keys(pages).length) { result.brands[brand].ok = false; continue; }

    for (const s of models) {
      const cfg = CFG[s.id] || { match: [s.name], kwh: parseFloat(s.battery) };
      const url = cfg.url || s.brandUrl, p = pages[url];
      if (!p) { result.models[s.id] = { fields: {}, notes: ['page failed to load'], url }; continue; }
      const r = X.extractModel(p, cfg);
      result.models[s.id] = { ...r, url };
    }

    // launch detection on every brand page we visited
    const known = models.map(s => (CFG[s.id] && CFG[s.id].match || [s.name])).flat();
    for (const [url, p] of Object.entries(pages)) {
      for (const c of X.candidateModels(p.text, known)) result.candidates.push({ brand, url, ...c });
    }

    // city prices, only for brands whose city mechanism is configured
    if (bcfg.city) {
      for (const [cityId, pin] of Object.entries(PINS)) {
        const hook = JSON.parse(JSON.stringify(bcfg.city).replace(/\{pincode\}/g, pin).replace(/\{city\}/g, cityId));
        for (const url of urls) {
          try {
            const u = hook.query ? url + (url.includes('?') ? '&' : '?') + hook.query : url;
            const p = await capture(ctx, u, hook);
            for (const s of models) {
              const cfg = CFG[s.id] || { match: [s.name], kwh: parseFloat(s.battery) };
              if ((cfg.url || s.brandUrl) !== url) continue;
              const r = X.extractModel(p, cfg);
              if (r.fields.price) (result.cities[s.id] = result.cities[s.id] || {})[cityId] = r.fields.price;
            }
          } catch (e) { result.brands[brand].errors.push(`city ${cityId}: ${String(e.message || e).slice(0, 80)}`); }
        }
      }
    }
    console.log(`${brand}: ${Object.keys(pages).length}/${urls.length} pages, ${models.filter(s => Object.keys((result.models[s.id] || {}).fields || {}).length).length}/${models.length} models with data`);
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'scrape.json'), JSON.stringify(result, null, 1));
  console.log(`scrape written: ${Object.keys(result.models).length} models, ${result.candidates.length} launch candidates`);
})();
