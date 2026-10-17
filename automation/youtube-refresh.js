/* ============================================================
   automation/youtube-refresh.js  |  YouTube section, exact data from YouTube

   1. Every video already in data/trending.json is re-read from the
      YouTube Data API (videos.list): real title, channel, publish date,
      duration, views and the video's own thumbnail URL (maxres, then
      standard, then high). Videos that are gone, private, Shorts, or
      whose title does not name the model are hidden (kept in the
      archive file, never shown).
   2. New videos are found per model family (search "<brand> <model>
      review", India, last 18 months, most relevant), checked the same
      way, and the best two per family are added.
   3. A few topical searches add launch and comparison videos.

   Needs YT_API_KEY. Run weekly and from .github/workflows/youtube.yml.
   ============================================================ */
const fs = require('fs');
const FILE = 'data/trending.json';
const T = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const S = JSON.parse(fs.readFileSync('data/scooters.json', 'utf8'));
const B = JSON.parse(fs.readFileSync('data/brands.json', 'utf8'));
const KEY = process.env.YT_API_KEY;
const TODAY = new Date().toISOString().slice(0, 10);
const SINCE = new Date(Date.now() - 548 * 864e5).toISOString();
const report = { checked: 0, updated: 0, hidden: 0, added: 0, notes: [] };
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const secs = iso => { const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };
const thumbOf = th => (th.maxres || th.standard || th.high || th.medium || th.default || {}).url || null;

async function api(path, params) {
  const u = new URL('https://www.googleapis.com/youtube/v3/' + path);
  Object.entries({ ...params, key: KEY }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u).then(x => x.json());
  if (r.error) throw new Error(r.error.message);
  return r;
}

async function details(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api('videos', { part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(',') });
    for (const v of r.items || []) out[v.id] = v;
  }
  return out;
}

const family = s => {
  const b = B.find(x => x.id === s.brandSlug) || {};
  const base = s.name.replace(/\s*[\d.]+\s*kWh$/i, '').trim();
  return { brand: b.shortName || s.brand, base, key: `${s.brandSlug}|${base}` };
};
// words in a title that prove the video is about this family ("450X", "iQube", "Konarc")
const proves = (f, title) => {
  const t = title.toLowerCase();
  const toks = f.base.split(/\s+/).filter(w => w.length > 1 && !/^(plus|pro|go|s|z|x|st|ex|neo|max|g)$/i.test(w));
  const toksAll = toks.length ? toks : f.base.split(/\s+/);
  return toksAll.some(w => t.includes(w.toLowerCase()));
};
const usable = v => v && v.status && v.status.privacyStatus === 'public' && v.status.embeddable !== false && secs(v.contentDetails.duration) >= 120;
const fill = (row, v) => Object.assign(row, {
  title: decode(v.snippet.title), channel: decode(v.snippet.channelTitle), published: (v.snippet.publishedAt || '').slice(0, 10),
  thumb: thumbOf(v.snippet.thumbnails), durationSec: secs(v.contentDetails.duration), views: +(v.statistics.viewCount || 0),
  customThumb: false, verified: TODAY
});

(async () => {
  if (!KEY) { console.log('YT_API_KEY not set, nothing done'); process.exit(0); }
  const byId = Object.fromEntries(S.map(s => [s.id, s]));

  // 1. re-verify what we already have
  const have = [...new Set(T.videos.map(v => v.videoId))];
  const d = await details(have);
  for (const row of T.videos) {
    report.checked++;
    const v = d[row.videoId], s = byId[row.modelId];
    const ok = usable(v) && (!s || row.type !== 'review' || proves(family(s), decode(v.snippet.title)));
    if (!ok) { if (!row.hidden) report.hidden++; row.hidden = true; row.hiddenReason = !v ? 'not on YouTube' : !usable(v) ? 'private, Short or not embeddable' : 'title does not name the model'; continue; }
    fill(row, v); delete row.hidden; delete row.hiddenReason; report.updated++;
  }

  // 2. best recent reviews per model family
  const fams = new Map();
  for (const s of S) { const f = family(s); if (!fams.has(f.key)) fams.set(f.key, { ...f, models: [] }); fams.get(f.key).models.push(s); }
  const seen = new Set(T.videos.map(v => v.videoId));
  for (const f of fams.values()) {
    const showing = T.videos.filter(v => !v.hidden && f.models.some(m => m.id === v.modelId)).length;
    if (showing >= 3) continue;
    try {
      const r = await api('search', { part: 'snippet', q: `${f.brand} ${f.base} review`, type: 'video', regionCode: 'IN', relevanceLanguage: 'en', maxResults: '12', order: 'relevance', publishedAfter: SINCE, videoDuration: 'medium' });
      const ids = (r.items || []).map(i => i.id.videoId).filter(id => id && !seen.has(id));
      const dd = await details(ids);
      const picks = ids.map(id => dd[id]).filter(v => usable(v) && proves(f, decode(v.snippet.title)) && +(v.statistics.viewCount || 0) >= 3000)
        .sort((a, b) => +b.statistics.viewCount - +a.statistics.viewCount).slice(0, Math.max(0, 2 - Math.min(showing, 2)) || 1);
      for (const v of picks) {
        const kw = (decode(v.snippet.title).match(/(\d(?:\.\d)?)\s*kwh/i) || [])[1];
        const model = (kw && f.models.find(m => parseFloat(m.battery) === parseFloat(kw))) || f.models[0];
        T.videos.push(fill({ videoId: v.id, modelId: model.id, brandId: model.brandSlug, type: /\bvs\b|compar/i.test(v.snippet.title) ? 'comparison' : 'review', added: TODAY }, v));
        seen.add(v.id); report.added++;
      }
    } catch (e) { report.notes.push(`${f.brand} ${f.base}: ${String(e.message).slice(0, 90)}`); if (/quota/i.test(e.message)) break; }
  }

  // 3. launch and comparison videos
  for (const [q, type, brandId] of [['Ather Konarc first ride review', 'launch', 'ather-energy'], ['best electric scooter India 2026', 'comparison', null], ['electric scooter comparison India 2026', 'comparison', null]]) {
    try {
      const r = await api('search', { part: 'snippet', q, type: 'video', regionCode: 'IN', relevanceLanguage: 'en', maxResults: '10', order: 'relevance', publishedAfter: new Date(Date.now() - 180 * 864e5).toISOString(), videoDuration: 'medium' });
      const ids = (r.items || []).map(i => i.id.videoId).filter(id => id && !seen.has(id));
      const dd = await details(ids);
      const need = brandId ? /konarc/i : /scooter|ev/i;
      for (const v of ids.map(id => dd[id]).filter(v => usable(v) && need.test(v.snippet.title) && +(v.statistics.viewCount || 0) >= 3000).slice(0, 2)) {
        const m = brandId ? S.find(s => s.brandSlug === brandId && /konarc/i.test(s.name)) : null;
        T.videos.push(fill({ videoId: v.id, modelId: m ? m.id : null, brandId: brandId, type, added: TODAY }, v));
        seen.add(v.id); report.added++;
      }
    } catch (e) { report.notes.push(`${q}: ${String(e.message).slice(0, 90)}`); }
  }

  T.videosVerified = TODAY;
  fs.writeFileSync(FILE, JSON.stringify(T, null, 1) + '\n');
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/youtube.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report));
})();
