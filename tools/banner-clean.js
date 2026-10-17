/* tools/banner-clean.js
   Removes the brand's own text from banners. For any slide with a "keep" region
   (fractions of the desktop banner that hold only the scooter or rider), it builds:
     desktop 1920x760: the clean region at full height on the right, with a blurred,
                       darkened extension of the same picture on the left where our text sits
     mobile   780x1040: a portrait crop taken only from the clean region
   The untouched brand download is kept as <id>-raw.jpg so the crop can be redone.
   Usage: node tools/banner-clean.js [data/banners.json] [data/launch-features.json] */
const fs = require('fs');
const sharp = require('sharp');

async function clean(s) {
  const d = '.' + s.img.d, m = '.' + s.img.m, raw = d.replace(/-d\.jpg$/, '-raw.jpg');
  if (!fs.existsSync(raw)) fs.copyFileSync(d, raw);
  const meta = await sharp(raw).metadata();
  const k = s.keep, W = meta.width, H = meta.height;
  const box = { left: Math.round(k.x0 * W), top: Math.round((k.y0 || 0) * H), width: Math.round((k.x1 - k.x0) * W), height: Math.round(((k.y1 || 1) - (k.y0 || 0)) * H) };
  const region = await sharp(raw).extract(box).toBuffer();

  // desktop: blurred backdrop + clean region scaled to full height, right aligned
  const fgW = Math.min(1920, Math.round(box.width * 760 / box.height));
  const fg = await sharp(region).resize(fgW, 760).toBuffer();
  const bg = await sharp(region).resize(1920, 760, { fit: 'cover' }).blur(38).modulate({ brightness: 0.55 }).toBuffer();
  // soft left edge on the clean region so it melts into the backdrop
  const mask = Buffer.from(`<svg width="${fgW}" height="760"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.22" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="${fgW}" height="760" fill="url(#g)"/></svg>`);
  const fgMasked = await sharp(fg).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  await sharp(bg).composite([{ input: fgMasked, left: 1920 - fgW, top: 0 }]).jpeg({ quality: 82 }).toFile(d + '.tmp');
  fs.renameSync(d + '.tmp', d);

  // mobile: portrait crop from the clean region only
  await sharp(region).resize(780, 1040, { fit: 'cover', position: s.keepMobile || 'centre' }).jpeg({ quality: 80 }).toFile(m + '.tmp');
  fs.renameSync(m + '.tmp', m);
  return `${s.id}: brand text removed (kept ${Math.round(k.x0 * 100)}-${Math.round(k.x1 * 100)}% of the banner)`;
}

(async () => {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : ['data/banners.json', 'data/launch-features.json'];
  for (const f of files) {
    const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const s of cfg.slides) if (s.keep && s.img && fs.existsSync('.' + s.img.d)) console.log(await clean(s));
  }
})();
