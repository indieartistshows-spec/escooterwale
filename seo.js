/* ============================================================
   seo.js  |  one place for every page title, meta description
   and social title on escooterwale.in. Used by the page
   templates in the browser and by the build scripts in Node.

   House style (keep it):
   - no em dashes or en dashes anywhere; use "|", ":" or commas
   - write like a person helping a friend buy a scooter: plain
     words, real numbers, no hype ("ultimate", "discover",
     "seamless", "unlock", "whether you're"), no exclamation marks
   - titles under ~60 characters where possible, brand last
   ============================================================ */
(function (root) {
  const YEAR = 2026;
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  // "80–90 km" -> "80 to 90 km" (no dashes in copy)
  const span = v => String(v || '').replace(/\s*[–—-]\s*/g, ' to ').replace(/km km/g, 'km');
  const lakh = n => n >= 100000 ? '₹' + (n / 100000).toFixed(n % 100000 ? 2 : 0).replace(/\.?0+$/, '') + ' lakh' : inr(n);
  // data.js declares its globals with const, which are not window properties
  const G = name => { try { return eval(name); } catch (e) { return root[name]; } };
  const cityName = () => { const c = G('SW_CONFIG'); return (c && c.headlineCityName) || ''; };
  const clean = s => String(s).replace(/\s*[–—]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();

  const SEO = {
    inr, span, lakh, clean,

    scooter(s) {
      const where = s.headlinePriceCity ? ` in ${cityName()}` : '';
      return {
        // price searches dominate (Search Console, Oct 2026): price and on-road price up front
        title: `${s.fullName} Price ${s.priceDisplay}: Real Range ${YEAR} | EScooterwale`, // short: Google shows about 60 characters
        desc: `${s.fullName} costs ${s.priceDisplay} ex-showroom${where}. See the on-road price in your city, real range of ${span(s.realRange)} (${s.range} claimed), EMI, subsidy and who should skip it.`
      };
    },

    brand(b, models) {
      const prices = models.map(m => m.price).sort((x, y) => x - y);
      const short = b.shortName || b.name;
      const lo = prices[0], hi = prices[prices.length - 1];
      // the name people search with ("chetak price", "hero vida price"); search terms: price, all model price, top model price
      const name = { 'bajaj-chetak': 'Bajaj Chetak', 'hero-vida': 'Hero Vida' }[b.id] || short;
      const sorted = models.slice().sort((x, y) => x.price - y.price), top = sorted[sorted.length - 1];
      return {
        title: models.length > 1 ? `${name} Electric Scooter Price ${YEAR}: All ${models.length} Models | EScooterwale` : `${name} ${top.name.replace(/\s*[\d.]+\s*kWh$/i, '')} Price ${YEAR}: ${inr(lo)} | EScooterwale`,
        desc: models.length > 1 ? `${name} electric scooter price list: all ${models.length} models from ${inr(lo)} to ${inr(hi)} ex-showroom. Top model ${top.name} at ${inr(top.price)}, on-road prices, real range and ScootScore for each.` : `${name} ${top.name} price ${inr(lo)} ex-showroom. On-road price, real range, ScootScore and subsidy.`
      };
    },

    city(c, opts) {
      const o = opts || {};
      return {
        // searched as "electric scooter price hyderabad", "scooty price in kolkata", "ev scooter price in ahmedabad"
        title: `Electric Scooter Price in ${c.name} ${YEAR}: On-Road Prices | EScooterwale`,
        desc: `EV scooter and scooty prices in ${c.name}: ${o.count || 41} models${o.minOn ? ' from ' + inr(o.minOn) + ' on-road' : ''}, plus ${o.state || c.state} subsidy and road tax${o.taxLine ? ' (' + o.taxLine + ')' : ''}. Showrooms near you and real range.`
      };
    },

    compare(a, b) {
      // same family ("Rizta S vs Rizta Z"): people search the difference, so say it that way
      const fam = x => String(x.name).split(' ')[0];
      if (a.brandSlug === b.brandSlug && fam(a) === fam(b)) {
        return {
          // Semrush flags titles over 70 characters: long model names get the shorter form
          title: (t => t.length > 70 ? `${a.fullName} vs ${b.name}: Difference and Price` : t)(`${a.fullName} vs ${b.name}: Difference, Price and Range (${YEAR})`),
          desc: `${a.fullName} vs ${b.name}: what is the difference? ${a.priceDisplay} vs ${b.priceDisplay}, real range ${span(a.realRange)} vs ${span(b.realRange)}, specs and which one to buy.`
        };
      }
      return {
        title: (t => t.length > 70 ? `${a.fullName} vs ${b.fullName}: Which to Buy` : t)(`${a.fullName} vs ${b.fullName}: Which to Buy (${YEAR})`),
        desc: `${a.fullName} at ${a.priceDisplay} or ${b.fullName} at ${b.priceDisplay}? Real-world range, specs, running cost and our verdict, side by side.`
      };
    },

    best(cat, picks) {
      const names = picks.slice(0, 3).map(p => p.fullName);
      const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join('');
      return { title: clean(cat.seoTitle), desc: clean(cat.seoDescLead) + (list ? ` Our top picks: ${list}.` : '') };
    }
  };

  /* Fill live facts into any element marked data-sw="...", so counts and
     dates on static pages never go stale. */
  SEO.fillFacts = function (doc) {
    const S = G('SCOOTERS_DB'); if (!doc || !S) return;
    const B = G('BRANDS_DB') || [], C = G('SW_CONFIG'), SU = G('SUBSIDY');
    const num = v => parseFloat(String(v).match(/[\d.]+/)) || 0;
    const facts = {
      models: S.length,
      brands: B.length,
      updated: C ? new Date(C.dataUpdated).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '',
      bestRange: Math.max(...S.map(s => num(s.range))) + ' km',
      fastestCharge: Math.min(...S.map(s => num(s.charging)).filter(x => x > 0)) + ' hrs',
      maxCentral: SU ? inr(SU.central.cap) : '',
      priceCityIn: C && C.headlineCityName && S.some(s => s.headlinePriceCity) ? ' in ' + C.headlineCityName + ' unless a city is shown' : ''
    };
    doc.querySelectorAll('[data-sw]').forEach(el => { const v = facts[el.getAttribute('data-sw')]; if (v !== undefined && v !== '') el.textContent = v; });
  };
  if (typeof document !== 'undefined') {
    const go = () => { SEO.fillFacts(document); setTimeout(() => SEO.fillFacts(document), 0); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    window.addEventListener('load', () => SEO.fillFacts(document));
  }

  // Google shows about 60 characters of a title; a longer one drops its " | EScooterwale" ending.
  // Same rule as tools/optimize-html.js (built pages) and i18n-runtime.js (translated pages).
  // Title rules (Semrush flags over 70 characters, and a title the same as the H1):
  //  1. over 60 characters: drop the " | EScooterwale" ending
  //  2. still over 70: keep the part before the first ": " (the subject comes first in our titles)
  //  3. if that leaves it the same as the page's H1, try the other forms
  SEO.shortTitle = (t, h1) => {
    t = String(t).trim();
    const SUF = /\s*\|\s*EScooterwale\s*$/, base = t.replace(SUF, '').trim(), hasSuf = SUF.test(t);
    // head: the longest start of the title, up to 70 characters, that ends at ": ", "? " or ", "
    let head = null;
    let first = null;
    for (const m of base.matchAll(/(: |\? |, )/g)) { const h = base.slice(0, m.index) + (m[1] === '? ' ? '?' : ''); if (h.length < 20) continue; if (!first) first = h; if (h.length <= 70) head = h; }
    if (!head && first && first.length < base.length) head = first; // nothing fits: the shortest clean start
    let out = !hasSuf || t.length <= 60 ? t : base;
    if (out.length > 70 && head) out = head;
    const same = x => !!h1 && x.trim().toLowerCase() === String(h1).replace(/\s+/g, ' ').trim().toLowerCase();
    if (same(out)) {
      const alts = [base + ' | EScooterwale', head, head && head + ' | EScooterwale'].filter(x => x && x.length <= 70 && !same(x));
      if (alts.length) out = alts[0];
    }
    return out;
  };
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && !(typeof navigator !== 'undefined' && navigator.webdriver) && !/^\/(hi|mr|ta|te|kn|gu|bn|or)(\/|$)/.test(location.pathname)) {
    // English pages: page scripts set the title after load, keep it short whenever it changes.
    // Not while the build renders pages (webdriver): the build keeps full titles for translation
    // and tools/optimize-html.js shortens them afterwards.
    const fix = () => { const el = document.querySelector('title'), h = document.querySelector('h1'); if (el) { const v = SEO.shortTitle(el.textContent, h && h.textContent); if (v !== el.textContent) el.textContent = v; } };
    new MutationObserver(fix).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    fix();
  }

  root.SEO = SEO;
  if (typeof module !== 'undefined') module.exports = SEO;
})(typeof window !== 'undefined' ? window : globalThis);
