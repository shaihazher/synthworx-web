import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import test from 'node:test';
import { captionIntake } from '../caption-intake.mjs';

test('Caption Desk email links identify the product in the shared mailbox', async () => {
  for (const page of ['index', 'desk', 'intake', 'order']) {
    const html = await readFile('dist/caption-desk/' + page + '.html', 'utf8');
    const links = [...html.matchAll(/href="(mailto:hello@synthworx\.com[^"]*)"/gi)];
    assert.ok(links.length, page);
    for (const [, url] of links) assert.match(new URL(url).searchParams.get('subject'), /^Caption Desk\b/i);
  }
});

test('the film site links to the branded scanner, intake and existing checkouts', async () => {
  const home = await readFile('dist/index.html', 'utf8');
  const desk = await readFile('dist/caption-desk/index.html', 'utf8');
  const plans = await readFile('dist/caption-desk/desk.html', 'utf8');
  assert.match(home, /href="\/caption-desk"/);
  assert.match(desk, /href="https:\/\/synthworx.com\/caption-desk"/);
  assert.match(desk, /src="\/caption-desk\/scan.js"/);
  assert.match(plans, /href="\/caption-desk\/intake\?service=pilot"/);
  assert.equal((plans.match(/https:\/\/checkout.dodopayments.com\/buy\//g) || []).length, 2);
});

test('intake forwards only the diagnostics to the fixed queue and returns its receipt', async t => {
  const client = globalThis.fetch;
  const previous = process.env.CAPTION_DESK_INTAKE_RELAY;
  process.env.CAPTION_DESK_INTAKE_RELAY = 'test-relay-key';
  t.after(() => {
    if (previous === undefined) delete process.env.CAPTION_DESK_INTAKE_RELAY;
    else process.env.CAPTION_DESK_INTAKE_RELAY = previous;
  });
  const server = http.createServer(captionIntake);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const endpoint = 'http://127.0.0.1:' + server.address().port;
  const body = JSON.stringify({ requestId: 'synthetic-unit-example' });
  let forwarded = 0;
  t.mock.method(globalThis, 'fetch', async (target, init) => {
    forwarded++;
    assert.equal(new URL(target).pathname, '/api/intake');
    assert.equal(new URL(target).hostname, 'synthworx-caption-desk.shaihazher.chatgpt.site');
    assert.equal(init.body.toString(), body);
    assert.equal(init.headers.cookie, undefined);
    assert.equal(init.headers.authorization, undefined);
    assert.match(init.headers['x-caption-client'], /^[a-f0-9]{64}$/);
    return Response.json({ receipt: 'synthetic-unit-example' }, { status: 201 });
  });
  const headers = { 'content-type': 'application/json', origin: 'https://synthworx.com', cookie: 'audience=private' };
  const ok = await client(endpoint, { method: 'POST', headers, body });
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { receipt: 'synthetic-unit-example' });
  for (const [options, expected] of [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', headers: { ...headers, origin: 'https://other.example' }, body }, 403],
    [{ method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body }, 415],
  ]) assert.equal((await client(endpoint, options)).status, expected);
  assert.equal(forwarded, 1);
});
