/* ============================================================
   outbound.js  |  every link that leaves escooterwale.in

   1. Links to a brand's website get UTM tags, so brands can see
      in their own analytics how many buyers we send them:
        utm_source=escooterwale  utm_medium=referral
        utm_campaign=<page type>  utm_content=<model or brand>
   2. Every outbound click is sent to Google Analytics as an
      "outbound_click" event (link type, brand, model, page type).
      Brand-site and test-ride clicks also fire "brand_click",
      which is marked as a key event in GA.
   Works on links added later by page scripts too.
   ============================================================ */
(function () {
  const G = n => { try { return eval(n); } catch (e) { return undefined; } };
  const brands = G('BRANDS_DB') || [], scooters = G('SCOOTERS_DB') || [], links = G('BRAND_LINKS') || {};
  const host = u => { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const brandHosts = {};
  brands.forEach(b => { if (b.website) brandHosts[host(b.website)] = b.id; });
  scooters.forEach(s => { if (s.brandUrl) brandHosts[host(s.brandUrl)] = s.brandSlug; });
  Object.entries(links).forEach(([id, l]) => ['testRide', 'dealer'].forEach(k => { if (l && l[k]) brandHosts[host(l[k])] = id; }));
  const brandFor = h => brandHosts[h] || Object.entries(brandHosts).find(([k]) => h.endsWith('.' + k))?.[1];

  // language pages (/hi/scooters/...) are tracked the same as English ones, with lang set
  const LANG = (location.pathname.match(/^\/(hi|mr|ta|te|kn|gu|bn|or)(?=\/|$)/) || [, 'en'])[1];
  const p = location.pathname.replace(/^\/(hi|mr|ta|te|kn|gu|bn|or)(?=\/|$)/, '') || '/';
  const pageType = p === '/' ? 'home' : (p.match(/^\/(scooters|brands|cities|best|compare|articles)\b/) || [])[1] || p.replace(/^\/|\.html$/g, '').split('/')[0] || 'home';
  const pageEntity = (p.match(/^\/(?:scooters|brands|cities|best|compare|articles)\/([^/]+)/) || [])[1] || '';

  function tag(a) {
    if (!a || !a.href || a.dataset.swTagged) return;
    const h = host(a.href);
    if (!h || h === location.hostname.replace(/^www\./, '') || h === 'escooterwale.in') return;
    a.dataset.swTagged = '1';
    const b = brandFor(h);
    if (!b) return;
    a.dataset.brand = a.dataset.brand || b;
    if (!a.dataset.out) a.dataset.out = 'brand';
    try {
      const u = new URL(a.href);
      if (!u.searchParams.has('utm_source')) {
        u.searchParams.set('utm_source', 'escooterwale');
        u.searchParams.set('utm_medium', 'referral');
        u.searchParams.set('utm_campaign', pageType);
        if (pageEntity) u.searchParams.set('utm_content', pageEntity);
        a.href = u.toString();
      }
    } catch (e) {}
  }
  function tagAll(root) { (root || document).querySelectorAll('a[href^="http"]').forEach(tag); }

  const send = (name, params) => { try { if (typeof gtag === 'function') gtag('event', name, Object.assign({ page_type: pageType, page_entity: pageEntity, lang: LANG }, params)); } catch (e) {} };

  // browses: which scooter model pages people open
  if (pageType === 'scooters' && pageEntity) {
    const s = scooters.find(x => x.id === pageEntity);
    send('scooter_view', { model: pageEntity, brand: s ? s.brandSlug : '' });
  }

  // clicks inside the site: buttons and links that stay on escooterwale.in
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('a[href],button');
    if (!el || el.closest('.mt-opt,.mt-chip,.hero-dot,.mt-step,[data-no-cta]')) return;
    const ext = el.closest('a[href^="http"]');
    if (ext && host(ext.href) !== location.hostname.replace(/^www\./, '') && host(ext.href) !== 'escooterwale.in') return; // counted as outbound_click
    const link = el.closest('a[href]'), href = (link && link.getAttribute('href')) || '';
    if (/^https?:/.test(href) && host(href) !== location.hostname.replace(/^www\./, '') && host(href) !== 'escooterwale.in') return;
    const where = el.closest('nav,.nav,.mobile-menu,.bottom-nav') ? 'nav' : el.closest('.seo-links') ? 'directory' : el.closest('footer,.footer') ? 'footer' : el.closest('.hero,.hero-content') ? 'hero' : 'content';
    const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    send('cta_click', { cta_text: text, cta_location: where, link_url: href ? href.split('?')[0].slice(0, 100) : '' });
  }, true);

  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    tag(a);
    const h = host(a.href);
    if (!h || h === location.hostname.replace(/^www\./, '')) return;
    const type = a.dataset.out || 'external';
    const params = { link_type: type, link_domain: h, link_url: a.href.split('?')[0], brand: a.dataset.brand || '', page_type: pageType, page_entity: pageEntity, lang: LANG };
    if (typeof gtag === 'function') {
      gtag('event', 'outbound_click', params);
      if (type === 'brand' || type === 'test-ride' || type === 'dealer') gtag('event', 'brand_click', params);
    }
  }, true);

  const start = () => {
    tagAll();
    try { new MutationObserver(m => m.forEach(r => r.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches && n.matches('a[href^="http"]')) tag(n); tagAll(n); } }))).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
