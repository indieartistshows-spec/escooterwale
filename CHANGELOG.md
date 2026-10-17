# escooterwale.in — v2

Drop everything in this folder into the root of `escooterwale finalv/`, overwriting.
It contains v1.1 plus the pre-render, five new pages and the corrected subsidy data.
Your `images/` folder and `styles.css` are untouched and not included.

**`styles.css` is byte-identical to what you sent me. Not one CSS rule changed.**

## Verified before shipping

Every page rendered in headless Chromium at 1280px, before and after, compared pixel by
pixel against the original zip:

| Page | Result |
|---|---|
| listings, best, city, scooter-detail, emi, yellow-brother, cases, guide-real-range, guide-battery-types, guide-service-network | **pixel-identical** |
| index | identical except the animated race-track bars, which differ between two loads of the *same* build |
| trending | shuffles its video and social cards every load, so it never matches itself either |
| article, brand, compare | taller, because they were crashing before |
| guide-subsidy | rewritten on purpose |

The six pre-rendered page types were each compared against their query-string original.
**All six are pixel-identical with zero JavaScript errors.**

Final sweep across 160 HTML files: exactly one `</head>`, one `<title>`, one meta
description, one canonical and one GA tag per page. 127 JSON-LD blocks, all valid JSON.

---

## 1. The pre-render: 138 new static pages

`/listings` used to serve *"Showing 0 electric scooters"* to any crawler that does not run
JavaScript, which is all of them except Google.

`prerender.js` loads each template in a real browser, lets your existing page JS render
exactly as it does for a visitor, and writes the resulting DOM to disk.

```
/scooters/<id>/          41 model pages
/brands/<id>/            10 brand pages
/cities/<id>/            12 city pages
/best/<cat>/              6 category pages
/articles/<id>/           3 article pages
/compare/<a>-vs-<b>/     66 comparison pages
```

Measured with JavaScript disabled:

| | Old | New |
|---|---|---|
| A model page | 788 chars of placeholder, wrong model | **3,071 chars of the right model** |
| A comparison page | did not exist | **5,814 chars** |
| A city page | did not exist | **3,045 chars** |

**How identity survives.** Each template now reads `window.__SW_ID__` (or `__SW_BRAND__`,
`__SW_CITY__`, `__SW_CAT__`, `__SW_ART__`, `__SW_A__`/`__SW_B__`) before falling back to
the query string, and `prerender.js` bakes that one line into each generated file. Without
it the scripts re-run on load, find no query string and overwrite the page with the
default scooter.

**Re-run it** whenever `data.js` changes:

```bash
npx playwright install chromium   # once
python3 -m http.server 8877       # serve the source files
node prerender.js
node build-sitemap.js
```

## 2. Internal links now point at the new paths

Nav, footer, cards, the compare tray and every hardcoded link were rewritten from
`listings.html` and `scooter-detail.html?id=X` to `/listings` and `/scooters/X/`.

This was not cosmetic. Nav links were relative, so on `/scooters/<id>/` a link to
`listings.html` resolved to `/scooters/<id>/listings.html` and 404'd. Same for image paths
in `data.js`, which are now root-absolute. Both had to change for the pre-render to work
at all.

`vercel.json` gains 35 redirects, including query-string captures so every indexed URL
lands on its new home:

```json
{ "source": "/scooter-detail",
  "has": [{ "type": "query", "key": "id", "value": "(?<sid>[^&]+)" }],
  "destination": "/scooters/:sid/", "permanent": true }
```

## 3. Subsidy guide rewritten against verified August 2026 data

Your Search Console shows `guide-subsidy` earning **58% of all site clicks**. It was also
the page with the most wrong numbers on it.

**PM E-DRIVE was amended on 10 August 2026**, fourteen days before this pack was built.
The scheme now runs to **31 March 2028**, the outlay rose to ₹11,900 crore, and the
two-wheeler allocation went from ₹1,772 crore to ₹2,767 crore.

The rate had already halved to **₹2,500/kWh capped at ₹5,000** on 1 April 2025. Your page
said ₹5,000/kWh capped at ₹10,000.

State figures corrected:

| Page said | Reality |
|---|---|
| Gujarat ₹30,000 | **Zero.** Policy expired, subsidy pulled from the e-VEG portal around Oct 2023 |
| Karnataka ₹20,000 | **Zero.** Supply-side policy only |
| Telangana ₹15,000 | **Zero.** Tax exemption only, and it expires 31 Dec 2026 |
| Tamil Nadu ₹15,000 | **Zero.** Road tax exempt to 31 Dec 2027 |
| Maharashtra ₹15,000 | Up to **₹10,000** |
| Delhi ₹40,000 | **₹45,000** with scrappage, ₹35,000 without |

The sidebar calculator was rebuilt with real per-state values and an explanation line for
each, instead of five invented bands.

## 4. Five new pages, built from your own data

| Page | Targets | Current position |
|---|---|---|
| `/guide-subsidy-deadlines` | "ev scooter subsidy last date" cluster | 222 impressions at pos 10, **no page existed** |
| `/guide-subsidy-eligibility` | "how much subsidy on X" | generated from `data.js` |
| `/guide-subsidy-claim` | "how to claim / apply" cluster | 525 impressions at pos 9.5 |
| `/electric-scooter-price` | "electric scooter price" cluster | **3,827 impressions at pos 21.7**, your biggest untapped pool |
| `/guide-battery-chemistry` | "chetak battery type nmc or lfp" | 147 impressions at **pos 7.1 with zero clicks** |

Two carry things nobody else in Indian EV publishing has:

**The eligibility page** runs all 41 models against the ₹1.5 lakh ex-factory ceiling. Four
get nothing: Ather 450 Apex, Ola S1 Pro+ 5.2, TVS iQube ST 5.3, Ather 450X. Three get less
than ₹5,000 on battery size. Four more sit within ₹8,000 of the cliff. It also makes the
point that at ₹2,500/kWh with a ₹5,000 cap, the per-kWh rate stops mattering above 2 kWh,
so every eligible scooter gets the identical ₹5,000.

**The chemistry page** covers all 41 models in `battery-chemistry.js`: 21 NMC, 6 LFP, 1
supply-dependent, and **13 where the manufacturer does not publish it**. Bajaj is the
notable one. Its FAQs say only "advanced chemistry Lithium Ion cells". Every site that
states the Chetak is NMC is repeating an unsourced claim, so we print "Not published"
instead. That honesty is the reason to trust the other 28 rows.

Each new page carries `Article`, `BreadcrumbList` and `FAQPage` schema. The claim page
adds `HowTo`, the price page adds a 41-item `ItemList`.

## 5. Google Analytics

`G-NZ5QX4MXYX` sits on **line 5 of every page**, immediately after `<head>` as Google
specifies, exactly once each. Verified in a browser: one loader script, `gtag` defined,
correct measurement ID, no JS errors. `<meta charset>` still lands inside the first 1KB on
every page.

## 6. Smaller fixes

- `data.js` stored prices in western grouping (`₹184,999`). All new pages render Indian
  grouping (`₹1,84,999`) from the raw number instead. See `OPEN-ITEMS.md` section F for
  the optional sitewide fix.
- `compare.html` no longer auto-scrolls on cold load, and `history.replaceState` no longer
  rewrites a clean pre-rendered URL back to a query string.
- `guide-shell.template` is the build template for the new guide pages. It is deliberately
  not a `.html` file so it can never be served as a page.
- `absolutise()` in `prerender.js` skips `<script>` and `<style>` *contents* while still
  rewriting their opening tags. Without that split it corrupts template literals like
  `url('${models[0].heroImg}')` into a protocol-relative URL; skipping the whole block
  instead 404s `<script src="data.js">` on deep pages. Both were caught in testing. The
  comments in the file explain why it looks fussy.

## 7. Generated files

`sitemap.xml` is now **155 URLs**, every one verified to resolve to a real file. It was 18
URLs, 14 of which were 404s.

```bash
node prerender.js       # after any data.js change
node build-sitemap.js   # reads .prerender-manifest.json so the two never drift
node build-schema.js
node build-guides.js
node build-llms.js
```

---

## Deploy checklist

1. Copy this folder over your project root.
2. Deploy. Spot-check `/scooters/ather-energy-450x-3point7-kwh/`, `/guide-subsidy` and
   `/electric-scooter-price`.
3. Confirm `/scooter-detail?id=ather-energy-450x-3point7-kwh` 301s to the new path.
4. Search Console → Sitemaps → resubmit `https://www.escooterwale.in/sitemap.xml`.
5. Run `/listings` and `/guide-real-range` through validator.schema.org.
6. Read `OPEN-ITEMS.md`. The 38 orphaned model reviews are still the largest block of
   unused content you own, and I need your answers to fix them.
