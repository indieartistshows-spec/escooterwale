/* ============================================================
   automation/lib/extract.js
   Pulls the eight brand-sourced fields out of a brand page:
   price, battery, claimed range, top speed, charging time,
   boot space, kerb weight, plus variant names.

   Brand sites differ a lot, so this tries several sources in
   order and records which one each value came from:
     1. JSON-LD Product/Offer blocks
     2. framework state (__NEXT_DATA__, __NUXT__, inline JSON)
     3. visible text, in a window around the model's name and
        battery size (so a page listing 3 variants is split
        correctly)
   Every function is pure (text in, values out) so it can be
   unit-tested against saved pages in automation/fixtures/.
   ============================================================ */

const num = s => parseFloat(String(s).replace(/,/g, ''));
const PRICE_MIN = 30000, PRICE_MAX = 400000;

/* All rupee amounts in a string, with their positions */
function prices(text) {
  const out = [];
  const re = /(?:₹|rs\.?|inr)\s*([0-9]{1,2}(?:,[0-9]{2})*,[0-9]{3}|[0-9]{5,6})(?:\.\d+)?(?:\s*\/-)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const v = num(m[1]);
    if (v >= PRICE_MIN && v <= PRICE_MAX) out.push({ v, at: m.index });
  }
  // "1.29 lakh" style
  const re2 = /(?:₹|rs\.?)\s*([0-9](?:\.[0-9]{1,2})?)\s*lakh/gi;
  while ((m = re2.exec(text))) {
    const v = Math.round(num(m[1]) * 100000);
    if (v >= PRICE_MIN && v <= PRICE_MAX) out.push({ v, at: m.index, approx: true });
  }
  return out.sort((a, b) => a.at - b.at);
}

const PATTERNS = {
  battery: [/(\d(?:\.\d{1,2})?)\s*kwh/i],
  range: [
    /(?:idc|certified|claimed|true|irde)\s*(?:range)?[^0-9]{0,25}(\d{2,3})\s*km(?!\s*\/\s*h)/i,
    /range[^0-9]{0,25}(\d{2,3})\s*km(?!\s*\/\s*h)/i,
    /(\d{2,3})\s*km(?!\s*\/\s*h)[^.\n]{0,25}(?:range|idc|per charge|on a single charge)/i
  ],
  speed: [
    /(?:top|max(?:imum)?)\s*speed[^0-9]{0,25}(\d{2,3})\s*km\s*\/?\s*h/i,
    /(\d{2,3})\s*km\s*\/?\s*h(?:r)?[^.\n]{0,15}(?:top|max)/i
  ],
  charging: [
    /(?:charging time|charge time|home charg\w*|0\s*[-–to]+\s*(?:80|100)\s*%)[^0-9]{0,30}(\d{1,2}(?:\.\d{1,2})?)\s*(?:hrs?|hours?|h)\b/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*(?:hrs?|hours?)\b[^.\n]{0,25}(?:0\s*[-–to]+\s*(?:80|100)|charg)/i,
    /(\d{1,2})\s*h(?:rs?)?\s*(\d{1,2})\s*m(?:in)?[^.\n]{0,25}(?:0\s*[-–to]+\s*(?:80|100)|charg)/i
  ],
  boot: [
    /(?:boot|storage|under[\s-]?seat)[^0-9]{0,25}(\d{2})\s*(?:l\b|litres?|liters?|ltrs?)/i,
    /(\d{2})\s*(?:l\b|litres?|liters?|ltrs?)[^.\n]{0,20}(?:boot|storage|under[\s-]?seat)/i
  ],
  weight: [
    /(?:kerb|curb|vehicle)\s*weight[^0-9]{0,25}(\d{2,3})\s*kg/i,
    /(\d{2,3})\s*kg[^.\n]{0,15}(?:kerb|curb)/i
  ]
};

const SANE = {
  battery: v => v >= 0.5 && v <= 8,
  range: v => v >= 30 && v <= 400,
  speed: v => v >= 20 && v <= 160,
  charging: v => v >= 0.5 && v <= 12,
  boot: v => v >= 5 && v <= 60,
  weight: v => v >= 50 && v <= 200
};

function firstMatch(text, field) {
  for (const re of PATTERNS[field]) {
    const m = text.match(re);
    if (!m) continue;
    let v = num(m[1]);
    if (field === 'charging' && m[2] && /h/i.test(m[0]) && /m/i.test(m[0]) && re === PATTERNS.charging[2]) v = num(m[1]) + num(m[2]) / 60;
    if (SANE[field](v)) return Math.round(v * 100) / 100;
  }
  return null;
}

/* Windows of text that mention this model: its name and (if given) its
   battery size within 200 characters of each other. */
function windowsFor(text, cfg) {
  const lower = text.toLowerCase();
  const names = (cfg.match || []).map(n => n.toLowerCase());
  const out = [];
  for (const n of names) {
    let i = -1;
    while ((i = lower.indexOf(n, i + 1)) !== -1) {
      // "S1 X" must not swallow "S1 X+"
      const after = lower[i + n.length];
      if (after === '+' && !n.endsWith('+')) continue;
      let w = text.slice(i, i + 650);
      const kws = [...w.matchAll(/(\d(?:\.\d{1,2})?)\s*kwh/gi)];
      if (cfg.kwh) {
        // the battery size has to sit right next to the name
        if (!kws.length || kws[0].index > 60 || Math.abs(num(kws[0][1]) - cfg.kwh) > 0.06) continue;
      }
      // stop where the next variant starts (the next kWh mention)
      if (kws.length > 1) w = w.slice(0, kws[1].index);
      // and at the next mention of a model name of the same family
      const nxt = names.map(x => lower.indexOf(x, i + n.length + 1)).filter(x => x > i).map(x => x - i);
      const cut = Math.min(...nxt.filter(x => x > 20), w.length);
      out.push(w.slice(0, cut));
    }
  }
  return out;
}

function fromJsonLd(jsonLdBlocks, cfg) {
  const found = [];
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = [].concat(o['@type'] || []).join(',');
    if (/Product|Vehicle|Car|Motorcycle/i.test(t)) {
      const name = String(o.name || '');
      const offers = [].concat(o.offers || []);
      for (const of of offers) {
        const p = num(of.price || of.lowPrice);
        if (p >= PRICE_MIN && p <= PRICE_MAX) found.push({ name, price: p });
      }
    }
    Object.values(o).forEach(walk);
  };
  for (const b of jsonLdBlocks) { try { walk(JSON.parse(b)); } catch (e) {} }
  const names = (cfg.match || []).map(n => n.toLowerCase());
  const hit = found.find(f => names.some(n => f.name.toLowerCase().includes(n)) && (!cfg.kwh || !/kwh/i.test(f.name) || f.name.includes(String(cfg.kwh))));
  return hit ? hit.price : (found.length === 1 ? found[0].price : null);
}

/* Main entry: page = { text, jsonLd: [strings], state: string|null } */
function extractModel(page, cfg) {
  const res = { fields: {}, source: {}, notes: [] };
  const ld = fromJsonLd(page.jsonLd || [], cfg);
  if (ld) { res.fields.price = ld; res.source.price = 'json-ld'; }

  const sources = [];
  if (page.state) sources.push({ name: 'state', text: page.state.replace(/\\u20b9/gi, '₹').replace(/["{}\[\]]/g, ' ') });
  sources.push({ name: 'text', text: page.text || '' });

  for (const src of sources) {
    const wins = windowsFor(src.text, cfg);
    if (!wins.length) continue;
    for (const w of wins) {
      if (res.fields.price == null) {
        const p = prices(w);
        if (p.length) {
          // the first exact amount after the name is usually the price; prefer exact over "lakh"
          const exact = p.filter(x => !x.approx);
          res.fields.price = (exact[0] || p[0]).v; res.source.price = src.name;
        }
      }
      for (const f of Object.keys(PATTERNS)) {
        if (res.fields[f] == null) {
          const v = firstMatch(w, f);
          if (v != null) { res.fields[f] = v; res.source[f] = src.name; }
        }
      }
    }
  }
  // battery must agree with the model we were asked for
  if (cfg.kwh && res.fields.battery != null && Math.abs(res.fields.battery - cfg.kwh) > 0.06) {
    res.notes.push(`battery on page ${res.fields.battery} kWh differs from ${cfg.kwh} kWh`);
  }
  if (!Object.keys(res.fields).length) res.notes.push('model name not found on page');
  return res;
}

/* Model names on a brand page that we do not list yet (launch detection).
   Looks for "<word> <code> ... <n> kWh" pairs with a price nearby. */
function candidateModels(text, knownNames) {
  const known = knownNames.map(n => n.toLowerCase());
  const out = new Map();
  const re = /([A-Z][A-Za-z0-9+\-]{1,12}(?:\s[A-Z0-9][A-Za-z0-9+\-]{0,10}){0,2})\s*(?:\(|[-|,]|\s)\s*(\d(?:\.\d{1,2})?)\s*kWh/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].trim(), kwh = num(m[2]);
    if (/^(battery|capacity|with|the|and|for|up|to|of|range|usable|lithium)$/i.test(name.split(' ')[0])) continue;
    if (known.some(k => k.includes(name.toLowerCase()) || name.toLowerCase().includes(k))) continue;
    const p = prices(text.slice(m.index, m.index + 400));
    if (!p.length) continue;
    out.set(`${name}|${kwh}`, { name, kwh, price: p[0].v });
  }
  return [...out.values()];
}

module.exports = { prices, firstMatch, windowsFor, extractModel, candidateModels, SANE };
