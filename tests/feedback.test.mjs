import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { acceptFeedback } from '../feedback.mjs';

test('feedback queues a product note without an account and keeps validation failures out of the inbox', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'product-feedback-'));
  process.env.FEEDBACK_DIR = dir;
  let notified = 0;
  const server = http.createServer((req, res) => acceptFeedback(req, res, () => { notified++; }));
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    await new Promise(done => server.close(done));
    delete process.env.FEEDBACK_DIR;
    await rm(dir, { recursive: true, force: true });
  });
  const url = 'http://127.0.0.1:' + server.address().port + '/feedback/submit';
  const submit = (fields, headers) => fetch(url, { method: 'POST', redirect: 'manual', headers, body: new URLSearchParams(fields) });
  const note = { product: 'caption-desk', message: 'A note about my scan.' };
  for (const invalid of [{ product: 'other' }, { message: ' ' }, { email: 'invalid' }]) {
    assert.equal((await submit({ ...note, ...invalid })).status, 422);
  }
  assert.equal((await submit(note, { Origin: 'https://example.org' })).status, 403);
  assert.equal((await submit({ ...note, website: 'filled' })).status, 303);
  assert.deepEqual(await readdir(dir), []);
  assert.equal(notified, 0);

  const result = await submit(note);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get('location'), '/feedback/received/caption-desk');
  const [file] = await readdir(dir);
  const saved = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
  assert.equal(saved.product, 'Caption Desk');
  assert.equal(saved.message, note.message);
  assert.equal(saved.email, '');
  assert.equal(saved.notification.status, 'pending');
  const withEmail = await submit({ ...note, email: 'tester@example.org' }, { Accept: 'application/json' });
  assert.equal(withEmail.status, 201);
  assert.equal((await withEmail.json()).ok, true);
  assert.equal(notified, 2);
});
