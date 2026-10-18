/* ============================================================
   components.js — Shared UI Helpers v6
   EScooterwale · CarWale-inspired · Mobile-first
   ============================================================ */

// ── RENDER HELPERS ─────────────────────────────────────────
function renderStars(r){
  const f=Math.floor(r),h=r%1>=.5?1:0,e=5-f-h;
  return '<span class="stars">'+'★'.repeat(f)+(h?'<span style="opacity:.5">★</span>':'')+'☆'.repeat(e)+'</span>'
}
function fmtViews(n){
  if(n>=100000) return (n/100000).toFixed(1)+'L';
  if(n>=1000)   return (n/1000).toFixed(0)+'K';
  return n.toString()
}
function fmtNum(n){ return n.toLocaleString('en-IN') }

// ── SCOOT-SCORE BADGE ─────────────────────────────────────
function scootScoreBadge(score, size='sm'){
  const s = parseFloat(score)||0;
  const pct = (s/10)*100;
  const color = s>=8.5?'#16c964':s>=7.5?'#22c55e':s>=6.5?'#f59e0b':'#ef4444';
  const label = s>=8.5?'Excellent':s>=7.5?'Great':s>=6.5?'Good':'Fair';
  if(size==='lg'){
    const r=44, circ=2*Math.PI*r, dash=circ*(pct/100);
    return `<div class="scoot-score-lg">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
        <circle cx="55" cy="55" r="${r}" fill="none" stroke="${color}" stroke-width="8"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-linecap="round"
          transform="rotate(-90 55 55)"
          style="transition:stroke-dasharray 1s ease"/>
        <text x="55" y="50" text-anchor="middle" fill="#fff" font-size="26" font-weight="900" font-family="'proxima-nova','Nunito Sans',sans-serif">${s.toFixed(1)}</text>
        <text x="55" y="65" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="10" font-weight="600" font-family="'proxima-nova','Nunito Sans',sans-serif">/10</text>
      </svg>
      <div class="ss-label" style="color:${color}">${label}</div>
      <div class="ss-sub">ScootScore</div>
    </div>`;
  }
  // Small badge for cards
  return `<div class="scoot-score-badge" style="--score-color:${color}" title="ScootScore: ${s}/10 — ${label}">
    <span class="ss-num">${s.toFixed(1)}</span>
    <span class="ss-denom">/10</span>
  </div>`;
}

// ── SCOOTER SVG FALLBACK ────────────────────────────────────
function scooterSVG(color='#16a663', w=180, h=110){
  return `<svg width="${w}" height="${h}" viewBox="0 0 180 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="38" cy="88" rx="20" ry="20" stroke="${color}" stroke-width="4" fill="${color}" fill-opacity=".1"/>
    <ellipse cx="38" cy="88" rx="9" ry="9" fill="${color}" opacity=".4"/>
    <ellipse cx="142" cy="88" rx="20" ry="20" stroke="${color}" stroke-width="4" fill="${color}" fill-opacity=".1"/>
    <ellipse cx="142" cy="88" rx="9" ry="9" fill="${color}" opacity=".4"/>
    <path d="M38 68 L60 32 L118 32 L140 68" stroke="${color}" stroke-width="4.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <rect x="65" y="16" width="42" height="20" rx="6" fill="${color}" opacity=".18"/>
    <rect x="65" y="16" width="42" height="20" rx="6" stroke="${color}" stroke-width="2"/>
    <path d="M86 22 L90 16 L94 22 L90 28Z" fill="${color}"/>
    <line x1="38" y1="68" x2="142" y2="68" stroke="${color}" stroke-width="3" opacity=".3"/>
    <line x1="86" y1="32" x2="86" y2="16" stroke="${color}" stroke-width="2"/>
  </svg>`;
}

// ── BRAND LOGO — local PNGs, SVG fallback for missing ───────
const BRAND_LOGO_DATA = {
  'ola-electric':{accent:'#16a663',short:'OLA',bg:'dark',circle:'#111111',src48:'/images/logos/ola-electric-48.webp',src96:'/images/logos/ola-electric-96.webp'},
  'ather-energy':{accent:'#2563eb',short:'ATH',bg:'dark',circle:'#111111',src48:'/images/logos/ather-energy-48.webp',src96:'/images/logos/ather-energy-96.webp'},
  'tvs-motor':{accent:'#f59e0b',short:'TVS',bg:'dark',circle:'#111111',src48:'/images/logos/tvs-motor-48.webp',src96:'/images/logos/tvs-motor-96.webp'},
  'bajaj-chetak':{accent:'#7c3aed',short:'BAJ',bg:'light',circle:'#ffffff',src48:'/images/logos/bajaj-chetak-48.webp',src96:'/images/logos/bajaj-chetak-96.webp'},
  'hero-vida':{accent:'#dc2626',short:'VDA',bg:'light',circle:'#ffffff',src48:'/images/logos/hero-vida-48.webp',src96:'/images/logos/hero-vida-96.webp'},
  'ampere':{accent:'#f97316',short:'AMP',bg:'light',circle:'#ffffff',src48:'/images/logos/ampere-48.webp',src96:'/images/logos/ampere-96.webp'},
  'bgauss':{accent:'#1e40af',short:'BGS',bg:'light',circle:'#ffffff',src48:'/images/logos/bgauss-48.webp',src96:'/images/logos/bgauss-96.webp'},
  'bounce-infinity':{accent:'#f59e0b',short:'BNC',bg:'light',circle:'#ffffff',src48:'/images/logos/bounce-infinity-48.webp',src96:'/images/logos/bounce-infinity-96.webp'},
  'pure-ev':{accent:'#10b981',short:'PRE',bg:'dark',circle:'#111111',src48:'/images/logos/pure-ev-48.webp',src96:'/images/logos/pure-ev-96.webp'},
  'okinawa':{accent:'#0ea5e9',short:'OKI',bg:'light',circle:'#ffffff',src48:'/images/logos/okinawa-48.webp',src96:'/images/logos/okinawa-96.webp'},
  'simple-energy':{accent:'#a78bfa',short:'SIM',bg:'dark',circle:'#4c1d95',src48:null,src96:null},
  'okaya-ev':      {accent:'#38bdf8',short:'OKY',bg:'dark',circle:'#0c4a6e',src48:null,src96:null},
};

function brandLogoHTML(slug, sz=28){
  const d = BRAND_LOGO_DATA[slug];
  if(!d){
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${sz}px;height:${sz}px;border-radius:50%;background:#e5e7eb;color:#374151;font-size:${Math.round(sz*.33)}px;font-weight:800;flex-shrink:0">EV</span>`;
  }
  const br  = sz >= 40 ? '50%' : '10px';
  const src = sz >= 72 ? d.src96 : d.src48;
  // Shadow: light circles get dark shadow to show on dark bg; dark circles get subtle glow
  const shadow = d.bg==='light'
    ? '0 0 0 1.5px rgba(0,0,0,.12), 0 1px 5px rgba(0,0,0,.18)'
    : '0 0 0 1.5px rgba(255,255,255,.10), 0 1px 5px rgba(0,0,0,.35)';

  if(src){
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${sz}px;height:${sz}px;border-radius:${br};overflow:hidden;flex-shrink:0;background:${d.circle};box-shadow:${shadow}">
      <img src="${src}" width="${sz}" height="${sz}" alt="${d.short}" loading="lazy" decoding="async" style="width:${sz}px;height:${sz}px;object-fit:contain;display:block"/>
    </span>`;
  }
  // Text fallback
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${sz}px;height:${sz}px;border-radius:${br};background:${d.circle};box-shadow:${shadow};color:${d.accent};font-size:${Math.round(sz*.33)}px;font-weight:900;letter-spacing:-.02em;flex-shrink:0">${d.short}</span>`;
}

// ── SCOOTER CARD HTML (CarWale-style, ScootScore prominent) ──
function scooterCardHTML(s, opts={}){
  const {showCompare=true, extraClass=''} = opts;
  const score = s.score||0;
  const scoreColor = score>=8.5?'#16c964':score>=7.5?'#22c55e':score>=6.5?'#f59e0b':'#ef4444';
  const badgeMap = {'popular':'🔥 Popular','top-rated':'⭐ Top Rated','new':'✨ New','trending':'📈 Trending','editor-pick':'🏆 Editor Pick'};
  const badgeLabel = s.badge ? (badgeMap[s.badge]||s.badge) : null;

  return `
  <div class="scooter-card ${extraClass}" data-id="${s.id}" onclick="window.location='/scooters/${s.id}'" role="button" tabindex="0" style="cursor:pointer">
    <div class="sc-img-wrap">
      <img src="${s.cardImg}"
           alt="${s.brand} ${s.name} electric scooter price India 2026"
           loading="lazy"
           onerror="this.onerror=null;this.style.display='none';var fb=this.parentElement.querySelector('.sc-img-fb');if(fb){fb.style.display='flex';}"
           class="sc-photo"/>
      <div class="sc-img-fb" style="display:none;background:linear-gradient(135deg,${s.accentColor}22,${s.accentColor}08)">
        ${scooterSVG(s.accentColor, 140, 86)}
      </div>
      ${badgeLabel ? `<div class="sc-badge-pill">${badgeLabel}</div>` : ''}
      <div class="sc-score-corner" style="--sc:${scoreColor}">
        <div class="sc-score-num">${score.toFixed(1)}</div>
        <div class="sc-score-label">Score</div>
      </div>
    </div>
    <div class="sc-body">
      <div class="sc-brand-row">
        ${brandLogoHTML(s.brandSlug, 28)}
        <span class="sc-brand-name">${s.brand}</span>
        <span class="sc-variant-pill">${s.battery||''}</span>
      </div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-tagline">${s.tagline||''}</div>
      <div class="sc-price-row">
        <span class="sc-price">${s.priceDisplay}</span>
        <span class="sc-emi">EMI from ₹${fmtNum(s.emiFrom||Math.round((s.price||0)*.028))}/mo</span>
      </div>
      <div class="sc-specs-grid">
        <div class="sc-spec-item">
          <div class="sc-spec-val">${s.realRange||s.range||'—'}</div>
          <div class="sc-spec-key">Real Range</div>
        </div>
        <div class="sc-spec-item">
          <div class="sc-spec-val">${s.speed||'—'}</div>
          <div class="sc-spec-key">Top Speed</div>
        </div>
        <div class="sc-spec-item">
          <div class="sc-spec-val">${s.charging||'—'}</div>
          <div class="sc-spec-key">Charge</div>
        </div>
        <div class="sc-spec-item">
          <div class="sc-spec-val">${s.bootSpace||'—'}</div>
          <div class="sc-spec-key">Boot</div>
        </div>
      </div>
      <div class="sc-verdict-preview">${(s.verdict||'').substring(0,90)}${(s.verdict||'').length>90?'…':''}</div>
      <div class="sc-actions" onclick="event.stopPropagation()">
        <a href="/scooters/${s.id}"><button class="btn btn-outline sc-btn">Full review</button></a>
        <a href="${s.brandUrl}" target="_blank" rel="noopener noreferrer">
          <button class="btn btn-primary sc-btn" style="display:flex;align-items:center;justify-content:center;gap:6px">
            ${brandLogoHTML(s.brandSlug,18)}
            <span>Buy ↗</span>
          </button>
        </a>
      </div>
    </div>
  </div>`;
}

// ── COMPARE TRAY ────────────────────────────────────────────
let compareList = JSON.parse(localStorage.getItem('sw_compare')||'[]');

function saveCompare(){ try{localStorage.setItem('sw_compare',JSON.stringify(compareList))}catch(e){} }

function addToCompare(id, e){
  if(e) e.stopPropagation();
  if(compareList.includes(id)){ compareList=compareList.filter(x=>x!==id); }
  else if(compareList.length>=2){ alert('Max 2 scooters. Remove one first.'); return; }
  else{ compareList.push(id); }
  saveCompare(); updateCompareTray();
}

function removeFromCompare(id){ compareList=compareList.filter(x=>x!==id); saveCompare(); updateCompareTray(); }

function updateCompareTray(){
  const tray=document.getElementById('compareTrayMount');
  if(!tray) return;
  if(!compareList.length){ tray.innerHTML=''; return; }
  const a=compareList[0]||null, b=compareList[1]||null;
  if(typeof SCOOTERS_DB==='undefined') return;
  const sa=a?SCOOTERS_DB.find(x=>x.id===a):null;
  const sb=b?SCOOTERS_DB.find(x=>x.id===b):null;
  tray.innerHTML=`<div class="compare-tray">
    <div class="ct-slots">
      <div class="ct-slot ${sa?'filled':''}">
        ${sa?`<img src="${sa.cardImg}" alt="${sa.name}" onerror="this.style.display='none'"/>
              <span>${sa.brand} ${sa.name}</span>
              <button onclick="removeFromCompare('${sa.id}')" aria-label="Remove">✕</button>`
           :'<span style="color:var(--ink-4)">+ Add scooter</span>'}
      </div>
      <div class="ct-vs">VS</div>
      <div class="ct-slot ${sb?'filled':''}">
        ${sb?`<img src="${sb.cardImg}" alt="${sb.name}" onerror="this.style.display='none'"/>
              <span>${sb.brand} ${sb.name}</span>
              <button onclick="removeFromCompare('${sb.id}')" aria-label="Remove">✕</button>`
           :'<span style="color:var(--ink-4)">+ Add scooter</span>'}
      </div>
    </div>
    ${compareList.length===2?`<a href="/compare?a=${compareList[0]}&b=${compareList[1]}"><button class="btn btn-primary ct-go">Compare →</button></a>`:''}
    <button class="ct-clear" onclick="compareList=[];saveCompare();updateCompareTray()" aria-label="Clear all">✕</button>
  </div>`;
}

function compareTrayHTML(){ return '<div id="compareTrayInner"></div>'; }

// ── NAV HTML ─────────────────────────────────────────────────
/* Language switcher: English base + 8 Indian languages. Goes to the same page in
   the chosen language. No automatic redirect by browser language. */
const SW_LANGS=[['en','English'],['hi','हिन्दी'],['mr','मराठी'],['ta','தமிழ்'],['te','తెలుగు'],['kn','ಕನ್ನಡ'],['gu','ગુજરાતી'],['bn','বাংলা'],['or','ଓଡ଼ିଆ']];
function langSelectHTML(){
  const cur=window.__SW_LANG__||'en';
  // only languages that are fully translated are offered (SW_CONFIG.langsLive, set at build)
  let live=[];try{live=(typeof SW_CONFIG!=='undefined'&&SW_CONFIG.langsLive)||[]}catch(e){}
  if(cur!=='en'&&!live.includes(cur))live=live.concat(cur);
  if(!live.length)return '';
  const opts=SW_LANGS.filter(([c])=>c==='en'||live.includes(c));
  return `<label class="lang-sel-wrap" translate="no"><span class="lang-sel-icon" aria-hidden="true">🌐</span><select class="lang-sel" aria-label="Language" onchange="swLang(this.value)">${opts.map(([c,n])=>`<option value="${c}"${c===cur?' selected':''}>${n}</option>`).join('')}</select></label>`;
}
function swLang(l){
  const path=location.pathname.replace(/^\/(hi|mr|ta|te|kn|gu|bn|or)(?=\/|$)/,'')||'/';
  try{localStorage.setItem('sw_lang',l)}catch(e){}
  location.href=(l==='en'?path:'/'+l+(path==='/'?'':path))+location.hash;
}
function navHTML(active='home'){
  const links=[
    {id:'home',label:'Home',href:'/'},
    {id:'listings',label:'All Scooters',href:'/listings'},
    {id:'compare',label:'Compare',href:'/compare'},
    {id:'best',label:'Best For',href:'/best'},
    {id:'trending',label:'🔥 Trending',href:'/trending'},
    {id:'launches',label:'🆕 Launches',href:'/launches'},
    {id:'emi',label:'EMI Calc',href:'/emi'},
  ];
  return `<nav class="nav" role="navigation" aria-label="Main navigation">
    <div class="container nav-inner">
      <a href="/" class="nav-logo" aria-label="EScooterwale home">
        <img src="/images/escooterwale_logo-72.webp" alt="EScooterwale logo" class="nav-logo-img" width="36" height="36" />
        <span class="nav-logo-text"><strong>EScooter</strong><em>wale</em></span>
      </a>
      <div class="nav-links" role="list">
        ${links.map(l=>`<a href="${l.href}" class="nav-link${l.id===active?' active':''}" role="listitem">${l.label}</a>`).join('')}
      </div>
      ${langSelectHTML()}
      <button class="hamburger" id="navToggle" onclick="toggleMenu()" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="mobile-menu" id="mobileMenu" role="navigation" aria-label="Mobile navigation">
      ${links.map(l=>`<a href="${l.href}" class="mob-link${l.id===active?' active':''}">${l.label}</a>`).join('')}
    </div>
  </nav>
  <nav class="mob-tab-bar" aria-label="Mobile tab navigation">
    <a href="/" class="mob-tab${active==='home'?' mob-tab--active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
      <span>Home</span>
    </a>
    <a href="/listings" class="mob-tab${active==='listings'?' mob-tab--active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="7" cy="17" rx="2.5" ry="2.5"/><ellipse cx="17" cy="17" rx="2.5" ry="2.5"/><path d="M4.5 17H3V9l3-5h9l2 3h1.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H19.5"/><path d="M9.5 17h5"/><path d="M6 9h12"/></svg>
      <span>Scooters</span>
    </a>
    <a href="/compare" class="mob-tab${active==='compare'?' mob-tab--active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
      <span>Compare</span>
    </a>
    <a href="/trending" class="mob-tab${active==='trending'?' mob-tab--active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      <span>Trending</span>
    </a>
    <a href="/emi" class="mob-tab${active==='emi'?' mob-tab--active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M7 8h.01M7 12h.01M7 16h.01"/></svg>
      <span>EMI</span>
    </a>
  </nav>`;
}

function toggleMenu(){
  const m=document.getElementById('mobileMenu');
  const b=document.getElementById('navToggle');
  if(!m||!b) return;
  const open=m.classList.toggle('open');
  b.setAttribute('aria-expanded', open);
}

// ── SEO LINK DIRECTORY (below the footer) ────────────────────
// Every model, grouped by brand: buy from the brand, on BikeDekho, on BikeWale,
// compare on EVIndia and on EScooterwale. Links come from data/aggregator-links.json,
// which the weekly job checks; a model without a checked page uses the site's brand page.
function seoLinksHTML(){
  if(typeof SCOOTERS_DB==='undefined')return '';
  const L=(typeof AGG_LINKS!=='undefined'&&AGG_LINKS.families)||{};
  const brands=(typeof BRANDS_DB!=='undefined'?BRANDS_DB:[]);
  const fam=new Map();
  SCOOTERS_DB.forEach(s=>{const base=s.name.replace(/\s*[\d.]+\s*kWh$/i,'').trim(),k=s.brandSlug+'|'+base;if(!fam.has(k))fam.set(k,{k,brand:s.brandSlug,base,first:s});});
  const utm=(u,c)=>{try{const x=new URL(u);x.searchParams.set('utm_source','escooterwale');x.searchParams.set('utm_medium','referral');x.searchParams.set('utm_campaign','footer_directory');x.searchParams.set('utm_content',c);return x.toString()}catch(e){return u}};
  const ext=(u,t,type,brand)=>`<a href="${u}" target="_blank" rel="noopener" data-out="${type}"${brand?` data-brand="${brand}"`:''}>${t}</a>`;
  const groups={};fam.forEach(f=>{(groups[f.brand]=groups[f.brand]||[]).push(f)});
  const body=Object.entries(groups).map(([bid,list])=>{
    const b=brands.find(x=>x.id===bid)||{},bname=b.shortName||b.name||list[0].first.brand;
    const rows=list.map(f=>{
      const s=f.first,l=L[f.k]||{},last=bname.split(' ').pop(),nm=f.base.toLowerCase().startsWith(last.toLowerCase())?`${bname.split(' ').slice(0,-1).join(' ')} ${f.base}`.trim():`${bname} ${f.base}`;
      const bw=(l.bikewale&&l.bikewale.url)||'https://www.bikewale.com/electric-bikes/';
      const bd=(l.bikedekho&&l.bikedekho.url)||'https://www.bikedekho.com/electric-bikes';
      const ev=(l.evindia&&l.evindia.url)||'https://evindia.online/';
      return `<li><a class="sl-model" translate="no" href="/scooters/${s.id}">${nm}</a>: `+
        (s.brandUrl?ext(utm(s.brandUrl,s.id),'Buy from '+bname,'brand',bid)+' · ':'')+
        ext(bd,'Buy on BikeDekho','aggregator')+' · '+ext(bw,'Buy on BikeWale','aggregator')+' · '+
        ext(ev,'Compare on EVIndia','aggregator')+' · '+`<a href="/compare?a=${s.id}">Compare on EScooterwale</a></li>`;
    }).join('');
    return `<div class="sl-brand"><h4><a href="/brands/${bid}">${bname} electric scooters</a></h4><ul>${rows}</ul></div>`;
  }).join('');
  return `<section class="seo-links" aria-label="Where to buy and compare every electric scooter"><div class="container"><h3>Buy and compare every electric scooter in India</h3><div class="sl-grid">${body}</div></div></section>`;
}

// ── FOOTER HTML ──────────────────────────────────────────────
function footerHTML(){
  return `<footer class="footer">
    <div class="container">
      <div class="footer-grid">

        <!-- Brand column -->
        <div class="footer-brand">
          <div class="footer-logo">
            <img src="/images/escooterwale_logo-72.webp" alt="EScooterwale" class="footer-logo-img" loading="lazy" width="32" height="32" />
            <span><strong>EScooter</strong><em>wale</em></span>
          </div>
          <p style="font-size:13px;line-height:1.7;color:rgba(255,255,255,.45);max-width:240px;margin:10px 0 12px">India's most honest EV scooter platform. Real-world range tests, zero brand bias, independent editorial.</p>
          <div class="footer-tagline">₹0 commission · 100% independent</div>
        </div>

        <!-- Explore -->
        <div class="footer-col">
          <h3>Explore</h3>
          <a href="/listings">All Scooters</a>
          <a href="/compare">Compare Models</a>
          <a href="/best">Best For You</a>
          <a href="/trending">Trending Now</a>
          <a href="/city">By City</a>
        </div>

        <!-- Tools & Guides -->
        <div class="footer-col">
          <h3>Tools & Guides</h3>
          <a href="/emi">EMI Calculator</a>
          <a href="/guide-real-range">Real Range Guide</a>
          <a href="/guide-battery-types">Battery Types</a>
          <a href="/guide-subsidy">Subsidy Guide</a>
          <a href="/guide-service-network">Service Network</a>
        </div>

        <!-- Top Brands -->
        <div class="footer-col">
          <h3>Top Brands</h3>
          <a href="/brands/ola-electric">Ola Electric</a>
          <a href="/brands/ather-energy">Ather Energy</a>
          <a href="/brands/tvs-motor">TVS iQube</a>
          <a href="/brands/bajaj-chetak">Bajaj Chetak</a>
          <a href="/brands/hero-vida">Hero Vida</a>
          <a href="/brands/ampere">Ampere</a>
        </div>

        <!-- Community -->
        <div class="footer-col">
          <h3>Community</h3>
          <a href="/yellow-brother" class="footer-yb-link">🟡 Yellow Brother</a>
          <a href="/trending">Brand Socials</a>
          <a href="/trending">YouTube Reviews</a>
          <a href="/trending">Read Before You Buy</a>
        </div>

      </div>

      <div class="footer-bottom">
        <span>© 2026 EScooterwale. Prices are ex-showroom<span data-sw="priceCityIn"></span>. Data updated <span data-sw="updated">October 2026</span>.</span>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <span>Not affiliated with any EV manufacturer.</span>
          <a href="/terms" style="color:rgba(255,255,255,.6);font-size:12px">Terms</a>
          <a href="/privacy" style="color:rgba(255,255,255,.6);font-size:12px">Privacy</a>
          <a href="/yellow-brother" style="color:var(--amber);font-weight:700;font-size:12px;text-decoration:none">🟡 Yellow Brother Blog</a>
        </div>
      </div>
    </div>
  </footer>`+seoLinksHTML();
}

// ── LAZY IMAGE OBSERVER ──────────────────────────────────────
function initLazyImages(){
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver((entries)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){
          const img=en.target;
          if(img.dataset.src){ img.src=img.dataset.src; }
          img.classList.add('loaded');
          obs.unobserve(img);
        }
      });
    },{rootMargin:'200px'});
    document.querySelectorAll('img.lazy').forEach(i=>obs.observe(i));
  } else {
    document.querySelectorAll('img.lazy').forEach(i=>i.classList.add('loaded'));
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  initLazyImages();
  updateCompareTray();
  document.querySelectorAll('img').forEach(img=>{
    img.addEventListener('error',function(){
      if(!this.dataset.errored){
        this.dataset.errored='1';
        this.style.display='none';
        const fb=this.parentElement.querySelector('.sc-img-fb');
        if(fb) fb.style.display='flex';
      }
    });
  });
});
