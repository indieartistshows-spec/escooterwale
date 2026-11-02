/* tools/minify-assets.js | refreshes min/ (the minified copies of our .js/.css that pages load)
   from the source files. Runs first in tools/build-all.js: the page templates load /min/ files,
   so the build's own browser renders must see this build's code, not last build's.
   tools/optimize-html.js creates min/ copies for any new file and points pages at them. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), MIN = path.join(ROOT, 'min');
if (!fs.existsSync(MIN)) process.exit(0);
const esbuild = require('esbuild');
let n = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    const rel = path.relative(MIN, f), src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) continue;
    const out = esbuild.transformSync(fs.readFileSync(src, 'utf8'), { loader: rel.endsWith('.css') ? 'css' : 'js', minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false, legalComments: 'none', charset: 'utf8' }).code;
    if (fs.readFileSync(f, 'utf8') !== out) { fs.writeFileSync(f, out); n++; }
  }
})(MIN);
console.log(`minify-assets: ${n} file(s) refreshed`);
