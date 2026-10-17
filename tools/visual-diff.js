/* tools/visual-diff.js — compare two screenshot folders.
   Usage: node tools/visual-diff.js <beforeDir> <afterDir> [threshold=0.002]
   Prints per-page changed-pixel ratio and height change; exit code 1 if any page exceeds threshold. */
const fs = require('fs'), path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const [a, b, th = '0.002'] = process.argv.slice(2);
const limit = parseFloat(th);
let worst = 0; const rows = [];
for (const f of fs.readdirSync(a).filter(f => f.endsWith('.png'))) {
  const pb = path.join(b, f);
  if (!fs.existsSync(pb)) { rows.push({ f, note: 'missing in after' }); worst = 1; continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(pb));
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = (img) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(A).data, crop(B).data, diff.data, w, h, { threshold: 0.1 });
  const ratio = n / (w * h);
  const dh = B.height - A.height;
  if (ratio > 0 || dh) { fs.mkdirSync(path.join(b, '_diff'), { recursive: true }); fs.writeFileSync(path.join(b, '_diff', f), PNG.sync.write(diff)); }
  rows.push({ f, ratio, dh });
  worst = Math.max(worst, ratio + (dh ? 1 : 0) * 0);
}
for (const r of rows) console.log(r.note ? `${r.f}: ${r.note}` : `${r.f}: ${(r.ratio * 100).toFixed(3)}% px changed${r.dh ? `, height ${r.dh > 0 ? '+' : ''}${r.dh}px` : ''}`);
process.exit(rows.some(r => r.note || r.ratio > limit) ? 1 : 0);
