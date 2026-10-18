/* tools/emoji.js | the site's emoji rule: only stars, fire, lightning and energy symbols stay.
   Everything else that renders as an emoji (hearts, faces, objects, flags) is dropped.
   Plain UI glyphs (arrows, tick, cross, menu) are left alone, as are the few functional icons
   (search, sound toggle, language globe).
   Used by tools/strip-emoji.js (sources) and tools/build-data.js (data the weekly automation
   brings in), so emoji cannot creep back in through new content. */
const KEEP = new Set(['⚡', '🔥', '★', '☆', '⭐', '🌟', '🔋', '🔌', '🪫', '🔍', '🔇', '🔊', '🌐', '✓', '✔', '✕', '✖', '✗', '☰']);
// one emoji with its variation selector, skin tone, keycap and joined parts (👨‍👩‍👧 is one match)
const BASE = '[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{2300}-\\u{23FF}]';
const EMOJI = new RegExp(`${BASE}(?:\\u{FE0F}|\\u{20E3}|[\\u{1F3FB}-\\u{1F3FF}])*(?:\\u{200D}${BASE}(?:\\u{FE0F}|[\\u{1F3FB}-\\u{1F3FF}])*)*`, 'u');
const WORD = /[\p{L}\p{N}\p{M}]/u;
const isDropped = e => !KEEP.has([...e][0]);
const ALL = new RegExp(EMOJI.source, 'gu'), LEAD = new RegExp(`^(?:${EMOJI.source}\\s*)+`, 'u');
// for a piece of text: drop emoji, and the space they leave at the start, end or in the middle
function strip(s) {
  if (typeof s !== 'string' || !ALL.test(s)) return s;
  ALL.lastIndex = 0;
  return s.replace(new RegExp(`(${EMOJI.source}) `, 'gu'), (m, e) => isDropped(e) ? '' : m)
    .replace(new RegExp(` (${EMOJI.source})$`, 'u'), (m, e) => isDropped(e) ? '' : m)
    .replace(ALL, (e, i, all) => !isDropped(e) ? e : WORD.test(all[i - 1] || '') && WORD.test(all[i + e.length] || '') ? ' ' : '');
}
const stripDeep = v => typeof v === 'string' ? strip(v) : Array.isArray(v) ? v.map(stripDeep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripDeep(x)])) : v;
module.exports = { strip, stripDeep, isDropped, EMOJI, KEEP };
