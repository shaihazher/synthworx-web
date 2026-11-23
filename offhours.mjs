import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const mount = '/offhours';
const publicOrigin = 'https://synthworx.com';
const siteOrigin = 'https://offhours-scout.shaihazher.chatgpt.site';
const shelfCookie = '__Secure-offhours-shelf';
const upstreamCookie = '__Host-offhours';
const staticPath = /^\/(?:_next\/static\/|fonts\/|favicon\.svg$|offhours-still\.webp$|robots\.txt$)/;
const privateApi = new Set(['/api/edition', '/api/shelf', '/api/club']);

function finish(response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(message);
}

export async function serveOffhours(request, response, fetchSite = fetch) {
  const incoming = new URL(request.url, publicOrigin);
  if (incoming.pathname !== mount && !incoming.pathname.startsWith(mount + '/')) {
    return finish(response, 404, 'Page not found.');
  }
  const path = incoming.pathname.slice(mount.length) || '/';
  const post = request.method === 'POST';
  if (!['GET', 'HEAD', 'POST'].includes(request.method) || (post && !path.startsWith('/api/'))) {
    return finish(response, 405, 'Method not allowed.');
  }
  if (post && request.headers.origin && request.headers.origin !== publicOrigin) {
    return finish(response, 403, 'Open Offhours Scout on Synthworx to continue.');
  }
  // Checkout sometimes appends buyer details. Only the plan and activation key are used.
  // Put the key in a browser fragment so it is never sent on the second request.
  if (path === '/access' && !post && [...incoming.searchParams.keys()].some(key => key !== 'plan')) {
    const club = incoming.searchParams.get('plan') === 'club';
    const key = incoming.searchParams.get('license_key') || '';
    const fragment = /^[A-Za-z0-9_-]{12,180}$/.test(key) ? '#license_key=' + encodeURIComponent(key) : '';
    response.writeHead(303, {
      Location: mount + '/access' + (club ? '?plan=club' : '') + fragment,
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    });
    return response.end();
  }

  const asset = staticPath.test(path);
  const target = new URL(siteOrigin);
  target.pathname = asset && !path.startsWith('/_next/static/') ? path : incoming.pathname.replace(/\/$/, '');
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url', 'range', 'if-none-match', 'if-modified-since']) {
    if (request.headers[name]) headers.set(name, request.headers[name]);
  }
  if (post && request.headers.origin) headers.set('origin', siteOrigin);
  if (path === '/api/desk' && request.headers.authorization) headers.set('authorization', request.headers.authorization);
  if (privateApi.has(path)) {
    const item = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(shelfCookie + '='));
    if (item) headers.set('cookie', upstreamCookie + item.slice(shelfCookie.length));
  }

  try {
    const upstream = await fetchSite(target, {
      method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(25000),
      ...(post ? { body: request, duplex: 'half' } : {}),
    });
    const output = new Headers({
      'Cache-Control': asset && upstream.ok ? (upstream.headers.get('cache-control') || 'public, max-age=3600') : 'no-store',
      'Referrer-Policy': path === '/access' || path === '/go' ? 'no-referrer' : 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    for (const name of ['content-type', 'vary', 'etag', 'last-modified', 'content-range', 'accept-ranges', 'content-language']) {
      if (upstream.headers.has(name)) output.set(name, upstream.headers.get(name));
    }
    const location = upstream.headers.get('location');
    if (location) {
      const dest = new URL(location, target);
      if (dest.origin === siteOrigin) {
        const route = dest.pathname === mount || dest.pathname.startsWith(mount + '/') ? dest.pathname : mount + dest.pathname;
        output.set('location', route + dest.search + dest.hash);
      } else if (dest.protocol === 'https:' && ['checkout.dodopayments.com', 'customer.dodopayments.com'].includes(dest.hostname)) {
        output.set('location', dest.href);
      } else {
        await upstream.body?.cancel();
        return finish(response, 502, 'The destination could not be reached.');
      }
    }
    if (path === '/api/shelf') {
      const set = upstream.headers.getSetCookie().find(value => value.startsWith(upstreamCookie + '='));
      if (set) {
        const value = set.split(';')[0].slice(upstreamCookie.length + 1);
        const age = /;\s*Max-Age=(\d+)/i.exec(set)?.[1] || '0';
        output.set('set-cookie', shelfCookie + '=' + value + '; Path=/offhours; Secure; HttpOnly; SameSite=Lax; Max-Age=' + age);
      }
    }
    response.writeHead(upstream.status, Object.fromEntries(output));
    if (request.method === 'HEAD' || !upstream.body) return response.end();
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch {
    if (!response.headersSent) finish(response, 503, 'Offhours Scout is temporarily unavailable. Please try again.');
    else response.destroy();
  }
}
