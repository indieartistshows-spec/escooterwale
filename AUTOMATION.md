# How the weekly update works

Every Monday at 06:00 IST, GitHub runs **Weekly update** (`.github/workflows/weekly.yml`).
It publishes on its own. You get a GitHub issue with the summary and an undo link.

## What it updates

| What | Source | Safety rule |
|---|---|---|
| Ex-showroom price, variants, battery, claimed range, top speed, charging, boot, weight | Brand websites | Price moves over 25% or range/speed over 30%: old value kept and flagged. Battery size change: kept and flagged. Brand site unreadable: that brand skipped, others still update |
| City prices | Brand websites where they show them | Over 25% away from national price: held |
| New launches, discontinued models | Brand websites | Only after showing up (or vanishing) two weeks running |
| On-road price, EMI, subsidy eligibility | Worked out from the above + `data/subsidy.json` | Rebuilt every run |
| Titles, descriptions, taglines | Generated from the data | No dashes, same style rules |
| Headline price city | Google Analytics, most users | Switches only after leading 2 weeks by 10% |
| Demand Mein Hai | VAHAN, last month by maker | Page change on VAHAN: last month kept |
| Trending videos and articles | YouTube + Google News | Append only, nothing removed |
| Subsidy (PM E-DRIVE and states) | Weekly Claude research run, official sources only | Changes only with an official source link |
| Outbound links | Checked every week | Dead test-ride or dealer link falls back to brand homepage |
| Languages | `i18n/` translation memory | A language goes live once 98% of site text is translated |

After the build, `tools/weekly-guard.js` checks:
- **Data**: missing names, bad prices, or the catalogue shrinking by over 20% rejects the whole week's data. The site keeps last week's.
- **Pages**: a page showing "undefined"/"NaN", an empty heading, or losing over half its text goes back to last week's version.
- **Screenshots**: key pages on desktop and mobile are compared with last week. A page whose layout jumps, or that gets wider than the phone screen, goes back to last week's version.

## Undo

GitHub → **Actions** → **Rollback** → **Run workflow** → **Run workflow**.
This undoes the latest weekly update, and Vercel redeploys in about a minute. The weekly issue links straight to it.

## One-time setup (GitHub → Settings → Secrets and variables → Actions → New repository secret)

| Secret | What it is | Without it |
|---|---|---|
| `GA_PROPERTY_ID` | GA4 property ID (numbers only, Admin → Property details) | Headline city stays Hyderabad |
| `GA_SA_KEY` | Full JSON key of a Google Cloud service account. Add that account's email in GA (Admin → Property access) as **Viewer** | Same as above |
| `YT_API_KEY` | YouTube Data API v3 key (Google Cloud console, free quota is enough) | New videos are not added; news articles still are |

Also check GitHub → Settings → Actions → General → **Workflow permissions** is set to **Read and write**.

## Running it by hand

Actions → **Weekly update** → Run workflow. Untick "scrape" to only rebuild from the current `/data`.
Locally: `npm ci && node tools/build-all.js`.
