/* api/service.js | Vercel serverless function: how close each brand's service is to a pincode.
   GET /api/service?pin=400050 → { found, pin, updated, brands: { <brandSlug>: { km, n15, thin } } }
   km   = distance to the nearest dealer or service point, straight line, rounded
   n15  = how many points are within 15 km
   thin = true when that brand has not been checked on Google Places in enough districts, or the
          data is stale, or no brand at all has a point near this pincode (an area we have not
          covered yet); the quiz then falls back to the brand trust score.
   far  = nearest point is over 50 km while another brand has one within 20 km; the quiz then
          shows the scooter as a close match only.
   Data: data/pincodes.json (GeoNames) and data/service-centres.json (OpenStreetMap), refreshed
   weekly by automation/service-centres.js. No personal data is stored. */
let PINS = null, SC = null;
function load() {
  if (PINS) return;
  try { PINS = require('../data/pincodes.json').pins; } catch (e) { PINS = {}; }
  try { SC = require('../data/service-centres.json'); } catch (e) { SC = { brands: {} }; }
}
const MIN_REGIONS = 50, MAX_AGE_DAYS = 45, NO_DATA_KM = 40;

// pincode → location; unknown pincodes use the average of their nearest neighbours by prefix
function locate(pin) {
  if (PINS[pin]) return PINS[pin];
  for (const n of [5, 4, 3]) {
    const pre = pin.slice(0, n), hits = Object.keys(PINS).filter(p => p.startsWith(pre));
    if (hits.length) return [hits.reduce((a, p) => a + PINS[p][0], 0) / hits.length, hits.reduce((a, p) => a + PINS[p][1], 0) / hits.length];
  }
  return null;
}
const rad = d => d * Math.PI / 180;
function km(a, b) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

module.exports = (req, res) => {
  load();
  const pin = String((req.query && req.query.pin) || '').trim();
  res.setHeader('content-type', 'application/json');
  if (!/^[1-9]\d{5}$/.test(pin)) { res.statusCode = 400; return res.end(JSON.stringify({ found: false, error: 'pin' })); }
  const at = locate(pin);
  if (!at) return res.end(JSON.stringify({ found: false, pin }));
  const now = Date.now(), brands = {};
  for (const [slug, b] of Object.entries(SC.brands || {})) {
    const pts = b.points || [], stale = !b.checked || (now - Date.parse(b.checked)) / 864e5 > MAX_AGE_DAYS;
    const sparse = (b.regions || 0) < MIN_REGIONS;
    let best = Infinity, n15 = 0;
    for (const p of pts) { const d = km(at, p); if (d < best) best = d; if (d <= 15) n15++; }
    brands[slug] = { km: isFinite(best) ? Math.round(best * 10) / 10 : null, n15, thin: sparse || stale };
  }
  const solid = Object.values(brands).filter(b => !b.thin && b.km != null);
  if (!solid.some(b => b.km <= NO_DATA_KM)) for (const b of Object.values(brands)) b.thin = true;
  const near = solid.some(b => b.km <= 20);
  for (const b of Object.values(brands)) b.far = !b.thin && near && b.km != null && b.km > 50;
  res.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.end(JSON.stringify({ found: true, pin, updated: SC.updated || null, brands }));
};
