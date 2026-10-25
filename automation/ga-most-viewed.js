/* automation/ga-most-viewed.js | weekly: which scooters people opened most last week.
   Reads GA4 scooter_view counts by model for the last full Monday to Sunday week and writes
   data/most-viewed.json (the "Most viewed this week" strip). Adds a comparison page for every
   pair among the top 8 models to data/compare-pairs.json (append only, nothing removed).
   Needs GA_SA_KEY and GA_PROPERTY_ID; without them it leaves both files as they are. */
const fs = require('fs'), crypto = require('crypto');
const report = { ok: false, note: '' };
function jwt(sa) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  return `${head}.${body}.${crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key, 'base64url')}`;
}
(async () => {
  try {
    if (!process.env.GA_SA_KEY || !process.env.GA_PROPERTY_ID) throw new Error('GA credentials not set; most viewed unchanged');
    // last full Monday to Sunday week, in IST
    const ist = new Date(Date.now() + 5.5 * 3600e3), dow = (ist.getUTCDay() + 6) % 7; // 0 = Monday
    const mon = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - dow - 7)), sun = new Date(mon.getTime() + 6 * 864e5);
    const d = x => x.toISOString().slice(0, 10);
    const sa = JSON.parse(process.env.GA_SA_KEY), pid = String(process.env.GA_PROPERTY_ID).replace(/\D/g, '');
    const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt(sa) }) }).then(r => r.json());
    if (!tok.access_token) throw new Error('GA sign-in failed');
    const rep = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({
      dateRanges: [{ startDate: d(mon), endDate: d(sun) }], dimensions: [{ name: 'customEvent:model' }], metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }], limit: 200,
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'scooter_view' } } }, orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }] }) }).then(r => r.json());
    const ids = new Set(JSON.parse(fs.readFileSync('data/scooters.json', 'utf8')).map(s => s.id));
    const models = (rep.rows || []).map(r => ({ id: r.dimensionValues[0].value, views: +r.metricValues[0].value, people: +r.metricValues[1].value })).filter(m => ids.has(m.id));
    if (models.length < 5) throw new Error(`only ${models.length} models with views; most viewed unchanged`);
    const f = 'data/most-viewed.json', mv = JSON.parse(fs.readFileSync(f, 'utf8'));
    Object.assign(mv, { from: d(mon), to: d(sun), updated: d(new Date()), models });
    fs.writeFileSync(f, JSON.stringify(mv, null, 1) + '\n');
    const pf = 'data/compare-pairs.json', cp = JSON.parse(fs.readFileSync(pf, 'utf8')), have = new Set(cp.pairs), top = models.slice(0, 8).map(m => m.id); let added = 0;
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
      const a = top[i], b = top[j];
      if (have.has(a + '-vs-' + b) || have.has(b + '-vs-' + a)) continue;
      cp.pairs.push(a + '-vs-' + b); have.add(a + '-vs-' + b); added++;
    }
    if (added) fs.writeFileSync(pf, JSON.stringify(cp, null, 1) + '\n');
    report.ok = true; report.note = `${d(mon)} to ${d(sun)}: top ${models.slice(0, 3).map(m => m.id + ' ' + m.views).join(', ')}; ${added} new comparison pages`;
  } catch (e) { report.note = e.message; }
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/most-viewed.json', JSON.stringify(report, null, 1));
  console.log('most viewed:', report.note);
})();
