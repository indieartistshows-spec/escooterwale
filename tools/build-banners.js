/* tools/build-banners.js
   Writes the homepage carousel markup into index.html (between <!--banners--> markers)
   from data/banners.json. Images come from automation/banners.js. Runs in build-all,
   so a new banner image or link from the weekly job reaches the page automatically.
   Each slide is a link to the brand's own product page, with UTM tags. */
const fs = require('fs');
const sharp = require('sharp');
const cfg = JSON.parse(fs.readFileSync('data/banners.json', 'utf8'));
const db = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const ver = f => { try { return Math.round(fs.statSync('.' + f).mtimeMs / 1000).toString(36); } catch (e) { return '1'; } };

const slides = cfg.slides.filter(s => s.img && fs.existsSync('.' + s.img.d));
// WebP copies for speed: desktop at 1280 and 1920 wide, mobile at its own size.
// Rebuilt only when the JPG is newer, so the weekly job and supplied images both flow through.
const webp = (f, w) => f.replace(/\.jpg$/, w ? `-${w}.webp` : '.webp');
async function makeWebp() {
  // the launch banners on /launches get the same treatment (built later by build-launches.js)
  let lf = [];
  try { lf = JSON.parse(fs.readFileSync('data/launch-features.json', 'utf8')).slides.filter(s => s.img && fs.existsSync('.' + s.img.d)); } catch (e) {}
  for (const s of slides.concat(lf)) {
    const m = s.img.m && fs.existsSync('.' + s.img.m) ? s.img.m : null;
    const jobs = [[s.img.d, 1920], [s.img.d, 1280]].concat(m ? [[m, 0]] : []);
    for (const [src, w] of jobs) {
      const out = '.' + webp(src, w);
      if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync('.' + src).mtimeMs) continue;
      let img = sharp('.' + src);
      if (w) img = img.resize({ width: w, withoutEnlargement: true });
      await img.webp({ quality: w === 1280 ? 72 : 76, effort: 5 }).toFile(out);
    }
  }
}

const build = () => slides.map((s, k) => {
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
  const at = (f, lazy) => `${lazy ? 'data-srcset' : 'srcset'}="${f}"`;
  const v = f => `${f}?v=${ver(f)}`;
  const mW = m === s.img.d ? webp(m, 1280) : webp(m);
  const dSet = `${v(webp(s.img.d, 1280))} 1280w, ${v(webp(s.img.d, 1920))} 1920w`;
  return `<a class="hero-slide${first ? ' on' : ''}" href="${esc(u.toString())}" target="_blank" rel="noopener" data-out="brand" data-brand="${s.brandId}" aria-hidden="${first ? 'false' : 'true'}"${first ? '' : ' tabindex="-1"'}>` +
    `<picture><source media="(max-width:768px)" type="image/webp" ${at(v(mW), !first)}/><source media="(max-width:768px)" ${at(v(m), !first)}/>` +
    `<source type="image/webp" ${at(dSet, !first)} sizes="100vw"/>` +
    `<img ${first ? `src="${s.img.d}?v=${ver(s.img.d)}" fetchpriority="high" loading="eager"` : `src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" ${at(v(s.img.d), true)} loading="lazy"`} alt="${esc(s.brand + ' ' + s.model)}" width="1920" height="760"${s.desktopFocus ? ` style="object-position:${s.desktopFocus}"` : ''}/></picture>` +
    `<span class="hero-slide-cap"><b>${esc(s.brand)} ${esc(s.model)}</b>${from ? ` <span>from ${inr(from)}</span>` : ''} <span class="hsc-go">${esc(host)} ↗</span></span></a>`;
}).join('');
const dots = slides.map((s, k) => `<button class="hero-dot${k ? '' : ' on'}" type="button" aria-label="${esc(s.brand + ' ' + s.model)}"></button>`).join('');
(async () => {
await makeWebp();
const html = build();
const s0 = slides[0], m0 = s0.img.m && fs.existsSync('.' + s0.img.m) ? s0.img.m : s0.img.d;
// the first banner is the largest thing on the page: start fetching it before the CSS is parsed
const pre = `<!--hero-preload--><link rel="preload" as="image" type="image/webp" href="${m0 === s0.img.d ? webp(m0, 1280) : webp(m0)}?v=${ver(m0 === s0.img.d ? webp(m0, 1280) : webp(m0))}" media="(max-width:768px)" fetchpriority="high"><link rel="preload" as="image" type="image/webp" imagesrcset="${webp(s0.img.d, 1280)}?v=${ver(webp(s0.img.d, 1280))} 1280w, ${webp(s0.img.d, 1920)}?v=${ver(webp(s0.img.d, 1920))} 1920w" imagesizes="100vw" media="(min-width:769px)" fetchpriority="high"><!--/hero-preload-->`;
const block = `<!--banners--><div class="hero-slides" id="heroSlides" data-interval="${cfg.intervalMs || 3000}" style="--hero-ov:${cfg.overlay ?? 0.5};--hero-ov-m:${cfg.overlayMobile ?? 0.65}" aria-roledescription="carousel" aria-label="Featured electric scooters">${html}</div><div class="hero-dots" role="group" aria-label="Choose banner">${dots}</div><!--/banners-->`;

const f = 'index.html';
const page = fs.readFileSync(f, 'utf8');
let next = page.replace(/<!--banners-->[\s\S]*?<!--\/banners-->/, block);
next = next.includes('<!--hero-preload-->') ? next.replace(/<!--hero-preload-->[\s\S]*?<!--\/hero-preload-->/, pre)
  : next.replace(/<link rel="preload" as="image" href="\/images\/hero-scooter\.webp"[^>]*>/, pre);
if (!next.includes('<!--hero-preload-->')) next = next.replace('<link rel="canonical"', pre + '\n<link rel="canonical"');
if (next === page && !page.includes(block)) throw new Error('banner markers missing in index.html');
fs.writeFileSync(f, next);
console.log(`homepage carousel: ${slides.length} slides, ${cfg.intervalMs || 3000} ms`);
})();
