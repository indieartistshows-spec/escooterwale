/* automation/locator-probe.js | one-off: opens each brand's dealer / service locator and records the
   data calls the page makes, so the service-centre job can read official locations.
   Writes reports/locator-probe.json. Run from .github/workflows/locator-probe.yml. */
const fs = require('fs');
const { chromium } = require('playwright');
const PAGES = {
  'ola-electric': ['https://www.olaelectric.com/experience-centres', 'https://www.olaelectric.com/service-centres'],
  'ather-energy': ['https://www.atherenergy.com/experience-centre', 'https://www.atherenergy.com/service-centre', 'https://www.atherenergy.com/dealers'],
  'tvs-motor': ['https://www.tvsmotor.com/en/tvs-dealer-locator', 'https://www.tvsmotor.com/electric-vehicle/tvs-iqube/dealer-locator'],
  'bajaj-chetak': ['https://www.chetak.com/dealer-locator', 'https://www.chetak.com/locate-dealer', 'https://www.bajajauto.com/dealer-locator'],
  'hero-vida': ['https://www.vidaworld.com/experience-centre.html', 'https://www.vidaworld.com/dealer-locator.html', 'https://www.heromotocorp.com/en-in/dealer-locator.html'],
  'ampere': ['https://amperevehicles.com/dealer-locator', 'https://www.amperevehicles.com/find-a-dealer'],
  'okinawa': ['https://okinawascooters.com/dealer-locator', 'https://www.okinawascooters.com/find-dealer'],
  'pure-ev': ['https://pureev.in/dealer-locator', 'https://www.pureenergy.co.in/dealer-locator', 'https://www.pureenergy.co.in/dealers'],
  'bounce-infinity': ['https://bounceinfinity.com/dealer-locator', 'https://bounceinfinity.com/dealers'],
  'bgauss': ['https://www.bgauss.com/dealer-locator', 'https://www.bgauss.com/find-a-dealer']
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
(async () => {
  const b = await chromium.launch();
  const report = { ranAt: new Date().toISOString(), brands: {} };
  for (const [slug, urls] of Object.entries(PAGES)) {
    const rb = report.brands[slug] = [];
    for (const url of urls) {
      const ctx = await b.newContext({ userAgent: UA, locale: 'en-IN', geolocation: { latitude: 19.07, longitude: 72.87 }, permissions: ['geolocation'] });
      const page = await ctx.newPage(), calls = [];
      page.on('response', async r => {
        try {
          const req = r.request(), ct = r.headers()['content-type'] || '';
          if (!['xhr', 'fetch'].includes(req.resourceType()) && !/json/.test(ct)) return;
          if (/google-analytics|googletagmanager|clarity|facebook|doubleclick|hotjar|moengage|webengage|sentry|newrelic/.test(r.url())) return;
          const body = await r.text().catch(() => '');
          calls.push({ url: r.url().slice(0, 400), method: req.method(), post: (req.postData() || '').slice(0, 300), status: r.status(), ct: ct.slice(0, 40), size: body.length, sample: body.slice(0, 500) });
        } catch (e) {}
      });
      const rec = { url };
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        rec.status = resp && resp.status(); await page.waitForTimeout(6000);
        rec.final = page.url(); rec.title = await page.title();
        rec.selects = await page.$$eval('select', ss => ss.map(s => ({ name: s.name || s.id, n: s.options.length, first: [...s.options].slice(0, 6).map(o => o.text.trim() + '=' + o.value) })));
        rec.inputs = await page.$$eval('input', ss => ss.filter(i => i.type !== 'hidden').slice(0, 8).map(i => (i.name || i.id) + ':' + (i.placeholder || '')));
        // pick the first real option in each dropdown to trigger the data call
        for (let k = 0; k < Math.min(3, rec.selects.length); k++) {
          await page.evaluate(k => { const s = document.querySelectorAll('select')[k]; if (s && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } }, k).catch(() => {});
          await page.waitForTimeout(3000);
        }
        rec.text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 600);
      } catch (e) { rec.error = e.message.slice(0, 200); }
      rec.calls = calls.slice(0, 25);
      rb.push(rec);
      await ctx.close();
    }
  }
  await b.close();
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/locator-probe.json', JSON.stringify(report, null, 1));
  console.log('done');
})();
