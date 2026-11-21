import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const mailbox = 'hello@synthworx.com';
let token;
let expiresAt = 0;

export function inboxDirectory() {
  return process.env.INQUIRY_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH &&
    path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'audience-cut'));
}

export async function saveInquiry(directory, record) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, randomUUID() + '.tmp');
  const handle = await open(temporary, 'wx', 0o600);
  try {
    try {
      await handle.writeFile(JSON.stringify(record) + '\n');
      await handle.sync();
    } finally { await handle.close(); }
    await rename(temporary, path.join(directory, record.id + '.json'));
  } finally { await rm(temporary, { force: true }); }
}

async function accessToken() {
  if (token && Date.now() < expiresAt) return token;
  const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID, client_secret: process.env.ZOHO_CLIENT_SECRET
    })
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error('Mail authorization failed');
  token = body.access_token;
  expiresAt = Date.now() + (Number(body.expires_in || 3600) - 60) * 1000;
  return token;
}

async function sendNotification(record) {
  const body = {
    fromAddress: mailbox, toAddress: mailbox, mailFormat: 'plaintext',
    subject: 'Audience Cut inquiry — ' + record.film.replace(/[\x00-\x1f\x7f]/g, ' '),
    content: [
      'A filmmaker submitted an inquiry on synthworx.com.', '',
      'Film: ' + record.film, 'From: ' + record.name,
      'Contact email: ' + record.email, '', 'Their decision:', record.decision,
      '', 'Write to ' + record.email + ' to follow up.', 'Inquiry ID: ' + record.id
    ].join('\n')
  };
  const url = 'https://mail.zoho.in/api/accounts/' + process.env.ZOHO_ACCOUNT_ID + '/messages';
  const response = await fetch(url, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Zoho-oauthtoken ' + await accessToken(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (response.status === 401) expiresAt = 0;
  const result = await response.json();
  if (!response.ok || Number(result.status?.code) !== 200) throw new Error('Mail service declined notification');
}

// The production service has a single worker on its attached volume. Only new,
// explicitly queued records are eligible, including after a process restart.
export function notificationWorker(directory, send = sendNotification) {
  let draining;
  async function drain() {
    const files = await readdir(directory).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const file of files.filter(name => name.endsWith('.json'))) {
      try {
        const record = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
        const state = record.notification;
        if (state?.status !== 'pending' || state.retryAfter > Date.now()) continue;
        try {
          await send(record);
          record.notification = { status: 'sent', sentAt: new Date().toISOString() };
        } catch {
          state.attempts = (state.attempts || 0) + 1;
          state.retryAfter = Date.now() + Math.min(15 * 60000, 30000 * 2 ** Math.min(5, state.attempts - 1));
          console.error('Inquiry notification pending retry', record.id);
        }
        await saveInquiry(directory, record);
      } catch { console.error('Inquiry notification record could not be processed', file); }
    }
  }
  return () => {
    if (!draining) draining = drain().catch(() => console.error('Inquiry notification inbox unavailable'))
      .finally(() => { draining = undefined; });
    return draining;
  };
}
