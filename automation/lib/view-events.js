/* automation/lib/view-events.js | GA filter for "a scooter was viewed".
   Since Oct 2026 every model has its own GA event (data/scooters.json gaEvent, e.g. ath_450s_29),
   each carrying the model id in the "model" parameter. Reports filter on all those event names,
   plus the old single "scooter_view" event so earlier weeks still count. */
const fs = require('fs');
const VIEW_EVENTS = [...new Set(JSON.parse(fs.readFileSync('data/scooters.json', 'utf8')).map(s => s.gaEvent).filter(Boolean)), 'scooter_view'];
const viewFilter = () => ({ filter: { fieldName: 'eventName', inListFilter: { values: VIEW_EVENTS } } });
module.exports = { VIEW_EVENTS, viewFilter };
