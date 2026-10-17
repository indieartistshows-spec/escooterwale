/* ============================================================
   build-sitemap.js — generates sitemap.xml from data.js
   Run:  node build-sitemap.js
   Re-run whenever data.js changes.
   ============================================================ */
const fs = require('fs');
const { SCOOTERS_DB, BRANDS_DB, CITIES_DB } = require('./data.js');

const BASE = 'https://www.escooterwale.in';
const TODAY = new Date().toISOString().slice(0, 10);

const urls = [];
const add = (loc, priority, changefreq) => urls.push({ loc, priority, changefreq });

// Core pages (cleanUrls:true is set in vercel.json, so no .html suffix)
add(`${BASE}/`,                       '1.0', 'daily');
add(`${BASE}/listings`,               '0.9', 'daily');
add(`${BASE}/compare`,                '0.8', 'weekly');
add(`${BASE}/best`,                   '0.8', 'weekly');
add(`${BASE}/trending`,               '0.8', 'daily');
add(`${BASE}/emi`,                    '0.7', 'monthly');
add(`${BASE}/cases`,                  '0.6', 'weekly');
add(`${BASE}/yellow-brother`,         '0.7', 'weekly');

// Guides. The subsidy cluster earns most of the site's search traffic.
add(`${BASE}/guide-subsidy`,             '1.0', 'weekly');
add(`${BASE}/guide-subsidy-deadlines`,   '0.9', 'weekly');
add(`${BASE}/guide-subsidy-eligibility`, '0.9', 'weekly');
add(`${BASE}/guide-subsidy-claim`,       '0.9', 'monthly');
add(`${BASE}/electric-scooter-price`,    '0.9', 'weekly');
add(`${BASE}/guide-real-range`,          '0.9', 'monthly');
add(`${BASE}/guide-battery-chemistry`,   '0.8', 'monthly');
add(`${BASE}/guide-battery-types`,       '0.7', 'monthly');
add(`${BASE}/guide-service-network`,     '0.7', 'monthly');

// Pre-rendered static pages, one per entity
const BEST_CATS = ['daily-commute','under-1-lakh','under-1-5l','family','best-range','tier2-cities'];
const ARTICLES  = ['ola-s1-pro-review','fame-3-guide','ev-running-costs'];

SCOOTERS_DB.forEach(s => add(`${BASE}/scooters/${s.id}/`, '0.9', 'weekly'));
BRANDS_DB.forEach(b   => add(`${BASE}/brands/${b.id}/`,   '0.8', 'weekly'));
CITIES_DB.forEach(c   => add(`${BASE}/cities/${c.id}/`,   '0.7', 'monthly'));
BEST_CATS.forEach(c   => add(`${BASE}/best/${c}/`,        '0.8', 'weekly'));
ARTICLES.forEach(a    => add(`${BASE}/articles/${a}/`,    '0.7', 'monthly'));

// Comparison pages, from the pre-render manifest so the two never drift apart
try {
  const manifest = JSON.parse(fs.readFileSync('.prerender-manifest.json', 'utf8'));
  (manifest.compare || []).forEach(slug => add(`${BASE}/compare/${slug}/`, '0.8', 'weekly'));
} catch (e) {
  console.warn('  no .prerender-manifest.json found — run node prerender.js first to include comparison pages');
}

const esc = s => s.replace(/&/g, '&amp;');

const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync('sitemap.xml', xml);
console.log(`sitemap.xml written — ${urls.length} URLs, lastmod ${TODAY}`);
