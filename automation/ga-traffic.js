/* automation/ga-traffic.js | traffic quality check: who the visitors from each country really are.
   Pulls GA4 rows by country with city, source, device, browser, OS, screen size and engagement,
   for today and the last 7 days. Writes reports/ga-traffic.json (no personal data).
   Needs GA_SA_KEY and GA_PROPERTY_ID. Run from .github/workflows/ga-traffic.yml. */
const fs = require('fs'), crypto = require('crypto');
function jwt(sa) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  return `${head}.${body}.${crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key, 'base64url')}`;
}
(async () => {
  const sa = JSON.parse(process.env.GA_SA_KEY), pid = String(process.env.GA_PROPERTY_ID).replace(/\D/g, '');
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt(sa) }) }).then(r => r.json());
  const run = body => fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const M = ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration', 'newUsers'].map(name => ({ name }));
  const flat = rep => (rep.rows || []).map(r => Object.fromEntries([...(rep.dimensionHeaders || []).map((h, i) => [h.name, r.dimensionValues[i].value]), ...(rep.metricHeaders || []).map((h, i) => [h.name, +(+r.metricValues[i].value).toFixed(3)])]));
  const out = { ranAt: new Date().toISOString(), reports: {} };
  for (const [name, range] of [['today', { startDate: 'today', endDate: 'today' }], ['last7', { startDate: '7daysAgo', endDate: 'today' }]]) {
    out.reports[name] = {
      byCountry: flat(await run({ dateRanges: [range], dimensions: [{ name: 'country' }], metrics: M, limit: 30 })),
      detail: flat(await run({ dateRanges: [range], dimensions: ['country', 'city', 'sessionSourceMedium', 'deviceCategory', 'browser', 'operatingSystem', 'screenResolution'].map(name => ({ name })), metrics: M, limit: 300,
        dimensionFilter: { filter: { fieldName: 'country', inListFilter: { values: ['Singapore', 'South Korea', 'United States', 'India'] } } }, orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] })),
      landing: flat(await run({ dateRanges: [range], dimensions: [{ name: 'country' }, { name: 'landingPage' }], metrics: M, limit: 60,
        dimensionFilter: { filter: { fieldName: 'country', inListFilter: { values: ['Singapore', 'South Korea'] } } }, orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] })),
      byHour: flat(await run({ dateRanges: [range], dimensions: [{ name: 'country' }, { name: 'dateHour' }], metrics: [{ name: 'activeUsers' }], limit: 200,
        dimensionFilter: { filter: { fieldName: 'country', inListFilter: { values: ['Singapore', 'South Korea'] } } } }))
    };
  }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/ga-traffic.json', JSON.stringify(out, null, 1));
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
