/* ============================================================
   build-guides-data.js  |  guides written as data (data/guides.json)
   One entry per guide; each becomes /guide-<slug> with the same shell,
   schema, lead box and sidebar as the other guides. Run by
   build-guide-pages.js (so by tools/build-all.js). The weekly guide
   task adds one entry a week (append only).

   Live figures: write tokens instead of numbers, so prices and
   ranges follow the data every build. Unknown tokens stop the build.
     {{name:<id>}}      model name, linked        {{price:<id>}}   ex-showroom
     {{onroad:<id>}}    on-road from               {{real:<id>}}    real range
     {{range:<id>}}     claimed range              {{battery:<id>}} battery
     {{speed:<id>}}     top speed                  {{charging:<id>}} charge time
     {{score:<id>}}     ScootScore                 {{emi:<id>}}     EMI from, a month
     {{subsidy:<id>}}   PM E-DRIVE amount          {{models}}       models on sale
     {{updated}}        date prices were updated
     {{table:<id>,<id>,...}}        spec and price table
     {{realrange-table:<km>}}       every model whose real range starts at <km> or more
     {{emi-table:<id>,<id>,...}}    EMI with no, ₹10,000 and 20% down payment
     {{roadtax-table}}              road tax and cash subsidy by state
     {{onroad-breakdown:<id>:<city>}} how the on-road price adds up in one city
   House style: no em or en dashes, plain words, real numbers only.
   ============================================================ */
const fs = require('fs');
const G = require('./build-guides.js');
const { page, BASE, inr, ORG, crumbs, article, faq, SIDEBAR_SUBSIDY } = G;
const D = require('./data.js');
const S = D.SCOOTERS_DB, SUB = D.SUBSIDY;

const FILE = 'data/guides.json';
const GUIDES = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')).guides || [] : [];
const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const UPDATED = longDate(D.SW_CONFIG.dataUpdated);
const sp = v => String(v || '').replace(/\s*[–—-]\s*/g, ' to ');
const low = s => parseFloat(String(s.realRange).split(/[–—-]|to/)[0]) || 0;
const byId = id => { const s = D.SCOOTERS_ALL.find(x => x.id === id.trim()); if (!s) throw new Error(`guides.json: unknown scooter id "${id}"`); return s; };
const ex = s => s.nationalPrice || s.price;
const link = s => `<a href="/scooters/${s.id}" translate="no">${s.fullName}</a>`;
const emiAt = (p, months, ratePct) => { const r = ratePct / 1200; return Math.round(p * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)); };
const EM = SUB.emiModel || { months: 48, annualRatePct: 12 };

const specTable = list => `<div style="overflow-x:auto"><table class="subsidy-table"><thead><tr><th>Model</th><th>Ex-showroom</th><th>On-road from</th><th>Battery</th><th>Real range</th><th>Claimed range</th><th>Top speed</th></tr></thead><tbody>
${list.map(s => `<tr><td>${link(s)}</td><td class="amt">${inr(ex(s))}</td><td>${inr(s.onRoad)}</td><td>${s.battery}</td><td>${sp(s.realRange)}</td><td>${s.range}</td><td>${s.speed}</td></tr>`).join('\n')}
</tbody></table></div>`;

const TOKENS = {
  name: id => link(byId(id)), price: id => inr(ex(byId(id))), onroad: id => inr(byId(id).onRoad),
  real: id => sp(byId(id).realRange), range: id => byId(id).range, battery: id => byId(id).battery,
  speed: id => byId(id).speed, charging: id => byId(id).charging, score: id => String(byId(id).score),
  emi: id => inr(byId(id).emiFrom) + ' a month',
  subsidy: id => { const s = byId(id); return s.subsidy && s.subsidy.eligible ? inr(s.subsidy.amount) : 'no subsidy'; },
  models: () => String(S.length), updated: () => UPDATED,
  table: ids => specTable(ids.split(',').map(byId)),
  'realrange-table': km => { const list = S.filter(s => low(s) >= Number(km)).sort((a, b) => ex(a) - ex(b));
    return `<div style="overflow-x:auto"><table class="subsidy-table"><thead><tr><th>Model</th><th>Ex-showroom</th><th>Real range</th><th>Battery</th><th>Charge time</th><th>ScootScore</th></tr></thead><tbody>
${list.map(s => `<tr><td>${link(s)}</td><td class="amt">${inr(ex(s))}</td><td>${sp(s.realRange)}</td><td>${s.battery}</td><td>${s.charging}</td><td>${s.score}/10</td></tr>`).join('\n')}
</tbody></table></div><p style="font-size:13px;color:var(--ink-4)">${list.length} of the ${S.length} scooters on sale. Real range is our own figure, prices updated ${UPDATED}.</p>`; },
  'emi-table': ids => { const list = ids.split(',').map(byId);
    return `<div style="overflow-x:auto"><table class="subsidy-table"><thead><tr><th>Model</th><th>Ex-showroom</th><th>No down payment</th><th>₹10,000 down</th><th>20% down</th></tr></thead><tbody>
${list.map(s => { const p = ex(s); return `<tr><td>${link(s)}</td><td class="amt">${inr(p)}</td><td>${inr(emiAt(p, EM.months, EM.annualRatePct))}</td><td>${inr(emiAt(p - 10000, EM.months, EM.annualRatePct))}</td><td>${inr(emiAt(p * 0.8, EM.months, EM.annualRatePct))} <small>(${inr(Math.round(p * 0.2))} down)</small></td></tr>`; }).join('\n')}
</tbody></table></div><p style="font-size:13px;color:var(--ink-4)">EMI a month over ${EM.months} months at ${EM.annualRatePct}% a year, on the ex-showroom price. Your bank's rate and fees will differ; the <a href="/emi">EMI calculator</a> works it out for your own numbers.</p>`; },
  'roadtax-table': () => { const rows = Object.values(SUB.states).map(st => {
      const rt = st.roadTax || {}, tax = rt.type === 'exempt' ? 'Exempt' + (rt.until ? ` until ${longDate(rt.until)}` : '') : rt.type === 'percent' ? `${rt.pct}% of ex-showroom` : 'Not confirmed';
      return `<tr><td>${st.name}</td><td>${tax}</td><td>${st.cash && st.cash.amount ? 'Up to ' + inr(st.cash.amount) : 'None'}</td></tr>`; }).join('\n');
    return `<div style="overflow-x:auto"><table class="subsidy-table"><thead><tr><th>State</th><th>Road tax on electric scooters</th><th>State cash subsidy</th></tr></thead><tbody>
${rows}
</tbody></table></div><p style="font-size:13px;color:var(--ink-4)">Checked ${longDate(SUB.checked)} against official sources. See the <a href="/guide-subsidy">subsidy guide</a> for each state's details.</p>`; },
  'onroad-breakdown': arg => { const [id, city] = arg.split(':'); const s = byId(id), c = D.CITIES_DB.find(x => x.id === (city || '').trim());
    if (!c) throw new Error(`guides.json: unknown city "${city}"`);
    const st = SUB.states[SUB.cityState[c.id]] || {}, rt = st.roadTax || {}, m = SUB.onRoadModel, p = ex(s);
    const tax = rt.type === 'percent' ? p * rt.pct / 100 : 0, ins = m.insuranceBase + p * m.insurancePct / 100;
    const total = Math.round((p + tax + ins + m.handling + m.registration) / 10) * 10;
    return `<div style="overflow-x:auto"><table class="subsidy-table"><thead><tr><th>${s.fullName} in ${c.name}</th><th>Amount</th></tr></thead><tbody>
<tr><td>Ex-showroom price (includes 5% GST)</td><td>${inr(p)}</td></tr>
<tr><td>Road tax (${rt.type === 'exempt' ? 'exempt in ' + st.name : rt.type === 'percent' ? rt.pct + '% in ' + st.name : 'not confirmed in ' + st.name + ', left out'})</td><td>${inr(Math.round(tax))}</td></tr>
<tr><td>Registration (free for EVs)</td><td>${inr(m.registration)}</td></tr>
<tr><td>First year insurance (our estimate)</td><td>${inr(Math.round(ins))}</td></tr>
<tr><td>Number plate and handling (our estimate)</td><td>${inr(m.handling)}</td></tr>
<tr><td><strong>On-road price</strong></td><td class="amt"><strong>${inr(total)}</strong></td></tr>
</tbody></table></div>`; }
};

function fill(text, where) {
  return String(text || '').replace(/\{\{([a-z-]+)(?::([^}]*))?\}\}/g, (m, k, arg) => {
    if (!TOKENS[k]) throw new Error(`guides.json (${where}): unknown token ${m}`);
    return TOKENS[k](arg || '');
  });
}
const strip = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const DASH = /[–—]/;

const sidebar = () => SIDEBAR_SUBSIDY + (GUIDES.length ? `
  <div class="sidebar-card">
    <h4>More buying guides</h4>
    ${GUIDES.map(g => `<a href="/guide-${g.slug}" class="toc-link">${g.crumb}</a>`).join('\n    ')}
  </div>` : '');

for (const g of GUIDES) {
  for (const k of ['slug', 'title', 'desc', 'h1', 'standfirst', 'body', 'crumb', 'published']) if (!g[k]) throw new Error(`guides.json: guide "${g.slug || '?'}" has no ${k}`);
  if (!/^[a-z0-9-]+$/.test(g.slug)) throw new Error(`guides.json: bad slug "${g.slug}"`);
  for (const k of ['title', 'desc', 'h1', 'standfirst']) if (DASH.test(g[k])) throw new Error(`guides.json: "${g.slug}" ${k} has a dash; use a colon or comma`);
  const where = g.slug, path = `/guide-${g.slug}`;
  const title = fill(g.title, where), desc = fill(g.desc, where), h1 = fill(g.h1, where);
  const qa = (g.faq || []).map(([q, a]) => [fill(q, where), fill(a, where)]);
  const art = article(path, strip(h1), strip(desc));
  art.datePublished = g.published; art.dateModified = g.updated || D.SW_CONFIG.dataUpdated;
  page({
    file: `guide-${g.slug}.html`, canon: path,
    title: /\| EScooterwale$/.test(title) ? title : `${title} | EScooterwale`,
    desc: strip(desc).replace(/"/g, '&quot;'),
    eyebrow: g.eyebrow || 'Buying Guide', crumb: g.crumb, h1, standfirst: fill(g.standfirst, where),
    readTime: g.readTime || `${Math.max(3, Math.round(strip(g.body).split(' ').length / 200))} min read`,
    schema: { '@context': 'https://schema.org', '@graph': [ORG,
      crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Guides', url: `${BASE}/trending` }, { name: g.crumb }]),
      art, ...(qa.length ? [faq(path, qa.map(([q, a]) => [strip(q), strip(a)]))] : [])] },
    body: fill(g.body, where) + (qa.length ? `\n  <h2>Common questions</h2>\n${qa.map(([q, a]) => `  <h3>${q}</h3>\n  <p>${a}</p>`).join('\n')}` : ''),
    sidebar: sidebar()
  });
}
module.exports = { GUIDES };
