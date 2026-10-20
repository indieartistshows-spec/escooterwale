/* automation/firewall-check.js | checks the live site after Vercel Bot Protection changes:
   plain requests (how a script sees it) and a real browser (how a visitor sees it).
   Writes reports/firewall-check.json. Run from .github/workflows/firewall-check.yml. */
const fs = require('fs');
const { chromium } = require('playwright');
const BASE = 'https://www.escooterwale.in';
const PATHS = ['/', '/compare', '/match', '/scooters/ather-energy-rizta-s-2point9-kwh', '/hi/', '/sitemap.xml', '/robots.txt', '/api/service?pin=400050'];
(async () => {
  const out = { ranAt: new Date().toISOString(), plain: [], browser: [] };
  for (const p of PATHS) for (const ua of ['curl/8.5', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36']) {
    try {
      const r = await fetch(BASE + p, { headers: { 'user-agent': ua }, redirect: 'manual' });
      const body = await r.text();
      out.plain.push({ path: p, ua: ua.slice(0, 12), status: r.status, mitigated: r.headers.get('x-vercel-mitigated'), challenge: /challenge|Vercel Security Checkpoint/i.test(body.slice(0, 3000)), bytes: body.length });
    } catch (e) { out.plain.push({ path: p, ua: ua.slice(0, 12), error: e.message }); }
  }
  // link-preview apps should get the real page (custom Bypass rule), with the share image tags
  out.previews = [];
  for (const ua of ['WhatsApp/2.24.20.80 A', 'TelegramBot (like TwitterBot)', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)', 'facebookexternalhit/1.1']) {
    for (const p of ['/scooters/ather-energy-rizta-s-2point9-kwh', '/match']) {
      try {
        const r = await fetch(BASE + p, { headers: { 'user-agent': ua } }), body = await r.text();
        const og = (body.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null;
        let img = null; if (og) { const ir = await fetch(og, { headers: { 'user-agent': ua } }); img = ir.status + ' ' + ir.headers.get('content-type'); }
        out.previews.push({ ua: ua.split(/[ /]/)[0], path: p, status: r.status, mitigated: r.headers.get('x-vercel-mitigated'), title: (body.match(/<title>([^<]*)/) || [])[1], og, img });
      } catch (e) { out.previews.push({ ua, path: p, error: e.message }); }
    }
  }
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' });
  for (const p of ['/', '/match', '/listings', '/trending']) {
    const rec = { path: p };
    try {
      const r = await page.goto(BASE + p, { waitUntil: 'load', timeout: 45000 }); await page.waitForTimeout(4000);
      rec.status = r && r.status(); rec.title = await page.title(); rec.final = page.url();
      rec.checkpoint = /Security Checkpoint|challenge/i.test(rec.title + (await page.evaluate(() => document.body.innerText.slice(0, 500))));
      rec.h1 = await page.$eval('h1', h => h.innerText.slice(0, 80)).catch(() => null);
    } catch (e) { rec.error = e.message.slice(0, 150); }
    out.browser.push(rec);
  }
  // service lookup from inside the page, as the quiz does it
  out.apiFromPage = await page.evaluate(() => fetch('/api/service?pin=400050').then(r => r.status + ' ' + r.headers.get('content-type')).catch(e => 'error ' + e.message));
  await b.close();
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/firewall-check.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
