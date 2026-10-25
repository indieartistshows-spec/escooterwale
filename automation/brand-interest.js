/* automation/brand-interest.js | monthly buyer-interest report per brand, for brand partnership pitches.
   For last calendar month (or the month given as YYYY-MM), from GA4:
     scooter views by model, shortlists (right swipes in the match quiz), clicks out to the brand's
     own website, comparison page views involving the brand, and the rivals its buyers compared it with.
   Writes reports/brand-interest/<YYYY-MM>.json and .md (plain English, one section per brand).
   Needs GA_SA_KEY and GA_PROPERTY_ID. Run from .github/workflows/brand-interest.yml.
   Usage: node automation/brand-interest.js [YYYY-MM] */
const fs = require('fs'), crypto = require('crypto');
function jwt(sa) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }), body = b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  return `${head}.${body}.${crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key, 'base64url')}`;
}
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8')), B = JSON.parse(fs.readFileSync('data/brands.json', 'utf8'));
const byId = Object.fromEntries(S.map(s => [s.id, s])), bname = id => (B.find(b => b.id === id) || {}).name || id;

(async () => {
  const arg = process.argv[2];
  const now = new Date(), ym = arg || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const [y, m] = ym.split('-').map(Number), start = `${ym}-01`, end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const sa = JSON.parse(process.env.GA_SA_KEY), pid = String(process.env.GA_PROPERTY_ID).replace(/\D/g, '');
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt(sa) }) }).then(r => r.json());
  if (!tok.access_token) throw new Error('GA sign-in failed');
  const run = body => fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${pid}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], limit: 1000, ...body }) }).then(r => r.json());
  const missing = [];
  const rows = rep => { if (rep.error) { missing.push(rep.error.message.slice(0, 120)); return []; } return (rep.rows || []).map(r => [...r.dimensionValues.map(d => d.value), ...r.metricValues.map(v => +v.value)]); };
  const ev = (name, dims) => run({ dimensions: dims.map(n => ({ name: n })), metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: name } } } }).then(rows);

  const views = await ev('scooter_view', ['customEvent:model']);
  const swipes = await ev('match_swipe', ['customEvent:model', 'customEvent:direction']);
  // brand_click fires for brand site, test ride and dealer links; link_type tells them apart.
  // If link_type is not registered as a custom dimension in GA, every click counts as a brand site click.
  let clicks = await ev('brand_click', ['customEvent:brand', 'customEvent:link_type']);
  if (!clicks.length) clicks = (await ev('brand_click', ['customEvent:brand'])).map(([b, n]) => [b, 'brand', n]);
  const cmp = rows(await run({ dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
    dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/compare/' } } } }));

  const brands = {};
  const get = id => brands[id] = brands[id] || { brandId: id, name: bname(id), views: 0, viewers: 0, models: {}, shortlisted: 0, skipped: 0, brandSiteClicks: 0, testRideDealerClicks: 0, compareViews: 0, rivals: {} };
  for (const [model, n, u] of views) { const s = byId[model]; if (!s) continue; const b = get(s.brandSlug); b.views += n; b.viewers += u; b.models[s.name] = (b.models[s.name] || 0) + n; }
  for (const [model, dir, n] of swipes) { const s = byId[model]; if (!s) continue; const b = get(s.brandSlug); if (dir === 'right') b.shortlisted += n; else if (dir === 'left') b.skipped += n; }
  for (const [brand, type, n] of clicks) if (brand && brand !== '(not set)') { if (/test-ride|dealer/.test(type)) get(brand).testRideDealerClicks += n; else get(brand).brandSiteClicks += n; }
  for (const [path, n] of cmp) {
    const k = path.replace(/^\/(?:hi|mr|ta|te|kn|gu|bn|or)\//, '/').replace(/^\/compare\//, '').replace(/\/$/, ''), i = k.indexOf('-vs-');
    if (i < 0) continue;
    const a = byId[k.slice(0, i)], c = byId[k.slice(i + 4)]; if (!a || !c) continue;
    for (const [x, o] of [[a, c], [c, a]]) { const b = get(x.brandSlug); b.compareViews += n; if (o.brandSlug !== x.brandSlug) { const r = bname(o.brandSlug); b.rivals[r] = (b.rivals[r] || 0) + n; } }
  }
  const list = Object.values(brands).sort((a, b) => b.views - a.views);
  const total = list.reduce((a, b) => a + b.views, 0) || 1;
  list.forEach((b, i) => { b.rank = i + 1; b.share = +(b.views / total * 100).toFixed(1); });

  fs.mkdirSync('reports/brand-interest', { recursive: true });
  fs.writeFileSync(`reports/brand-interest/${ym}.json`, JSON.stringify({ month: ym, label, from: start, to: end, totalViews: total, brands: list, notes: missing }, null, 1) + '\n');
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  let md = `# Buyer interest by brand, ${label}\n\nFrom EScooterwale's Google Analytics, ${start} to ${end}. ${total} scooter views across ${list.length} brands. Bot traffic is blocked at the firewall.\n\n`;
  md += `| # | Brand | Scooter views | Share | Shortlisted in the quiz | Clicks to brand site | Test ride and dealer clicks | Comparison page views |\n|---|---|---|---|---|---|---|---|\n`;
  md += list.map(b => `| ${b.rank} | ${b.name} | ${b.views} | ${b.share}% | ${b.shortlisted} | ${b.brandSiteClicks} | ${b.testRideDealerClicks} | ${b.compareViews} |`).join('\n') + '\n';
  for (const b of list) {
    md += `\n## ${b.name}\n\n- Ranked ${b.rank} of ${list.length} brands for scooter views (${b.views}, ${b.share}% of all views, about ${b.viewers} people).\n`;
    const tm = top(b.models).slice(0, 3); if (tm.length) md += `- Most viewed models: ${tm.map(([n, v]) => `${n} (${v})`).join(', ')}.\n`;
    if (b.shortlisted || b.skipped) md += `- In the match quiz, buyers shortlisted its scooters ${pl(b.shortlisted, 'time')} and skipped them ${pl(b.skipped, 'time')}.\n`;
    md += `- ${pl(b.brandSiteClicks, 'click')} to the brand's own website and ${b.testRideDealerClicks} to test ride or dealer pages.\n`;
    const tr = top(b.rivals).slice(0, 3); if (tr.length) md += `- Most compared against: ${tr.map(([n, v]) => `${n} (${pl(v, 'view')})`).join(', ')}.\n`;
  }
  fs.writeFileSync(`reports/brand-interest/${ym}.md`, md);
  if (missing.length) console.log('::warning::Some GA queries failed: ' + missing.join(' | '));
  console.log(md.slice(0, 1500));
})().catch(e => { console.error(e); process.exit(1); });
