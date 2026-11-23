/* Keep a public campaign code on the links a visitor actually follows. No cookies or beacons. */
(() => {
  const page = new URL(location.href);
  const root = '/caption-desk';
  const guide = root + '/srt-revision-handoff';
  const source = page.searchParams.get('src') || (page.pathname === guide ? 'revision-guide' : '');
  if (!/^[a-z0-9][a-z0-9-]{0,44}$/.test(source)) return;
  const routes = new Set([root, root + '/', root + '/desk', root + '/intake', root + '/sample-handoff', guide]);
  for (const link of document.querySelectorAll('a[href]')) {
    if (link.getAttribute('href').startsWith('#')) continue;
    const target = new URL(link.href);
    if (target.origin === page.origin && routes.has(target.pathname)) {
      target.searchParams.set('src', source);
    } else if (target.origin === 'https://checkout.dodopayments.com' && ['buy-studio', 'buy-catalog'].includes(link.id)) {
      target.searchParams.set('metadata_caption_source', source);
      const back = new URL(target.searchParams.get('redirect_url'));
      back.searchParams.set('src', source);
      target.searchParams.set('redirect_url', back.href);
    } else {
      continue;
    }
    link.href = target.href;
  }
})();
