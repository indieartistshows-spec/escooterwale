/* tools/i18n-merge.js  |  folds translated batches into i18n/<lang>.json
   i18n/batches/src-NNN.json = [english keys]
   i18n/batches/out-NNN.json = { hi: [...], mr: [...], ... } same order
   Checks every translation keeps the same {n} placeholders as its key;
   a bad one is skipped (stays English) and reported. */
const fs = require('fs'), path = require('path');
const C = require('../i18n-core.js');
const dir = 'i18n/batches';
const langs = Object.keys(C.LANGS);
const dict = {}; for (const l of langs) { try { dict[l] = JSON.parse(fs.readFileSync(`i18n/${l}.json`, 'utf8')); } catch (e) { dict[l] = {}; } }
let ident = {}; try { ident = JSON.parse(fs.readFileSync('i18n/identity.json', 'utf8')); } catch (e) {}
for (const l of langs) for (const k of Object.keys(ident)) if (dict[l][k] == null) dict[l][k] = k;
const ph = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
let added = 0, bad = [];
// TSV batches: one line per key -> "index<TAB>hi<TAB>mr<TAB>ta<TAB>te<TAB>kn<TAB>gu<TAB>bn<TAB>or"
for (const f of fs.readdirSync(dir).filter(f => /^out-\d+\.tsv$/.test(f)).sort()) {
  const n = JSON.parse(fs.readFileSync(path.join(dir, f.replace('out-', 'src-').replace('.tsv', '.json')), 'utf8')).length;
  const out = Object.fromEntries(langs.map(l => [l, new Array(n).fill(null)]));
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    const cols = line.split('\t'); if (cols.length < 9 || !/^\d+$/.test(cols[0])) continue;
    langs.forEach((l, j) => { out[l][+cols[0]] = cols[j + 1].trim(); });
  }
  fs.writeFileSync(path.join(dir, f.replace('.tsv', '.json')), JSON.stringify(out));
}
for (const f of fs.readdirSync(dir).filter(f => /^out-\d+\.json$/.test(f)).sort()) {
  const src = JSON.parse(fs.readFileSync(path.join(dir, f.replace('out-', 'src-')), 'utf8'));
  const out = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const l of langs) {
    const arr = out[l] || [];
    if (arr.length !== src.length) { bad.push(`${f} ${l}: ${arr.length} items for ${src.length} keys`); continue; }
    src.forEach((k, i) => {
      const v = arr[i];
      if (v == null || v === '') return;
      if (ph(v) !== ph(k)) { bad.push(`${f} ${l} #${i}: placeholders differ for "${k.slice(0, 40)}"`); return; }
      if (dict[l][k] !== v) { dict[l][k] = v; added++; }
    });
  }
}
for (const l of langs) fs.writeFileSync(`i18n/${l}.json`, JSON.stringify(dict[l], null, 0));
console.log(`i18n merge: ${added} translations added or updated${bad.length ? `, ${bad.length} problems:\n  ` + bad.slice(0, 30).join('\n  ') : ''}`);
