import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const sender = 'hello@synthworx.com';
const state = join(homedir(), '.local/state/synthworx/mail');
const session = join(state, 'session.json');

async function accessToken(refresh = false) {
  if (!refresh) {
    try {
      const saved = JSON.parse(await readFile(session, 'utf8'));
      if (saved.until > Date.now()) return saved.token;
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const source = await readFile(join(homedir(), 'Desktop/Claude_Space/credentials/zoho.env'), 'utf8');
  const env = Object.fromEntries(source.split(/\r?\n/).filter(line => /^\w+=/.test(line)).map(line => {
    const equal = line.indexOf('=');
    return [line.slice(0, equal), line.slice(equal + 1).trim().replace(/^['"]|['"]$/g, '')];
  }));
  const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: env.ZOHO_REFRESH_TOKEN,
      client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw Error('Zoho mailbox authentication failed');
  await mkdir(state, { recursive: true, mode: 0o700 });
  const temp = join(state, randomUUID() + '.tmp');
  await writeFile(temp, JSON.stringify({ token: result.access_token, until: Date.now() + (Number(result.expires_in) - 90) * 1000 }), { mode: 0o600 });
  await rename(temp, session);
  return result.access_token;
}

export async function feedbackMailbox() {
  let token = await accessToken();
  async function request(route) {
    async function call() {
      return fetch('https://mail.zoho.in/api/' + route, { headers: {
        Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json'
      }, signal: AbortSignal.timeout(25000) });
    }
    let response = await call();
    if (response.status === 401) {
      token = await accessToken(true);
      response = await call();
    }
    const answer = await response.json();
    if (!response.ok || Number(answer.status?.code) !== 200) throw Error('Zoho returned ' + (answer.status?.code || response.status));
    return answer.data;
  }
  const accounts = await request('accounts');
  const mailbox = accounts.find(a => [a.primaryEmailAddress, a.incomingUserName,
    ...(a.emailAddress || []).map(v => v.mailId || v)].includes(sender));
  if (!mailbox) throw Error('The authenticated account has no Synthworx sender');
  return route => request('accounts/' + mailbox.accountId + '/' + route);
}
