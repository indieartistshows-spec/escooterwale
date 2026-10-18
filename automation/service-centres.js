/* automation/service-centres.js
   Builds the data behind "service nearby" in the scooter match quiz.
   1. data/pincodes.json: map location for every Indian pincode, from the GeoNames postal code
      file (CC BY 4.0), averaged across the post offices that share a pincode.
   2. data/service-centres.json: dealer and service points for every brand we list, from
      OpenStreetMap (ODbL, © OpenStreetMap contributors).
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
  const acc = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const c = line.split('\t');
    if (c.length < 11) continue;
    const pin = c[1].trim(), lat = +c[9], lng = +c[10];
    if (!/^[1-9]\d{5}$/.test(pin) || !lat || !lng) continue;
    (acc[pin] = acc[pin] || []).push([lat, lng]);
  }
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
  try {
    const { src, els } = await overpass();
    report.source = src; report.osmElements = els.length;
    const brands = {};
    for (const slug of Object.keys(BRANDS)) brands[slug] = [];
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
        const key = slug + ':' + lat.toFixed(3) + ',' + lng.toFixed(3);
        if (seen.has(key)) continue;
        seen.add(key);
        brands[slug].push([+lat.toFixed(4), +lng.toFixed(4)]);
      }
    }
    const out = { _note: 'Dealer and service points per brand. Source: OpenStreetMap (ODbL, © OpenStreetMap contributors). Refreshed weekly by automation/service-centres.js. A brand with too few points falls back to the brand trust score in the quiz.', updated: report.ranAt.slice(0, 10), brands: {} };
    report.counts = {};
    for (const [slug, pts] of Object.entries(brands)) {
      const prev = old.brands && old.brands[slug];
      // a sudden big drop usually means a bad fetch, so keep last week's points
      if (prev && prev.points.length > 20 && pts.length < prev.points.length * 0.6) { out.brands[slug] = prev; report.counts[slug] = `${pts.length} (kept ${prev.points.length} from ${prev.checked})`; continue; }
      out.brands[slug] = { checked: report.ranAt.slice(0, 10), points: pts };
      report.counts[slug] = pts.length;
    }
    fs.writeFileSync('data/service-centres.json', JSON.stringify(out));
  } catch (e) { report.serviceError = e.message; }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/service-centres.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
})();
