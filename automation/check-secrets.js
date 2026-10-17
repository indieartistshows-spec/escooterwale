/* automation/check-secrets.js  |  tests the three secrets without printing them */
const crypto = require('crypto');
const out = [];
const ok = (n, m) => out.push(`- ✅ **${n}**: ${m}`), bad = (n, m) => out.push(`- ❌ **${n}**: ${m}`);
(async () => {
  const pid = (process.env.GA_PROPERTY_ID || '').trim();
  if (!pid) bad('GA_PROPERTY_ID', 'missing');
  else if (!/^\d+$/.test(pid)) bad('GA_PROPERTY_ID', `should be digits only, it has ${pid.length} characters and starts with "${pid.slice(0, 2)}"`);
  else ok('GA_PROPERTY_ID', `digits only, ${pid.length} long`);

  let sa = null;
  if (!process.env.GA_SA_KEY) bad('GA_SA_KEY', 'missing');
  else { try { sa = JSON.parse(process.env.GA_SA_KEY); if (!sa.private_key || !sa.client_email) { bad('GA_SA_KEY', 'is JSON but not a service account key file'); sa = null; } } catch (e) { bad('GA_SA_KEY', 'not valid JSON. Paste the whole file, from { to }'); } }
  if (sa) {
    try {
      const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
      const h = b64({ alg: 'RS256', typ: 'JWT' }), b = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 });
      const jwt = `${h}.${b}.${crypto.createSign('RSA-SHA256').update(`${h}.${b}`).sign(sa.private_key, 'base64url')}`;
      const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) }).then(r => r.json());
      if (!tok.access_token) bad('GA_SA_KEY', `Google refused the key: ${tok.error_description || tok.error}`);
      else {
        ok('GA_SA_KEY', `valid key for ${sa.client_email}`);
        if (/^\d+$/.test(pid)) {
          const rep = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'city' }], metrics: [{ name: 'activeUsers' }], limit: 5, orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }] }) }).then(r => r.json());
          if (rep.error) bad('Google Analytics access', `${rep.error.status}: ${rep.error.message}`.slice(0, 300));
          else ok('Google Analytics access', `report works. Top cities, last 28 days: ${(rep.rows || []).map(r => `${r.dimensionValues[0].value} ${r.metricValues[0].value}`).join(', ') || 'no rows'}`);
        }
      }
    } catch (e) { bad('GA_SA_KEY', 'could not sign with the key: ' + String(e.message).slice(0, 120)); }
  }

  const yk = (process.env.YT_API_KEY || '').trim();
  if (!yk) bad('YT_API_KEY', 'missing');
  else {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&regionCode=IN&maxResults=1&key=${encodeURIComponent(yk)}`).then(r => r.json());
    if (r.error) bad('YT_API_KEY', `${r.error.code}: ${r.error.message}`.slice(0, 300));
    else ok('YT_API_KEY', 'YouTube API answers');
  }
  const body = `Automatic test of the three secrets (values are never shown).\n\n${out.join('\n')}`;
  require('fs').writeFileSync('secrets-check.md', body); console.log(body);
})();
