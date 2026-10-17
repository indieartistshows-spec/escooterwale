/* ============================================================
   automation/trending.js
   Adds new YouTube reviews and news articles to data/trending.json.
   APPEND-ONLY: existing items are never removed or reordered;
   duplicates (same video ID or same URL) are skipped.

   Videos: YouTube Data API v3 (env YT_API_KEY). For each model we
   search "<model> review", India region, published since the last
   run, and keep only videos whose title names the model. Videos
   attach to that model, so they also show on its page under
   "What owners say". Without a key, video discovery is skipped.

   Articles: Google News RSS searches for Indian electric scooter
   topics (no key needed). Kept only if the title is on topic.
   ============================================================ */
const fs = require('fs');
const FILE = 'data/trending.json';
const T = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const B = JSON.parse(fs.readFileSync('data/brands.json', 'utf8'));
const TODAY = new Date().toISOString().slice(0, 10);
const since = T.lastRun || new Date(Date.now() - 14 * 864e5).toISOString();
const report = { videos: 0, articles: 0, notes: [] };
const haveVid = new Set(T.videos.map(v => v.videoId));
const haveUrl = new Set(T.articles.map(a => a.url.split('?')[0]));
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function modelKey(s) {
  const b = B.find(x => x.id === s.brandSlug) || {};
  const base = s.name.replace(/\s*[\d.]+\s*kWh$/i, '').trim();
  return { short: b.shortName || s.brand, base, query: `${b.shortName || s.brand} ${base} review` };
}

async function videos() {
  const key = process.env.YT_API_KEY;
  if (!key) { report.notes.push('YT_API_KEY not set, video discovery skipped'); return; }
  // one search per model family (S1 X 2/3 kWh share a family), to stay well inside the free quota
  const fams = new Map();
  for (const s of S) { const k = modelKey(s); const id = `${s.brandSlug}|${k.base}`; if (!fams.has(id)) fams.set(id, { ...k, models: [] }); fams.get(id).models.push(s); }
  for (const f of fams.values()) {
    const u = new URL('https://www.googleapis.com/youtube/v3/search');
    Object.entries({ part: 'snippet', q: f.query, type: 'video', regionCode: 'IN', relevanceLanguage: 'en', maxResults: '8', order: 'date', publishedAfter: since, key }).forEach(([k, v]) => u.searchParams.set(k, v));
    try {
      const r = await fetch(u).then(x => x.json());
      if (r.error) { report.notes.push('YouTube API: ' + r.error.message); if (r.error.code === 403) return; continue; }
      for (const it of r.items || []) {
        const id = it.id && it.id.videoId, sn = it.snippet || {};
        if (!id || haveVid.has(id)) continue;
        const title = decode(sn.title || '');
        // title must name the model family (e.g. "450X", "iQube", "Chetak")
        const tok = f.base.split(' ').filter(w => w.length > 1 && !/^(plus|pro|go|s|z|x)$/i.test(w));
        if (!tok.some(w => title.toLowerCase().includes(w.toLowerCase()))) continue;
        // attach to the variant whose battery size the title mentions, else the first in the family
        const kw = (title.match(/(\d(?:\.\d)?)\s*kwh/i) || [])[1];
        const model = (kw && f.models.find(m => parseFloat(m.battery) === parseFloat(kw))) || f.models[0];
        T.videos.push({ videoId: id, title, channel: decode(sn.channelTitle || ''), modelId: model.id, brandId: model.brandSlug, type: 'review', published: (sn.publishedAt || '').slice(0, 10), added: TODAY });
        haveVid.add(id); report.videos++;
      }
    } catch (e) { report.notes.push(`YouTube search failed for ${f.query}: ${String(e.message || e).slice(0, 80)}`); }
  }
}

const QUERIES = [
  ['electric scooter India launch', 'launch'], ['electric two-wheeler sales India', 'sales'],
  ['PM E-DRIVE electric two-wheeler', 'subsidy'], ['EV subsidy two-wheeler state policy India', 'subsidy'],
  ['electric scooter review India', 'review']
];
const ON_TOPIC = /electric|ev\b|e-?scooter|e2w|e-?two|ather|ola electric|iqube|chetak|vida|ampere|e-?drive|bgauss|okinawa|pure ev|bounce/i;

async function articles() {
  for (const [q, topic] of QUERIES) {
    const u = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:14d')}&hl=en-IN&gl=IN&ceid=IN:en`;
    try {
      const xml = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 escooterwale-bot' } }).then(r => r.text());
      const items = xml.split('<item>').slice(1, 12);
      for (const it of items) {
        const g = tag => decode(((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim());
        let title = g('title'), link = g('link'), source = g('source'), pub = g('pubDate');
        if (!title || !link) continue;
        if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
        if (!ON_TOPIC.test(title)) continue;
        const key = link.split('?')[0];
        if (haveUrl.has(key) || T.articles.some(a => a.title === title)) continue;
        T.articles.push({ url: link, title, source: source || 'News', published: pub ? new Date(pub).toISOString().slice(0, 10) : null, added: TODAY, topic });
        haveUrl.add(key); report.articles++;
      }
    } catch (e) { report.notes.push(`news feed failed for "${q}": ${String(e.message || e).slice(0, 80)}`); }
  }
}

(async () => {
  await videos();
  await articles();
  T.lastRun = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(T, null, 1) + '\n');
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/trending.json', JSON.stringify(report, null, 1));
  console.log(`trending: +${report.videos} videos, +${report.articles} articles${report.notes.length ? ' | ' + report.notes.join(' | ') : ''}`);
})();
