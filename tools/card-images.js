/* tools/card-images.js | square thumbnails with the scooter in focus, for every model.
   Source: the model's photo (heroImg). Output: images/cards/<id>.webp, 800x800.
   - Product shot on a plain background: the background is trimmed away, the scooter is
     centred on a square of the same background colour with a little breathing room.
   - Photo with a scene behind it: cropped to a square around the most important area
     (the scooter), or around a focus point set in data/card-focus.json { "<id>": { "x": 0.6, "y": 0.5, "zoom": 1.2 } }.
   Rebuilt only when the source photo or the focus setting changes. build-data.js points
   cardImg at these files. Run: node tools/card-images.js [--force] */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
let FOCUS = {}; try { FOCUS = JSON.parse(fs.readFileSync('data/card-focus.json', 'utf8')); delete FOCUS._note; } catch (e) {}
const OUT = 'images/cards', SIZE = 800, FORCE = process.argv.includes('--force');
fs.mkdirSync(OUT, { recursive: true });
const stampFile = path.join(OUT, '.stamps.json');
let stamps = {}; try { stamps = JSON.parse(fs.readFileSync(stampFile, 'utf8')); } catch (e) {}

async function borderStats(img, w, h) {
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const strips = [[0, 0, w, t], [0, h - t, w, t], [0, 0, t, h], [w - t, 0, t, h]];
  const st = await Promise.all(strips.map(async ([left, top, width, height]) => sharp(await img.clone().extract({ left, top, width, height }).png().toBuffer()).stats()));
  const mean = [0, 1, 2].map(c => st.reduce((a, s) => a + s.channels[c].mean, 0) / 4);
  const dev = Math.max(...st.map(s => Math.max(s.channels[0].stdev, s.channels[1].stdev, s.channels[2].stdev)));
  const spread = Math.max(...[0, 1, 2].map(c => Math.max(...st.map(s => s.channels[c].mean)) - Math.min(...st.map(s => s.channels[c].mean))));
  return { mean, plain: dev < 14 && spread < 18 };
}

async function make(s) {
  const src = '.' + (s.heroImg || s.cardImg);
  if (!fs.existsSync(src)) return `${s.id}: no source photo`;
  const f = FOCUS[s.id] || null;
  const stamp = crypto.createHash('md5').update(fs.readFileSync(src)).update(JSON.stringify(f)).digest('hex').slice(0, 10);
  const out = path.join(OUT, s.id + '.webp');
  if (!FORCE && stamps[s.id] === stamp && fs.existsSync(out)) return null;
  const base = sharp(src).flatten({ background: '#ffffff' });
  const { width: w, height: h } = await base.metadata();
  const bs = await borderStats(base, w, h);
  let how;
  if (bs.plain && !(f && (f.mode === 'crop' || f.x != null))) {
    const bg = { r: Math.round(bs.mean[0]), g: Math.round(bs.mean[1]), b: Math.round(bs.mean[2]) };
    // outline of the scooter: rows and columns where enough pixels differ from the background
    // (stray specks and faint lines in the backdrop are ignored)
    const { data, info } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels, rowN = new Uint32Array(H), colN = new Uint32Array(W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (Math.abs(data[i] - bg.r) + Math.abs(data[i + 1] - bg.g) + Math.abs(data[i + 2] - bg.b) > 60) { rowN[y]++; colN[x]++; }
    }
    const edge = (arr, min) => { let a = 0, b = arr.length - 1; while (a < b && arr[a] < min) a++; while (b > a && arr[b] < min) b--; return [a, b]; };
    const [y0, y1] = edge(rowN, Math.max(3, W * 0.01)), [x0, x1] = edge(colN, Math.max(3, H * 0.01));
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const trimmed = { data: await base.clone().extract({ left: x0, top: y0, width: tw, height: th }).png().toBuffer() };
    const side = Math.round(Math.max(tw, th) * (f && f.pad ? f.pad : 1.08));
    // sharp resizes before it composites, so compose first, then resize
    const sq = await sharp({ create: { width: side, height: side, channels: 3, background: bg } })
      .composite([{ input: trimmed.data, left: Math.round((side - tw) / 2), top: Math.round((side - th) / 2) }]).png().toBuffer();
    await sharp(sq).resize(SIZE, SIZE).webp({ quality: 82 }).toFile(out + '.tmp');
    how = `trimmed ${w}x${h} to ${tw}x${th}, centred`;
  } else if (f && f.x != null) {
    const zoom = f.zoom || 1, side = Math.round(Math.min(w, h) / zoom);
    const left = Math.max(0, Math.min(w - side, Math.round(f.x * w - side / 2)));
    const top = Math.max(0, Math.min(h - side, Math.round((f.y != null ? f.y : 0.5) * h - side / 2)));
    await base.clone().extract({ left, top, width: side, height: side }).resize(SIZE, SIZE).webp({ quality: 82 }).toFile(out + '.tmp');
    how = `cropped at ${f.x},${f.y || 0.5} zoom ${zoom}`;
  } else {
    await base.clone().resize(SIZE, SIZE, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toFile(out + '.tmp');
    how = 'cropped around the scooter (attention)';
  }
  fs.renameSync(out + '.tmp', out);
  stamps[s.id] = stamp;
  return `${s.id}: ${how}`;
}

(async () => {
  let n = 0;
  for (const s of S) { const r = await make(s); if (r) { console.log(r); n++; } }
  fs.writeFileSync(stampFile, JSON.stringify(stamps, null, 1));
  console.log(`card images: ${n} rebuilt, ${S.length} models`);
})();
