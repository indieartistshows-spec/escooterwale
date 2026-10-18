# Still open

Everything with one correct answer is done. These need a decision from you, or a phone
call I cannot make.

---

## A. 38 of your 41 model pages have no long-form review

Still the largest item on the list. Now that every model has its own URL at
`/scooters/<id>/`, the thin content is more exposed, not less.

`scooter-detail.html` holds 19 extended reviews keyed by scooter ID, some over 400 words.
**Three keys match `data.js`. Sixteen do not**, because they use slugs from an older
version of the database.

| Orphaned key | What is in `data.js` now |
|---|---|
| `tvs-iqube-st` | 4 iQube variants. Which one? |
| `bajaj-chetak` | 5 Chetak variants |
| `hero-vida-v1` | V1 dropped. Now VX2 Go, VX2 Plus, V2 Pro |
| `ola-s1-air` | S1 Air dropped. Closest: S1 X 3 kWh, S1 X+ 4 kWh |
| `ather-rizta` | Rizta S 2.9 and Rizta Z 3.7 |
| `ampere-primus` | Not in the database. Closest: Nexus ST |
| `ampere-magnus-ex` | Magnus Neo 2.3 and Magnus G Max 3.0 |
| `ampere-zeal-ex` | Not in the database |
| `okinawa-praise-pro` | Not in the database. Closest: Okhi-90 |
| `simple-one` | Simple Energy is not in the database. See B |
| `honda-activa-electric` | Honda is not a brand you carry |
| `revolt-rv400`, `tork-kratos-r`, `raptee-t30`, `matter-aera` | Motorcycles, no brand entry |

`bgauss-d15i` and `bounce-infinity-e1` were unambiguous and are already remapped.

**Send me one line per row**, either the correct model ID or "delete". The remap is ten
minutes and it takes 38 pages from a one-line verdict to real editorial depth.

---

## B. Six models were removed from `data.js`, their images were not

Still sitting in `images/`:

```
simple-energy-simple-one-5.0-kwh.jpg      okaya-ev-freedum-1.5-kwh.avif
simple-energy-simple-one-s-4.5-kwh.jpg    okaya-ev-faast-f2b-2.2-kwh.avif
                                          okaya-ev-faast-f4-3.0-kwh.webp
                                          okaya-ev-motofaast-3.5-kwh.avif
```

`listings.html` still carries search keywords for all six and brand filter rules for
`simple-energy` and `okaya-ev`. It also means the Simple One, which your own Best Range
page calls India's number-one long-range scooter, cannot be viewed, compared or bought
anywhere on the site.

Either send me the specs and I write the six `data.js` entries, taking you to 47 models
and fixing section C at the same time, or say the word and I purge the references and
delete the images. I would add them back.

---

## C. Holes in two ranked lists on `/best/`

Now visible at `/best/best-range/` and `/best/under-1-lakh/`.

**Best Range** ranks `simple-energy-simple-one-5point0-kwh` at number one. It does not
exist, so the top pick renders as nothing and the list starts at #2. The `seoDesc` and the
closing recommendation both name the Simple One too. Section B fixes this.

**Under ₹1 Lakh** ranks `ampere-zeal-ex` at number two, described as "At ₹64,999… the
cheapest real full-speed EV scooter". No such model. The candidates:

| Candidate | Price | Top speed | Matches the copy? |
|---|---|---|---|
| Ampere Reo 1.3 kWh | ₹59,900 | 45 km/h | Price close, but 45 km/h is not "full-speed" |
| Ampere Magnus Neo 2.3 kWh | ₹79,999 | 65 km/h | Speed closer, price ₹15k off |

Neither fits what you wrote, so I did not substitute one. Tell me which you meant and I
will fix the ID and the price in the copy together.

The final-recommendation block also points at `ola-s1-air` and `ampere-magnus-ex`, so its
two CTA buttons render empty and the compare link below them goes nowhere.

---

## D. `AggregateRating` and the 42,000 review counts

Your only Search Console rich result is **Review snippet, 271 impressions**. It comes from
the `AggregateRating` that `compare.html` injects at runtime, built on the `rating` and
`reviews` fields in `data.js`.

If those counts are not first-party reviews collected on escooterwale.in, publishing them
as `AggregateRating` breaks Google's review snippet policy and risks a manual action
against your structured data.

**I left `AggregateRating` out of every schema block I wrote.** The listings ItemList and
the new pages publish ScootScore as a `Review` with your own `Rating` and a stated
`ratingExplanation`, which is fully defensible. But `compare.html` still injects the old
one.

Three ways forward:

1. Confirm the counts are first-party and I add it back with a visible source line.
2. They come from elsewhere. Keep them as page content, cite the source, never mark up.
3. Drop them and let ScootScore carry the rating story.

Option 3 is cleanest and the better positioning. "Our own 0-10 score, five published
components, no brand money" beats a borrowed star average every competitor also shows.

---

## E. Four subsidy facts I could not confirm from a primary source

Each is commercially material and each needs a phone call:

- **Gujarat motor vehicle tax after 1 April 2026.** The 1% concessional rate was valid to
  31 March 2026. Two low-quality blogs contradict each other and there is no notification
  either way. Call a Gujarat RTO.
- **Punjab policy validity.** EVreporter says three years from February 2023, which means
  it died in February 2026. Other summaries say five. The investpunjab 2026 PDF is
  unfetchable and appears to be manufacturing-only.
- **Uttar Pradesh "Made in UP" condition.** One source says the reinstated road tax
  exemption requires a UP manufacturing certificate, which would exclude most national
  OEMs. Another says all pure EVs qualify.
- **Delhi two-wheeler scrappage bonus.** Two sources report ₹10,000. The notification
  report does not mention it. The guide currently presents ₹45,000 as the Delhi maximum on
  that basis. Verify before you promote the number.

The pages say "Last verified 24 August 2026" and describe their sourcing, so they are
honest as they stand. But these four are the ones to nail down.

---

## F. Optional: fix the price formatting sitewide

`data.js` stores `priceDisplay` in western grouping (`₹184,999`) rather than Indian
(`₹1,84,999`). The five new pages render Indian grouping from the raw `price` number, so
the site is currently inconsistent between old and new pages.

One line fixes it everywhere:

```js
SCOOTERS_DB.forEach(s => {
  s.priceDisplay  = '₹' + s.price.toLocaleString('en-IN');
  s.onRoadDisplay = '₹' + s.onRoad.toLocaleString('en-IN');
});
```

I did not apply it because it changes visible text on every existing page and you asked me
not to move anything. Say the word and it is a two-minute job.

---

## G. Not code, and worth more than most code

- **Named authors.** Everything is bylined "EScooterwale Editorial" or "EScooterwale Test
  Team". Answer engines weight named people with stated credentials. One page introducing
  who runs the range tests would feed `Person` schema and help more than a month of
  technical work.
- **Outbound citations.** The subsidy guide now describes its sources in prose but still
  does not link the MHI or VAHAN portals. Linking primary sources is one of the strongest
  signals that a page deserves quoting.
- **A permanent methodology page.** The range test describes its conditions inline, which
  is good. A standalone methodology page that every test links back to is what turns "a
  site that ran a range test" into "the source for Indian EV range data".
- **Microsoft Clarity** is still only on `index.html`. You have no session recordings for
  the subsidy guide that earns 58% of your clicks. Say the word and it goes on all of them.

---

## What I would do next, in order

1. Deploy this, resubmit the sitemap, and let the duplicate-URL consolidation land. That
   alone should move a lot, given 84% of your impressions were split across URL pairs.
2. Send me the section A mapping. Highest value per minute of your time on this list.
3. Decide on section B, which unblocks C.
4. Write the four city pages properly: Chennai (495 impressions, pos 14.7), Hyderabad
   (366), Mumbai (266), Delhi. The template works. The copy is what is thin.
5. Per-state subsidy pages, starting with Tamil Nadu and Maharashtra.
