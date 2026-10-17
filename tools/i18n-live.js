/* tools/i18n-live.js  |  which languages are allowed on the live site
   A language goes live (toggle option, /xx/ pages, hreflang, sitemap) only
   once its translation memory covers every key on the site, so visitors
   never see a half English page. Threshold: site-config langMinCoverage
   (default 1 = 100%; site-config sets 0.98 so a few brand new strings fall back to English instead of pulling the language). site-config langsForceLive / langsBlocked override. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const C = require('../i18n-core.js');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { return d; } };

function coverage() {
  const keys = rd('i18n/keys.json', []);
  const out = {};
  for (const l of Object.keys(C.LANGS)) {
    const d = rd(`i18n/${l}.json`, {});
    const have = keys.filter(k => d[k] != null).length;
    out[l] = keys.length ? have / keys.length : 0;
  }
  return out;
}
function liveLangs() {
  const cfg = rd('data/site-config.json', {});
  const min = cfg.langMinCoverage != null ? cfg.langMinCoverage : 1;
  const cov = coverage(), force = cfg.langsForceLive || [], block = cfg.langsBlocked || [];
  return Object.keys(C.LANGS).filter(l => !block.includes(l) && (force.includes(l) || cov[l] >= min));
}
module.exports = { coverage, liveLangs };
if (require.main === module) {
  const cov = coverage();
  console.log(Object.entries(cov).map(([l, c]) => `${l} ${(c * 100).toFixed(1)}%`).join(', '));
  console.log('live:', liveLangs().join(', ') || 'none');
}
