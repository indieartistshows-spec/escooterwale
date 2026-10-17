/* ============================================================
   automation/vahan.js
   Refreshes data/ev-sales.json (the homepage "Demand Mein Hai"
   leaderboard) with last month's electric two-wheeler
   registrations by maker from the VAHAN dashboard.

   VAHAN is a JSF/PrimeFaces app with no public API, so this drives
   the report page in a browser: Y axis = Maker, X axis = Month,
   vehicle category = two-wheelers, fuel = electric. If anything
   about the page has changed, it leaves the current data alone and
   reports it; the weekly Claude research run then fills the month
   from published VAHAN/FADA figures instead.

   Only runs the full scrape when the stored month is older than
   last month, so it does real work once a month.
   ============================================================ */
const fs = require('fs');
const { chromium } = require('playwright');
const FILE = 'data/ev-sales.json';
const cur = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const report = { ok: false, note: '' };

const now = new Date();
const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
const wantMonth = last.toISOString().slice(0, 7);
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const LABEL = last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/* VAHAN maker names -> our brands */
const MAKERS = [
  [/TVS MOTOR/i, 'TVS', 'tvs-motor'], [/BAJAJ AUTO/i, 'Bajaj Chetak', 'bajaj-chetak'], [/ATHER/i, 'Ather', 'ather-energy'],
  [/HERO MOTOCORP/i, 'Hero Vida', 'hero-vida'], [/OLA ELECTRIC/i, 'Ola Electric', 'ola-electric'], [/GREAVES/i, 'Ampere', 'ampere'],
  [/RIVER/i, 'River', null], [/BGAUSS|RR GLOBAL/i, 'BGauss', 'bgauss'], [/BOUNCE/i, 'Bounce Infinity', 'bounce-infinity'],
  [/OKINAWA/i, 'Okinawa', 'okinawa'], [/PURE ENERGY|PUR ENERGY/i, 'Pure EV', 'pure-ev'], [/HONDA/i, 'Honda', null],
  [/SUZUKI/i, 'Suzuki', null], [/KINETIC GREEN/i, 'Kinetic Green', null], [/E-SPRINTO|ESPRINTO/i, 'E-Sprinto', null],
  [/QUANTUM/i, 'Quantum', null], [/REVOLT/i, 'Revolt', null], [/ULTRAVIOLETTE/i, 'Ultraviolette', null], [/OBEN/i, 'Oben', null]
];

async function scrape() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  try {
    await page.goto('https://vahan.parivahan.gov.in/vahan4dashboard/vahan/view/reportview.xhtml', { waitUntil: 'networkidle', timeout: 90000 });
    const pick = async (labelRe, optionRe) => {
      const menus = await page.$$('.ui-selectonemenu');
      for (const m of menus) {
        const lbl = await m.evaluate(el => (el.querySelector('label') || {}).textContent || '');
        const near = await m.evaluate(el => (el.closest('div,td') || el).parentElement.innerText || '');
        if (!labelRe.test(lbl + ' ' + near)) continue;
        await m.click(); await page.waitForTimeout(500);
        const items = await page.$$('.ui-selectonemenu-items-wrapper:visible li');
        for (const it of items) { if (optionRe.test(await it.innerText())) { await it.click(); await page.waitForTimeout(1500); return true; } }
      }
      return false;
    };
    await pick(/y-?axis/i, /^maker$/i);
    await pick(/x-?axis/i, /month/i);
    await pick(/year/i, new RegExp('^' + last.getUTCFullYear() + '$'));
    // left filter panel: vehicle category and fuel
    const tick = async re => { const el = await page.$(`label:text-matches("${re}", "i")`); if (el) { await el.click(); await page.waitForTimeout(400); } };
    await tick('TWO WHEELER\\(NT\\)'); await tick('TWO WHEELER\\(T\\)');
    await tick('ELECTRIC\\(BOV\\)');
    const refresh = await page.$('button:has-text("Refresh"), a:has-text("Refresh")');
    if (refresh) { await refresh.click(); await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(3000); }
    // read the table: header row has month names, body rows have maker + counts
    const table = await page.evaluate(() => {
      const t = [...document.querySelectorAll('table')].find(x => /MAKER/i.test(x.innerText) && /JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/.test(x.innerText));
      if (!t) return null;
      return [...t.querySelectorAll('tr')].map(r => [...r.querySelectorAll('th,td')].map(c => c.innerText.trim()));
    });
    if (!table) throw new Error('report table not found');
    const head = table.find(r => r.some(c => /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i.test(c)));
    const col = head.findIndex(c => c.toUpperCase() === MONTHS[last.getUTCMonth()]);
    if (col < 0) throw new Error('month column not found');
    const tally = new Map(); let total = 0;
    for (const r of table) {
      const maker = r.find(c => /[A-Z]{3,}/.test(c) && !/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|TOTAL|MAKER)$/i.test(c));
      const v = parseInt(String(r[col] || '').replace(/,/g, ''), 10);
      if (!maker || !v) continue;
      total += v;
      const m = MAKERS.find(([re]) => re.test(maker));
      const key = m ? m[1] : maker;
      const prev = tally.get(key) || { name: m ? m[1] : maker.replace(/\b(PVT|PRIVATE|LTD|LIMITED|INDIA|COMPANY|CO)\b\.?/gi, '').trim(), brandId: m ? m[2] : null, units: 0 };
      prev.units += v; tally.set(key, prev);
    }
    if (total < 50000) throw new Error(`total ${total} looks incomplete`);
    return { total, brands: [...tally.values()].sort((a, b) => b.units - a.units).slice(0, 12) };
  } finally { await browser.close(); }
}

(async () => {
  if (cur.month >= wantMonth) { report.ok = true; report.note = `already have ${cur.monthLabel}`; }
  else {
    try {
      const r = await scrape();
      Object.assign(cur, { month: wantMonth, monthLabel: LABEL, total: r.total, brands: r.brands, checked: now.toISOString().slice(0, 10),
        source: 'VAHAN registrations', note: 'Electric two-wheelers, all states on VAHAN. Telangana registers outside VAHAN and is not included.' });
      fs.writeFileSync(FILE, JSON.stringify(cur, null, 2) + '\n');
      report.ok = true; report.note = `updated to ${LABEL}: ${r.brands.slice(0, 3).map(b => b.name + ' ' + b.units).join(', ')}`;
    } catch (e) { report.note = `VAHAN scrape failed, kept ${cur.monthLabel}: ${String(e.message || e).slice(0, 150)}`; }
  }
  fs.mkdirSync('automation/out', { recursive: true });
  fs.writeFileSync('automation/out/vahan.json', JSON.stringify(report, null, 1));
  console.log('vahan:', report.note);
})();
