/* ============================================================
   automation/summary.js  |  the weekly summary GK reads
   Collects automation/out/*.json into one plain-English report:
   reports/weekly/<date>.md (committed with the site) and
   automation/out/summary.md (used as the GitHub issue body).
   Usage: node automation/summary.js <repo> <prevSha>
   ============================================================ */
const fs = require('fs');
const J = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const [repo = 'indieartistshows-spec/escooterwale', prevSha = ''] = process.argv.slice(2);
const TODAY = new Date().toISOString().slice(0, 10);
const ch = J('automation/out/changes.json') || {}, guard = J('automation/out/guard.json') || {};
const head = J('automation/out/headline.json'), vahan = J('automation/out/vahan.json'), trend = J('automation/out/trending.json'), links = J('automation/out/links.json');
const sub = J('automation/out/subsidy.json'), i18n = J('automation/out/i18n.json');
const S = J('data/scooters.json') || [];
const nm = id => (S.find(s => s.id === id) || {}).name || id;
const inr = v => typeof v === 'number' ? '₹' + v.toLocaleString('en-IN') : v;
const L = [];
const sec = (t, rows, empty) => { L.push(`\n## ${t}`); if (rows && rows.length) rows.forEach(r => L.push('- ' + r)); else L.push(empty || '- No changes'); };

L.push(`# Weekly update, ${TODAY}`);
const restored = (guard.pages && guard.pages.restored) || [];
const dataRejected = guard.data && !guard.data.ok;
L.push(dataRejected ? '\n**Data from this week was rejected by the safety check, so the site kept last week\'s data.** Details below.'
  : `\nPublished automatically. ${restored.length ? restored.length + ' page(s) failed a check and were kept at last week\'s version.' : 'All checks passed.'}`);

sec('Prices and specs changed', (ch.applied || []).map(a => `${nm(a.id)}: ${a.field} ${inr(a.from)} → ${inr(a.to)}${a.url ? ` ([source](${a.url}))` : ''}`));
sec('Held back (looked wrong, old value kept)', (ch.held || []).map(h => `${nm(h.id)}: ${h.field} ${inr(h.from) || ''} → ${inr(h.to)} (${h.why})`), '- Nothing held');
if (ch.cityPrices) L.push(`- ${ch.cityPrices} city prices updated`);
sec('Brand sites that could not be read (skipped, data unchanged)', (ch.skippedBrands || []).map(b => `${b.brand}: ${(b.errors || []).join('; ').slice(0, 160)}`), '- None');
sec('New launches', (ch.launches || []).map(e => `${e.brand || ''} ${e.name || ''} ${e.price ? inr(e.price) : ''}`.trim()), '- None');
sec('Marked discontinued', (ch.discontinued || []).map(d => `${d.brand} ${d.name}`), '- None');
if (head) sec('Headline price city (Google Analytics)', [head.note]);
if (vahan) sec('Demand Mein Hai (VAHAN)', [vahan.note]);
{ let mvr = null; try { mvr = JSON.parse(require('fs').readFileSync('automation/out/most-viewed.json', 'utf8')); } catch (e) {} if (mvr) sec('Most viewed this week (GA)', [mvr.note]); }
if (trend) sec('Trending', [`${trend.videos || 0} videos and ${trend.articles || 0} articles added`, ...(trend.notes || [])]);
if (sub) sec('Subsidy', (sub.changes || []).map(c => `${c.what} (source: ${c.source})`), '- No official change found this week');
if (links) sec('Outbound links', [`${links.checked || 0} checked`, ...(links.fixed || []).map(f => `fixed: ${f.what || JSON.stringify(f)}`), ...(links.broken || []).map(b => `broken: ${b.url || JSON.stringify(b)}`)]);
if (i18n) sec('Languages', [i18n.note]);
sec('Safety checks', [
  ...(guard.data && guard.data.problems || []).map(p => `data: ${p}`),
  ...restored.map(r => `kept last week's ${r.file}: ${r.why}`),
  ...(guard.visual || []).filter(v => v.diff > 0.3).map(v => `${v.shot}: ${Math.round(v.diff * 100)}% of the page looks different (under the limit, published)`),
], '- All pages passed');

L.push(`\n## Undo this week`);
L.push(`If anything looks wrong, open [Rollback](https://github.com/${repo}/actions/workflows/rollback.yml), press **Run workflow**, then the green **Run workflow** button. It reverts this week's update and Vercel redeploys in about a minute.${prevSha ? ` The site goes back to commit \`${prevSha.slice(0, 7)}\`.` : ''}`);

const md = L.join('\n') + '\n';
fs.mkdirSync('reports/weekly', { recursive: true });
fs.writeFileSync(`reports/weekly/${TODAY}.md`, md);
fs.writeFileSync('automation/out/summary.md', md);
console.log(md);
