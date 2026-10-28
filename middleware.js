/* middleware.js | Vercel Routing Middleware: one permanent redirect from old-style addresses
   to the clean page, so Google stops splitting ranking across duplicates. Runs before the
   page is served; returns nothing (page served as usual) for every normal address.
     /scooters/<id>?id=<id>   → /scooters/<id>        (also /brands/<b>?b=, /cities/<c>?city=)
     /best?cat=<cat>          → /best/<cat>
     /city?city=<c>, /city    → /cities/<c>, or the price list when no known city
     /compare?a=<x>&b=<y>     → /compare/<x>-vs-<y> when that comparison page exists
   Language prefixes (/hi/, /mr/ ...) are kept. Other query params (utm_*, etc.) are kept. */
import PAIRS from './data/compare-pairs.json';

const SET = new Set(PAIRS.pairs || []);
const CATS = new Set(['daily-commute', 'under-1-lakh', 'under-1-5l', 'family', 'best-range', 'tier2-cities']);
const HEADLINE_CITY = PAIRS.headlineCity || null; // no default city: /city without one goes to the price list
const CITIES = new Set(PAIRS.cities || []);
const LANG = /^\/(hi|mr|ta|te|kn|gu|bn|or)(?=\/|$)/;
const DROP = { scooters: 'id', brands: 'b', cities: 'city' };

export const config = { matcher: ['/((?!api/|images/|fonts/|.*\\.(?:js|css|webp|png|jpe?g|svg|ico|woff2?|json|xml|txt|webmanifest|map)$).*)'] };

export function target(href) {
  const u = new URL(href), q = u.searchParams;
  const m = u.pathname.match(LANG), pre = m ? m[0] : '';
  let p = u.pathname.slice(pre.length).replace(/\/+$/, '') || '/';
  let to = null;
  const seg = p.split('/').filter(Boolean);
  if (seg.length === 2 && DROP[seg[0]] && q.has(DROP[seg[0]])) { q.delete(DROP[seg[0]]); to = p; }
  else if ((p === '/best' || p === '/best.html') && q.has('cat') && CATS.has(q.get('cat'))) { const c = q.get('cat'); q.delete('cat'); to = '/best/' + c; }
  else if (p === '/city' || p === '/city.html') { const c = (q.get('city') || HEADLINE_CITY || '').toLowerCase().replace(/[^a-z-]/g, ''); q.delete('city'); to = CITIES.has(c) ? '/cities/' + c : '/electric-scooter-price'; }
  else if ((p === '/compare' || p === '/compare.html') && q.get('a') && q.get('b')) {
    const a = q.get('a'), b = q.get('b');
    const hit = SET.has(a + '-vs-' + b) ? a + '-vs-' + b : SET.has(b + '-vs-' + a) ? b + '-vs-' + a : null;
    if (hit) { q.delete('a'); q.delete('b'); to = '/compare/' + hit; }
  }
  if (!to) return null;
  const qs = q.toString();
  return u.origin + pre + to + (qs ? '?' + qs : '');
}

export default function middleware(request) {
  const t = target(request.url);
  if (t) return Response.redirect(t, 301);
}
