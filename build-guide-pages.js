/* ============================================================
   build-guide-pages.js — content for the new guide pages.
   Run:  node build-guides.js
   ============================================================ */
const G = require('./build-guides.js');
const { page, BASE, VERIFIED, kwh, exFactory, inr, subsidyFor,
        ORG, crumbs, article, faq, SIDEBAR_SUBSIDY, SCOOTERS_DB } = G;

const byPrice = [...SCOOTERS_DB].sort((a, b) => a.price - b.price);
const rows = byPrice.map(s => ({ s, k: kwh(s), f: exFactory(s), sub: subsidyFor(s) }));
const ineligible = rows.filter(r => !r.sub.eligible);
const partial = rows.filter(r => r.sub.eligible && r.sub.amount < 5000);
const full = rows.filter(r => r.sub.amount === 5000);
const nearLine = rows.filter(r => r.sub.eligible && r.f > 135000).sort((a, b) => b.f - a.f);

/* ═══════════════════════════════════════════════════════════
   1. SUBSIDY DEADLINES
   ═══════════════════════════════════════════════════════════ */
const SD = JSON.parse(require('fs').readFileSync('data/subsidy.json', 'utf8'));
const TODAY_ISO = SD.checked;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD = (iso, approx) => { const [y, m, d] = iso.split('-').map(Number); return (approx ? '~' : '') + `${d} ${MON[m - 1]} ${y}`; };
const withDeadline = Object.entries(SD.states).filter(([k, s]) => s.deadline && s.deadlineWhat)
  .map(([k, s]) => ({ k, s, passed: s.deadline < TODAY_ISO })).sort((a, b) => a.s.deadline.localeCompare(b.s.deadline));
const upcoming = withDeadline.filter(x => !x.passed), passed = withDeadline.filter(x => x.passed);
const next = upcoming.slice(0, 3);
const shortList = upcoming.slice(0, 3).map(x => `${x.s.name} ${fmtD(x.s.deadline, x.s.deadlineApprox)}`).join(', ');
const deadlineRows = upcoming.map(({ s }) => `      <tr><td class="amt">${fmtD(s.deadline, s.deadlineApprox)}</td><td><strong>${s.name}</strong></td><td>${s.deadlineWhat}</td><td>${s.deadlineAdvice}</td></tr>`).join('\n');
const passedRows = passed.map(({ s }) => `      <tr><td>${s.name}</td><td>${s.deadlineWhat}</td><td>Ended ${fmtD(s.deadline, s.deadlineApprox)}. ${s.deadlineAdvice}</td></tr>`).join('\n');
const changeLog = SD.changelog.slice(0, 6).map(c => `<li><strong>${fmtD(c.date)}</strong><ul style="margin:4px 0 8px 16px">${c.items.map(i => `<li>${i}</li>`).join('')}</ul></li>`).join('');
const srcLinks = [SD.central.sources, ...Object.values(SD.states).map(s => s.sources || [])].flat()
  .filter((v, i, arr) => v && arr.findIndex(x => x.url === v.url) === i)
  .map(s => `<li><a href="${s.url}" target="_blank" rel="noopener" data-out="source">${s.title}</a>${s.official ? ' (official)' : ''}</li>`).join('');

page({
  file: 'guide-subsidy-deadlines.html',
  canon: '/guide-subsidy-deadlines',
  title: 'EV Subsidy Last Date 2026: Every Central and State Deadline | EScooterwale',
  desc: `PM E-DRIVE runs to 31 March 2028. State deadlines come sooner: ${shortList}. Every electric scooter subsidy deadline, checked ${VERIFIED}.`,
  eyebrow: 'Deadline Tracker',
  crumb: 'EV subsidy deadlines',
  h1: 'Electric scooter subsidy last date: every deadline that matters in 2026',
  standfirst: 'The central scheme runs to March 2028. Several state schemes end much sooner. This page tracks every date and is re-checked every week.',
  readTime: '6 min read',
  schema: { '@context': 'https://schema.org', '@graph': [
    ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Guides', url: `${BASE}/trending` }, { name: 'EV subsidy deadlines' }]),
    article('/guide-subsidy-deadlines', 'Electric scooter subsidy last date: every deadline that matters in 2026',
      `Central and state electric two-wheeler subsidy deadlines in India, checked ${VERIFIED}.`),
    faq('/guide-subsidy-deadlines', [
      ['What is the last date for the electric scooter subsidy in India?',
       `The central PM E-DRIVE scheme for electric two-wheelers runs until 31 March 2028. State deadlines are earlier: ${shortList}.`],
      ['Is there a separate last date for the Bajaj Chetak or TVS iQube subsidy?',
       'No. Subsidy deadlines belong to the government scheme, not to the brand. A Bajaj Chetak, TVS iQube, Ola or Ather buyer is governed by the same PM E-DRIVE date of 31 March 2028, plus whatever state deadline applies where the scooter is registered. A brand-specific subsidy deadline is a sales offer, not a government scheme.'],
      ['What happens if the scheme ends before my scooter is delivered?',
       'Eligibility is normally locked at the date of booking and advance payment rather than at delivery. If you book before the deadline you should keep the subsidy even if delivery is delayed. Get that confirmation in writing from the dealer.'],
      ['What is the Odisha EV subsidy last date?',
       `${SD.states.odisha.notes} The state subsidy is ${SD.states.odisha.cash.text.toLowerCase()}`],
      ['Has the PM E-DRIVE subsidy been extended?',
       'Yes. The Ministry of Heavy Industries extended PM E-DRIVE demand incentives for electric two-wheelers to 31 March 2028, raised the two-wheeler allocation from ₹1,772 crore to ₹2,767 crore and lifted the unit cap to about 45.8 lakh vehicles. The rate stays at ₹2,500/kWh, capped at ₹5,000.']
    ])
  ]},
  body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">The central <strong>PM E-DRIVE scheme runs to 31 March 2028</strong>, so there is no rush on the central ₹5,000. The dates that matter are at state level, soonest first: <strong>${shortList}</strong>.</p>
  </div>

  <div class="callout-box">
    <h4>What changed recently</h4>
    <ul style="margin:0 0 0 16px;font-size:14px">${changeLog}</ul>
  </div>

  <h2>Central deadline: 31 March 2028</h2>
  <p>PM E-DRIVE support for electric two-wheelers was due to lapse in 2026. The Ministry of Heavy Industries extended it to <strong>31 March 2028</strong> in August 2026, with a bigger budget. Claims have to be filed by 31 December 2027.</p>
  <table class="subsidy-table">
    <thead><tr><th>What changed in August 2026</th><th>Before</th><th>After</th></tr></thead>
    <tbody>
      <tr><td>End date for e-2W</td><td>2026</td><td class="amt">31 Mar 2028</td></tr>
      <tr><td>Two-wheeler allocation</td><td>₹1,772 crore</td><td class="amt">₹2,767 crore</td></tr>
      <tr><td>Subsidised units</td><td>24.8 lakh</td><td class="amt">45.8 lakh</td></tr>
      <tr><td>Total scheme outlay</td><td>₹10,900 crore</td><td class="amt">₹11,900 crore</td></tr>
      <tr><td>Rate per kWh</td><td>₹2,500</td><td>₹2,500, unchanged</td></tr>
    </tbody>
  </table>
  <p>The rate itself did not change. It was halved from ₹5,000/kWh to ₹2,500/kWh on 1 April 2025 and has stayed there. The cap remains ₹5,000 per scooter.</p>

  <h2>Is there a separate deadline for Chetak, iQube, Ola or Ather?</h2>
  <p>No. <strong>Subsidy deadlines belong to the government scheme, not to the brand.</strong> A Bajaj Chetak buyer, a TVS iQube buyer and an Ather buyer all work to the same central date of 31 March 2028, plus whatever state deadline applies where the scooter is registered.</p>
  <p>If a dealer tells you the "Chetak subsidy ends this month", they are describing a manufacturer discount or a sales target, not a government scheme. Ask them to name the notification.</p>
  <p>What can change by brand is <strong>eligibility</strong>. If a manufacturer raises a model's price above ₹1.5 lakh ex-factory, that model stops qualifying from the date of the price change. We track which models sit close to that line on our <a href="/guide-subsidy-eligibility">eligibility page</a>.</p>

  <h2>State deadlines, soonest first</h2>
  <table class="subsidy-table">
    <thead><tr><th>Date</th><th>State</th><th>What lapses</th><th>What to do</th></tr></thead>
    <tbody>
${deadlineRows}
    </tbody>
  </table>

  <div class="callout-box">
    <h4>Delhi tapers, so the real deadline is sooner than 2030</h4>
    <p style="margin:0 0 8px;font-size:14px">Delhi's EV Policy 2026 was notified on 1 July 2026 and runs to March 2030, but the two-wheeler incentive drops every year:</p>
    <ul style="margin:0 0 0 16px;font-size:14px">
      <li><strong>Year 1</strong> (to roughly 30 June 2027): ₹10,000/kWh, capped at ₹30,000</li>
      <li><strong>Year 2</strong>: ₹6,600/kWh, capped at ₹20,000</li>
      <li><strong>Year 3</strong>: ₹3,300/kWh, capped at ₹10,000</li>
    </ul>
    <p style="margin:8px 0 0;font-size:14px">A Delhi buyer who waits twelve months loses ₹10,000. That is the deadline that actually costs money.</p>
  </div>

  <h2>Already ended, so ignore anything that says otherwise</h2>
  <table class="subsidy-table">
    <thead><tr><th>State</th><th>What ended</th><th>When</th></tr></thead>
    <tbody>
${passedRows}
      <tr><td>Gujarat</td><td>₹10,000/kWh purchase subsidy, capped at ₹20,000</td><td>Policy expired; subsidy pulled from the e-VEG portal around October 2023</td></tr>
      <tr><td>Uttar Pradesh</td><td>15% of ex-factory, capped at ₹5,000</td><td>One-year window closed 13 October 2023</td></tr>
      <tr><td>Goa</td><td>₹8,000/kWh, capped at ₹15,000</td><td>Window closed 31 December 2024</td></tr>
      <tr><td>Kerala</td><td>EV Policy 2019</td><td>Expired March 2024, no successor. Kerala raised EV taxes in 2025</td></tr>
      <tr><td>West Bengal</td><td>Road tax and registration exemption</td><td>Last confirmed extension ran only to 31 March 2025</td></tr>
      <tr><td>Punjab</td><td>₹3,000/kWh, capped at ₹10,000</td><td>Validity disputed. May have lapsed February 2026, and no working disbursement portal was ever confirmed</td></tr>
    </tbody>
  </table>
  <p>Several large sites still list the Gujarat ₹20,000 and the UP ₹5,000 as current. Both ended years ago. If a page quoting them has no verification date, treat every other figure on that page as suspect too.</p>

  <h2>Common questions</h2>

  <h3>What is the last date for the electric scooter subsidy in India?</h3>
  <p>31 March 2028 for the central PM E-DRIVE scheme. State deadlines are earlier and vary: ${shortList}.</p>

  <h3>What is the Odisha EV subsidy last date?</h3>
  <p>${SD.states.odisha.notes} The state pays ${SD.states.odisha.cash.text.toLowerCase()}</p>

  <h3>Will PM E-DRIVE be extended again beyond 2028?</h3>
  <p>Nobody knows yet. The scheme has been extended and the two-wheeler budget raised by about 85%, which suggests continued support. But the rate was also halved in April 2025, so the amount per scooter is heading down even as the timeline stretches.</p>

  <h3>What happens if the scheme ends before my scooter is delivered?</h3>
  <p>Eligibility is normally locked at booking and advance payment, not at delivery. Book before the deadline and you should keep the subsidy even if delivery slips. Get it in writing.</p>

  <h3>Should I wait for a better subsidy?</h3>
  <p>On the central scheme, no. The rate has already halved once and there is no sign of an increase. In Delhi, waiting costs you money because the incentive tapers each year. The only reason to wait is if your state is about to announce a new policy, which currently applies to Uttarakhand, Goa and Assam.</p>

  <div class="callout-box">
    <h4>How we check this page</h4>
    <p style="margin:0 0 8px;font-size:14px">We re-check this page every week against the PM E-DRIVE portal, Ministry of Heavy Industries and PIB releases, state transport department notifications and trade press. A change goes on the page only when an official source or a named report backs it. <strong>Last checked ${VERIFIED}.</strong></p>
    <ul style="margin:0 0 0 16px;font-size:13px">${srcLinks}</ul>
  </div>

  <div class="guide-nav">
    <a href="/guide-subsidy" class="guide-nav-card">
      <div class="gnc-label">← Back</div>
      <div class="gnc-title">EV subsidy 2026, the full guide</div>
    </a>
    <a href="/guide-subsidy-eligibility" class="guide-nav-card" style="text-align:right">
      <div class="gnc-label">Next →</div>
      <div class="gnc-title">Which scooters actually qualify</div>
    </a>
  </div>`,
  sidebar: `
  <div class="sidebar-card" style="background:var(--ink);border-color:rgba(22,166,99,.2)">
    <h4 style="color:#fff">Next deadlines</h4>
    ${next.map((x, i) => `${i ? '<div style="border-top:1px solid rgba(255,255,255,.1);margin:14px 0 12px"></div>' : ''}
    <div style="font-size:${i ? 20 : 26}px;font-weight:${i ? 800 : 900};color:#16c964;font-family:var(--f-head);line-height:1.1;margin:6px 0 4px">${fmtD(x.s.deadline, x.s.deadlineApprox)}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5">${x.s.name}: ${x.s.deadlineWhat.split('.')[0]}.</div>`).join('')}
    <div style="border-top:1px solid rgba(255,255,255,.1);margin:14px 0 12px"></div>
    <div style="font-size:20px;font-weight:800;color:#16c964;font-family:var(--f-head)">31 Mar 2028</div>
    <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;margin-top:2px">Central PM E-DRIVE ends.</div>
  </div>
  ${SIDEBAR_SUBSIDY}`
});

/* ═══════════════════════════════════════════════════════════
   2. ELIGIBILITY — generated from the 41-model database
   ═══════════════════════════════════════════════════════════ */
const eligibilityRows = rows.map(r => `      <tr>
        <td><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a></td>
        <td>${inr(r.s.price)}</td>
        <td>~${inr(r.f)}</td>
        <td>${r.s.battery}</td>
        <td class="amt">${r.sub.eligible ? inr(r.sub.amount) : 'Nothing'}</td>
      </tr>`).join('\n');

page({
  file: 'guide-subsidy-eligibility.html',
  canon: '/guide-subsidy-eligibility',
  title: 'Which Electric Scooters Qualify for PM E-DRIVE Subsidy? All 44 Models Checked | EScooterwale',
  desc: 'Four of the 44 electric scooters sold in India get no PM E-DRIVE subsidy because they exceed the ₹1.5 lakh ex-factory cap. Model-by-model subsidy amounts, verified 24 August 2026.',
  eyebrow: 'Eligibility Check',
  crumb: 'Which scooters qualify',
  h1: 'Which electric scooters actually qualify for the PM E-DRIVE subsidy?',
  standfirst: `We ran all ${SCOOTERS_DB.length} electric scooters in our database against the scheme rules. ${ineligible.length} get nothing at all, ${partial.length} get less than the full amount, and the rest all get exactly the same ₹5,000.`,
  readTime: '7 min read',
  schema: { '@context': 'https://schema.org', '@graph': [
    ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Guides', url: `${BASE}/trending` }, { name: 'Which scooters qualify' }]),
    article('/guide-subsidy-eligibility', 'Which electric scooters qualify for the PM E-DRIVE subsidy',
      `Model-by-model PM E-DRIVE eligibility for ${SCOOTERS_DB.length} electric scooters sold in India, against the ₹1.5 lakh ex-factory cap and the ₹2,500 per kWh rate.`),
    faq('/guide-subsidy-eligibility', [
      ['How much PM E-DRIVE subsidy do I get on an electric scooter?',
       'The scheme pays ₹2,500 per kWh capped at ₹5,000 per scooter, or 15% of ex-factory price if that is lower. Because the cap is reached at a 2 kWh battery, almost every eligible scooter receives exactly ₹5,000 regardless of how large its battery is.'],
      ['Why does the Ather 450X get no subsidy?',
       'PM E-DRIVE only covers electric two-wheelers with an ex-factory price at or below ₹1.5 lakh. The Ather 450X, Ather 450 Apex, Ola S1 Pro+ 5.2 kWh and TVS iQube ST 5.3 kWh all sit above that ceiling, so they receive no central subsidy.'],
      ['Does a bigger battery mean a bigger subsidy?',
       'No. The ₹2,500 per kWh rate hits the ₹5,000 cap at 2 kWh. A 5.2 kWh scooter and a 2 kWh scooter receive the same ₹5,000. The rate only reduces your subsidy below the cap if the battery is smaller than 2 kWh.'],
      ['Is the ₹1.5 lakh limit on ex-showroom or ex-factory price?',
       'Ex-factory, which is lower than the ex-showroom price you see advertised because ex-showroom includes GST and dealer margin. A scooter advertised slightly above ₹1.5 lakh ex-showroom may still qualify. Ask the dealer for the ex-factory figure on the invoice.']
    ])
  ]},
  body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">PM E-DRIVE pays <strong>₹2,500 per kWh, capped at ₹5,000</strong>, only on scooters with an ex-factory price at or below <strong>₹1.5 lakh</strong>. Because the cap is reached at a 2 kWh battery, <strong>${full.length} of our ${SCOOTERS_DB.length} models receive exactly ₹5,000</strong>, ${partial.length} receive less because their packs are small, and <strong>${ineligible.length} receive nothing</strong> because they are too expensive.</p>
  </div>

  <h2>The four scooters that get nothing</h2>
  <p>These are all popular, well-reviewed machines. None of them qualifies, because all four sit above the ₹1.5 lakh ex-factory ceiling.</p>
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Ex-showroom</th><th>Approx ex-factory</th><th>Subsidy</th></tr></thead>
    <tbody>
${ineligible.sort((a,b)=>b.f-a.f).map(r => `      <tr><td><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a></td><td>${inr(r.s.price)}</td><td>~${inr(r.f)}</td><td class="amt">Nothing</td></tr>`).join('\n')}
    </tbody>
  </table>
  <p>If a dealer quotes you a PM E-DRIVE subsidy on any of these, they are either describing their own discount or they are wrong. Ask to see the deduction as a line item on the invoice.</p>

  <h2>Four more are sitting right on the cliff edge</h2>
  <p>These models are within about ₹8,000 of the ex-factory ceiling. A modest price rise pushes any of them out of the scheme, and the subsidy would disappear from the date of the price change.</p>
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Approx ex-factory</th><th>Headroom before ineligible</th></tr></thead>
    <tbody>
${nearLine.map(r => `      <tr><td><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a></td><td>~${inr(r.f)}</td><td class="amt">~${inr(150000 - r.f)}</td></tr>`).join('\n')}
    </tbody>
  </table>

  <h2>Three get less than ₹5,000</h2>
  <p>The per-kWh rate only bites below a 2 kWh pack. These three are the models where battery size, not price, limits the subsidy.</p>
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Battery</th><th>Calculation</th><th>Subsidy</th></tr></thead>
    <tbody>
${partial.map(r => `      <tr><td><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a></td><td>${r.s.battery}</td><td>${r.k} kWh × ₹2,500</td><td class="amt">${inr(r.sub.amount)}</td></tr>`).join('\n')}
    </tbody>
  </table>

  <div class="callout-box">
    <h4>Why battery size mostly does not matter</h4>
    <p style="margin:0;font-size:14px">At ₹2,500 per kWh, a 2 kWh battery already produces ₹5,000, which is the cap. Every scooter above 2 kWh therefore receives the identical ₹5,000. A 5.2 kWh Ola S1 Pro+ would receive the same as a 2 kWh Ola S1 X, if the Pro+ were eligible at all. The per-kWh framing that dealers and manufacturers use makes the scheme sound more generous on large batteries than it is.</p>
  </div>

  <h2>Every model, checked</h2>
  <p>All ${SCOOTERS_DB.length} scooters in our database, sorted cheapest first, with the central subsidy each one attracts. State subsidies come on top and are covered in the <a href="/guide-subsidy">main subsidy guide</a>.</p>
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Ex-showroom</th><th>Approx ex-factory</th><th>Battery</th><th>Central subsidy</th></tr></thead>
    <tbody>
${eligibilityRows}
    </tbody>
  </table>

  <div class="callout-box">
    <h4>How we calculate ex-factory, and why it is an estimate</h4>
    <p style="margin:0;font-size:14px">The ₹1.5 lakh eligibility test uses <strong>ex-factory</strong> price, which manufacturers do not publish. We derive it from ex-showroom price by removing the 5% GST that applies to electric vehicles. Real ex-factory also excludes dealer margin, so true figures are a little lower than ours and the models we show near the line may in fact clear it comfortably. Treat this table as a strong guide, and confirm the ex-factory figure on your invoice before assuming a subsidy. Where a model's status is genuinely borderline, ask the dealer to show you its Ministry of Heavy Industries empanelment.</p>
  </div>

  <h2>The other eligibility conditions</h2>
  <p>Price is the rule that excludes the most models, but it is not the only one. To qualify a scooter must also:</p>
  <ul>
    <li>Be fitted with an advanced battery as defined by the scheme</li>
    <li>Come from a manufacturer empanelled with the Ministry of Heavy Industries</li>
    <li>Be sold through a dealer registered on the PM E-DRIVE and VAHAN portals</li>
    <li>Be registered in India, privately or corporately owned, both of which are eligible</li>
  </ul>
  <p>The subsidy is also limited to <strong>one two-wheeler claim per Aadhaar</strong>, and you must apply within <strong>30 days of your RC being generated</strong>. Full process on the <a href="/guide-subsidy-claim">how to claim page</a>.</p>

  <h2>Common questions</h2>

  <h3>How much PM E-DRIVE subsidy do I get on an electric scooter?</h3>
  <p>₹5,000, if your scooter has a battery of 2 kWh or larger and an ex-factory price at or below ₹1.5 lakh. Below 2 kWh you get ₹2,500 per kWh. Above ₹1.5 lakh ex-factory you get nothing.</p>

  <h3>Why does the Ather 450X get no subsidy?</h3>
  <p>Its ex-factory price is above the ₹1.5 lakh scheme ceiling. The same applies to the Ather 450 Apex, the Ola S1 Pro+ 5.2 kWh and the TVS iQube ST 5.3 kWh. PM E-DRIVE is designed for mass-market adoption, so the premium segment is deliberately excluded.</p>

  <h3>Does a bigger battery get a bigger subsidy?</h3>
  <p>No. The ₹5,000 cap is reached at 2 kWh, so every eligible scooter above that gets the same amount.</p>

  <h3>Which is the cheapest scooter that gets the full ₹5,000?</h3>
  <p>${(() => { const c = full.sort((a,b)=>a.s.price-b.s.price)[0]; return `The ${c.s.brand} ${c.s.name} at ${inr(c.s.price)} ex-showroom, with a ${c.s.battery} pack.`; })()}</p>

  <div class="guide-nav">
    <a href="/guide-subsidy-deadlines" class="guide-nav-card">
      <div class="gnc-label">← Back</div>
      <div class="gnc-title">Every EV subsidy deadline in 2026</div>
    </a>
    <a href="/guide-subsidy-claim" class="guide-nav-card" style="text-align:right">
      <div class="gnc-label">Next →</div>
      <div class="gnc-title">How to claim your subsidy</div>
    </a>
  </div>`,
  sidebar: `
  <div class="sidebar-card" style="background:var(--ink);border-color:rgba(22,166,99,.2)">
    <h4 style="color:#fff">At a glance</h4>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Models checked</span><strong style="color:#fff">${SCOOTERS_DB.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Get the full ₹5,000</span><strong style="color:#16c964">${full.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Get a reduced amount</span><strong style="color:#f59e0b">${partial.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Get nothing</span><strong style="color:#ef4444">${ineligible.length}</strong></div>
  </div>
  ${SIDEBAR_SUBSIDY}`
});

/* ═══════════════════════════════════════════════════════════
   3. HOW TO CLAIM
   ═══════════════════════════════════════════════════════════ */
page({
  file: 'guide-subsidy-claim.html',
  canon: '/guide-subsidy-claim',
  title: 'How to Claim the PM E-DRIVE Subsidy: Documents, Portal and Timeline | EScooterwale',
  desc: 'Step-by-step process to claim your electric scooter subsidy in India: what the dealer does, what you do, the 30-day RC window, the document list, state-by-state application routes and what to do if the money never arrives.',
  eyebrow: 'Process Guide',
  crumb: 'How to claim',
  h1: 'How to claim your electric scooter subsidy, step by step',
  standfirst: 'The central subsidy is applied by the dealer. Several state subsidies are not, and those are the ones buyers lose. Here is exactly who does what, and by when.',
  readTime: '7 min read',
  schema: { '@context': 'https://schema.org', '@graph': [
    ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Guides', url: `${BASE}/trending` }, { name: 'How to claim' }]),
    article('/guide-subsidy-claim', 'How to claim your electric scooter subsidy, step by step',
      'The PM E-DRIVE and state subsidy claim process for electric two-wheelers in India, including documents, deadlines and escalation.'),
    {
      '@type': 'HowTo',
      '@id': `${BASE}/guide-subsidy-claim#howto`,
      name: 'How to claim the PM E-DRIVE electric scooter subsidy',
      description: 'The process for receiving the central PM E-DRIVE subsidy and any applicable state subsidy when buying an electric two-wheeler in India.',
      totalTime: 'P60D',
      supply: [
        { '@type': 'HowToSupply', name: 'Aadhaar card, original and photocopy' },
        { '@type': 'HowToSupply', name: 'Valid address proof' },
        { '@type': 'HowToSupply', name: 'Bank account details for state direct transfer' },
        { '@type': 'HowToSupply', name: 'Certificate of Deposit, if claiming a scrappage bonus' }
      ],
      step: [
        { '@type': 'HowToStep', name: 'Confirm eligibility before booking', text: 'Check the ex-factory price is at or below ₹1.5 lakh and ask the dealer to show the model’s Ministry of Heavy Industries empanelment.' },
        { '@type': 'HowToStep', name: 'Complete Aadhaar verification', text: 'Aadhaar is mandatory and links the claim to you. One Aadhaar supports one two-wheeler claim under the scheme.' },
        { '@type': 'HowToStep', name: 'Check the invoice shows the subsidy as a deduction', text: 'The subsidy must appear as a line item reducing the price, not as a discount the dealer claims credit for.' },
        { '@type': 'HowToStep', name: 'Apply for the state subsidy within its deadline', text: 'Delhi requires application within 30 days of RC generation. Bihar uses a DBT portal. Maharashtra and Madhya Pradesh route it through the dealer.' },
        { '@type': 'HowToStep', name: 'Keep the invoice and RC', text: 'Both are needed for any later bank transfer and for any dispute about a subsidy that does not arrive.' }
      ]
    },
    faq('/guide-subsidy-claim', [
      ['Do I need to apply for the PM E-DRIVE subsidy myself?',
       'No. The central subsidy is applied by the dealer at the point of sale and appears as a deduction on your invoice. You complete Aadhaar verification and pay the reduced price. State subsidies are different and several require you to apply yourself within a deadline.'],
      ['What documents do I need to claim an electric scooter subsidy?',
       'Aadhaar card, which is mandatory, and a valid address proof. State schemes may additionally need bank account details for direct transfer, proof of state residence, and a Certificate of Deposit if you are claiming a scrappage bonus.'],
      ['How long does the subsidy take to arrive?',
       'The central subsidy is instant because it is deducted from your invoice. State subsidies vary. Delhi commits to disbursement within 60 days of application. Bihar pays through a DBT portal. Rajasthan, Assam and Chandigarh have all had reported delays or non-payment.'],
      ['What do I do if my subsidy never arrives?',
       'Start with the dealer and ask for the claim reference and submission date in writing. If it was a state subsidy, escalate to the state transport department or nodal EV agency with your invoice, RC and claim reference. Keep every document, because a claim with no paper trail is very hard to recover.']
    ])
  ]},
  body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">You do <strong>not</strong> apply for the central PM E-DRIVE subsidy. The dealer applies it and it appears as a deduction on your invoice. What you do have to watch is the <strong>state</strong> subsidy, where Delhi gives you <strong>30 days from RC generation</strong> to apply and Bihar runs its own portal. That is where buyers lose money.</p>
  </div>

  <h2>Who does what</h2>
  <table class="subsidy-table">
    <thead><tr><th>Step</th><th>Who</th><th>When</th></tr></thead>
    <tbody>
      <tr><td>Confirm the model is empanelled and under the price cap</td><td>You, at the dealership</td><td>Before booking</td></tr>
      <tr><td>Aadhaar verification</td><td>You</td><td>At booking</td></tr>
      <tr><td>Register the sale on the PM E-DRIVE and VAHAN portals</td><td>Dealer</td><td>At sale</td></tr>
      <tr><td>Deduct the central subsidy from the invoice</td><td>Dealer</td><td>At sale</td></tr>
      <tr><td>Apply for the state subsidy</td><td class="amt">Usually you</td><td>Varies. Delhi: 30 days from RC</td></tr>
      <tr><td>Disburse the state subsidy</td><td>State government</td><td>Delhi: within 60 days of application</td></tr>
    </tbody>
  </table>

  <h2>The five steps</h2>
  <ol class="step-list">
    <li>
      <div class="step-num">1</div>
      <div class="step-body">
        <div class="step-title">Confirm eligibility before you book, not after</div>
        <div class="step-desc">Ask for the ex-factory price on the invoice, not the ex-showroom price. The central cap of ₹1.5 lakh applies to ex-factory. Ask to see the model's Ministry of Heavy Industries empanelment. Four of the popular models we track do not qualify at all, listed on our <a href="/guide-subsidy-eligibility">eligibility page</a>.</div>
      </div>
    </li>
    <li>
      <div class="step-num">2</div>
      <div class="step-body">
        <div class="step-title">Complete Aadhaar verification</div>
        <div class="step-desc">Mandatory. It links the claim to you and blocks duplicate claims. One Aadhaar supports one two-wheeler claim under the scheme, so if someone in your household has already claimed on their Aadhaar, use a different one.</div>
      </div>
    </li>
    <li>
      <div class="step-num">3</div>
      <div class="step-body">
        <div class="step-title">Make the dealer show the subsidy as a line item</div>
        <div class="step-desc">This is the step that protects you. The invoice should read as ex-showroom price, minus PM E-DRIVE subsidy, equals amount payable. If the dealer instead presents a single "discounted price" with no breakdown, you cannot tell whether the subsidy reached you or was absorbed into their margin. Ask for the breakdown before signing.</div>
      </div>
    </li>
    <li>
      <div class="step-num">4</div>
      <div class="step-body">
        <div class="step-title">Apply for the state subsidy, and diarise the deadline</div>
        <div class="step-desc">This is where money gets lost. Delhi requires an application within 30 days of RC generation. Bihar runs a DBT portal that you use yourself. Maharashtra and Madhya Pradesh route it through the dealer. Ask which applies, get the answer in writing, and set a reminder.</div>
      </div>
    </li>
    <li>
      <div class="step-num">5</div>
      <div class="step-body">
        <div class="step-title">Keep the invoice, the RC and the claim reference</div>
        <div class="step-desc">Any state subsidy paid later by bank transfer will need them, and so will any complaint if the money never arrives. Photograph everything the day you take delivery.</div>
      </div>
    </li>
  </ol>

  <h2>Documents to carry</h2>
  <table class="subsidy-table">
    <thead><tr><th>Document</th><th>Needed for</th><th>Mandatory?</th></tr></thead>
    <tbody>
      <tr><td>Aadhaar card, original and photocopy</td><td>Central subsidy</td><td class="amt">Yes</td></tr>
      <tr><td>Valid address proof</td><td>Central and state</td><td class="amt">Yes</td></tr>
      <tr><td>Bank account details, cancelled cheque or passbook</td><td>States that pay by direct transfer</td><td>State-dependent</td></tr>
      <tr><td>Proof of state residence</td><td>Odisha, Goa, and several others</td><td>State-dependent</td></tr>
      <tr><td>Certificate of Deposit from a scrapping facility</td><td>Delhi ₹10,000 scrappage bonus</td><td>Only if scrapping</td></tr>
      <tr><td>PAN card</td><td>Bihar DBT portal</td><td>State-dependent</td></tr>
    </tbody>
  </table>

  <div class="callout-box">
    <h4>Delhi scrappage: get the certificate first</h4>
    <p style="margin:0;font-size:14px">Delhi's ₹10,000 scrappage bonus requires you to trade in a Delhi-registered BS-IV or older two-wheeler and buy the new EV <strong>within six months of the Certificate of Deposit being issued</strong>. Get the certificate before you buy, not after. Buying first and scrapping later does not work.</p>
  </div>

  <h2>How each state handles it</h2>
  <table class="subsidy-table">
    <thead><tr><th>State</th><th>Route</th><th>Deadline</th></tr></thead>
    <tbody>
      <tr><td><strong>Delhi</strong></td><td>You apply, following RC generation</td><td class="amt">30 days from RC, disbursed within 60 days</td></tr>
      <tr><td><strong>Bihar</strong></td><td>You apply on the state DBT portal with RC, chassis number, PAN and bank details</td><td>Purchases from 15 May 2026 onward</td></tr>
      <tr><td><strong>Maharashtra</strong></td><td>Dealer processes</td><td>Within the policy period to 31 Mar 2030</td></tr>
      <tr><td><strong>Madhya Pradesh</strong></td><td>Dealer processes, first 1,00,000 units</td><td>While the quota lasts</td></tr>
      <tr><td><strong>Rajasthan</strong></td><td>Dealer submits, state disburses</td><td>Disbursement has been slow. Chase it</td></tr>
      <tr><td><strong>Odisha</strong></td><td>You apply, permanent residents only</td><td class="amt">Window closes 30 Sep 2026</td></tr>
      <tr><td><strong>Assam</strong></td><td>Dealer route</td><td class="amt">Policy expires around 4 Sep 2026. Reported non-payment</td></tr>
      <tr><td><strong>Andhra Pradesh</strong></td><td>Policy exists, no operational portal confirmed</td><td>Verify with the AP Transport Department</td></tr>
    </tbody>
  </table>

  <h2>What to do if the subsidy never arrives</h2>
  <p>This happens more than the schemes admit. Assam and Chandigarh both have documented cases of announced incentives not reaching buyers.</p>
  <ol class="step-list">
    <li><div class="step-num">1</div><div class="step-body"><div class="step-title">Go back to the dealer in writing</div><div class="step-desc">Email, not a phone call. Ask for the claim reference number and the date it was submitted. A dealer who cannot produce a reference probably never filed it.</div></div></li>
    <li><div class="step-num">2</div><div class="step-body"><div class="step-title">Check the portal yourself</div><div class="step-desc">For the central scheme, the status sits against your vehicle on the government portal. For state schemes, the nodal agency usually publishes a status lookup.</div></div></li>
    <li><div class="step-num">3</div><div class="step-body"><div class="step-title">Escalate to the state transport department or nodal EV agency</div><div class="step-desc">Send the invoice, RC, claim reference and a dated summary. Delhi cleared roughly ₹140 crore of pending EV subsidy dues after a High Court intervention, so escalation does work, slowly.</div></div></li>
  </ol>

  <h2>Common questions</h2>

  <h3>Do I need to apply for the PM E-DRIVE subsidy myself?</h3>
  <p>No. The dealer applies it and it comes off your invoice. You verify with Aadhaar and pay the reduced price. State subsidies are the ones that may need your own application.</p>

  <h3>Can I claim if I buy online?</h3>
  <p>Yes. Ola Electric and Ather Energy both process PM E-DRIVE through their online sales channels, with Aadhaar verification during booking.</p>

  <h3>How long does the money take?</h3>
  <p>The central subsidy is instant because it is a deduction, not a payment. Delhi commits to 60 days from application. Bihar pays through DBT. Rajasthan, Assam and Chandigarh have all had reported delays.</p>

  <h3>Can I claim on a second scooter?</h3>
  <p>Not on the same Aadhaar. The scheme allows one two-wheeler claim per Aadhaar.</p>

  <div class="guide-nav">
    <a href="/guide-subsidy-eligibility" class="guide-nav-card">
      <div class="gnc-label">← Back</div>
      <div class="gnc-title">Which scooters actually qualify</div>
    </a>
    <a href="/guide-subsidy" class="guide-nav-card" style="text-align:right">
      <div class="gnc-label">Next →</div>
      <div class="gnc-title">EV subsidy 2026, the full guide</div>
    </a>
  </div>`,
  sidebar: SIDEBAR_SUBSIDY
});

/* ═══════════════════════════════════════════════════════════
   4. PRICE PAGE
   ═══════════════════════════════════════════════════════════ */
const priceRows = byPrice.map(r => {
  const sub = subsidyFor(r);
  return `      <tr>
        <td><a href="/scooters/${r.id}">${r.brand} ${r.name}</a></td>
        <td class="amt">${inr(r.price)}</td>
        <td>${inr(r.onRoad)}</td>
        <td>₹${r.emiFrom.toLocaleString('en-IN')}/mo</td>
        <td>${r.battery}</td>
        <td>${r.realRange}</td>
        <td>${sub.eligible ? inr(sub.amount) : '—'}</td>
      </tr>`;
}).join('\n');

const band = (label, lo, hi) => {
  const list = byPrice.filter(s => s.price >= lo && s.price < hi);
  if (!list.length) return '';
  const cheapest = list[0], best = [...list].sort((a, b) => b.score - a.score)[0];
  return `  <h3>${label} <span style="font-weight:500;color:var(--ink-3);font-size:15px">(${list.length} models)</span></h3>
  <p>Cheapest is the <a href="/scooters/${cheapest.id}">${cheapest.brand} ${cheapest.name}</a> at ${inr(cheapest.price)}. Highest ScootScore in this band is the <a href="/scooters/${best.id}">${best.brand} ${best.name}</a> at ${best.score}/10, ${inr(best.price)}.</p>
  <ul>${list.map(s => `<li><a href="/scooters/${s.id}">${s.brand} ${s.name}</a> — ${inr(s.price)} ex-showroom, ${s.realRange} real range, ScootScore ${s.score}</li>`).join('')}</ul>`;
};

page({
  file: 'electric-scooter-price.html',
  canon: '/electric-scooter-price',
  title: `Electric Scooter Price in India 2026: All ${SCOOTERS_DB.length} Models Compared | EScooterwale`,
  desc: `Complete electric scooter price list for India 2026. Ex-showroom and on-road prices, EMI, real-world range and subsidy for all ${SCOOTERS_DB.length} models from 10 brands. Updated 24 August 2026.`,
  eyebrow: 'Price List',
  crumb: 'Electric scooter prices',
  h1: `Electric scooter price in India 2026: all ${SCOOTERS_DB.length} models`,
  standfirst: `Ex-showroom price, estimated on-road price, EMI, real-world range and the central subsidy for every electric scooter on sale in India. Prices from ${inr(byPrice[0].price)} to ${inr(byPrice[byPrice.length-1].price)}.`,
  readTime: '8 min read',
  schema: { '@context': 'https://schema.org', '@graph': [
    ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Electric scooter prices' }]),
    article('/electric-scooter-price', `Electric scooter price in India 2026: all ${SCOOTERS_DB.length} models`,
      'Complete price list for electric scooters sold in India, with ex-showroom price, on-road estimate, EMI, real-world range and central subsidy.'),
    {
      '@type': 'ItemList',
      '@id': `${BASE}/electric-scooter-price#list`,
      name: 'Electric scooter prices in India 2026',
      numberOfItems: byPrice.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: byPrice.map((s, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: {
          '@type': 'Product',
          name: `${s.brand} ${s.name}`,
          url: `${BASE}/scooters/${s.id}`,
          image: `${BASE}${s.cardImg}`,
          brand: { '@type': 'Brand', name: s.brand },
          offers: { '@type': 'Offer', price: s.price, priceCurrency: 'INR', availability: 'https://schema.org/InStock', url: s.brandUrl }
        }
      }))
    },
    faq('/electric-scooter-price', [
      ['What is the price of an electric scooter in India?',
       `Electric scooters in India range from ${inr(byPrice[0].price)} for the ${byPrice[0].brand} ${byPrice[0].name} to ${inr(byPrice[byPrice.length-1].price)} for the ${byPrice[byPrice.length-1].brand} ${byPrice[byPrice.length-1].name}, ex-showroom. Most mainstream models sit between ₹90,000 and ₹1.5 lakh. On-road prices are typically 8 to 10% higher.`],
      ['Which is the cheapest electric scooter in India?',
       `The ${byPrice[0].brand} ${byPrice[0].name} at ${inr(byPrice[0].price)} ex-showroom, with a ${byPrice[0].battery} battery and around ${byPrice[0].realRange} of real-world range.`],
      ['What is the difference between ex-showroom and on-road price?',
       'Ex-showroom is the manufacturer price including GST but excluding registration, insurance and any local levies. On-road price adds those. For electric scooters the gap is smaller than for petrol, because registration fees are waived nationwide and many states also exempt road tax. Expect roughly 8 to 10% above ex-showroom.'],
      ['Do electric scooter prices include the subsidy?',
       'Advertised ex-showroom prices normally exclude the PM E-DRIVE subsidy, which is deducted at the point of sale. The central subsidy is ₹5,000 for most eligible scooters. Four models we track exceed the ₹1.5 lakh ex-factory cap and receive nothing.']
    ])
  ]},
  body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">Electric scooters in India run from <strong>${inr(byPrice[0].price)}</strong> to <strong>${inr(byPrice[byPrice.length-1].price)}</strong> ex-showroom. The mainstream band is ₹90,000 to ₹1.5 lakh. On-road adds roughly 8 to 10%, less than for petrol scooters because registration fees are waived nationwide and many states also waive road tax. Most eligible scooters get <strong>₹5,000 off</strong> via PM E-DRIVE.</p>
  </div>

  <h2>Full price list, cheapest first</h2>
  <p>All ${SCOOTERS_DB.length} models we track, with ex-showroom price, our estimated on-road price, the starting EMI, battery size, our measured or estimated real-world range, and the central subsidy each attracts.</p>
  <div style="overflow-x:auto">
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Ex-showroom</th><th>On-road (est.)</th><th>EMI from</th><th>Battery</th><th>Real range</th><th>Subsidy</th></tr></thead>
    <tbody>
${priceRows}
    </tbody>
  </table>
  </div>
  <p style="font-size:13px;color:var(--ink-4)">On-road prices are estimates and vary by state depending on road tax and insurance. Real-world range is our own figure and is consistently lower than the manufacturer IDC claim. See the <a href="/guide-real-range">real range test</a> for how we measure it.</p>

  <h2>Prices by budget</h2>
${band('Under ₹80,000', 0, 80000)}
${band('₹80,000 to ₹1 lakh', 80000, 100000)}
${band('₹1 lakh to ₹1.25 lakh', 100000, 125000)}
${band('₹1.25 lakh to ₹1.5 lakh', 125000, 150000)}
${band('Above ₹1.5 lakh', 150000, 99999999)}

  <div class="callout-box">
    <h4>The price you pay is not the price advertised</h4>
    <p style="margin:0;font-size:14px">Three things move the number between the advertisement and your invoice. <strong>The central subsidy</strong> takes ₹5,000 off most eligible scooters at the point of sale. <strong>State subsidies</strong> can take up to ₹30,000 more off in Delhi, ₹10,000 in Maharashtra, Madhya Pradesh and Bihar, and nothing at all in most other states. <strong>Road tax</strong> is waived in most states, which is why the on-road gap is smaller than for petrol. Our <a href="/guide-subsidy">subsidy guide</a> has the verified state-by-state position.</p>
  </div>

  <h2>Common questions</h2>

  <h3>What is the price of an electric scooter in India?</h3>
  <p>From ${inr(byPrice[0].price)} to ${inr(byPrice[byPrice.length-1].price)} ex-showroom across the ${SCOOTERS_DB.length} models we track. The mainstream band is ₹90,000 to ₹1.5 lakh, where most buyers end up.</p>

  <h3>Which is the cheapest electric scooter in India?</h3>
  <p>The <a href="/scooters/${byPrice[0].id}">${byPrice[0].brand} ${byPrice[0].name}</a> at ${inr(byPrice[0].price)} ex-showroom, with a ${byPrice[0].battery} pack and around ${byPrice[0].realRange} of real range. Bear in mind that the cheapest models are often low-speed, which changes what you can legally do with them.</p>

  <h3>What is the difference between ex-showroom and on-road price?</h3>
  <p>Ex-showroom includes GST but excludes registration, insurance and local levies. On-road adds those. For EVs the gap is smaller than for petrol because registration fees are waived nationwide and many states waive road tax too.</p>

  <h3>Are electric scooter prices coming down?</h3>
  <p>Not obviously. The central subsidy halved in April 2025, which raised effective prices by up to ₹5,000, and several state subsidies have expired. Falling cell costs have mostly gone into bigger batteries rather than lower prices.</p>

  <div class="guide-nav">
    <a href="/listings" class="guide-nav-card">
      <div class="gnc-label">← Browse</div>
      <div class="gnc-title">All ${SCOOTERS_DB.length} scooters with filters</div>
    </a>
    <a href="/emi" class="guide-nav-card" style="text-align:right">
      <div class="gnc-label">Next →</div>
      <div class="gnc-title">Work out your monthly EMI</div>
    </a>
  </div>`,
  sidebar: `
  <div class="sidebar-card" style="background:var(--ink);border-color:rgba(22,166,99,.2)">
    <h4 style="color:#fff">Price range</h4>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Cheapest</span><strong style="color:#16c964">${inr(byPrice[0].price)}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Most expensive</span><strong style="color:#fff">${inr(byPrice[byPrice.length-1].price)}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Models tracked</span><strong style="color:#fff">${SCOOTERS_DB.length}</strong></div>
  </div>
  <div class="sidebar-card">
    <h4>Filter by budget</h4>
    <a href="/listings?tag=under-1-lakh" class="toc-link">Under ₹1 lakh</a>
    <a href="/listings?tag=under-1-5l" class="toc-link">Under ₹1.5 lakh</a>
    <a href="/best?cat=best-range" class="toc-link">🔋 Best range</a>
    <a href="/best?cat=daily-commute" class="toc-link">Best for commuting</a>
  </div>
  ${SIDEBAR_SUBSIDY}`
});

/* ═══════════════════════════════════════════════════════════
   5. BATTERY CHEMISTRY — which scooter uses LFP vs NMC
   ═══════════════════════════════════════════════════════════ */
const { CHEM } = require('./battery-chemistry.js');
const withChem = byPrice.map(s => ({ s, c: CHEM[s.id] }));
const lfp = withChem.filter(r => r.c.chem === 'LFP');
const nmc = withChem.filter(r => r.c.chem === 'NMC');
const mixed = withChem.filter(r => r.c.chem === 'LFP or NMC');
const undisclosed = withChem.filter(r => r.c.chem === 'Not published');
const removable = withChem.filter(r => r.c.removable);

const chemBadge = c => c === 'LFP' ? '<strong style="color:#16a663">LFP</strong>'
  : c === 'NMC' ? '<strong style="color:#2563eb">NMC</strong>'
  : c === 'LFP or NMC' ? '<strong style="color:#f59e0b">LFP or NMC</strong>'
  : '<span style="color:var(--ink-4)">Not published</span>';

const chemRows = withChem.map(r => `      <tr>
        <td><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a></td>
        <td>${r.s.battery}</td>
        <td>${chemBadge(r.c.chem)}</td>
        <td>${r.c.removable ? 'Yes' : 'No'}</td>
        <td>${r.c.warranty}</td>
      </tr>`).join('\n');

const brandList = arr => arr.map(r => `<li><a href="/scooters/${r.s.id}">${r.s.brand} ${r.s.name}</a> — ${r.s.battery}, ${r.c.warranty}</li>`).join('');

page({
  file: 'guide-battery-chemistry.html',
  canon: '/guide-battery-chemistry',
  title: 'Which Electric Scooters Use LFP vs NMC Batteries in India? All 44 Models | EScooterwale',
  desc: 'Battery cell chemistry for every electric scooter sold in India. Which use LFP, which use NMC, which brands refuse to say, and which have removable packs. Verified 24 August 2026.',
  eyebrow: 'Battery Guide',
  crumb: 'LFP vs NMC by model',
  h1: 'Which electric scooters use LFP batteries, and which use NMC?',
  standfirst: `We checked cell chemistry for all ${SCOOTERS_DB.length} models against manufacturer spec sheets and trade press. ${lfp.length} confirmed LFP, ${nmc.length} confirmed NMC, and ${undisclosed.length} where the brand simply will not say.`,
  readTime: '6 min read',
  schema: { '@context': 'https://schema.org', '@graph': [
    ORG,
    crumbs([{ name: 'Home', url: `${BASE}/` }, { name: 'Guides', url: `${BASE}/trending` }, { name: 'LFP vs NMC by model' }]),
    article('/guide-battery-chemistry', 'Which electric scooters use LFP batteries, and which use NMC',
      `Cell chemistry, pack removability and battery warranty for ${SCOOTERS_DB.length} electric scooters sold in India.`),
    faq('/guide-battery-chemistry', [
      ['What battery type does the Bajaj Chetak use, NMC or LFP?',
       'Bajaj does not publish the cell chemistry for any Chetak variant. Its FAQs say only "advanced chemistry Lithium Ion cells sourced from reputed manufacturers". The widely repeated claim that the Chetak uses NMC traces to aggregator websites rather than to Bajaj, so we do not state it as fact.'],
      ['What battery type does the TVS iQube use, NMC or LFP?',
       'NMC. TVS Motor states that the iQube uses lithium-ion cells with NMC chemistry, across the 2.2 kWh, 3.5 kWh and 5.3 kWh variants.'],
      ['What battery type does Hero Vida use?',
       'Hero does not publish cell chemistry for the VX2 Go, VX2 Plus or V2 Pro. Vida markets pack removability rather than chemistry. All three have removable batteries.'],
      ['Does Ola use LFP or NMC?',
       'NMC across the S1 range. Ola used LG 21700 NMC cells and is moving to its own 4680 format Bharat Cell, which Ola also describes as NMC. The change is one of cell format, not chemistry.'],
      ['Which is better for Indian conditions, LFP or NMC?',
       'LFP tolerates heat better and typically lasts more charge cycles, which matters in Indian summers. NMC is more energy dense, so it delivers more range for the same weight and space. In practice a well-managed NMC pack in a scooter with good thermal management can outlast a poorly managed LFP one, so brand engineering matters as much as chemistry.']
    ])
  ]},
  body: `
  <div class="callout-box green">
    <h4>The short answer</h4>
    <p style="margin:0;font-size:15px">Of the ${SCOOTERS_DB.length} scooters we track, <strong>${nmc.length} use NMC</strong>, <strong>${lfp.length} use LFP</strong>, ${mixed.length} may be either depending on supply, and <strong>${undisclosed.length} come from brands that do not publish the chemistry at all</strong>. LFP handles Indian heat better and lasts more cycles. NMC packs more range into the same space. Ampere and BGauss are the LFP brands. Ola, Ather, TVS, Okinawa and Bounce are NMC.</p>
  </div>

  <h2>Every model, by chemistry</h2>
  <div style="overflow-x:auto">
  <table class="subsidy-table">
    <thead><tr><th>Model</th><th>Battery</th><th>Chemistry</th><th>Removable</th><th>Battery warranty</th></tr></thead>
    <tbody>
${chemRows}
    </tbody>
  </table>
  </div>

  <h2>The LFP scooters</h2>
  <p>LFP, or lithium iron phosphate, runs cooler, tolerates heat better and typically survives more charge cycles than NMC. It is also heavier and less energy dense for the same capacity, which is why it tends to appear on value-focused models rather than performance ones. Notably, the LFP brands also offer the longest battery warranties on this list.</p>
  <ul>${brandList(lfp)}</ul>
  <p>Ather began fitting LFP to the smaller Rizta pack in July 2026, its first use of the chemistry. Which one you get depends on supply and cannot be specified when ordering.</p>
  ${mixed.length ? `<ul>${brandList(mixed)}</ul>` : ''}

  <h2>The NMC scooters</h2>
  <p>NMC, or nickel manganese cobalt, is more energy dense, so it delivers more range per kilogram and per litre of pack volume. It is more sensitive to sustained heat, which places more weight on the quality of the battery management and thermal design. Every scooter with a claimed range above 200 km on this list is NMC.</p>
  <ul>${brandList(nmc)}</ul>

  <h2>The brands that will not tell you</h2>
  <p>This is the honest part of the page, and the reason it exists. <strong>${undisclosed.length} of ${SCOOTERS_DB.length} models</strong> come from manufacturers who do not publish cell chemistry anywhere in their public specifications.</p>
  <ul>${brandList(undisclosed)}</ul>
  <p>Bajaj is the most notable. Its FAQs say only "advanced chemistry Lithium Ion cells sourced from reputed manufacturers". Plenty of websites will confidently tell you the Chetak uses NMC. That claim traces back to aggregator sites copying each other, not to Bajaj, so we will not repeat it. Hero Vida and Pure EV are the same. If chemistry matters to your purchase, ask the dealer to put the answer in writing on the invoice.</p>

  <h2>Scooters with removable or swappable batteries</h2>
  <p>${removable.length} of the ${SCOOTERS_DB.length} models have a pack you can take out, whether to charge indoors in a flat with no parking-bay socket, or to swap at a station.</p>
  <ul>${brandList(removable)}</ul>

  <div class="callout-box">
    <h4>🔋 Which chemistry should you actually pick?</h4>
    <p style="margin:0 0 8px;font-size:14px">Chemistry is a weaker signal than most buying guides suggest. A well-engineered NMC pack with proper thermal management will outlast a badly managed LFP one. What we would actually weight, in order:</p>
    <ul style="margin:0 0 0 16px;font-size:14px">
      <li><strong>Warranty length</strong>. Ampere's 5 years and 75,000 km is the strongest on this list and tells you more than the chemistry label does</li>
      <li><strong>Whether you park in direct sun</strong>. If you do, LFP has a real advantage in an Indian summer</li>
      <li><strong>Whether you need to carry the battery inside</strong>. That rules out most of the range immediately</li>
      <li><strong>Chemistry itself</strong>, last</li>
    </ul>
  </div>

  <h2>Common questions</h2>

  <h3>What battery type does the Bajaj Chetak use, NMC or LFP?</h3>
  <p>Bajaj does not say, for any Chetak variant. Its own FAQs describe only "advanced chemistry Lithium Ion cells". Sites that state NMC are repeating an unsourced claim.</p>

  <h3>What battery type does the TVS iQube use?</h3>
  <p>NMC. TVS Motor states NMC cell chemistry across the 2.2 kWh, 3.5 kWh and 5.3 kWh iQube variants.</p>

  <h3>What battery type does Hero Vida use?</h3>
  <p>Not published. Hero markets the removable pack rather than the chemistry. All three Vida models on sale have removable batteries.</p>

  <h3>Does Ola use LFP or NMC?</h3>
  <p>NMC throughout. Ola used LG 21700 NMC cells and is transitioning to its in-house 4680 Bharat Cell, which is also NMC. That is a change of cell format, not chemistry.</p>

  <h3>Which lasts longer in Indian heat?</h3>
  <p>LFP, other things being equal. It degrades more slowly at high ambient temperatures and tolerates more charge cycles. Other things are rarely equal though, so read the warranty as well as the chemistry.</p>

  <div class="callout-box">
    <h4>How we verify this page</h4>
    <p style="margin:0;font-size:14px">Chemistry is taken from manufacturer specification sheets where published, and from Autocar India, Autocar Professional, EVreporter or Rushlane where the manufacturer is silent but credible technical coverage exists. Where neither is available we print "Not published" rather than inferring. Okinawa's NMC entry is a brand-level statement rather than a per-model spec line, and TVS's NMC confirmation comes from TVS Motor's own FAQ. <strong>Last verified ${VERIFIED}.</strong></p>
  </div>

  <div class="guide-nav">
    <a href="/guide-battery-types" class="guide-nav-card">
      <div class="gnc-label">← Background</div>
      <div class="gnc-title">LFP vs NMC: how the chemistries differ</div>
    </a>
    <a href="/guide-real-range" class="guide-nav-card" style="text-align:right">
      <div class="gnc-label">Next →</div>
      <div class="gnc-title">Real range test: 8 scooters measured</div>
    </a>
  </div>`,
  sidebar: `
  <div class="sidebar-card" style="background:var(--ink);border-color:rgba(22,166,99,.2)">
    <h4 style="color:#fff">🔋 Chemistry split</h4>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">NMC</span><strong style="color:#60a5fa">${nmc.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">LFP</span><strong style="color:#16c964">${lfp.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Either, supply-dependent</span><strong style="color:#f59e0b">${mixed.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Not published</span><strong style="color:rgba(255,255,255,.5)">${undisclosed.length}</strong></div>
    <div style="display:flex;justify-content:space-between;padding:8px 0">
      <span style="font-size:13px;color:rgba(255,255,255,.6)">Removable packs</span><strong style="color:#fff">${removable.length}</strong></div>
  </div>
  <div class="sidebar-card">
    <h4>Battery guides</h4>
    <a href="/guide-battery-types" class="toc-link">🔋 LFP vs NMC explained</a>
    <a href="/guide-real-range" class="toc-link">Real range test results</a>
    <a href="/guide-service-network" class="toc-link">Service network guide</a>
    <a href="/electric-scooter-price" class="toc-link">All ${SCOOTERS_DB.length} scooter prices</a>
  </div>
  <div class="sidebar-card" style="text-align:center">
    
    <h4 class="mb-8">Compare scooters</h4>
    <p style="font-size:13px;color:var(--ink-3);margin-bottom:12px">Put any two head to head on battery, range and price.</p>
    <a href="/compare"><button class="btn btn-primary btn-full">Compare now →</button></a>
  </div>`
});
