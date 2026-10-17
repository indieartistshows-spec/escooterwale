/* ============================================================
   automation/links-check.js
   Checks every outbound brand and source link once a week.
   - Broken test-ride or dealer link -> set to null, so the site
     falls back to the brand homepage (never a dead button)
   - Broken model page link (brandUrl) or source link -> reported
   A link counts as broken only after two failed tries.
   ============================================================ */
const fs = require('fs');
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const links = J('data/brand-links.json'), S = J('data/scooters.json'), SUB = J('data/subsidy.json'), B = J('data/brands.json');
const report = { checked: 0, broken: [], fixed: [] };

async function ok(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; escooterwale-linkcheck)' }, signal: AbortSignal.timeout(20000) });
      if (r.status < 400 || r.status === 403 || r.status === 429) return true;   // 403/429 = bot wall, page exists
    } catch (e) {}
  }
  return false;
}

(async () => {
  const jobs = [];
  for (const [id, l] of Object.entries(links)) if (id !== '_note') for (const k of ['testRide', 'dealer']) if (l[k]) jobs.push({ url: l[k], fix: () => { l[k] = null; l.verified = (l.verified || []).filter(x => x !== k); }, what: `${id} ${k}` });
  for (const u of new Set(S.map(s => s.brandUrl))) jobs.push({ url: u, what: `model page ${u}` });
  for (const b of B) if (b.website) jobs.push({ url: b.website, what: `${b.name} homepage` });
  const srcs = [...SUB.central.sources, ...Object.values(SUB.states).flatMap(s => s.sources || [])];
  for (const s of srcs) jobs.push({ url: s.url, what: `source: ${s.title}` });
  for (const j of jobs) {
    report.checked++;
    if (await ok(j.url)) continue;
    report.broken.push({ what: j.what, url: j.url });
    if (j.fix) { j.fix(); report.fixed.push(j.what); }
  }
  fs.writeFileSync('data/brand-links.json', JSON.stringify(links, null, 1) + '\n');
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/links.json', JSON.stringify(report, null, 1));
  console.log(`links: ${report.checked} checked, ${report.broken.length} broken, ${report.fixed.length} fell back to brand homepage`);
})();
