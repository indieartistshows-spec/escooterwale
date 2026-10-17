/* automation/aggregator-links.js
   Finds the real BikeWale, BikeDekho and EVIndia pages for every model family and
   writes data/aggregator-links.json for the SEO link footer. Each candidate URL is
   opened in a browser; it is kept only if it loads, is not a search or home page and
   its title names the model. Otherwise the site's brand page is used, and failing
   that the site itself. Runs weekly and from .github/workflows/links.yml. */
const fs = require('fs');
const { chromium } = require('playwright');
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const OUT = 'data/aggregator-links.json';
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { families: {} };

const BW = { 'ola-electric': ['ola-bikes', 'ola-electric-bikes'], 'ather-energy': ['ather-bikes', 'ather-energy-bikes'], 'tvs-motor': ['tvs-bikes'], 'bajaj-chetak': ['bajaj-bikes', 'chetak-bikes'], 'hero-vida': ['vida-bikes', 'hero-bikes', 'hero-electric-bikes'], ampere: ['ampere-bikes'], okinawa: ['okinawa-bikes'], 'pure-ev': ['pure-ev-bikes', 'pureev-bikes'], 'bounce-infinity': ['bounce-infinity-bikes', 'bounce-bikes'], bgauss: ['bgauss-bikes'] };
const BD = { 'ola-electric': ['ola-electric', 'ola'], 'ather-energy': ['ather', 'ather-energy'], 'tvs-motor': ['tvs'], 'bajaj-chetak': ['bajaj', 'chetak'], 'hero-vida': ['vida', 'hero-electric', 'hero'], ampere: ['ampere'], okinawa: ['okinawa'], 'pure-ev': ['pure-ev', 'pureev'], 'bounce-infinity': ['bounce-infinity', 'bounce'], bgauss: ['bgauss'] };
const slug = s => s.toLowerCase().replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const fams = new Map();
for (const s of S) {
  const base = s.name.replace(/\s*[\d.]+\s*kWh$/i, '').trim();
  const key = `${s.brandSlug}|${base}`;
  if (!fams.has(key)) fams.set(key, { key, brandId: s.brandSlug, base, ids: [] });
  fams.get(key).ids.push(s.id);
}
const cands = f => {
  const full = slug(f.base), first = slug(f.base.split(/\s+/)[0]), two = slug(f.base.split(/\s+/).slice(0, 2).join(' '));
  const ms = [...new Set([full, two, first].filter(x => x && !/^\d+$/.test(x)))];
  return {
    bikewale: [...BW[f.brandId].flatMap(b => ms.map(m => `https://www.bikewale.com/${b}/${m}/`)), ...BW[f.brandId].map(b => `https://www.bikewale.com/${b}/`), 'https://www.bikewale.com/electric-bikes/'],
    bikedekho: [...BD[f.brandId].flatMap(b => ms.map(m => `https://www.bikedekho.com/${b}/${m}`)), ...BD[f.brandId].map(b => `https://www.bikedekho.com/${b}-bikes`), 'https://www.bikedekho.com/electric-bikes'],
    evindia: [...ms.map(m => `https://evindia.online/electric-scooters/${m}`), 'https://evindia.online/compare', 'https://evindia.online/electric-scooters', 'https://evindia.online/']
  };
};
const word = f => f.base.split(/\s+/).find(w => /[a-z]{3,}/i.test(w)) || f.base;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', locale: 'en-IN' });
  const cache = {};
  const check = async (url, mustName) => {
    if (url in cache) return cache[url];
    const p = await ctx.newPage();
    let ok = false;
    try {
      const r = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const fin = new URL(p.url());
      const title = (await p.title()).toLowerCase();
      ok = !!r && r.status() < 400 && !/search|404|not-found/i.test(fin.pathname) && !/not found|404|page not available/.test(title) &&
        (!mustName || title.includes(mustName.toLowerCase())) && (fin.pathname !== '/' || /\/$/.test(new URL(url).pathname) && new URL(url).pathname === '/');
      if (ok) ok = fin.href;
    } catch (e) { ok = false; } finally { await p.close(); }
    return (cache[url] = ok);
  };
  const out = { checked: new Date().toISOString().slice(0, 10), families: {} };
  for (const f of fams.values()) {
    const c = cands(f), w = word(f), row = { brandId: f.brandId, name: f.base, ids: f.ids };
    for (const site of ['bikewale', 'bikedekho', 'evindia']) {
      let got = null, level = null;
      const list = c[site];
      for (let i = 0; i < list.length && !got; i++) {
        const tail = site === 'evindia' ? 3 : (site === 'bikewale' ? BW : BD)[f.brandId].length + 1;
        const isModel = i < list.length - tail;
        const r = await check(list[i], isModel ? w : null);
        if (r) { got = list[i]; level = isModel ? 'model' : (i === list.length - 1 ? 'site' : 'brand'); }
      }
      row[site] = got ? { url: got, level } : ((prev.families[f.key] || {})[site] || { url: list[list.length - 1], level: 'site' });
    }
    out.families[f.key] = row;
    console.log(f.key, '|', row.bikewale.level, row.bikewale.url, '|', row.bikedekho.level, row.bikedekho.url, '|', row.evindia.level, row.evindia.url);
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
})();
