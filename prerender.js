/* ============================================================
   prerender.js — turns the query-string templates into real
   static pages, one directory per entity.

   Run:  npm i -D playwright && node prerender.js
         (or reuse an existing Playwright install)

   What it does
   ------------
   Loads each template in a real browser, lets the existing
   page JS render exactly as it does for a visitor, then writes
   the resulting DOM to disk as a static file. The markup is
   byte-identical to what the browser produces today, so nothing
   about the design can change. The scripts still run on load and
   re-render into the same mount points, which is a no-op.

   Output
   ------
   /scooters/<id>/index.html      41 model pages
   /brands/<id>/index.html        10 brand pages
   /cities/<id>/index.html        12 city pages
   /best/<cat>/index.html          6 category pages
   /compare/<a>-vs-<b>/index.html  top comparison pages
   /articles/<id>/index.html       3 article pages

   Identity is passed to the page via window.__SW_* which the
   templates read before falling back to the query string.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { SCOOTERS_DB, BRANDS_DB, CITIES_DB } = require('./data.js');

const ORIGIN = 'http://127.0.0.1:8877';   // local static server for the source files
const BASE = 'https://www.escooterwale.in';
const BEST_CATS = ['daily-commute', 'under-1-lakh', 'under-1-5l', 'family', 'best-range', 'tier2-cities'];
const ARTICLES = ['ola-s1-pro-review', 'fame-3-guide', 'ev-running-costs'];

/* Top comparison pairs: every combination among the 12 most-viewed
   models, which is what people actually search for. */
const TOP = [...SCOOTERS_DB].sort((a, b) => b.views - a.views).slice(0, 12);
const PAIRS = [];
for (let i = 0; i < TOP.length; i++)
  for (let j = i + 1; j < TOP.length; j++)
    PAIRS.push([TOP[i], TOP[j]]);

/* ── path rewriting ──────────────────────────────────────────
   Pages move from the root into /scooters/<id>/, so relative asset
   references in the static markup have to become absolute.

   Critically this must NOT touch <script> or <style> content. Those
   blocks contain template literals like src="${s.cardImg}" and
   url('${models[0].heroImg}'), and prefixing those produces a double
   slash once the (already absolute) value is interpolated, which the
   browser then reads as a protocol-relative URL. */
function absolutiseMarkup(chunk) {
  return chunk
    .replace(/(\s(?:src|href))="(?!https?:|\/\/|\/|#|data:|mailto:|tel:|\$\{)([^"]+)"/g, '$1="/$2"')
    .replace(/url\((['"]?)(?!https?:|\/\/|\/|data:|&quot;|&#39;|\$\{)([^)'"]+)\1\)/g, 'url($1/$2$1)');
}

function absolutise(html) {
  // Rewrite everything except the *contents* of script and style blocks.
  // The opening tag still needs rewriting, otherwise <script src="data.js">
  // resolves against /scooters/<id>/ and 404s.
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/gi);
  return parts.map((part, i) => {
    if (i % 2 === 0) return absolutiseMarkup(part);
    const m = part.match(/^(<(?:script|style)[^>]*>)([\s\S]*)(<\/(?:script|style)>)$/i);
    if (!m) return part;
    return absolutiseMarkup(m[1]) + m[2] + m[3];
  }).join('');
}

/* Only the canonical href changes, and only its href.
   The captured DOM already carries the JS-updated title and
   description, and the id attributes on those tags (pgTitle,
   pgDesc, pgCanon) must survive: the page scripts write to them
   on load, and stripping an id throws and aborts the rest of
   the script. */
function setHead(html, { canonical }) {
  if (!canonical) return html;
  if (/<link[^>]*rel="canonical"[^>]*>/.test(html)) {
    return html.replace(/<link([^>]*rel="canonical"[^>]*)>/, (m, attrs) =>
      `<link${attrs.replace(/href="[^"]*"/, `href="${canonical}"`)}>`);
  }
  return html.replace('</head>', `<link rel="canonical" href="${canonical}"/>\n</head>`);
}

function write(outDir, html) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

/* The identity has to be baked into the written file, not just set
   during capture. Without it the page scripts re-run on load, find no
   query string, fall back to the default entity and overwrite the
   pre-rendered content with the wrong scooter. */
function bakeIdentity(html, inject) {
  if (!inject) return html;
  // Also drop leftover query strings (e.g. ?id= carried over by old redirects)
  // from the address bar, so shared links are always the clean URL.
  const clean = "if(location.search&&/[?&](id|b|city|cat|a)=/.test(location.search)){try{history.replaceState(null,'',location.pathname)}catch(e){}}";
  return html.replace(/<head([^>]*)>/i,
    `<head$1>\n<script>${inject}${clean}</script>`);
}

async function renderOne(page, { url, inject, outDir, canonical }) {
  if (inject) await page.addInitScript(inject);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(700);
  let html = await page.evaluate(() => '<!DOCTYPE html>\n' + document.documentElement.outerHTML);
  const title = await page.title();
  html = absolutise(html);
  html = setHead(html, { canonical });
  html = bakeIdentity(html, inject);
  write(outDir, html);
  return { title, bytes: html.length };
}

(async () => {
  const browser = await chromium.launch();
  // Third-party requests (analytics, fonts, YouTube thumbnails) are not part of the
  // captured DOM, and waiting on them makes the build slow and flaky. Block them.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(u => !u.href.startsWith(ORIGIN), r => r.abort());
  const jobs = [];

  SCOOTERS_DB.forEach(s => jobs.push({
    label: `scooter ${s.id}`,
    url: `${ORIGIN}/scooter-detail.html?id=${s.id}`,
    inject: `window.__SW_ID__=${JSON.stringify(s.id)};`,
    outDir: path.join('scooters', s.id),
    canonical: `${BASE}/scooters/${s.id}`
  }));

  BRANDS_DB.forEach(b => jobs.push({
    label: `brand ${b.id}`,
    url: `${ORIGIN}/brand.html?b=${b.id}`,
    inject: `window.__SW_BRAND__=${JSON.stringify(b.id)};`,
    outDir: path.join('brands', b.id),
    canonical: `${BASE}/brands/${b.id}`
  }));

  CITIES_DB.forEach(c => jobs.push({
    label: `city ${c.id}`,
    url: `${ORIGIN}/city.html?city=${c.id}`,
    inject: `window.__SW_CITY__=${JSON.stringify(c.id)};`,
    outDir: path.join('cities', c.id),
    canonical: `${BASE}/cities/${c.id}`
  }));

  BEST_CATS.forEach(cat => jobs.push({
    label: `best ${cat}`,
    url: `${ORIGIN}/best.html?cat=${cat}`,
    inject: `window.__SW_CAT__=${JSON.stringify(cat)};`,
    outDir: path.join('best', cat),
    canonical: `${BASE}/best/${cat}`
  }));

  ARTICLES.forEach(a => jobs.push({
    label: `article ${a}`,
    url: `${ORIGIN}/article.html?id=${a}`,
    inject: `window.__SW_ART__=${JSON.stringify(a)};`,
    outDir: path.join('articles', a),
    canonical: `${BASE}/articles/${a}`
  }));

  PAIRS.forEach(([a, b]) => {
    const slug = `${a.id}-vs-${b.id}`;
    jobs.push({
      label: `compare ${slug}`,
      url: `${ORIGIN}/compare.html?a=${a.id}&b=${b.id}`,
      inject: `window.__SW_A__=${JSON.stringify(a.id)};window.__SW_B__=${JSON.stringify(b.id)};`,
      outDir: path.join('compare', slug),
      canonical: `${BASE}/compare/${slug}`
    });
  });

  console.log(`pre-rendering ${jobs.length} pages\n`);
  let done = 0, failed = 0;
  const CONCURRENCY = 6;

  async function worker() {
    while (jobs.length) {
      const job = jobs.shift();
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e)));
      try {
        const r = await renderOne(page, job);
        done++;
        if (errs.length) console.log(`  ⚠ ${job.label}: ${errs[0].slice(0, 80)}`);
        if (done % 20 === 0) console.log(`  ${done} done`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${job.label}: ${String(e).slice(0, 90)}`);
      }
      await page.close();
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  console.log(`\npre-render complete: ${done} written, ${failed} failed`);
  fs.writeFileSync('.prerender-manifest.json', JSON.stringify({
    generated: new Date().toISOString(),
    scooters: SCOOTERS_DB.map(s => s.id),
    brands: BRANDS_DB.map(b => b.id),
    cities: CITIES_DB.map(c => c.id),
    best: BEST_CATS,
    articles: ARTICLES,
    compare: PAIRS.map(([a, b]) => `${a.id}-vs-${b.id}`)
  }, null, 2));
  console.log('manifest written to .prerender-manifest.json');
})();
