/* automation/service-centres.js
   Builds the data behind "service nearby" in the scooter match quiz.
   1. data/pincodes.json: map location for every Indian pincode, from the GeoNames postal code
      file (CC BY 4.0), averaged across the post offices that share a pincode.
   2. data/service-centres.json: dealer and service points for every brand we list.
      Main source: Google Places text search ("<brand> service centre") around each district,
      a slice of districts each week (biggest first) so the whole country is covered within weeks
      and the monthly request count stays inside Google's free allowance. Needs PLACES_API_KEY
      (a Google Cloud key with Places API (New) enabled), kept in GitHub secrets only.
      OpenStreetMap points (ODbL, © OpenStreetMap contributors) are merged in on top.
   Both files are read by api/service.js on the server; they are not loaded by visitors.
   Runs weekly from .github/workflows/service-centres.yml. Needs network access, no keys.
   Usage: node automation/service-centres.js [path/to/IN.txt] */
const fs = require('fs');

const BRANDS = {
  'ola-electric': /\bola\b/i,
  'ather-energy': /\bather\b/i,
  'tvs-motor': /\btvs\b/i,
  'bajaj-chetak': /\bbajaj\b|\bchetak\b/i,
  'hero-vida': /hero\s*moto\s*corp|\bvida\b|hero\s*honda|^hero\b.*(motor|two|auto|bike|service)/i,
  'ampere': /\bampere\b/i,
  'okinawa': /\bokinawa\b/i,
  'pure-ev': /\bpure\s*-?\s*ev\b/i,
  'bounce-infinity': /\bbounce\b/i,
  'bgauss': /\bb\s*-?\s*gauss\b/i
};
// names that match a brand word but are not scooter sales or service
const NOT_VEHICLE = /electricals|finserv|finance|allianz|housing|cab|taxi|bicycle|cycle\b|cycles\b|mall|insurance|tower|nagar|school|hospital|travels/i;
const VEHICLE_SHOP = /^(motorcycle|motorcycle_repair|car_repair|car|vehicles|scooter|electric_vehicle|e-bike|motorcycle_parts|car_parts|repair)$/;

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const QUERY = `[out:json][timeout:600];
area["ISO3166-1"="IN"][admin_level=2]->.in;
(
  nwr(area.in)["shop"~"motorcycle|car_repair|car|vehicles|scooter|electric|repair|motorcycle_repair"];
  nwr(area.in)["craft"~"motorcycle|vehicle"];
  nwr(area.in)["brand"~"Ather|TVS|Bajaj|Chetak|Ola Electric|Hero MotoCorp|Vida|Ampere|Okinawa|Pure EV|Bounce|BGauss",i]["amenity"!="charging_station"];
);
out center tags;`;

let DISTRICTS = [];
const QUERY_NAME = { 'ola-electric': 'Ola Electric', 'ather-energy': 'Ather', 'tvs-motor': 'TVS iQube', 'bajaj-chetak': 'Bajaj Chetak', 'hero-vida': 'Hero Vida', 'ampere': 'Ampere electric scooter', 'okinawa': 'Okinawa electric scooter', 'pure-ev': 'Pure EV', 'bounce-infinity': 'Bounce Infinity', 'bgauss': 'BGauss' };
const km = (a, b) => { const r = d => d * Math.PI / 180, x = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

// one Places text search; returns [[lat,lng], ...] for open places that carry the brand name
async function places(key, slug, d) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.location,places.businessStatus' },
    body: JSON.stringify({ textQuery: QUERY_NAME[slug] + ' service centre', regionCode: 'IN', pageSize: 20, locationBias: { circle: { center: { latitude: d.lat, longitude: d.lng }, radius: 40000 } } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Places ' + r.status + ' ' + ((j.error && j.error.message) || '').slice(0, 160));
  return (j.places || []).filter(p => p.location && p.businessStatus !== 'CLOSED_PERMANENTLY' && p.businessStatus !== 'CLOSED_TEMPORARILY'
    && BRANDS[slug].test((p.displayName && p.displayName.text) || '') && !NOT_VEHICLE.test(p.displayName.text)
    && km([d.lat, d.lng], [p.location.latitude, p.location.longitude]) <= 60)
    .map(p => [+p.location.latitude.toFixed(4), +p.location.longitude.toFixed(4)]);
}

async function overpass() {
  let last;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: QUERY }), headers: { 'user-agent': 'escooterwale.in service-centre refresh (info@escooterwale.in)' }, signal: AbortSignal.timeout(900000) });
      if (!r.ok) throw new Error(url + ' ' + r.status);
      const j = await r.json();
      if (!j.elements || !j.elements.length) throw new Error(url + ' returned nothing');
      return { src: url, els: j.elements };
    } catch (e) { last = e; console.log('overpass failed:', e.message); }
  }
  throw last;
}

function pincodes(file) {
  const acc = {}, dist = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const c = line.split('\t');
    if (c.length < 11) continue;
    const pin = c[1].trim(), lat = +c[9], lng = +c[10];
    if (!/^[1-9]\d{5}$/.test(pin) || !lat || !lng) continue;
    (acc[pin] = acc[pin] || []).push([lat, lng]);
    const d = (c[3] + ' | ' + c[5]).trim();
    (dist[d] = dist[d] || { n: 0, lat: 0, lng: 0, pins: new Set() });
    dist[d].n++; dist[d].lat += lat; dist[d].lng += lng; dist[d].pins.add(pin);
  }
  DISTRICTS = Object.entries(dist).map(([name, d]) => ({ name, lat: +(d.lat / d.n).toFixed(4), lng: +(d.lng / d.n).toFixed(4), pins: d.pins.size }))
    .sort((a, b) => b.pins - a.pins || a.name.localeCompare(b.name));
  const out = {};
  for (const [pin, pts] of Object.entries(acc)) {
    out[pin] = [+(pts.reduce((a, p) => a + p[0], 0) / pts.length).toFixed(3), +(pts.reduce((a, p) => a + p[1], 0) / pts.length).toFixed(3)];
  }
  return out;
}

(async () => {
  const report = { ranAt: new Date().toISOString() };
  const inTxt = process.argv[2] || 'IN.txt';
  if (fs.existsSync(inTxt)) {
    const P = pincodes(inTxt);
    report.pincodes = Object.keys(P).length;
    if (report.pincodes > 15000) fs.writeFileSync('data/pincodes.json', JSON.stringify({ _note: 'Pincode to map location, averaged per pincode. Source: GeoNames postal codes (CC BY 4.0). Refreshed by automation/service-centres.js.', updated: report.ranAt.slice(0, 10), pins: P }));
    else report.pincodeError = 'too few pincodes, kept the old file';
  } else report.pincodeError = 'no GeoNames file';

  let old = {}; try { old = JSON.parse(fs.readFileSync('data/service-centres.json', 'utf8')); } catch (e) {}
  const today = report.ranAt.slice(0, 10), brands = {};
  for (const slug of Object.keys(BRANDS)) {
    const o = (old.brands && old.brands[slug]) || {};
    brands[slug] = { places: o.places || {}, osm: o.osm || [], checked: o.checked || null };
  }

  // Google Places, a rotating slice of districts each week
  const key = process.env.PLACES_API_KEY || '';
  const budget = +process.env.PLACES_PER_WEEK || 1100;
  if (!key) report.places = 'skipped: no PLACES_API_KEY';
  else if (!DISTRICTS.length) report.places = 'skipped: no district list';
  else {
    const per = Math.max(1, Math.floor(budget / Object.keys(BRANDS).length));
    const start = ((old.placesCursor || 0) % DISTRICTS.length), slice = [];
    for (let i = 0; i < Math.min(per, DISTRICTS.length); i++) slice.push(DISTRICTS[(start + i) % DISTRICTS.length]);
    let calls = 0, fails = 0, firstErr = null;
    for (const d of slice) {
      for (const slug of Object.keys(BRANDS)) {
        try { brands[slug].places[d.name] = { at: today, pts: await places(key, slug, d) }; calls++; }
        catch (e) { fails++; firstErr = firstErr || e.message; if (fails >= 5 && !calls) break; }
      }
      if (fails >= 5 && !calls) break;
    }
    report.places = { districts: slice.length, from: slice[0] && slice[0].name, calls, fails, error: firstErr };
    if (calls) report.placesCursor = (start + slice.length) % DISTRICTS.length;
  }

  // OpenStreetMap on top
  try {
    const { src, els } = await overpass();
    report.osm = { source: src, elements: els.length, counts: {} };
    const fresh = {};
    for (const slug of Object.keys(BRANDS)) fresh[slug] = [];
    const seen = new Set();
    for (const e of els) {
      const t = e.tags || {}, lat = e.lat || (e.center && e.center.lat), lng = e.lon || (e.center && e.center.lon);
      if (!lat || !lng || t.amenity === 'charging_station') continue;
      const text = [t.brand, t.name, t['name:en'], t.operator].filter(Boolean).join(' | ');
      if (!text || NOT_VEHICLE.test(text)) continue;
      const shop = t.shop || t.craft || '';
      if (!t.brand && !VEHICLE_SHOP.test(shop)) continue;
      for (const [slug, re] of Object.entries(BRANDS)) {
        if (!re.test(text)) continue;
        const k = slug + ':' + lat.toFixed(3) + ',' + lng.toFixed(3);
        if (seen.has(k)) continue;
        seen.add(k); fresh[slug].push([+lat.toFixed(4), +lng.toFixed(4)]);
      }
    }
    for (const [slug, pts] of Object.entries(fresh)) {
      // a sudden big drop usually means a bad fetch, so keep last week's points
      if (brands[slug].osm.length > 20 && pts.length < brands[slug].osm.length * 0.6) report.osm.counts[slug] = `${pts.length} (kept ${brands[slug].osm.length})`;
      else { brands[slug].osm = pts; report.osm.counts[slug] = pts.length; }
    }
  } catch (e) { report.osmError = e.message; }

  // merged points per brand, near-duplicates (within about 150 m) removed
  const out = { _note: 'Dealer and service points per brand. Sources: Google Places (per district, refreshed in weekly slices) and OpenStreetMap (ODbL, © OpenStreetMap contributors). Built by automation/service-centres.js. "regions" = districts checked on Google Places; a brand with too few is treated as unknown by api/service.js.', updated: today, placesCursor: report.placesCursor != null ? report.placesCursor : (old.placesCursor || 0), districts: DISTRICTS.length || old.districts || 0, brands: {} };
  report.merged = {};
  for (const [slug, b] of Object.entries(brands)) {
    const all = [...Object.values(b.places).flatMap(r => r.pts), ...b.osm], keep = [], grid = new Set();
    for (const p of all) { const g = Math.round(p[0] * 700) + ',' + Math.round(p[1] * 700); if (grid.has(g)) continue; grid.add(g); keep.push(p); }
    const regions = Object.keys(b.places).length;
    out.brands[slug] = { checked: regions ? today : b.checked, regions, places: b.places, osm: b.osm, points: keep };
    report.merged[slug] = { points: keep.length, regions };
  }
  fs.writeFileSync('data/service-centres.json', JSON.stringify(out));
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/service-centres.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})();
