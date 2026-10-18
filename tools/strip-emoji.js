/* tools/strip-emoji.js | applies the emoji rule (tools/emoji.js) to the site's source files and
   carries existing translations over to the new emoji-free strings, so every language stays
   fully translated. Only emoji are touched: an element that held nothing but an emoji goes with
   it, and so does the one space that separated the emoji from its text. Re-runnable.
   Run: node tools/strip-emoji.js */
const fs = require('fs'), path = require('path'), glob = d => fs.readdirSync(d).map(f => path.join(d, f));
const { strip, isDropped, EMOJI } = require('./emoji');
process.chdir(path.resolve(__dirname, '..'));
const SKIP = new Set(['data.js', 'trending-data.js', 'videos-db.js', 'tools/emoji.js', 'tools/strip-emoji.js', 'prerender.js', 'tools/i18n-build.js']);
const E = EMOJI.source;
// <span class="ic">💰</span>  → removed whole (only when the emoji is one we drop)
const WRAP = new RegExp(`<(span|i|div|em|b|small)(\\s[^<>]*)?>\\s*((?:${E}\\s*)+)</\\1>`, 'gu');
// "💡 Tip" → "Tip"; "Blog 🏁<" → "Blog<"; anything else: the emoji alone
const WORD = /[\p{L}\p{N}\p{M}]/u;
const LEAD = new RegExp(`(${E}) (?=\\S)`, 'gu'), TRAIL = new RegExp(` (${E})(?=\\s*(?:<|['"\`]|$))`, 'gmu'), ANY = new RegExp(E, 'gu');
function clean(s) {
  return s.replace(WRAP, (m, t, a, inner) => [...inner.matchAll(ANY)].every(x => isDropped(x[0])) ? '' : m)
    .replace(LEAD, (m, e) => isDropped(e) ? '' : m)
    .replace(TRAIL, (m, e) => isDropped(e) ? '' : m)
    .replace(ANY, (e, i, all) => !isDropped(e) ? e : WORD.test(all[i - 1] || '') && WORD.test(all[i + e.length] || '') ? ' ' : '');
}
let changed = 0;
const files = [...glob('.'), ...glob('tools')].map(f => f.replace(/^\.\//, ''))
  .filter(f => /\.(html|js|template)$/.test(f) && !SKIP.has(f) && fs.statSync(f).isFile());
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8'), out = clean(s);
  if (out !== s) { fs.writeFileSync(f, out); changed++; console.log('cleaned', f); }
}
for (const f of glob('data').filter(f => f.endsWith('.json'))) {
  const s = fs.readFileSync(f, 'utf8'), out = clean(s);
  if (out !== s) { JSON.parse(out); fs.writeFileSync(f, out); changed++; console.log('cleaned', f); }
}
let added = 0;
for (const f of glob('i18n').filter(f => /\/[a-z]{2}\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(d)) {
    const nk = strip(k);
    if (nk !== k && nk.trim() && d[nk] == null) { d[nk] = strip(v); added++; }
  }
  fs.writeFileSync(f, JSON.stringify(d));
}
console.log(`${changed} files cleaned, ${added} translations carried over`);
