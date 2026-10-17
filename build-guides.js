/* ============================================================
   build-guides.js — generates the new guide pages from the
   shared ScooterWale guide shell (same CSS, same nav/footer).
   Run:  node build-guides.js
   Regenerate whenever data.js or the figures below change.
   ============================================================ */
const fs = require('fs');
const { SCOOTERS_DB } = require('./data.js');

const BASE = 'https://www.escooterwale.in';
const VERIFIED = '24 August 2026';
const SHELL = fs.readFileSync('guide-shell.template', 'utf8');

/* ── shared helpers ─────────────────────────────────────── */
const kwh = s => parseFloat(String(s.battery).match(/[\d.]+/)[0]);
const exFactory = s => Math.round(s.price / 1.05);      // EVs carry 5% GST
const inr = n => '₹' + Number(n).toLocaleString('en-IN');

function subsidyFor(s) {
  const k = kwh(s), f = exFactory(s);
  if (f > 150000) return { eligible: false, amount: 0, reason: 'Ex-factory price above ₹1.5 lakh' };
  const amount = Math.min(2500 * k, 5000, 0.15 * f);
  return {
    eligible: true,
    amount: Math.round(amount),
    reason: amount < 5000 ? `Battery is ${k} kWh, so ₹2,500/kWh lands below the ₹5,000 cap` : 'Full cap'
  };
}

function page({ file, title, desc, canon, eyebrow, h1, standfirst, readTime, crumb, body, sidebar, schema }) {
  // the shell already closes </head>; drop it so we can inject schema first
  const openHead = SHELL.replace(/<\/head>\s*$/, '')
    .replace('{{TITLE}}', `<title>${title}</title>`)
    .replace('{{DESC}}', `<meta name="description" content="${desc}"/>`)
    .replace('{{CANON}}', `<link rel="canonical" href="${BASE}${canon}"/>`);
  const html = openHead
    + (schema ? `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n` : '')
    + `</head>
<body>
<div id="navMount"></div>
<div class="page-wrap">

<div class="breadcrumb"><div class="container"><div class="breadcrumb-inner">
  <a href="/">Home</a><span class="bc-sep">›</span>
  <a href="/trending">Guides</a><span class="bc-sep">›</span>
  <span>${crumb}</span>
</div></div></div>

<section class="guide-hero">
  <div class="container">
    <div class="guide-hero-inner">
      <div class="guide-eyebrow">${eyebrow}</div>
      <h1>${h1}</h1>
      <p>${standfirst}</p>
      <div class="guide-meta">
        <div class="guide-meta-item">✍️ ScooterWale Editorial</div>
        <div class="guide-meta-item">📅 Verified ${VERIFIED}</div>
        <div class="guide-meta-item">⏱ ${readTime}</div>
      </div>
    </div>
  </div>
</section>

<div class="container">
<div class="guide-layout">

<article class="guide-content">
${body}
</article>

<aside class="guide-sidebar">
${sidebar}
</aside>

</div>
</div>

<div id="footerMount"></div>
</div>

<script src="data.js"></script>
<script src="components.js"></script>
<script>
document.getElementById('navMount').innerHTML=navHTML('news');
document.getElementById('footerMount').innerHTML=footerHTML();
</script>
</body>
</html>
`;
  const heads = (html.match(/<\/head>/g) || []).length;
  if (heads !== 1) throw new Error(`${file}: expected exactly one </head>, found ${heads}`);
  fs.writeFileSync(file, html);
  console.log('built', file, '(' + Math.round(html.length / 1024) + ' KB)');
}

const ORG = { '@type': 'Organization', '@id': `${BASE}/#organization`, name: 'ScooterWale', url: `${BASE}/` };
const crumbs = items => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, ...(it.url ? { item: it.url } : {}) }))
});
const article = (path, headline, description) => ({
  '@type': ['Article', 'TechArticle'],
  '@id': `${BASE}${path}#article`,
  headline, description,
  url: `${BASE}${path}`,
  datePublished: '2026-08-24', dateModified: '2026-08-24',
  author: { '@type': 'Organization', name: 'ScooterWale Editorial', url: `${BASE}/` },
  publisher: { '@id': `${BASE}/#organization` },
  inLanguage: 'en-IN'
});
const faq = (path, qs) => ({
  '@type': 'FAQPage', '@id': `${BASE}${path}#faq`,
  mainEntity: qs.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }))
});

const SIDEBAR_SUBSIDY = `
  <div class="sidebar-card">
    <h4>Subsidy guides</h4>
    <a href="/guide-subsidy" class="toc-link">💰 EV subsidy 2026, full guide</a>
    <a href="/guide-subsidy-deadlines" class="toc-link">⏳ Subsidy deadlines 2026</a>
    <a href="/guide-subsidy-eligibility" class="toc-link">✅ Which scooters qualify</a>
    <a href="/guide-subsidy-claim" class="toc-link">📝 How to claim, step by step</a>
  </div>
  <div class="sidebar-card">
    <h4>Other guides</h4>
    <a href="/guide-real-range" class="toc-link">📊 Real range test results</a>
    <a href="/guide-battery-types" class="toc-link">🔋 LFP vs NMC battery</a>
    <a href="/guide-service-network" class="toc-link">🛠️ Service network guide</a>
    <a href="/electric-scooter-price" class="toc-link">💸 All 41 scooter prices</a>
  </div>
  <div class="sidebar-card" style="text-align:center">
    <div style="font-size:28px;margin-bottom:8px">⚖️</div>
    <h4 class="mb-8">Compare scooters</h4>
    <p style="font-size:13px;color:var(--ink-3);margin-bottom:12px">See which subsidised scooter gives the best value after discounts.</p>
    <a href="/compare"><button class="btn btn-primary btn-full">Compare now →</button></a>
  </div>`;

module.exports = { page, SHELL, BASE, VERIFIED, kwh, exFactory, inr, subsidyFor, ORG, crumbs, article, faq, SIDEBAR_SUBSIDY, SCOOTERS_DB };

if (require.main === module) {
  require('./build-guide-pages.js');
}
