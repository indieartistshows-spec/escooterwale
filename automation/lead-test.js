/* automation/lead-test.js | sends one test lead to the live /api/lead from inside a real browser
   (plain curl from GitHub is stopped by Vercel's security checkpoint), in the two steps the quiz
   uses: contact first, then the shortlist added to the same row. Test rows go to the Sheet's
   "Tests" tab. Writes reports/lead-test.json. */
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const out = { ranAt: new Date().toISOString() };
  const b = await chromium.launch();
  try {
    const p = await (await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36' })).newPage();
    await p.goto('https://www.escooterwale.in/match', { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(4000);
    out.page = await p.title();
    out.result = await p.evaluate(async () => {
      const post = body => fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.text() }));
      const contact = await post({ test: true, stage: 'contact', name: 'Connection Test', mobile: '9999999999', pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', consent: true, consentText: 'test', answers: { budget: 'test' }, lang: 'en', source: 'github-action', page: '/match' });
      let id = null; try { id = JSON.parse(contact.body).id; } catch (e) {}
      const final = id ? await post({ test: true, leadId: id, mobile: '9999999999', shortlist: ['test-model'], answers: { budget: 'test', licence: 'yes' }, lang: 'en', page: '/match' }) : null;
      return { contact, final };
    });
  } catch (e) { out.error = String(e.message || e); }
  await b.close();
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/lead-test.json', JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})();
