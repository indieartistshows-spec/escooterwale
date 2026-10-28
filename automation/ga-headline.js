/* ============================================================
   automation/ga-headline.js
   Picks the headline price city from Google Analytics.

   Reads active users by city for the last 28 days (GA4 Data API,
   read-only service account), keeps India only, merges name
   variants, counts only the cities we have city pages for, and
   switches the headline city only when a new city has led for two
   weekly checks in a row by at least 10%. This stops prices on
   every page flipping back and forth on a few visits' difference.

   Needs env: GA_SA_KEY (service account JSON), GA_PROPERTY_ID.
   Without them it leaves the current city unchanged.
   When headlineCity is empty (no default city, GK Oct 2026) it only records
   the weekly leader in headlineHistory and never sets one.
   ============================================================ */
const fs = require('fs'), crypto = require('crypto');
const CFG_FILE = 'data/site-config.json';
const cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
const cities = JSON.parse(fs.readFileSync('data/cities.json', 'utf8'));
const out = { changed: false, from: cfg.headlineCity, to: cfg.headlineCity, users: null, note: '' };

const ALIAS = { 'new delhi': 'delhi', 'delhi': 'delhi', 'bengaluru': 'bangalore', 'bangalore': 'bangalore', 'secunderabad': 'hyderabad', 'hyderabad': 'hyderabad',
  'mumbai': 'mumbai', 'navi mumbai': 'mumbai', 'thane': 'mumbai', 'chennai': 'chennai', 'pune': 'pune', 'pimpri-chinchwad': 'pune', 'kolkata': 'kolkata', 'howrah': 'kolkata',
  'ahmedabad': 'ahmedabad', 'gandhinagar': 'ahmedabad', 'jaipur': 'jaipur', 'lucknow': 'lucknow', 'surat': 'surat', 'chandigarh': 'chandigarh', 'mohali': 'chandigarh', 'sahibzada ajit singh nagar': 'chandigarh', 'panchkula': 'chandigarh' };

function jwt(sa) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key, 'base64url');
  return `${head}.${body}.${sig}`;
}

async function usersByCity() {
  const sa = JSON.parse(process.env.GA_SA_KEY);
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt(sa) }) }).then(r => r.json());
  if (!tok.access_token) throw new Error('GA auth failed: ' + JSON.stringify(tok).slice(0, 200));
  const rep = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA_PROPERTY_ID}:runReport`, {
    method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: '28daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'country' }, { name: 'city' }], metrics: [{ name: 'activeUsers' }], limit: 1000 })
  }).then(r => r.json());
  if (!rep.rows) throw new Error('GA report empty: ' + JSON.stringify(rep).slice(0, 200));
  const ids = new Set(cities.map(c => c.id)), tally = {};
  for (const r of rep.rows) {
    if (r.dimensionValues[0].value !== 'India') continue;
    const id = ALIAS[r.dimensionValues[1].value.toLowerCase()];
    if (!id || !ids.has(id)) continue;
    tally[id] = (tally[id] || 0) + Number(r.metricValues[0].value);
  }
  return tally;
}

(async () => {
  if (!process.env.GA_SA_KEY || !process.env.GA_PROPERTY_ID) {
    out.note = 'GA credentials not set; headline city unchanged';
  } else {
    try {
      const tally = await usersByCity();
      out.users = tally;
      const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      const [leader, lUsers] = ranked[0] || [];
      const cur = cfg.headlineCity, curUsers = tally[cur] || 0;
      const hist = cfg.headlineHistory || [];
      hist.unshift({ week: new Date().toISOString().slice(0, 10), leader, users: tally });
      cfg.headlineHistory = hist.slice(0, 12);
      const ledLastWeek = hist[1] && hist[1].leader === leader;
      if (cur && leader && leader !== cur && ledLastWeek && lUsers >= curUsers * 1.10) {
        cfg.headlineCity = leader; out.changed = true; out.to = leader;
        cfg.headlineCityReason = `Most active users in GA for two weeks running (${leader} ${lUsers} vs ${cur} ${curUsers}, last 28 days)`;
        out.note = `Headline city switched from ${cur} to ${leader}`;
      } else {
        out.note = !cur ? `No headline city by choice; ${leader} leads GA this week (recorded only)` : leader === cur ? `${cur} still leads` : `${leader} leads this week but the switch rule (2 weeks, 10%) is not met yet`;
      }
    } catch (e) { out.note = 'GA check failed, headline city unchanged: ' + String(e.message || e).slice(0, 160); }
  }
  cfg.dataUpdated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2) + '\n');
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/headline.json', JSON.stringify(out, null, 1));
  console.log('headline city:', out.note);
})();
