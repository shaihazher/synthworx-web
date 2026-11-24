import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat, mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {acceptInquiry} from '../inquiries.mjs';

test('the portfolio links directly to each product from both the name and task indexes', async () => {
  const home = await readFile('dist/index.html', 'utf8');
  const destinations = [
    ['/arrival-slip/?src=referral', 'Arrival Slip'],
    ['/caption-desk', 'Caption Desk'],
    ['/federal-desk/?src=synthworx', 'Federal Evidence Desk'],
    ['/offhours', 'Offhours Scout'],
    ['/outcome-prompt/?src=synthworx', 'Outcome Prompt'],
    ['https://pikki.synthworx.com/?utm_source=synthworx&amp;utm_campaign=product-index', 'Pikki Jobs'],
  ];
  for (const [href, name] of destinations) {
    assert.ok(home.includes(name), name);
    assert.equal(home.split(`href="${href}"`).length - 1, 2, name);
  }
  assert.ok(home.includes('href="/audience-cut"'));
  assert.match(home, /<link rel="canonical" href="https:\/\/synthworx\.com\/"\s*\/?>/);
});
test('release brief, contact form, artwork and supporting pages are available', async()=>{
 const home=await readFile('dist/audience-cut/index.html','utf8');
 for(const term of ['Audience Cut','Lights Out','It Comes at Night','id="it-comes-at-night"','href="#it-comes-at-night"','1 hour 20 minutes','$1,500','/inquiries','03:04','name="decision"']) assert.ok(home.includes(term),term);
 for(const p of ['art/hero.webp','art/lights-out-poster.jpg','art/it-comes-at-night-poster.jpg','privacy/index.html','terms/index.html','thanks/index.html','.well-known/security.txt','sitemap-index.xml']) assert.ok((await stat('dist/'+p)).size);
 assert.doesNotMatch(home,/Audience Cut 11|automation sprint/i);
});
test('form stores valid inquiries durably and rejects invalid entries', async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'audience-form-'));process.env.INQUIRY_DIR=dir;
 const server=http.createServer(acceptInquiry);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{delete process.env.INQUIRY_DIR;await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})});
 const url='http://127.0.0.1:'+server.address().port+'/inquiries';
 const send=(params,extra={})=>fetch(url,{method:'POST',redirect:'manual',headers:{Accept:'application/json',...extra},body:new URLSearchParams(params)});
 const data={name:'QA',email:'qa@example.org',film:'Test feature',decision:'Choose a trailer.'};
 assert.equal((await send({...data,email:'wrong'})).status,422);
 assert.equal((await send(data,{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await send({...data,website:'bot'})).status,201);
 assert.deepEqual(await readdir(dir),[]);
 assert.equal((await send(data)).status,201);
 const files=await readdir(dir);
 assert.equal(files.length,1);
 assert.equal(JSON.parse(await readFile(path.join(dir,files[0]))).decision,data.decision);
 assert.equal((await send(data,{Accept:'text/html'})).headers.get('location'),'/thanks');
});

test('queued mail survives a failure and restart and each successful notification is retired', async t => {
  const { notificationWorker, saveInquiry } = await import('../notification.mjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'audience-mail-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await saveInquiry(directory, { id: 'old-inquiry' });
  await saveInquiry(directory, { id: 'new-inquiry', notification: { status: 'pending' } });
  const pendingFile = path.join(directory, 'new-inquiry.json');
  const failed = notificationWorker(directory, async () => { throw new Error('Offline'); });
  await failed();
  const pending = JSON.parse(await readFile(pendingFile));
  assert.equal(pending.notification.attempts, 1);
  assert.ok(pending.notification.retryAfter > Date.now());
  const sent = [];
  const restarted = notificationWorker(directory, async record => sent.push(record.id));
  await restarted();
  assert.deepEqual(sent, []);
  pending.notification.retryAfter = 0;
  await saveInquiry(directory, pending);
  await Promise.all([restarted(), restarted()]);
  await restarted();
  assert.deepEqual(sent, ['new-inquiry']);
  assert.equal(JSON.parse(await readFile(pendingFile)).notification.status, 'sent');
});
