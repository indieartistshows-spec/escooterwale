/* tools/build-banners.js
   Writes the homepage carousel markup into index.html (between <!--banners--> markers)
   from data/banners.json. Images come from automation/banners.js. Runs in build-all,
   so a new banner image or link from the weekly job reaches the page automatically.
   Each slide is a link to the brand's own product page, with UTM tags. */
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('data/banners.json', 'utf8'));
const db = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const ver = f => { try { return Math.round(fs.statSync('.' + f).mtimeMs / 1000).toString(36); } catch (e) { return '1'; } };

const slides = cfg.slides.filter(s => s.img && fs.existsSync('.' + s.img.d));
const html = slides.map((s, k) => {
  // cheapest model of this family in the catalogue, for the "from" price
  const brandModels = db.filter(m => m.brandSlug === s.brandId);
  let fam = brandModels.filter(m => m.name.toLowerCase().includes(s.model.toLowerCase()));
  if (!fam.length) fam = brandModels;
  const from = fam.length ? Math.min(...fam.map(m => m.price)) : null;
  const u = new URL(s.url || s.home);
  u.searchParams.set('utm_source', 'escooterwale');
  u.searchParams.set('utm_medium', 'referral');
  u.searchParams.set('utm_campaign', 'home_banner');
  u.searchParams.set('utm_content', s.id);
  const host = u.hostname.replace(/^www\./, '');
  const m = s.img.m && fs.existsSync('.' + s.img.m) ? s.img.m : s.img.d;
  const first = k === 0;
  const src = (f, lazy) => `${lazy ? 'data-srcset' : 'srcset'}="${f}?v=${ver(f)}"`;
  return `<a class="hero-slide${first ? ' on' : ''}" href="${esc(u.toString())}" target="_blank" rel="noopener" data-out="brand" data-brand="${s.brandId}" aria-label="${esc(s.brand + ' ' + s.model)}: visit ${host}" aria-hidden="${first ? 'false' : 'true'}"${first ? '' : ' tabindex="-1"'}>` +
    `<picture><source media="(max-width:768px)" ${src(m, !first)}/>` +
    `<img ${first ? `src="${s.img.d}?v=${ver(s.img.d)}" fetchpriority="high" loading="eager"` : `src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" ${src(s.img.d, true)} loading="lazy"`} alt="${esc(s.brand + ' ' + s.model)}" width="1920" height="760"${s.desktopFocus ? ` style="object-position:${s.desktopFocus}"` : ''}/></picture>` +
    `<span class="hero-slide-cap"><b>${esc(s.brand)} ${esc(s.model)}</b>${from ? ` <span>from ${inr(from)}</span>` : ''} <span class="hsc-go">${esc(host)} ↗</span></span></a>`;
}).join('');
const dots = slides.map((s, k) => `<button class="hero-dot${k ? '' : ' on'}" type="button" aria-label="${esc(s.brand + ' ' + s.model)}"></button>`).join('');
const block = `<!--banners--><div class="hero-slides" id="heroSlides" data-interval="${cfg.intervalMs || 3000}" style="--hero-ov:${cfg.overlay ?? 0.5}" aria-roledescription="carousel" aria-label="Featured electric scooters">${html}</div><div class="hero-dots" role="group" aria-label="Choose banner">${dots}</div><!--/banners-->`;

const f = 'index.html';
const page = fs.readFileSync(f, 'utf8');
const next = page.replace(/<!--banners-->[\s\S]*?<!--\/banners-->/, block);
if (next === page && !page.includes(block)) throw new Error('banner markers missing in index.html');
fs.writeFileSync(f, next);
console.log(`homepage carousel: ${slides.length} slides, ${cfg.intervalMs || 3000} ms`);
