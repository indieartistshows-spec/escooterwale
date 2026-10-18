/* automation/ga-setup.js
   Sets up Google Analytics 4 for escooterwale.in through the GA Admin API, so the events the
   site sends show up as key events and can be sliced by brand, model, language and quiz answers.
   Safe to run again: anything already there is left as it is.
   Needs GA_SA_KEY (service account JSON, Editor on the property) and GA_PROPERTY_ID (digits).
   Writes reports/ga-setup.json. Run from .github/workflows/ga-setup.yml. */
const fs = require('fs'), crypto = require('crypto');

const KEY_EVENTS = ['quiz_start', 'quiz_complete', 'lead_submitted', 'brand_click'];
const DIMENSIONS = [
  ['brand', 'Brand', 'Scooter brand of the page, card or outbound link'],
  ['model', 'Model', 'Scooter model id'],
  ['page_type', 'Page type', 'home, scooters, brands, cities, best, compare, match and so on'],
  ['page_entity', 'Page item', 'The model, brand or city a page is about'],
  ['lang', 'Site language', 'en, hi, mr, ta, te, kn, gu, bn or or'],
  ['link_type', 'Outbound link type', 'brand, test-ride, dealer, aggregator or external'],
  ['link_domain', 'Outbound domain', 'Website an outbound click went to'],
  ['cta_text', 'Click text', 'Text of the button or link clicked inside the site'],
  ['cta_location', 'Click location', 'nav, hero, content, footer or directory'],
  ['question', 'Quiz question', 'Scooter match quiz question'],
  ['answer', 'Quiz answer', 'Answer picked for a quiz question'],
  ['direction', 'Swipe direction', 'left or right on a match card'],
  ['reason', 'Skip reason', 'Why a match was skipped'],
  ['budget', 'Quiz budget', 'Budget band picked in the quiz'],
  ['daily', 'Quiz daily km', 'Daily distance picked in the quiz'],
  ['riders', 'Quiz riders', 'Who rides, from the quiz'],
  ['charging', 'Quiz charging', 'Where they charge, from the quiz'],
  ['priority', 'Quiz priorities', 'What matters most, from the quiz'],
  ['licence', 'Quiz licence', 'Has a two-wheeler licence or not']
];

const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token() {
  const key = JSON.parse(process.env.GA_SA_KEY);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/analytics.edit',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google sign-in failed: ' + (j.error_description || j.error));
  return { t: j.access_token, who: key.client_email };
}

(async () => {
  const out = { ranAt: new Date().toISOString(), keyEvents: {}, dimensions: {}, errors: [] };
  try {
    const pid = String(process.env.GA_PROPERTY_ID || '').replace(/\D/g, '');
    const { t, who } = await token();
    out.serviceAccount = who.replace(/^(.{4}).*(@.*)$/, '$1...$2');
    const api = async (path, opts = {}) => {
      const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/properties/' + pid + path, { ...opts, headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path}: ${r.status} ${(j.error && j.error.message) || ''}`);
      return j;
    };
    const have = new Set(((await api('/keyEvents?pageSize=200')).keyEvents || []).map(k => k.eventName));
    for (const e of KEY_EVENTS) {
      if (have.has(e)) { out.keyEvents[e] = 'already a key event'; continue; }
      try { await api('/keyEvents', { method: 'POST', body: JSON.stringify({ eventName: e, countingMethod: 'ONCE_PER_EVENT' }) }); out.keyEvents[e] = 'marked as key event'; }
      catch (err) { out.keyEvents[e] = 'failed'; out.errors.push(err.message); }
    }
    const dims = new Set(((await api('/customDimensions?pageSize=200')).customDimensions || []).map(d => d.parameterName));
    for (const [param, name, desc] of DIMENSIONS) {
      if (dims.has(param)) { out.dimensions[param] = 'already registered'; continue; }
      try { await api('/customDimensions', { method: 'POST', body: JSON.stringify({ parameterName: param, displayName: name, description: desc, scope: 'EVENT' }) }); out.dimensions[param] = 'registered as ' + name; }
      catch (err) { out.dimensions[param] = 'failed'; out.errors.push(err.message); }
    }
  } catch (err) { out.errors.push(err.message); }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/ga-setup.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
