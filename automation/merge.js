/* ============================================================
   automation/merge.js
   Applies automation/out/scrape.json to /data with the field lock
   and safety rules, and writes automation/out/changes.json for the
   weekly summary.

   FIELD LOCK: only these are ever written from a brand site:
     price, battery, range (claimed), speed, charging, bootSpace,
     weight, variants
   Images, ScootScore, real range, verdicts, bestFor/avoidIf,
   colours and everything else are never touched.

   SAFETY (per item, never blocks the whole run):
   - empty or unreadable value      -> keep the old value
   - price moves more than 25%      -> keep old, report as held
   - range/speed move more than 30% -> keep old, report as held
   - battery size changes           -> keep old, report (usually a
                                       variant mix-up, not a change)
   - brand whose pages failed       -> skipped, reported
   - model missing from brand page in 2 weekly runs (at least 6 days
     apart) -> reported as "possibly discontinued" for a person to
     check against the brand's site. Never marked automatically: a
     page that changed layout looks exactly like a dropped model.
   - over 40% of a brand's models missing in one run -> treated as a
     page the extractor could not read; nothing counted for that brand
   - fields listed in scrape-config "<id>": { "lock": ["price"] } are
     never written (brand pages whose banner shows a "starting at"
     price instead of the variant's own ex-showroom price)
   - unknown model on a brand page in 2 runs in a row -> logged as
     a new launch on /launches
   ============================================================ */
const fs = require('fs');
const J = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const W = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n');

const scrape = J('automation/out/scrape.json', null);
if (!scrape) { console.log('no scrape.json, nothing to merge'); process.exit(0); }
const scooters = J('data/scooters.json', []);
const cityPrices = J('data/city-prices.json', {});
const launches = J('data/launches.json', { events: [] });
const state = J('automation/state.json', { missing: {}, candidates: {} });
const TODAY = new Date().toISOString().slice(0, 10);
const BRANDS = J('data/brands.json', []);
const brandName = id => (BRANDS.find(b => b.id === id) || {}).name || id;

const LIMITS = { price: 0.25, range: 0.30, speed: 0.30, charging: 0.5, bootSpace: 0.5, weight: 0.3 };
const FMT = { battery: v => `${v} kWh`, range: v => `${Math.round(v)} km`, speed: v => `${Math.round(v)} km/h`, charging: v => `${v} hrs`, bootSpace: v => `${Math.round(v)} L`, weight: v => `${Math.round(v)} kg` };
const MAP = { price: 'price', battery: 'battery', range: 'range', speed: 'speed', charging: 'charging', boot: 'bootSpace', weight: 'weight' };
const num = v => parseFloat(String(v).replace(/,/g, '').match(/[\d.]+/)) || null;

const changes = { applied: [], held: [], skippedBrands: [], kept: [], discontinued: [], launches: [], cityPrices: 0 };

for (const [b, info] of Object.entries(scrape.brands || {})) if (!info.ok) changes.skippedBrands.push({ brand: b, errors: info.errors });
const failedBrands = new Set(changes.skippedBrands.map(x => x.brand));

const CFG = J('data/scrape-config.json', {});
const isFound = r => Object.keys(r.fields || {}).length > 0 && !(r.notes || []).includes('model name not found on page');
// a brand where many models "vanish" at once is a page the extractor could not read, not a line-up change
const unreadable = new Set();
{ const per = {};
  for (const s of scooters) { const r = (scrape.models || {})[s.id]; if (!r || s.discontinued) continue; const b = (per[s.brandSlug] = per[s.brandSlug] || { n: 0, miss: 0 }); b.n++; if (!isFound(r)) b.miss++; }
  for (const [b, x] of Object.entries(per)) if (x.n >= 2 && x.miss / x.n > 0.4) { unreadable.add(b); changes.skippedBrands.push({ brand: b, errors: [`${x.miss} of ${x.n} models not found on the page; treated as unreadable, nothing counted`] }); } }
const DAY = 864e5;
for (const s of scooters) {
  if (failedBrands.has(s.brandSlug) || unreadable.has(s.brandSlug) || s.discontinued) continue;
  const r = (scrape.models || {})[s.id];
  if (!r) continue;
  const found = isFound(r);

  // possibly discontinued: missing in two weekly runs at least 6 days apart. Reported, never applied.
  if (!found) {
    let m = state.missing[s.id];
    if (typeof m !== 'object' || !m) m = { n: 0, last: null };
    if (!m.last || (new Date(TODAY) - new Date(m.last)) >= 6 * DAY) { m.n++; m.last = TODAY; }
    state.missing[s.id] = m;
    if (m.n >= 2) changes.discontinued.push({ id: s.id, name: s.name, brand: s.brand, weeks: m.n, url: r.url });
    continue;
  }
  if (state.missing[s.id]) delete state.missing[s.id];
  const lock = new Set((CFG[s.id] || {}).lock || []);

  for (const [k, field] of Object.entries(MAP)) {
    const v = r.fields[k];
    if (v == null || Number.isNaN(v) || lock.has(field)) continue;
    const oldNum = field === 'price' ? s.price : num(s[field]);
    if (oldNum && Math.abs(v - oldNum) < 1e-9) continue;
    if (field === 'battery') { changes.held.push({ id: s.id, field, from: s.battery, to: FMT.battery(v), why: 'battery size differs; usually a variant mix-up' }); continue; }
    if (oldNum && LIMITS[field] != null && Math.abs(v - oldNum) / oldNum > LIMITS[field]) {
      changes.held.push({ id: s.id, field, from: field === 'price' ? s.price : s[field], to: field === 'price' ? v : FMT[field](v), why: `moved more than ${Math.round(LIMITS[field] * 100)}%` });
      continue;
    }
    const from = field === 'price' ? s.price : s[field];
    const to = field === 'price' ? Math.round(v) : FMT[field](v);
    if (String(from) === String(to)) continue;
    s[field] = to;
    // keep the nested spec table in step with the top-level field
    if (s.specs) {
      if (field === 'speed' && s.specs.performance) s.specs.performance['Top speed'] = to;
      if (field === 'charging') { if (s.specs.performance) s.specs.performance['Charging time'] = to; if (s.specs.battery) s.specs.battery['Charge time'] = to; }
      if (field === 'range' && s.specs.battery) s.specs.battery['Claimed range'] = to;
    }
    changes.applied.push({ id: s.id, field, from, to, source: (r.source || {})[k], url: r.url });
  }
}

// city prices: replace a city's value only when it was read this week and is sane against national
for (const [id, cities] of Object.entries(scrape.cities || {})) {
  const s = scooters.find(x => x.id === id); if (!s) continue;
  for (const [cityId, price] of Object.entries(cities)) {
    if (!price || Math.abs(price - s.price) / s.price > 0.25) { changes.held.push({ id, field: `price in ${cityId}`, to: price, why: 'city price more than 25% from national price' }); continue; }
    cityPrices[id] = cityPrices[id] || {};
    const prev = cityPrices[id][cityId];
    cityPrices[id][cityId] = { ex: Math.round(price), checked: TODAY };
    if (!prev || prev.ex !== Math.round(price)) changes.cityPrices++;
  }
}

// launches: a candidate has to show up in two runs in a row
const seenNow = new Set();
for (const c of scrape.candidates || []) {
  const key = `${c.brand}|${c.name}|${c.kwh}`;
  seenNow.add(key);
  state.candidates[key] = (state.candidates[key] || 0) + 1;
  const already = launches.events.some(e => e.type === 'launch' && e.key === key);
  if (state.candidates[key] >= 2 && !already) {
    const ev = { date: TODAY, type: 'launch', key, brand: brandName(c.brand), brandId: c.brand, name: `${c.name} ${c.kwh} kWh`, price: c.price, url: c.url, note: 'Spotted on the official brand website. Full review and ScootScore to follow.' };
    launches.events.unshift(ev); changes.launches.push(ev);
  }
}
for (const k of Object.keys(state.candidates)) if (!seenNow.has(k)) delete state.candidates[k];

W('data/scooters.json', scooters);
W('data/city-prices.json', cityPrices);
W('data/launches.json', launches);
W('automation/state.json', state);
W('automation/out/changes.json', changes);
console.log(`merge: ${changes.applied.length} applied, ${changes.held.length} held, ${changes.cityPrices} city prices, ${changes.launches.length} launches, ${changes.discontinued.length} discontinued, ${changes.skippedBrands.length} brands skipped`);
