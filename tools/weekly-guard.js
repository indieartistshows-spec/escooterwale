/* ============================================================
   tools/weekly-guard.js  |  safety net for the automatic weekly publish
   Runs after the build, before anything is committed.

   node tools/weekly-guard.js data
     Checks data.js. If any scooter has a missing name, a price that is
     not a positive number, or the catalogue shrank by more than 20%,
     the whole /data change is rejected (exit 2). The workflow then puts
     /data back to last week and rebuilds, so the site keeps last good data.

   node tools/weekly-guard.js pages <prevSiteDir>
     1. Text check on every built page that changed: "undefined", "NaN",
        "[object Object]", an empty <h1>, or a page that lost more than
        half its text. A failing page is put back to last week's file.
     2. Screenshot check: the key pages are captured on this build and on
        last week's site (<prevSiteDir>, a git worktree of the previous
        commit). A page whose layout jumps (more than 60% of pixels or
        height changing by more than 40%) is put back to last week's file.
   Writes automation/out/guard.json for the weekly summary.
   ============================================================ */
const fs = require('fs'), path = require('path');
const { execSync, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..'); process.chdir(ROOT);
const OUT = 'automation/out/guard.json';
fs.mkdirSync('automation/out', { recursive: true });
const report = (() => { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return {}; } })();
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
const sh = c => execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function checkData() {
  delete require.cache[require.resolve('../data.js')];
  const D = require('../data.js');
  const problems = [];
  const ALL = D.SCOOTERS_ALL || D.SCOOTERS_DB;
  for (const s of ALL) {
    if (!s.id || !s.name) problems.push(`scooter without id or name: ${JSON.stringify(s).slice(0, 80)}`);
    if (!(typeof s.price === 'number' && s.price > 10000 && s.price < 1000000)) problems.push(`${s.id}: price ${s.price}`);
    for (const f of ['range', 'speed', 'battery']) if (s[f] != null && /undefined|NaN/.test(String(s[f]))) problems.push(`${s.id}: ${f} "${s[f]}"`);
  }
  let prevCount = null;
  try { prevCount = JSON.parse(sh('git show HEAD:data/scooters.json')).length; } catch (e) {}
  if (prevCount && ALL.length < prevCount * 0.8) problems.push(`catalogue shrank from ${prevCount} to ${ALL.length} models`);
  const onSale = D.SCOOTERS_DB.length;
  if (prevCount && onSale < prevCount * 0.6) problems.push(`only ${onSale} of ${ALL.length} models still on sale; too many marked discontinued at once`);
  report.data = { ok: !problems.length, problems };
  save();
  console.log(problems.length ? `data check FAILED:\n  ${problems.join('\n  ')}` : 'data check ok');
  process.exit(problems.length ? 2 : 0);
}

const textOf = html => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function restore(file, why) {
  try { execSync(`git checkout HEAD -- "${file}"`, { stdio: 'ignore' }); report.pages.restored.push({ file, why }); }
  catch (e) { report.pages.restored.push({ file, why: why + ' (new page, removed)' }); fs.rmSync(file, { force: true }); }
}

async function checkPages(prevDir) {
  report.pages = { checked: 0, restored: [] };
  // query-string templates fill their headings in the browser; their built copies are what gets checked
  const TEMPLATES = new Set(['scooter-detail.html', 'brand.html', 'city.html', 'best.html', 'article.html', 'compare.html']);
  const changed = sh('git status --porcelain').split('\n').map(l => l.slice(3).trim()).filter(f => f.endsWith('.html') && fs.existsSync(f) && !TEMPLATES.has(f));
  for (const f of changed) {
    report.pages.checked++;
    const html = fs.readFileSync(f, 'utf8'), t = textOf(html);
    const bad = (t.match(/\bundefined\b|\bNaN\b|\[object Object\]/g) || []);
    if (bad.length) { restore(f, `page text shows "${bad[0]}"`); continue; }
    if (/<h1[^>]*>\s*<\/h1>/i.test(html)) { restore(f, 'empty main heading'); continue; }
    let prev = null; try { prev = textOf(sh(`git show HEAD:"${f}"`)); } catch (e) {}
    if (prev && prev.length > 2000 && t.length < prev.length * 0.5) restore(f, `lost ${Math.round((1 - t.length / prev.length) * 100)}% of its text`);
  }
  if (prevDir && fs.existsSync(prevDir)) await visual(prevDir);
  save();
  console.log(`page check: ${report.pages.checked} changed pages checked, ${report.pages.restored.length} put back to last week`);
}

async function visual(prevDir) {
  const { PNG } = require('pngjs'), pixelmatch = require('pixelmatch');
  const start = (dir, port) => { const p = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(port), dir], { stdio: 'ignore' }); execSync('node -e "setTimeout(()=>{},800)"'); return p; };
  const a = start(prevDir, 8891), b = start(ROOT, 8892);
  const shots = 'shots-tmp/guard';
  try {
    execSync(`node tools/screens.js ${shots}/prev http://127.0.0.1:8891`, { stdio: 'ignore' });
    execSync(`node tools/screens.js ${shots}/now http://127.0.0.1:8892`, { stdio: 'ignore' });
  } finally { a.kill(); b.kill(); }
  report.visual = [];
  for (const f of fs.readdirSync(`${shots}/now`).filter(f => f.endsWith('.png'))) {
    if (!fs.existsSync(`${shots}/prev/${f}`)) continue;
    const A = PNG.sync.read(fs.readFileSync(`${shots}/prev/${f}`)), B = PNG.sync.read(fs.readFileSync(`${shots}/now/${f}`));
    const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
    const crop = img => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
    const diff = pixelmatch(crop(A).data, crop(B).data, null, w, h, { threshold: 0.2 }) / (w * h);
    const dh = Math.abs(B.height - A.height) / A.height, widthGrew = B.width > A.width + 4;
    const row = { shot: f, diff: +diff.toFixed(3), heightChange: +dh.toFixed(3), widthGrew };
    report.visual.push(row);
    if (diff > 0.6 || dh > 0.4 || widthGrew) {
      // shot -> url (screens.js manifest) -> built file
      const url = (JSON.parse(fs.readFileSync(`${shots}/now/manifest.json`, 'utf8')))[f] || '';
      const rel = url.replace(/^\//, '');
      const file = !rel ? 'index.html' : [rel + '.html', path.join(rel, 'index.html')].find(c => fs.existsSync(c));
      if (file && !report.pages.restored.some(r => r.file === file)) restore(file, `layout changed on ${f.endsWith('.m.png') ? 'mobile' : 'desktop'} (${Math.round(diff * 100)}% pixels, height ${Math.round(dh * 100)}%${widthGrew ? ', wider than screen' : ''})`);
    }
  }
}

const [mode, arg] = process.argv.slice(2);
if (mode === 'data') checkData();
else if (mode === 'pages') checkPages(arg).catch(e => { console.error(e); process.exit(1); });
else { console.log('usage: weekly-guard.js data | pages <prevSiteDir>'); process.exit(1); }
