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
        title: `${s.fullName} Price ${s.priceDisplay}: On-Road Price and Real Range ${YEAR} | EScooterwale`,
        desc: `${s.fullName} costs ${s.priceDisplay} ex-showroom${where}. See the on-road price in your city, real range of ${span(s.realRange)} (${s.range} claimed), EMI, subsidy and who should skip it.`
      };
    },

    brand(b, models) {
      const prices = models.map(m => m.price).sort((x, y) => x - y);
      const short = b.shortName || b.name;
      const lo = prices[0], hi = prices[prices.length - 1];
      return {
        title: `${short} Electric Scooter Price ${YEAR}: ${inr(lo)} to ${inr(hi)}, All ${models.length} Models | EScooterwale`,
        desc: `Every ${short} electric scooter on sale in India, ${models.length} models from ${inr(lo)} to ${inr(hi)}. Real-world range from our own tests, ScootScore, subsidy and on-road price for each.`
      };
    },

    city(c, opts) {
      const o = opts || {};
      return {
        title: `Electric Scooter Price in ${c.name} ${YEAR}: On-Road Prices | EScooterwale`,
        desc: `On-road prices for ${o.count || 41} electric scooters in ${c.name}, plus what ${o.state || c.state} gives you in subsidy and road tax${o.taxLine ? ' (' + o.taxLine + ')' : ''}. Dealers, charging and real range.`
      };
    },

    compare(a, b) {
      return {
        title: `${a.fullName} vs ${b.fullName}: Which to Buy (${YEAR})`,
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

  root.SEO = SEO;
  if (typeof module !== 'undefined') module.exports = SEO;
})(typeof window !== 'undefined' ? window : globalThis);
