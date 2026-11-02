/* automation/external-links.js | checks every outbound link on the built site from a normal
   network, like a visitor would: a plain browser-style request first, and a real browser for
   anything that answers 403/404/429/5xx or times out (many brand sites refuse scripts but serve
   people). Writes reports/external-links.json: ok, dead (real browser also gets 404/410 or the
   host does not resolve) and blocked (refuses automated checks; fine for visitors).
   Run from .github/workflows/external-links.yml. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const LANG = /^(hi|mr|ta|te|kn|gu|bn|or)$/;
function pages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'automation', 'tools', 'reports', 'i18n', 'api'].includes(e.name) || (dir === ROOT && LANG.test(e.name))) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) pages(f, out); else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}
const links = new Map();
for (const f of pages(ROOT)) {
  const h = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '');
  for (const m of h.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/gi)) {
    const u = m[1].replace(/&amp;/g, '&');
    if (/^https?:\/\/(www\.)?escooterwale\.in/.test(u)) continue;
    if (!links.has(u)) links.set(u, new Set());
    links.get(u).add('/' + path.relative(ROOT, f).replace(/(\/)?index\.html$/, '').replace(/\.html$/, ''));
  }
}
const SKIP = /^https?:\/\/(www\.)?(google\.com\/maps|youtube\.com|youtu\.be|reddit\.com|wa\.me|api\.whatsapp)/; // fine for visitors, refuse scripts
(async () => {
  const urls = [...links.keys()], res = {};
  const plain = async u => {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      return { status: r.status, final: r.url };
    } catch (e) { return { status: 0, error: (e.cause && e.cause.code) || e.name }; }
  };
  let i = 0;
  const work = async () => { while (i < urls.length) { const u = urls[i++]; res[u] = SKIP.test(u) ? { status: 'skipped' } : await plain(u); } };
  await Promise.all(Array.from({ length: 12 }, work));
  // second opinion in a real browser for anything that did not answer 2xx/3xx
  const b = await chromium.launch(), ctx = await b.newContext({ userAgent: UA }), page = await ctx.newPage();
  for (const u of urls) {
    const r = res[u]; if (r.status === 'skipped' || (r.status >= 200 && r.status < 400)) continue;
    try { const resp = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 }); r.browser = resp ? resp.status() : 0; r.title = (await page.title()).slice(0, 80); r.browserFinal = page.url(); }
    catch (e) { r.browser = 0; r.browserError = e.message.split('\n')[0].slice(0, 120); }
  }
  await b.close();
  const out = { ranAt: new Date().toISOString(), total: urls.length, ok: [], dead: [], blocked: [], skipped: 0 };
  for (const u of urls) {
    const r = res[u], from = [...links.get(u)];
    if (r.status === 'skipped') { out.skipped++; continue; }
    if (r.status >= 200 && r.status < 400) { out.ok.push(u); continue; }
    const b = r.browser;
    const notFound = (b === 404 || b === 410) || /ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test((r.browserError || '') + (r.error || '')) || /\b404\b|not found|page not found/i.test(r.title || '');
    const item = { url: u, plain: r.status || r.error, browser: b || r.browserError, title: r.title, final: r.browserFinal || r.final, pages: from.length, examples: from.slice(0, 3) };
    if (b >= 200 && b < 400 && !notFound) out.ok.push(u); else (notFound ? out.dead : out.blocked).push(item);
  }
  out.ok = out.ok.length;
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'reports/external-links.json'), JSON.stringify(out, null, 1));
  console.log(`checked ${out.total}: ok ${out.ok}, dead ${out.dead.length}, blocked ${out.blocked.length}, skipped ${out.skipped}`);
})();
