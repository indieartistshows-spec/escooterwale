/* ============================================================
   tools/build-launches.js  ->  launches.html
   New launches and discontinued models, from data/launches.json
   (written by automation/merge.js every week). Entries are never
   removed: this is a running public log.
   ============================================================ */
const fs = require('fs');
const G = require('../build-guides.js');
const { page, BASE, ORG, crumbs, inr } = G;
const L = JSON.parse(fs.readFileSync('data/launches.json', 'utf8'));
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const ev = L.events || [];
const launches = ev.filter(e => e.type === 'launch'), gone = ev.filter(e => e.type === 'discontinued');
const onSale = S.filter(s => !s.discontinued).length;
const UTM = u => u ? u + (u.includes('?') ? '&' : '?') + 'utm_source=escooterwale&utm_medium=referral&utm_campaign=launches' : '';

const row = e => `      <tr>
        <td>${fmt(e.date)}</td>
        <td><strong>${e.brand}</strong></td>
        <td>${e.id ? `<a href="/scooters/${e.id}">${e.name}</a>` : e.name}</td>
        <td>${e.type === 'launch' ? '<span class="amt">New</span>' : 'Discontinued'}</td>
        <td>${e.price ? inr(e.price) : ''}</td>
        <td>${e.url && /^https?:/.test(e.url) ? `<a href="${UTM(e.url)}" target="_blank" rel="noopener" data-out="brand" data-brand="${e.brandId || ''}">Official page ↗</a>` : ''}</td>
      </tr>`;

const table = list => list.length ? `<table class="subsidy-table">
    <thead><tr><th>Spotted</th><th>Brand</th><th>Model</th><th>Status</th><th>Price</th><th>Link</th></tr></thead>
    <tbody>
${list.map(row).join('\n')}
    </tbody>
  </table>` : `<p style="color:var(--ink-3)">Nothing yet. We check every brand's website once a week, and the first entries will appear after the next check.</p>`;

page({
  file: 'launches.html',
  canon: '/launches',
  title: 'New Electric Scooter Launches in India 2026 | ScooterWale',
  desc: `Every new electric scooter and battery variant that appears on a brand's official website, and every model that quietly disappears. Checked weekly across ${new Set(S.map(s => s.brandSlug)).size} brands.`,
  eyebrow: 'Launch tracker',
  crumb: 'Launches and discontinued models',
  h1: 'New electric scooter launches, and the ones that quietly disappeared',
  standfirst: `We check the official website of every brand we cover once a week. When a new model or battery option shows up, it goes here. When one is dropped, it goes here too. ${onSale} models are on sale right now.`,
  readTime: 'Updated weekly',
  schema: { '@context': 'https://schema.org', '@graph': [ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Launches' }]),
    { '@type': 'ItemList', name: 'New electric scooter launches in India', itemListElement: launches.slice(0, 30).map((e, i) => ({ '@type': 'ListItem', position: i + 1, name: `${e.brand} ${e.name}` })) }] },
  body: `
  <div class="callout-box green">
    <h4>💡 How this list works</h4>
    <p style="margin:0;font-size:15px">A model counts as <strong>new</strong> once it has appeared on the brand's own website in two weekly checks in a row, so one-off test pages do not sneak in. It counts as <strong>discontinued</strong> after it has been missing for two checks in a row. Entries stay here permanently.</p>
  </div>

  <h2>New launches</h2>
  ${table(launches)}

  <h2>Discontinued models</h2>
  <p>Pages for discontinued models stay up with a label, so you can still look up a scooter you already own.</p>
  ${table(gone)}

  <div class="guide-nav">
    <a href="/listings" class="guide-nav-card"><div class="gnc-label">See all</div><div class="gnc-title">Every electric scooter on sale</div></a>
    <a href="/electric-scooter-price" class="guide-nav-card" style="text-align:right"><div class="gnc-label">Prices</div><div class="gnc-title">Electric scooter price list</div></a>
  </div>`,
  sidebar: `
  <div class="sidebar-card">
    <h4>At a glance</h4>
    <p style="font-size:14px;margin:0">${onSale} models on sale<br>${launches.length} new launches logged<br>${gone.length} discontinued models logged</p>
  </div>`
});
