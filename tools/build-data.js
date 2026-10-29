/* ============================================================
   tools/build-data.js  —  data/*.json  ->  data.js
   data.js is GENERATED. Edit the JSON files in /data instead.
   Keeps every global the templates already use (SCOOTERS_DB,
   BRANDS_DB, NEWS_DB, CITIES_DB + helpers) and adds:
     SUBSIDY      verified central + state rules (data/subsidy.json)
     SW_CONFIG    headline city etc. (data/site-config.json)
     each scooter gets: fullName, shortBrand, subsidy, cityPrices
   Derived fields (priceDisplay, onRoad, emiFrom, tagline) are
   recalculated here so they can never drift from the price.
   ============================================================ */
const fs = require('fs');
// every data file passes the site's emoji rule (tools/emoji.js), so emoji in new video titles
// or news from the weekly automation never reach the pages
const { stripDeep } = require('./emoji');
const J = f => stripDeep(JSON.parse(fs.readFileSync(f, 'utf8')));
const scooters = J('data/scooters.json');
// square thumbnails with the scooter in focus (tools/card-images.js); the full photo stays as heroImg
// keep middleware.js's copy of the headline city and city list current (pairs are append only)
{ const f = 'data/compare-pairs.json', cp = JSON.parse(fs.readFileSync(f, 'utf8')), cfg = JSON.parse(fs.readFileSync('data/site-config.json', 'utf8'));
  const cities = JSON.parse(fs.readFileSync('data/cities.json', 'utf8')).map(c => c.id), hc = cfg.headlineCity || null;
  if (cp.headlineCity !== hc || JSON.stringify(cp.cities) !== JSON.stringify(cities)) { cp.headlineCity = hc; cp.cities = cities; fs.writeFileSync(f, JSON.stringify(cp, null, 1) + '\n'); } }
// match quiz points per scooter (data/match-points.json), as s.mp = { range, performance, ... }
{ const MP = JSON.parse(fs.readFileSync('data/match-points.json', 'utf8')); for (const s of scooters) { const v = MP.points[s.id]; if (v) s.mp = Object.fromEntries(MP.order.map((k, i) => [k, v[i]])); } }
for (const s of scooters) { const sq = `/images/cards/${s.id}.webp`; if (fs.existsSync('.' + sq)) s.cardImg = sq + '?v=' + Math.round(fs.statSync('.' + sq).mtimeMs / 1000).toString(36); }
const brands = J('data/brands.json');
const news = J('data/news.json');
const cities = J('data/cities.json');
const subsidy = J('data/subsidy.json');
const cityPrices = J('data/city-prices.json');   // { scooterId: { cityId: { ex: 123, checked: 'YYYY-MM-DD', url } } }
const config = J('data/site-config.json');
const evSales = J('data/ev-sales.json');
const brandLinks = J('data/brand-links.json'); delete brandLinks._note;

const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const kwh = s => parseFloat(String(s.battery).match(/[\d.]+/)[0]);
const brandById = Object.fromEntries(brands.map(b => [b.id, b]));

function fullName(s) {
  const short = (brandById[s.brandSlug] || {}).shortName || s.brand;
  const last = short.split(' ').pop().toLowerCase();
  const name = s.name.toLowerCase().startsWith(last + ' ') ? s.name.slice(last.length + 1) : s.name;
  return `${short} ${name}`;
}

function centralSubsidy(s) {
  const c = subsidy.central, k = kwh(s), exFactory = Math.round(s.price / (1 + c.gstPct / 100));
  if (exFactory > c.exFactoryCeiling) return { eligible: false, amount: 0, exFactory };
  return { eligible: true, amount: Math.round(Math.min(c.ratePerKwh * k, c.cap, c.capPctExFactory / 100 * exFactory)), exFactory };
}

function onRoadFor(ex, stateId) {
  const m = subsidy.onRoadModel, st = subsidy.states[stateId] || {};
  const rt = st.roadTax || {};
  const roadTax = rt.type === 'percent' ? ex * rt.pct / 100 : 0;
  const insurance = m.insuranceBase + ex * m.insurancePct / 100;
  return { onRoad: Math.round((ex + roadTax + insurance + m.handling + m.registration) / 10) * 10, roadTaxKnown: rt.type !== 'unconfirmed' };
}

function emi(p) {
  const { months, annualRatePct } = subsidy.emiModel, r = annualRatePct / 1200;
  return Math.round(p * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
}

const headline = config.headlineCity;
// city subsidy labels come from the verified subsidy file, never typed by hand
for (const c of cities) {
  const st = subsidy.states[subsidy.cityState[c.id]] || {};
  const amt = st.cash ? st.cash.amount : 0;
  c.subsidy = amt ? inr(amt) : (amt === null ? 'Unclear' : '₹0');
  c.stateId = subsidy.cityState[c.id];
}
// GA event name per model (data/scooters.json gaEvent): letters, digits and _ only, max 40, unique.
// A model added without one gets a code made from its id, so tracking never silently stops.
{ const seen = new Set();
  for (const s of scooters) {
    if (!s.gaEvent || !/^[a-z][a-z0-9_]{0,39}$/.test(s.gaEvent)) { s.gaEvent = ('m_' + s.id.replace(/-kwh$/, '').replace(/point/g, '').replace(/[^a-z0-9]+/g, '_')).slice(0, 40); console.warn(`gaEvent missing for ${s.id}, using ${s.gaEvent}`); }
    if (seen.has(s.gaEvent)) throw new Error('duplicate gaEvent ' + s.gaEvent);
    seen.add(s.gaEvent);
  } }
for (const s of scooters) {
  s.shortBrand = (brandById[s.brandSlug] || {}).shortName || s.brand;
  s.fullName = fullName(s);
  // national ex-showroom stays in s.price; city prices layered on top
  s.nationalPrice = s.price;
  s.nationalPriceDisplay = inr(s.price);
  const cp = cityPrices[s.id] || {};
  s.cityPrices = {};
  for (const c of cities) {
    const st = subsidy.cityState[c.id];
    // brand's own city ex-showroom when we have it, otherwise the national price
    // with this city's road tax and charges on top (exConfirmed tells the page which)
    const exConfirmed = !!(cp[c.id] && cp[c.id].ex);
    const ex = exConfirmed ? cp[c.id].ex : s.nationalPrice;
    const o = onRoadFor(ex, st);
    s.cityPrices[c.id] = { city: c.name, ex, exDisplay: inr(ex), exConfirmed, onRoad: o.onRoad, onRoadDisplay: inr(o.onRoad), roadTaxKnown: o.roadTaxKnown, emi: emi(ex), checked: exConfirmed ? cp[c.id].checked : null };
  }
  // headline price = headline city when we have it, else national
  const h = s.cityPrices[headline] && s.cityPrices[headline].exConfirmed ? s.cityPrices[headline] : null;
  const headEx = h ? h.ex : s.price;
  // no headline city: the national figure is the lowest on-road across our cities ("on-road from")
  const headOn = h ? h.onRoad : headline ? onRoadFor(s.price, subsidy.cityState[headline]).onRoad : Math.min(...Object.values(s.cityPrices).map(c => c.onRoad));
  s.headlinePriceCity = h ? headline : null;
  s.price = headEx;
  s.priceDisplay = inr(headEx);
  s.onRoad = headOn;
  s.onRoadDisplay = inr(headOn);
  s.emiFrom = emi(headEx);
  s.subsidy = centralSubsidy({ ...s, price: s.nationalPrice });
  // internal tag name kept for the listings filter; shown as "PM E-DRIVE eligible"
  s.tags = (s.tags || []).filter(x => x !== 'fame-eligible').concat(s.subsidy.eligible ? ['fame-eligible'] : []);
  s.tagline = `${s.fullName} | ${s.range} claimed | ${s.speed}`;
  if (s.variants) s.variants.forEach(v => { if (v.price) v.priceDisplay = inr(v.price); });
}

const header = `/* ============================================================
   EScooterwale data.js  |  GENERATED by tools/build-data.js on ${config.dataUpdated}
   Do not edit by hand: change /data/*.json and run the build.
   ${brands.length} brands, ${scooters.filter(s => !s.discontinued).length} scooters on sale (${scooters.length} incl. discontinued). Headline price city: ${headline}.
   ============================================================ */\n\n`;
const out = header +
  // every model ever listed (discontinued ones keep their page); SCOOTERS_DB is the on-sale catalogue
  `const SCOOTERS_ALL = ${JSON.stringify(scooters)};\n\n` +
  `const SCOOTERS_DB = SCOOTERS_ALL.filter(s=>!s.discontinued);\n\n` +
  `const BRAND_SOCIALS = ${JSON.stringify(J('data/brand-socials.json').brands)};\n\n` +
  `const MODEL_NOTES = ${JSON.stringify(J('data/model-notes.json').brands)};\n\n` +
  `const COMPARE_PAIRS = ${JSON.stringify(J('data/compare-pairs.json').pairs)};\n\n` +
  `const MOST_VIEWED = ${JSON.stringify((({ from, to, models }) => ({ from, to, models }))(J('data/most-viewed.json')))};\n\n` +
  `const CITY_MOST_VIEWED = ${JSON.stringify((() => { try { const c = J('data/city-most-viewed.json'); return { minVisits: c.minVisits || 2, from: c.from, to: c.to, cities: c.cities || {} }; } catch (e) { return { minVisits: 2, cities: {} }; } })())};\n\n` +
  `const BRANDS_DB = ${JSON.stringify(brands)};\n\n` +
  `const NEWS_DB = ${JSON.stringify(news)};\n\n` +
  `const CITIES_DB = ${JSON.stringify(cities)};\n\n` +
  `const SUBSIDY = ${JSON.stringify(subsidy)};\n\n` +
  `const BRAND_LINKS = ${JSON.stringify(brandLinks)};\n\n` +
  `const EV_SALES = ${JSON.stringify(evSales)};\n\n` +
  `const BRAND_VIDEOS = ${JSON.stringify((() => { try { return J('data/brand-videos.json').videos; } catch (e) { return {}; } })())};\n\n` +
  `const AGG_LINKS = ${JSON.stringify((() => { try { return J('data/aggregator-links.json'); } catch (e) { return { families: {} }; } })())};\n\n` +
  `const SW_CONFIG = ${JSON.stringify({ headlineCity: headline, headlineCityName: (cities.find(c => c.id === headline) || {}).name, dataUpdated: config.dataUpdated, langsLive: (() => { try { return require('./i18n-live.js').liveLangs(); } catch (e) { return []; } })() }, null, 1)};\n\n` +
`function getById(id)       { return SCOOTERS_ALL.find(s=>s.id===id); }
function getByBrand(slug)  { return SCOOTERS_DB.filter(s=>s.brandSlug===slug); }
function getSorted(by)     { return [...SCOOTERS_DB].sort((a,b)=>b[by]-a[by]); }
function getBrandById(id)  { return BRANDS_DB.find(b=>b.id===id); }
if(typeof module!=='undefined') module.exports={CITY_MOST_VIEWED,SCOOTERS_ALL,MODEL_NOTES,COMPARE_PAIRS,MOST_VIEWED,BRAND_SOCIALS,BRAND_VIDEOS,AGG_LINKS,SCOOTERS_DB,BRANDS_DB,NEWS_DB,CITIES_DB,SUBSIDY,SW_CONFIG,EV_SALES,BRAND_LINKS};
`;
fs.writeFileSync('data.js', out);
// Trending archive goes in its own file so data.js stays small as it grows
const trending = J('data/trending.json');
// nothing ever leaves the site: anything in last build's archive that is missing from
// data/trending.json is put back (articles by url, videos by videoId), and the data file is saved
{
  let prev = null; try { prev = require(require('path').resolve('trending-data.js')).TRENDING; } catch (e) {}
  if (prev) {
    const raw = JSON.parse(fs.readFileSync('data/trending.json', 'utf8')); let back = 0;
    for (const [list, key] of [['articles', 'url'], ['videos', 'videoId']]) {
      const have = new Set((raw[list] || []).map(x => x[key]));
      for (const x of prev[list] || []) if (x[key] && !have.has(x[key])) { raw[list].push(x); trending[list].push(x); have.add(x[key]); back++; }
    }
    if (back) { fs.writeFileSync('data/trending.json', JSON.stringify(raw, null, 1) + '\n'); console.log(`trending: put back ${back} items that had gone missing`); }
  }
}
fs.writeFileSync('trending-data.js', `/* GENERATED from data/trending.json by tools/build-data.js. Append-only archive. */\nconst TRENDING = ${JSON.stringify({ videos: trending.videos, articles: trending.articles })};\nif(typeof module!=='undefined') module.exports={TRENDING};\n`);
console.log(`data.js written: ${scooters.length} scooters, headline city ${headline}, ${Object.keys(cityPrices).length} models with city prices`);
