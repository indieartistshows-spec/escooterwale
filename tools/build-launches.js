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
const F = JSON.parse(fs.readFileSync('data/launch-features.json', 'utf8')).slides.filter(f => f.img && fs.existsSync('.' + f.img.d) || f.img && fs.existsSync('.' + f.img.m));
const host = u => new URL(u).hostname.replace(/^www\./, '');
const fold = f => {
  const brandUrl = UTM(f.url) + '&utm_content=' + f.id;
  const d = fs.existsSync('.' + f.img.d) ? f.img.d : f.img.m, m = fs.existsSync('.' + f.img.m) ? f.img.m : d;
  const inCat = f.modelId && S.some(x => x.id === f.modelId) && /konarc/i.test(f.model) ? `<a class="lf-btn ghost" href="/scooters/${f.modelId}">Konarc specs and review</a>` : '';
  return `
  <section class="launch-fold">
    <a class="lf-img" href="${brandUrl}" target="_blank" rel="noopener" data-out="brand" data-brand="${f.brandId}" aria-label="${f.brand} ${f.model} on ${host(f.url)}">
      <picture><source media="(max-width:640px)" srcset="${m}"/><img src="${d}" alt="${f.brand} ${f.model}" loading="lazy" width="1920" height="760"/></picture>
      <span class="lf-tag">${f.status} · ${fmt(f.date)}</span>
    </a>
    <div class="lf-body">
      <div class="lf-brand">${f.brand}</div>
      <h2 class="lf-title">${f.headline}</h2>
      <p>${f.summary}</p>
      <ul class="lf-facts">${f.facts.map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="lf-actions">
        <a class="lf-btn" href="${brandUrl}" target="_blank" rel="noopener" data-out="brand" data-brand="${f.brandId}">Visit ${host(f.url)} ↗</a>
        <a class="lf-btn ghost" href="${f.article.url}" target="_blank" rel="noopener" data-out="article">Read the ${f.article.source} report ↗</a>
        ${inCat}
      </div>
    </div>
  </section>`;
};
const FOLD_CSS = `<style>
.launch-fold{margin:0 0 32px;border:1px solid var(--line,#e5e7eb);border-radius:18px;overflow:hidden;background:var(--card,#fff)}
.lf-img{position:relative;display:block;aspect-ratio:1920/760;background:#0b0f14}
.lf-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.lf-img::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.25)}
.lf-tag{position:absolute;left:16px;top:16px;z-index:1;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px}
.lf-body{padding:22px 24px 24px}
.lf-brand{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--g,#16a663);margin-bottom:6px}
.lf-title{margin:0 0 10px;font-size:24px;line-height:1.25}
.lf-facts{margin:12px 0 16px;padding-left:18px}
.lf-facts li{margin:4px 0}
.lf-actions{display:flex;flex-wrap:wrap;gap:10px}
.lf-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:10px;background:var(--g,#16a663);color:#fff!important;font-weight:700;font-size:14px;text-decoration:none!important}
.lf-btn.ghost{background:transparent;color:var(--ink,#111)!important;border:1px solid var(--line,#d1d5db)}
@media(max-width:640px){.lf-img{aspect-ratio:780/1040;max-height:420px}.lf-title{font-size:20px}.lf-body{padding:18px}}
</style>`;
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
  body: `${FOLD_CSS}
  <h2>Latest launches</h2>
  ${F.map(fold).join('')}

  <div class="callout-box green">
    <h4>💡 How this list works</h4>
    <p style="margin:0;font-size:15px">A model counts as <strong>new</strong> once it has appeared on the brand's own website in two weekly checks in a row, so one-off test pages do not sneak in. It counts as <strong>discontinued</strong> after it has been missing for two checks in a row. Entries stay here permanently.</p>
  </div>

  <h2>Launch log</h2>
  <p>New models and battery options we have spotted on brand websites, newest first.</p>
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
