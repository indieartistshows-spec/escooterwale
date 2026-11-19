/* api/leads-cleanup.js | daily clean up of the "Leads" tab in the leads Google Sheet.
   Run every night at 11:59 PM IST by a Claude scheduled task that starts the GitHub workflow
   "Leads clean up" (.github/workflows/leads-cleanup.yml), which calls this endpoint. Also run on demand from Actions.
   Rows with the same mobile number are duplicates. Of each group, the row with the most
   information is kept and the others are deleted from "Leads":
     score = filled answer columns (Name, Email, Pincode, City, State, Shortlist, Skipped, Budget,
             Daily km, Riders, Charging, Priority) + answers stored in "Other answers";
     a tie goes to the row with more text in total, then to the newest row.
   Nothing is lost: every deleted row is first copied to the "Removed duplicates" tab, with the
   lead id of the row that was kept and the time it was removed. Only after that copy succeeds
   are rows deleted, and only if they are still at the same place in the sheet.
   Safety rules:
     - a number with a lead from the last 2 hours is left until the next run, so a quiz still
       being filled in (its second save looks the row up by lead id) is never touched;
     - only the "Leads" tab is changed; the form tabs and "Tests" are left as they are;
     - every run is written to the "Cleanup log" tab (counts only).
   Env: GOOGLE_SA_KEY and LEADS_SHEET_ID (same as api/lead.js). CRON_SECRET is optional: when set in
   Vercel (and as a GitHub secret for the workflow), every other caller is refused. Without it, a real
   clean up runs at most once an hour. ?dry=1 reports counts only and changes nothing.
   The reply never contains names, numbers or any other personal detail. */
const crypto = require('crypto');

const TAB = 'Leads', ARCHIVE = 'Removed duplicates', LOG = 'Cleanup log';
const COLS = 23;                       // A..W, as in api/lead.js
const C = { submitted: 0, mobile: 2, other: 14, leadId: 22 };
const INFO = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // Name, Email, Pincode, City, State, Shortlist .. Priority
const RECENT_MS = 2 * 3600e3, MIN_GAP_MS = 3600e3;

const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token() {
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
  return j.access_token;
}

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
const sheetId = () => { const v = String(process.env.LEADS_SHEET_ID || ''); const m = v.match(/\/d\/([A-Za-z0-9_-]{20,})/) || v.match(/[A-Za-z0-9_-]{20,}/); return m ? (m[1] || m[0]) : ''; };
function client(tok) {
  return async (path, opts = {}) => {
    const r = await fetch(API + sheetId() + path, { ...opts, headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' } });
    const txt = await r.text();
    let j = {}; try { j = JSON.parse(txt); } catch (e) { /* not JSON */ }
    if (!r.ok) throw new Error('sheets ' + r.status + ' on ' + (path.split('?')[0].slice(0, 60) || 'spreadsheet') + ': ' + ((j.error && (j.error.message || j.error.status)) || txt.slice(0, 160)));
    return j;
  };
}
const range = (tab, a1) => `/values/${encodeURIComponent(tab)}!${a1}`;

async function ensureTab(sheets, name, header) {
  const meta = await sheets('?fields=sheets.properties');
  if ((meta.sheets || []).some(s => s.properties.title === name)) return;
  await sheets(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } }] }) });
  await sheets(range(name, 'A1') + ':append?valueInputOption=RAW', { method: 'POST', body: JSON.stringify({ values: [header] }) });
}

// ---- pure logic (exported for the test) ----
const phone = v => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
function otherCount(v) {
  try { const o = JSON.parse(String(v || '').replace(/^'/, '')); return Object.entries(o).filter(([k, x]) => k !== 'stage' && x !== '' && x != null).length; }
  catch (e) { return 0; }
}
const filled = v => String(v == null ? '' : v).trim() !== '';
function score(r) {
  return { info: INFO.filter(i => filled(r[i])).length + otherCount(r[C.other]), chars: r.reduce((n, v) => n + String(v == null ? '' : v).trim().length, 0) };
}
// when a row was submitted: from the lead id (UTC ISO + _hex), else the IST "Submitted" column
function when(r) {
  const id = Date.parse(String(r[C.leadId] || '').split('_')[0]);
  if (!isNaN(id)) return id;
  const ist = Date.parse(String(r[C.submitted] || '').replace(' ', 'T') + '+05:30');
  return isNaN(ist) ? 0 : ist;
}
// rows: sheet rows without the header (rows[0] is sheet row 2). Returns the plan; changes nothing.
function plan(rows, now = Date.now()) {
  const groups = new Map();
  rows.forEach((r, i) => { const p = phone(r[C.mobile]); if (p) (groups.get(p) || groups.set(p, []).get(p)).push(i); });
  const remove = [], keptFor = {};
  let dupGroups = 0, deferred = 0;
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    dupGroups++;
    if (idx.some(i => now - when(rows[i]) < RECENT_MS)) { deferred++; continue; }
    const best = idx.slice().sort((a, b) => {
      const sa = score(rows[a]), sb = score(rows[b]);
      return sb.info - sa.info || sb.chars - sa.chars || when(rows[b]) - when(rows[a]) || b - a;
    })[0];
    for (const i of idx) if (i !== best) { remove.push(i); keptFor[i] = best; }
  }
  return { remove: remove.sort((a, b) => a - b), keptFor, dupGroups, deferred };
}

// ---- the run ----
async function run({ dry, sheets, now = Date.now() }) {
  const meta = await sheets('?fields=sheets.properties');
  const tabs = Object.fromEntries((meta.sheets || []).map(s => [s.properties.title, s.properties.sheetId]));
  if (tabs[TAB] == null) return { ok: true, rows: 0, duplicateNumbers: 0, removed: 0, note: 'no Leads tab yet' };
  const rows = ((await sheets(range(TAB, 'A2:W'))).values || []).map(r => { const x = r.slice(0, COLS); while (x.length < COLS) x.push(''); return x; });
  const p = plan(rows, now);
  const summary = { ok: true, dry: !!dry, rows: rows.length, duplicateNumbers: p.dupGroups, leftForNextRun: p.deferred, removed: dry ? 0 : p.remove.length, wouldRemove: dry ? p.remove.length : undefined };
  if (dry || !p.remove.length) { if (!dry) await log(sheets, now, summary); return summary; }

  // 1. copy every row that will be deleted to the archive tab first
  const stamp = new Date(now + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
  await ensureTab(sheets, ARCHIVE, ['Submitted (IST)', 'Name', 'Mobile', 'Email', 'Pincode', 'City', 'State', 'Shortlist', 'Skipped (reason)',
    'Budget', 'Daily km', 'Riders', 'Charging', 'Priority', 'Other answers', 'Consent', 'Consent text', 'Language',
    'Source', 'Page', 'Device', 'Duplicate of earlier lead', 'Lead id', 'Kept lead id', 'Removed (IST)']);
  const archived = p.remove.map(i => [...rows[i], rows[p.keptFor[i]][C.leadId] || ('sheet row ' + (p.keptFor[i] + 2)), stamp]);
  await sheets(range(ARCHIVE, 'A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: archived }) });

  // 2. delete only rows that are still where they were (same lead id and mobile at that row)
  const again = ((await sheets(range(TAB, 'A2:W'))).values || []);
  const same = i => again[i] && String(again[i][C.leadId] || '') === String(rows[i][C.leadId] || '') && String(again[i][C.mobile] || '') === String(rows[i][C.mobile] || '');
  const del = p.remove.filter(same);
  summary.removed = del.length;
  if (del.length < p.remove.length) summary.skippedMoved = p.remove.length - del.length;
  if (del.length) {
    // bottom up, so earlier deletions never shift the rows still to delete
    const requests = del.slice().sort((a, b) => b - a).map(i => ({ deleteDimension: { range: { sheetId: tabs[TAB], dimension: 'ROWS', startIndex: i + 1, endIndex: i + 2 } } }));
    await sheets(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
  }
  await log(sheets, now, summary);
  return summary;
}

async function log(sheets, now, s) {
  try {
    await ensureTab(sheets, LOG, ['Ran (IST)', 'Rows checked', 'Numbers with duplicates', 'Left for next run (recent lead)', 'Rows removed', 'Note']);
    const ist = new Date(now + 5.5 * 3600e3).toISOString().replace('T', ' ').slice(0, 19);
    await sheets(range(LOG, 'A1') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', body: JSON.stringify({ values: [[ist, s.rows, s.duplicateNumbers, s.leftForNextRun, s.removed, s.skippedMoved ? s.skippedMoved + ' moved during the run, left for next time' : '']] }) });
  } catch (e) { console.error('cleanup log failed', e.message); }
}

async function lastRun(sheets) {
  try {
    const v = (await sheets(range(LOG, 'A2:A'))).values || [];
    const t = v.length ? Date.parse(String(v[v.length - 1][0]).replace(' ', 'T') + '+05:30') : NaN;
    return isNaN(t) ? 0 : t;
  } catch (e) { return 0; }
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (!process.env.GOOGLE_SA_KEY || !process.env.LEADS_SHEET_ID) return res.status(500).json({ ok: false, error: 'not configured' });
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ ok: false, error: 'unauthorised' });
  const dry = /^(1|true|yes)$/i.test(String((req.query || {}).dry || ''));
  try {
    const sheets = client(await token());
    if (!secret && !dry && Date.now() - await lastRun(sheets) < MIN_GAP_MS) return res.status(429).json({ ok: false, error: 'already ran in the last hour' });
    const out = await run({ dry, sheets });
    console.log('leads cleanup', JSON.stringify(out));
    return res.status(200).json(out);
  } catch (e) {
    console.error('leads cleanup failed', e.message);
    return res.status(502).json({ ok: false, error: 'cleanup failed', detail: secret ? e.message : undefined });
  }
};
module.exports.plan = plan;
module.exports.run = run;
