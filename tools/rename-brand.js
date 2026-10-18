/* tools/rename-brand.js | one-off: the official brand name is EScooterwale.
   Rewrites every older spelling (E-ScooterWale, ScooterWale, Escooterwale, EScooterWale) in the
   site sources, build scripts, data and translation dictionaries (keys and values, so no language
   loses coverage). The domain and email stay lowercase: escooterwale.in, info@escooterwale.in.
   Run once, then rebuild: node tools/rename-brand.js && node tools/build-all.js */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const NEW = 'EScooterwale';
const swap = s => s
  .replace(/<strong>E-Scooter<\/strong><em>Wale<\/em>/g, '<strong>EScooter</strong><em>wale</em>')
  .replace(/E-ScooterWale/g, NEW)
  .replace(/EScooterWale/g, NEW)
  .replace(/Escooterwale(?![.\w])/g, NEW)
  .replace(/(?<![A-Za-z-])ScooterWale/g, NEW);

const skip = /^(node_modules|images|fonts|i18n\/batches|reports)\/|\.(png|jpe?g|webp|avif|gif|ico|woff2?|zip|pdf)$/;
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f && !skip.test(f) && !/rename-brand\.js$/.test(f));
let changed = 0;
for (const f of files) {
  let s;
  try { s = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!/ScooterWale|Escooterwale|E-Scooter<\/strong>/.test(s)) continue;
  let out;
  if (/^i18n\/[a-z]{2}\.json$|^i18n\/(keys|segments|identity)\.json$/.test(f)) {
    // dictionaries: rename inside keys and values, then re-serialise the same way the merge tool does
    const d = JSON.parse(s);
    const walk = v => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [swap(k), walk(x)])) : typeof v === 'string' ? swap(v) : v;
    out = JSON.stringify(walk(d), null, f.includes('/keys') || f.includes('/segments') ? (s.includes('\n  ') ? 1 : 0) : 0);
    if (s.endsWith('\n')) out += '\n';
  } else out = swap(s);
  if (out !== s) { fs.writeFileSync(f, out); changed++; }
}
console.log(`rename-brand: ${changed} files updated to ${NEW}`);
