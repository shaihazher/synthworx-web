import { randomUUID } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';

const windows = new Map();
const interval = 15 * 60 * 1000;
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [ip, window] of windows) if (window.until <= now) windows.delete(ip);
}, interval);
sweep.unref();

function reply(request, response, status, message) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.headers.accept?.includes('application/json')) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: status === 201, message }));
  } else if (status === 201) {
    response.writeHead(303, { Location: '/thanks' });
    response.end();
  } else {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(message + '\nReturn to the form or email hello@synthworx.com.');
  }
}

export async function acceptInquiry(req, res) {
  const fail = (status, message) => reply(req, res, status, message);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'Submit the inquiry form to contact us.');
  }
  const origin = req.headers.origin;
  if (origin && origin !== 'https://synthworx.com' && origin !== 'https://www.synthworx.com'
      && (process.env.RAILWAY_ENVIRONMENT || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    return fail(403, 'Please use the form on synthworx.com.');
  }
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return fail(415, 'Please use the website form.');
  const maxBytes = 32 * 1024;
  if (Number(req.headers['content-length']) > maxBytes) return fail(413, 'Please shorten your message.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) return fail(413, 'Please shorten your message.');
    chunks.push(chunk);
  }
  const fields = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  if (fields.get('website')) return reply(req, res, 201, 'Received.');
  const record = {};
  for (const [key, limit] of Object.entries({ name: 100, email: 254, film: 180, decision: 2500 })) {
    const value = fields.get(key)?.trim();
    if (!value || value.length > limit || fields.getAll(key).length !== 1 || value.includes('\0')) return fail(422, 'Please complete each field within the displayed length limits.');
    record[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return fail(422, 'Please enter a valid reply email.');
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
  const now = Date.now();
  let window = windows.get(ip);
  if (!window || window.until <= now) { window = { count: 0, until: now + interval }; windows.set(ip, window); }
  if (window.count >= 6) return fail(429, 'Please wait a few minutes before sending another inquiry.');
  window.count++;
  const dir = process.env.INQUIRY_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH && path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'audience-cut'));
  if (!dir) return fail(503, 'The form is temporarily unavailable. Please email hello@synthworx.com.');
  const id = randomUUID();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const handle = await open(path.join(dir, id + '.json'), 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify({ id, received: new Date().toISOString(), ...record }) + '\n');
    await handle.sync();
  } finally { await handle.close(); }
  console.info('Audience Cut inquiry received', id);
  return reply(req, res, 201, 'Inquiry received.');
}
