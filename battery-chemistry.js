/* ============================================================
   battery-chemistry.js — cell chemistry per model.
   Researched 24 August 2026 against manufacturer spec sheets and
   trade press. "Not published" is used deliberately: several
   brands do not disclose chemistry, and guessing on a public page
   would be worse than saying so.
   ============================================================ */

const CHEM = {
  // ── Ola Electric: NMC throughout. LG 21700 cells, moving to
  //    Ola's own 4680 "Bharat Cell", also NMC.
  'ola-electric-s1-x-2-kwh':            { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'EVreporter pack teardown; Ola battery warranty page', conf: 'High' },
  'ola-electric-s1-x-3-kwh':            { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'EVreporter pack teardown', conf: 'High' },
  'ola-electric-s1-xplus-4-kwh':        { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'EVreporter pack teardown', conf: 'Medium-High' },
  'ola-electric-s1-pro-3-kwh':          { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'EVreporter pack teardown', conf: 'Medium-High' },
  'ola-electric-s1-pro-4-kwh':          { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'EVreporter pack teardown', conf: 'Medium-High' },
  'ola-electric-s1-proplus-5point2-kwh':{ chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'Ola Bharat Cell Platform, stated as NMC 4680', conf: 'High' },

  // ── Ather: NMC across the 450 range. LFP introduced on Rizta
  //    from July 2026, supply-dependent, buyer cannot choose.
  'ather-energy-450s-2point9-kwh':      { chem: 'NMC', removable: false, warranty: '5 yr / 60,000 km', src: 'Autocar India, July 2026', conf: 'High' },
  'ather-energy-450x-3point7-kwh':      { chem: 'NMC', removable: false, warranty: '5 yr / 60,000 km', src: 'Autocar India, July 2026', conf: 'High' },
  'ather-energy-450-apex-3point7-kwh':  { chem: 'NMC', removable: false, warranty: '5 yr / 60,000 km', src: 'Autocar India, July 2026', conf: 'High' },
  'ather-energy-rizta-s-2point9-kwh':   { chem: 'LFP or NMC', removable: false, warranty: '5 yr / 60,000 km', src: 'Autocar India / Rushlane, July 2026', conf: 'High', note: 'Ather began fitting LFP to the smaller Rizta pack in July 2026. Which chemistry you get depends on supply and cannot be specified at order.' },
  'ather-energy-rizta-z-3point7-kwh':   { chem: 'NMC', removable: false, warranty: '5 yr / 60,000 km', src: 'Autocar India / Rushlane', conf: 'Medium', note: 'Autocar and Rushlane report NMC on the larger pack. Team-BHP reports LFP is also possible. Treat as NMC unless the dealer confirms otherwise.' },

  // ── TVS: NMC, stated by TVS Motor.
  'tvs-motor-iqube-2point2-kwh':        { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'TVS Motor FAQ', conf: 'High' },
  'tvs-motor-iqube-s-3point5-kwh':      { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'TVS Motor FAQ', conf: 'High' },
  'tvs-motor-iqube-st-3point5-kwh':     { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'TVS Motor FAQ', conf: 'High' },
  'tvs-motor-iqube-st-5point3-kwh':     { chem: 'NMC', removable: false, warranty: '3 yr / 50,000 km', src: 'TVS Motor FAQ', conf: 'High' },

  // ── Bajaj: deliberately undisclosed. The widely repeated
  //    "Chetak = NMC" claim traces to aggregators, not Bajaj.
  'bajaj-chetak-chetak-c2501-2point5-kwh': { chem: 'Not published', removable: false, warranty: '3 yr / 50,000 km', src: 'Chetak FAQs say only "advanced chemistry Lithium Ion cells"', conf: '—' },
  'bajaj-chetak-chetak-3001-3point0-kwh':  { chem: 'Not published', removable: false, warranty: '3 yr / 50,000 km', src: 'Chetak FAQs', conf: '—' },
  'bajaj-chetak-chetak-3501-3point5-kwh':  { chem: 'Not published', removable: false, warranty: '3 yr / 50,000 km', src: 'Chetak FAQs', conf: '—' },
  'bajaj-chetak-chetak-3502-3point5-kwh':  { chem: 'Not published', removable: false, warranty: '3 yr / 50,000 km', src: 'Chetak FAQs', conf: '—' },
  'bajaj-chetak-chetak-3503-3point5-kwh':  { chem: 'Not published', removable: false, warranty: '3 yr / 50,000 km', src: 'Chetak FAQs', conf: '—' },

  // ── Hero Vida: chemistry never stated. Removability is the
  //    headline feature instead.
  'hero-vida-vx2-go-2point2-kwh':       { chem: 'Not published', removable: true, warranty: '3 yr, extendable to 5 yr / 60,000 km', src: 'Vida product pages', conf: '—' },
  'hero-vida-vx2-plus-3point4-kwh':     { chem: 'Not published', removable: true, warranty: '3 yr, extendable to 5 yr / 60,000 km', src: 'Vida product pages', conf: '—' },
  'hero-vida-v2-pro-3point94-kwh':      { chem: 'Not published', removable: true, warranty: '3 yr, extendable to 5 yr / 60,000 km', src: 'Vida product pages', conf: '—' },

  // ── Ampere: LFP confirmed on Nexus and Magnus. Reo not stated.
  'ampere-reo-1point3-kwh':             { chem: 'Not published', removable: false, warranty: 'Not stated for this model', src: 'ampere-electric.com', conf: '—' },
  'ampere-magnus-neo-2point3-kwh':      { chem: 'LFP', removable: false, warranty: '5 yr / 75,000 km', src: 'Ampere product page', conf: 'High' },
  'ampere-magnus-g-max-3point0-kwh':    { chem: 'LFP', removable: false, warranty: '5 yr / 75,000 km', src: 'Ampere product page', conf: 'High' },
  'ampere-nexus-ex-3-kwh':              { chem: 'LFP', removable: false, warranty: '5 yr / 75,000 km', src: 'Ampere product page; Autocar Professional', conf: 'High' },
  'ampere-nexus-st-3-kwh':              { chem: 'LFP', removable: false, warranty: '5 yr / 75,000 km', src: 'Ampere product page; Autocar Professional', conf: 'High' },

  // ── Okinawa: brand-level statement that its scooters use NMC.
  //    Not a per-model spec line, so worded as a brand claim.
  'okinawa-r30-0point8-kwh':            { chem: 'NMC', removable: true, warranty: '36 months, no km cap', src: 'Okinawa states its scooters use NMC cells', conf: 'High' },
  'okinawa-lite-1point2-kwh':           { chem: 'NMC', removable: true, warranty: '36 months, no km cap', src: 'Okinawa brand statement', conf: 'Medium-High' },
  'okinawa-ipraiseplus-2point2-kwh':    { chem: 'NMC', removable: true, warranty: '36 months, no km cap', src: 'Okinawa brand statement', conf: 'Medium' },
  'okinawa-ridgeplus-2point8-kwh':      { chem: 'NMC', removable: true, warranty: '36 months, no km cap', src: 'Okinawa brand statement', conf: 'Medium' },
  'okinawa-okhi-90-2point8-kwh':        { chem: 'NMC', removable: false, warranty: '36 months, no km cap', src: 'Okinawa brand statement', conf: 'Medium' },

  // ── Pure EV: not disclosed.
  'pure-ev-epluto-7g-2point0-kwh':      { chem: 'Not published', removable: true, warranty: 'Sources conflict: 5 yr or 10 yr / 50,000 km', src: 'Pure EV product page and FAQ disagree', conf: '—' },
  'pure-ev-etranceplus-4point5-kwh':    { chem: 'Not published', removable: false, warranty: 'Not clearly stated', src: 'Pure EV product page', conf: '—' },
  'pure-ev-etron-plus-3point0-kwh':     { chem: 'Not published', removable: false, warranty: 'Not clearly stated', src: 'Pure EV product page', conf: '—' },

  // ── Bounce: NMC, swappable. Source is the brand's own blog.
  'bounce-infinity-infinity-e1-2point0-kwh':      { chem: 'NMC', removable: true, warranty: 'Not published', src: 'Bounce Infinity blog', conf: 'Medium-High' },
  'bounce-infinity-infinity-e1-plus-2point5-kwh': { chem: 'NMC', removable: true, warranty: 'Not published', src: 'Bounce Infinity blog', conf: 'Medium-High' },

  // ── BGauss: LFP confirmed on C12i and RUV. D15i not stated.
  'bgauss-c12i-2point0-kwh':            { chem: 'LFP', removable: true, warranty: '3 yr / 36,000 km', src: 'BGauss C12 spec sheet PDF', conf: 'High' },
  'bgauss-d15i-3point0-kwh':            { chem: 'Not published', removable: true, warranty: '3 yr / 36,000 km', src: 'Autocar India; BGauss lists "lithium-ion" only', conf: '—' },
  'bgauss-ruv-350i-3point0-kwh':        { chem: 'LFP', removable: false, warranty: '3 yr battery and motor', src: 'Autocar India review; BGauss product page', conf: 'Medium-High' }
};

module.exports = { CHEM };
