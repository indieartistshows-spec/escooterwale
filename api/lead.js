/* api/lead.js | Vercel serverless function: saves a /match lead as a row in the leads Google Sheet.
   Env (set in Vercel, never in the repo):
     GOOGLE_SA_KEY   the service account JSON key (the Sheet is shared with its client_email as Editor)
     LEADS_SHEET_ID  the spreadsheet id
   Rows go to the "Leads" tab. Test submissions ({ test: true }) go to a separate "Tests" tab.
   Nothing personal is ever sent to Google Analytics; the page only fires a "lead_submitted" event. */
const crypto = require('crypto');

const TAB = 'Leads', TEST_TAB = 'Tests';
const HEADER = ['Submitted (IST)', 'Name', 'Mobile', 'Email', 'Pincode', 'City', 'State', 'Shortlist', 'Skipped (reason)',
  'Budget', 'Daily km', 'Riders', 'Charging', 'Priority', 'Other answers', 'Consent', 'Consent text', 'Language',
  'Source', 'Page', 'Device', 'Duplicate of earlier lead', 'Lead id'];

// best effort rate limit per warm instance: 5 submissions per 10 minutes per IP
const hits = new Map();
const limited = ip => {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 600000);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
};

const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
let cached = null;
async function token() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const key = JSON.parse(process.env.GOOGLE_SA_KEY);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  }));
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64u(sig) })
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('google auth failed: ' + (j.error_description || j.error || r.status));
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
async function sheets(path, opts = {}) {
  const r = await fetch(API + process.env.LEADS_SHEET_ID + path, {
    ...opts, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json', ...(opts.headers || {}) }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('sheets ' + r.status + ': ' + ((j.error && j.error.message) || 'error'));
  return j;
}

// create the tab with a bold, frozen header row the first time it is used
async function ensureTab(name) {
  const meta = await sheets('?fields=sheets.properties');
  if ((meta.sheets || []).some(s => s.properties.title === name)) return;
  const add = await sheets(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } }] }) });
  const id = add.replies[0].addSheet.properties.sheetId;
  await sheets(`/values/${encodeURIComponent(name)}!A1:append?valueInputOption=RAW`, { method: 'POST', body: JSON.stringify({ values: [HEADER] }) });
  await sheets(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ repeatCell: { range: { sheetId: id, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } }] }) });
}

const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
// a value starting with = + - @ would run as a formula in Sheets
const safe = v => /^[=+\-@]/.test(v) ? "'" + v : v;

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const origin = req.headers.origin || '';
  if (origin && !/^https:\/\/([a-z0-9-]+\.)*(escooterwale\.in|vercel\.app)$/.test(origin)) return res.status(403).json({ ok: false, error: 'origin' });
  if (!process.env.GOOGLE_SA_KEY || !process.env.LEADS_SHEET_ID) return res.status(500).json({ ok: false, error: 'not configured' });

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  // bots: hidden field filled in, or the form sent faster than a person can type
  if (b.hp) return res.status(200).json({ ok: true });
  if (!b.test && b.t && Date.now() - Number(b.t) < 3000) return res.status(200).json({ ok: true });
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'Too many tries. Please wait a few minutes.' });

  const name = clean(b.name, 80), email = clean(b.email, 120).toLowerCase();
  const mobile = clean(b.mobile, 20).replace(/[\s-]/g, '').replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '');
  const pincode = clean(b.pincode, 6);
  const bad = [];
  if (name.length < 2) bad.push('name');
  if (!/^[6-9]\d{9}$/.test(mobile)) bad.push('mobile');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) bad.push('email');
  if (!/^[1-9]\d{5}$/.test(pincode)) bad.push('pincode');
  if (b.consent !== true) bad.push('consent');
  if (bad.length) return res.status(400).json({ ok: false, error: 'invalid', fields: bad });

  try {
    const tab = b.test ? TEST_TAB : TAB;
    await ensureTab(tab);
    // duplicate check: same mobile in the last 7 days
    let dup = '';
    try {
      const prev = await sheets(`/values/${encodeURIComponent(tab)}!A2:W`);
      const week = Date.now() - 7 * 864e5;
      const hit = (prev.values || []).reverse().find(r => r[2] === mobile && Date.parse(r[22] ? r[22].split('_')[0] : '') > week);
      if (hit) dup = hit[22] || 'yes';
    } catch (e) { /* duplicate check is optional */ }

    const a = b.answers || {};
    const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
    const id = new Date().toISOString() + '_' + crypto.randomBytes(3).toString('hex');
    const ua = String(req.headers['user-agent'] || '');
    const row = [ist, name, mobile, email, pincode, clean(b.city, 60), clean(b.state, 60),
      clean((b.shortlist || []).join(', '), 500),
      clean((b.skipped || []).map(s => s.id + (s.reason ? ' (' + s.reason + ')' : '')).join(', '), 800),
      clean(a.budget), clean(a.daily), clean(a.riders), clean(a.charging), clean(a.priority),
      clean(JSON.stringify(Object.fromEntries(Object.entries(a).filter(([k]) => !['budget', 'daily', 'riders', 'charging', 'priority', 'pincode'].includes(k)))), 500),
      'Yes', clean(b.consentText, 600), clean(b.lang, 5) || 'en', clean(b.source, 300), clean(b.page, 200),
      /mobile|android|iphone/i.test(ua) ? 'Mobile' : 'Desktop', dup, id].map(v => safe(String(v)));
    const out = await sheets(`/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [row] }) });
    return res.status(200).json({ ok: true, id, range: out.updates && out.updates.updatedRange, duplicate: !!dup });
  } catch (e) {
    console.error('lead save failed', e.message);
    return res.status(502).json({ ok: false, error: 'Could not save right now. Please try again.', detail: b.test ? e.message : undefined });
  }
};
