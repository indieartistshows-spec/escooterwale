/* automation/brand-socials.js | finds each brand's official social accounts on the brand's own
   website (links in the header and footer), then checks every account still loads.
   Writes reports/brand-socials.json. Run from .github/workflows/brand-socials.yml. */
const fs = require('fs');
const { chromium } = require('playwright');
const BRANDS = JSON.parse(fs.readFileSync('data/brands.json', 'utf8'));
const EXTRA = { 'tvs-motor': ['https://www.tvsmotor.com/electric-scooters/tvs-iqube'], 'hero-vida': ['https://www.vidaworld.com'], 'bajaj-chetak': ['https://www.chetak.com'], 'ampere': ['https://ampere.greaveselectricmobility.com', 'https://www.greaveselectricmobility.com'], 'okinawa': ['https://okinawascooters.com', 'https://www.okinawascooters.com'], 'pure-ev': ['https://pureev.in', 'https://www.pureenergy.co.in'], 'bounce-infinity': ['https://bounceinfinity.com'] };
// accounts to check by hand when a brand website hides its links from automated visits
const CANDIDATES = { 'ather-energy': ['https://www.instagram.com/atherenergy/', 'https://www.youtube.com/@atherenergy', 'https://www.facebook.com/atherenergy', 'https://www.linkedin.com/company/ather-energy', 'https://x.com/atherenergy'],
  'okinawa': ['https://www.instagram.com/okinawaautotech/', 'https://www.instagram.com/okinawascooters/', 'https://www.youtube.com/@OkinawaAutotech', 'https://www.facebook.com/okinawaautotech', 'https://www.linkedin.com/company/okinawa-autotech', 'https://x.com/okinawaautotech'],
  'ampere': ['https://www.instagram.com/ampere_ev_/'],
  'all-instagram': ['https://www.instagram.com/olaelectric/', 'https://www.instagram.com/tvsiqube/', 'https://www.instagram.com/tvsmotorcompany/', 'https://www.instagram.com/chetak_official/', 'https://www.instagram.com/vidaworldofficial/', 'https://www.instagram.com/pureenergy_india/', 'https://www.instagram.com/bounce_infinity/', 'https://www.instagram.com/bgauss_official/', 'https://www.instagram.com/bajajchetak/', 'https://www.instagram.com/herovida_official/', 'https://www.instagram.com/greavesamperev/', 'https://www.instagram.com/pureev_india/'] };
const NET = /instagram\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|linkedin\.com|threads\.net|whatsapp\.com|wa\.me/i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
(async () => {
  const b = await chromium.launch(); const out = { ranAt: new Date().toISOString(), brands: {} };
  const ctx = await b.newContext({ userAgent: UA, locale: 'en-IN', viewport: { width: 1366, height: 900 }, ignoreHTTPSErrors: true });
  for (const br of BRANDS) {
    const urls = [br.website, ...(EXTRA[br.id] || [])], found = new Map(), tried = [];
    for (const u of urls) {
      const page = await ctx.newPage();
      try {
        const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(4000); await page.mouse.wheel(0, 20000); await page.waitForTimeout(2500);
        const links = await page.$$eval('a[href]', as => as.map(a => ({ href: a.href, text: (a.getAttribute('aria-label') || a.title || a.innerText || '').trim().slice(0, 40) })));
        tried.push({ url: u, status: r && r.status(), final: page.url(), links: links.length });
        for (const l of links) if (NET.test(l.href) && !/share|sharer|intent|dialog|\/hashtag\//i.test(l.href)) found.set(l.href.replace(/\?.*$/, '').replace(/\/$/, ''), l.text);
      } catch (e) { tried.push({ url: u, error: e.message.slice(0, 120) }); }
      await page.close();
    }
    out.brands[br.id] = { tried, socials: [...found].map(([href, text]) => ({ href, text })) };
  }
  // does each account page still load (no "page isn't available")?
  for (const [id, x] of Object.entries(out.brands)) {
    for (const s of x.socials) {
      const page = await ctx.newPage();
      try {
        const r = await page.goto(s.href, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(2500);
        const body = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 3000);
        s.status = r && r.status(); s.final = page.url(); s.title = (await page.title()).slice(0, 120);
        s.dead = /isn.t available|page not found|this account doesn.t exist|content isn.t available|this page doesn.t exist|404/i.test(body + ' ' + s.title) || (s.status >= 400 && s.status !== 429 && s.status !== 999);
        const m = body.match(/([\d.,]+[KMk]?)\s+(followers|subscribers)/i); if (m) s.followers = m[0];
      } catch (e) { s.error = e.message.slice(0, 100); }
      await page.close();
    }
  }
  out.candidates = {};
  for (const [id, list] of Object.entries(CANDIDATES)) {
    out.candidates[id] = [];
    for (const u of list) {
      const page = await ctx.newPage(), c = { href: u };
      try {
        const r = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 }); await page.waitForTimeout(3000);
        c.status = r && r.status(); c.final = page.url(); c.title = (await page.title()).slice(0, 120);
        c.og = await page.$eval('meta[property="og:title"]', m => m.content).catch(() => null);
        c.desc = await page.$eval('meta[property="og:description"], meta[name="description"]', m => m.content.slice(0, 160)).catch(() => null);
        const body = (await page.evaluate(() => document.body ? document.body.innerText : '')).slice(0, 3000);
        c.dead = /isn.t available|page not found|this account doesn.t exist|this page doesn.t exist/i.test(body + ' ' + c.title);
      } catch (e) { c.error = e.message.slice(0, 100); }
      out.candidates[id].push(c); await page.close();
    }
  }
  await b.close();
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/brand-socials.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
