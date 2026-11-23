import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { serveOffhours } from '../offhours.mjs';

test('the Offhours mount isolates shelf cookies and preserves application and asset paths', async t => {
  const forwards = [];
  const server = createServer((request, response) => serveOffhours(request, response, async (target, options) => {
    forwards.push({ url: target, headers: options.headers });
    return new Response('ok', { headers: {
      'set-cookie': '__Host-offhours=sample; Path=/; HttpOnly; SameSite=Lax; Max-Age=100; Secure',
      'content-type': 'text/plain',
    } });
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const local = 'http://127.0.0.1:' + server.address().port;
  const get = (path, init) => fetch(local + path, { redirect: 'manual', ...init });
  const cookie = '__Secure-offhours-shelf=sample; other_product=private';
  const shelf = await get('/offhours/api/shelf', { headers: { cookie } });
  assert.equal(forwards.at(-1).url.pathname, '/offhours/api/shelf');
  assert.equal(forwards.at(-1).headers.get('cookie'), '__Host-offhours=sample');
  assert.match(shelf.headers.get('set-cookie'), /^__Secure-offhours-shelf=sample; Path=\/offhours; Secure; HttpOnly;/);
  assert.equal(shelf.headers.get('cache-control'), 'no-store');
  for (const [path, expected] of [
    ['/offhours', '/offhours'], ['/offhours/weekly?src=guide', '/offhours/weekly'],
    ['/offhours/_next/static/chunks/example.js', '/offhours/_next/static/chunks/example.js'],
    ['/offhours/offhours-still.webp', '/offhours-still.webp'],
  ]) {
    const result = await get(path, { headers: { cookie } });
    const last = forwards.at(-1);
    assert.equal(last.url.origin, 'https://offhours-scout.shaihazher.chatgpt.site');
    assert.equal(last.url.pathname, expected);
    assert.equal(last.headers.has('cookie'), false);
    assert.equal(result.headers.has('set-cookie'), false);
  }
  const count = forwards.length;
  const returned = await get('/offhours/access?plan=club&status=succeeded&license_key=test_key_12345');
  assert.equal(returned.status, 303);
  assert.equal(returned.headers.get('location'), '/offhours/access?plan=club#license_key=test_key_12345');
  assert.equal(returned.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(forwards.length, count);
  const rejected = await get('/offhours/api/edition', { method: 'POST', headers: { origin: 'https://other.example' } });
  assert.equal(rejected.status, 403);
  assert.equal(forwards.length, count);
  const allowed = await get('/offhours/api/edition', { method: 'POST', headers: { origin: 'https://synthworx.com' } });
  assert.equal(allowed.status, 200);
  assert.equal(forwards.at(-1).headers.get('origin'), forwards.at(-1).url.origin);
});
