/* ============================================================
   tools/build-all.js  |  rebuild the whole site from /data
   Order matters:
     data.js -> generated guides -> launches page -> schema ->
     llms.txt -> pre-render (needs a local server) -> language
     versions (only fully translated ones go live) -> sitemap
   Usage: node tools/build-all.js [--no-i18n]
   ============================================================ */
const { execSync } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);
const run = cmd => { console.log(`\n▶ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

// The static server runs in its own process: execSync blocks this one.
const { spawn } = require('child_process');
function serve(port) {
  const child = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(port)], { stdio: 'ignore' });
  execSync('node -e "setTimeout(()=>{},800)"');
  return child;
}

(async () => {
  run('node tools/build-data.js');
  run('node tools/build-banners.js');
  run('node build-guide-pages.js');
  run('node tools/build-launches.js');
  run('node build-schema.js');
  run('node build-llms.js');
  const srv = serve(8877);
  try { run('node prerender.js'); } finally { srv.kill(); }
  if (!process.argv.includes('--no-i18n') && fs.existsSync('tools/i18n-build.js')) {
    run('node tools/i18n-patterns.js');
    run('node tools/i18n-build.js');
  }
  run('node tools/optimize-html.js'); // fonts, cache busting, lazy images on every finished page
  run('node build-sitemap.js'); // after languages, so live language URLs get real lastmod dates
  console.log('\n✓ site built');
})().catch(e => { console.error(e); process.exit(1); });
