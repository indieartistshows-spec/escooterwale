/* ============================================================
   tools/build-brand-vs.js  |  brand vs brand comparison pages
   ("ola vs ather", "ather vs tvs iqube", "chetak vs iqube" are searched
   as brands, not as single models). Every figure comes from data.js.
   Writes <a>-vs-<b>.html in the site root; build-sitemap.js lists them.
   ============================================================ */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const fs = require('fs');
const G = require('../build-guides.js');
const { page, BASE, inr, subsidyFor, ORG, crumbs, faq, SCOOTERS_DB } = G;
const src = fs.readFileSync('data.js', 'utf8').replace(/^const /gm, 'var ');
const BRANDS_DB = new Function(src + ';return BRANDS_DB;')();

// the five brands people compare most, with the name they search by
const BR = [
  ['ola-electric', 'ola', 'Ola'],
  ['ather-energy', 'ather', 'Ather'],
  ['tvs-motor', 'tvs', 'TVS', 'TVS iQube'],
  ['bajaj-chetak', 'chetak', 'Bajaj Chetak'],
  ['hero-vida', 'vida', 'Hero Vida']
];
const PAIRS = [];
for (let i = 0; i < BR.length; i++) for (let j = i + 1; j < BR.length; j++) PAIRS.push([BR[i], BR[j]]);

const hiKm = s => { const m = String(s.realRange || '').match(/\d+/g); return m ? Math.max(...m.map(Number)) : 0; };
const kmh = s => parseFloat(s.speed) || 0;
const range = v => String(v || '').replace(/\s*[–—-]\s*/g, ' to ');
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const pairPages = JSON.parse(fs.readFileSync('data/compare-pairs.json', 'utf8')).pairs;

function stats(id) {
  const m = SCOOTERS_DB.filter(s => s.brandSlug === id).sort((a, b) => a.price - b.price);
  return {
    m, n: m.length, lo: m[0], hi: m[m.length - 1],
    far: [...m].sort((a, b) => hiKm(b) - hiKm(a))[0],
    fast: [...m].sort((a, b) => kmh(b) - kmh(a))[0],
    best: [...m].sort((a, b) => b.score - a.score)[0],
    avgScore: Math.round(avg(m.map(s => s.score)) * 10) / 10,
    eligible: m.filter(s => subsidyFor(s).eligible).length
  };
}

const out = [];
for (const [[ia, sa, na, ta], [ib, sb, nb, tb]] of PAIRS) {
  const TA = ta || na, TB = tb || nb; // title names: "ather vs tvs iqube" is how it is searched
  const A = stats(ia), B = stats(ib);
  if (!A.n || !B.n) continue;
  const slug = `${sa}-vs-${sb}`, canon = `/${slug}`;
  const cheaper = A.lo.price <= B.lo.price ? [na, A] : [nb, B];
  const farther = hiKm(A.far) >= hiKm(B.far) ? [na, A] : [nb, B];
  const higher = A.best.score >= B.best.score ? [na, A] : [nb, B];
  const tie = (x, y) => x === y;

  const row = s => `      <tr><td><a href="/scooters/${s.id}">${s.fullName}</a></td><td class="amt">${inr(s.price)}</td><td>${s.onRoadDisplay}</td><td>${s.battery}</td><td>${s.range}</td><td>${range(s.realRange)}</td><td>${s.speed}</td><td>${s.score}/10</td></tr>`;
  const table = (name, S) => `
  <h2>${name} electric scooters: all ${S.n} models</h2>
  <div style="overflow-x:auto">
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Ex-showroom</th><th>On-road from</th><th>Battery</th><th>Claimed range</th><th>Real range</th><th>Top speed</th><th>ScootScore</th></tr></thead>
    <tbody>
${S.m.map(row).join('\n')}
    </tbody>
  </table>
  </div>`;

  const sumRow = (label, a, b) => `      <tr><td><strong>${label}</strong></td><td>${a}</td><td>${b}</td></tr>`;
  const summary = `
  <div style="overflow-x:auto">
  <table class="subsidy-table">
    <thead><tr><th></th><th>${na}</th><th>${nb}</th></tr></thead>
    <tbody>
${sumRow('Models on sale', A.n, B.n)}
${sumRow('Price range (ex-showroom)', `${inr(A.lo.price)} to ${inr(A.hi.price)}`, `${inr(B.lo.price)} to ${inr(B.hi.price)}`)}
${sumRow('Cheapest model', `<a href="/scooters/${A.lo.id}">${A.lo.name}</a>, ${inr(A.lo.price)}`, `<a href="/scooters/${B.lo.id}">${B.lo.name}</a>, ${inr(B.lo.price)}`)}
${sumRow('Top model', `<a href="/scooters/${A.hi.id}">${A.hi.name}</a>, ${inr(A.hi.price)}`, `<a href="/scooters/${B.hi.id}">${B.hi.name}</a>, ${inr(B.hi.price)}`)}
${sumRow('Longest real range', `${A.far.name}, ${range(A.far.realRange)}`, `${B.far.name}, ${range(B.far.realRange)}`)}
${sumRow('Fastest', `${A.fast.name}, ${A.fast.speed}`, `${B.fast.name}, ${B.fast.speed}`)}
${sumRow('Highest ScootScore', `${A.best.name}, ${A.best.score}/10`, `${B.best.name}, ${B.best.score}/10`)}
${sumRow('Average ScootScore', `${A.avgScore}/10`, `${B.avgScore}/10`)}
${sumRow('PM E-DRIVE eligible', `${A.eligible} of ${A.n}`, `${B.eligible} of ${B.n}`)}
    </tbody>
  </table>
  </div>`;

  // model comparison pages that already exist for this pair of brands
  const both = pairPages.filter(p => { const [x, y] = p.split('-vs-'); return (x.startsWith(ia) && y.startsWith(ib)) || (x.startsWith(ib) && y.startsWith(ia)); });
  const byId = Object.fromEntries(SCOOTERS_DB.map(s => [s.id, s]));
  const modelLinks = both.map(p => { const [x, y] = p.split('-vs-'); return byId[x] && byId[y] ? `<li><a href="/compare/${p}">${byId[x].fullName} vs ${byId[y].fullName}</a></li>` : ''; }).filter(Boolean);
  const headToHead = `/compare.html?a=${A.best.id}&b=${B.best.id}`;

  const answer = `${na} sells ${A.n} electric scooter models from ${inr(A.lo.price)} to ${inr(A.hi.price)}, and ${nb} sells ${B.n} from ${inr(B.lo.price)} to ${inr(B.hi.price)} (ex-showroom). `
    + (tie(A.lo.price, B.lo.price) ? `Both start at the same price. ` : `${cheaper[0]} is cheaper to get into, with the ${cheaper[1].lo.fullName} at ${inr(cheaper[1].lo.price)}. `)
    + (tie(hiKm(A.far), hiKm(B.far)) ? `Their longest range models go about as far as each other. ` : `${farther[0]} goes further: the ${farther[1].far.fullName} manages ${range(farther[1].far.realRange)} in real use. `)
    + (tie(A.best.score, B.best.score) ? `Their best models score the same on our ScootScore (${A.best.score}/10).` : `Our highest rated of the two is the ${higher[1].best.fullName} at ${higher[1].best.score}/10.`);

  const qs = [
    [`Which is better, ${na} or ${nb}?`, answer],
    [`Which is cheaper, ${na} or ${nb}?`, tie(A.lo.price, B.lo.price) ? `Both start at ${inr(A.lo.price)} ex-showroom.` : `${cheaper[0]}. Its cheapest scooter, the ${cheaper[1].lo.fullName}, costs ${inr(cheaper[1].lo.price)} ex-showroom against ${inr((cheaper[1] === A ? B : A).lo.price)} for the cheapest ${cheaper[1] === A ? nb : na}.`],
    [`Which has more range, ${na} or ${nb}?`, `The longest real range ${na} is the ${A.far.fullName} at ${range(A.far.realRange)} (${A.far.range} claimed). The longest real range ${nb} is the ${B.far.fullName} at ${range(B.far.realRange)} (${B.far.range} claimed).`],
    [`What is the price of the top ${na} and ${nb} models?`, `The top ${na} model is the ${A.hi.fullName} at ${inr(A.hi.price)}. The top ${nb} model is the ${B.hi.fullName} at ${inr(B.hi.price)}. Both prices are ex-showroom.`]
  ];
  const faqHtml = `
  <h2>Questions people ask</h2>
${qs.map(([q, a]) => `  <h3>${q}</h3>\n  <p>${a}</p>`).join('\n')}`;

  const t = `${TA} vs ${TB} Electric Scooter 2026: Price, Range and Which to Buy | EScooterwale`;
  page({
    file: `${slug}.html`,
    canon,
    title: t,
    desc: `${TA} vs ${TB}: all ${A.n + B.n} electric scooter models compared. Prices ${inr(Math.min(A.lo.price, B.lo.price))} to ${inr(Math.max(A.hi.price, B.hi.price))}, on-road price, real range, top speed and ScootScore side by side.`,
    eyebrow: 'Brand comparison',
    crumb: `${TA} vs ${TB}`,
    h1: `${TA} vs ${TB} electric scooter: price, range and which to buy`,
    standfirst: `Every ${na} and ${nb} electric scooter on sale, compared on price, real-world range, speed and our ScootScore. Updated weekly from the brands' own websites.`,
    readTime: '4 min read',
    schema: { '@context': 'https://schema.org', '@graph': [ORG,
      crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Compare', url: `${BASE}/compare` }, { name: `${na} vs ${nb}` }]),
      faq(canon, qs)] },
    sidebar: `
  <div class="sidebar-card">
    <h4>Brand comparisons</h4>
${PAIRS.map(([x, y]) => `    <a href="/${x[1]}-vs-${y[1]}" class="toc-link">${x[3] || x[2]} vs ${y[3] || y[2]}</a>`).join('\n')}
  </div>
  <div class="sidebar-card">
    <h4>Prices</h4>
    <a href="/electric-scooter-price" class="toc-link">EV scooter price list</a>
    <a href="/best/under-1-lakh" class="toc-link">Best under 1 lakh</a>
    <a href="/compare" class="toc-link">Compare any two scooters</a>
  </div>`,
    body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">${answer}</p>
  </div>

  <h2>${na} vs ${nb} at a glance</h2>
${summary}
${table(na, A)}
${table(nb, B)}

  <h2>Compare ${na} and ${nb} models head to head</h2>
  <ul>
    <li><a href="${headToHead}">${A.best.fullName} vs ${B.best.fullName}</a> (the highest rated of each)</li>
${modelLinks.map(l => '    ' + l).join('\n')}
  </ul>
  <p>Brand pages: <a href="/brands/${ia}">${na}</a>, <a href="/brands/${ib}">${nb}</a>. Or see the <a href="/electric-scooter-price">full EV scooter price list</a>.</p>
${faqHtml}

  <div class="callout-box">
    <h4>Other brand comparisons</h4>
    <p style="margin:0;font-size:15px">${PAIRS.filter(([x, y]) => `${x[1]}-vs-${y[1]}` !== slug).map(([x, y]) => `<a href="/${x[1]}-vs-${y[1]}">${x[3] || x[2]} vs ${y[3] || y[2]}</a>`).join(' · ')}</p>
  </div>`
  });
  out.push(slug);
}
fs.writeFileSync('data/brand-vs.json', JSON.stringify({ _note: 'Written by tools/build-brand-vs.js; read by build-sitemap.js.', pages: out }, null, 1) + '\n');
console.log(`brand vs brand pages: ${out.length}`);
