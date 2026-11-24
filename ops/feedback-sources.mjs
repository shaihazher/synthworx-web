// Both modes read private sources. Only the volume mode runs on Railway.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [mode, slug] = process.argv.slice(2);
const products = JSON.parse(await readFile('feedback-products.json', 'utf8'));
if (!Object.hasOwn(products, slug)) throw Error('Unknown feedback product');
const { name } = products[slug];

async function volume() {
  const root = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
  // A missing mount is an unavailable source. A product can legitimately have no notes yet.
  await readdir(root);
  const rows = [], qa = [];
  async function scan(directory, source, archived = false) {
    let files;
    try { files = await readdir(join(root, directory)); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const file of files.filter(f => /^[a-f\d-]+\.json$/i.test(f))) {
      const item = JSON.parse(await readFile(join(root, directory, file), 'utf8'));
      if (source === 'shared' && item.product !== name) continue;
      const inquiry = source === 'inquiry';
      const ref = (inquiry ? 'inquiry:' : 'form:') + item.id;
      if (archived) { qa.push(ref); continue; }
      const body = inquiry ? item.decision : item.message;
      if (!body || !item.id || !(item.at || item.received)) throw Error('Incomplete feedback record in ' + directory);
      rows.push({ ref, at: item.at || item.received, body, reply: item.email || null,
        subject: inquiry ? item.film : (item.kind || name), delivery: item.notification?.status || null });
    }
  }
  await scan('product-feedback', 'shared');
  await scan('product-feedback/qa', 'shared', true);
  if (slug === 'federal-desk') {
    await scan('federal-evidence-desk/feedback', 'federal');
    await scan('federal-evidence-desk/qa-feedback', 'federal', true);
  }
  if (slug === 'audience-cut') await scan('audience-cut', 'inquiry');
  let ratings;
  if (slug === 'outcome-prompt') {
    const db = new DatabaseSync(join(root, 'outcome-prompt', 'activity.sqlite'), { readOnly: true });
    try {
      ratings = db.prepare(`SELECT date(r.at / 1000,'unixepoch') AS rewriteDay, r.bucket != r.sid AS paid,
        COUNT(*) AS completed, COUNT(CASE WHEN r.rating = 'closer' THEN 1 END) AS closer,
        COUNT(CASE WHEN r.rating = 'missed' THEN 1 END) AS missed
        FROM runs r JOIN sessions s ON s.id = r.sid WHERE s.qa = 0 AND r.status = 'ready'
        GROUP BY rewriteDay, paid ORDER BY rewriteDay`).all();
    } finally { db.close(); }
  }
  return { rows, qa, ratings };
}

async function mailbox() {
  const { feedbackMailbox, sender } = await import('./zoho.mjs');
  const get = await feedbackMailbox();
  const folders = await get('folders');
  const excluded = new Set(folders.filter(f => /^(sent|drafts?|trash|outbox|templates)$/i.test(f.folderType || f.folderName))
    .map(f => String(f.folderId)));
  const productTerm = slug === 'pikki-jobs' ? 'Pikki' : (slug === 'synthworx' ? 'Synthworx feedback' : name);
  const rows = [];
  for (let start = 1; ; start += 100) {
    const params = new URLSearchParams({ searchKey: 'subject:"' + productTerm + '"', start: String(start), limit: '100' });
    const page = await get('messages/search?' + params);
    for (const m of page) {
      if (excluded.has(String(m.folderId))) continue;
      const subject = String(m.subject || '').replace(/^(?:(?:re|fw|fwd):\s*)+/ig, '').trim();
      const lower = subject.toLowerCase();
      const named = lower.startsWith(name.toLowerCase() + ' ');
      const direct = (named && /\b(feedback|reader note|support|help|delivery|intake)\b/i.test(subject)) || lower === name.toLowerCase();
      if (!direct && !(slug === 'audience-cut' && lower.includes('audience cut'))) continue;
      const from = String(m.fromAddress || '').toLowerCase();
      const own = from === sender || from.endsWith('<' + sender + '>');
      if (own && subject !== name + ' feedback' && !subject.startsWith('Audience Cut inquiry')) continue;
      const content = await get('folders/' + m.folderId + '/messages/' + m.messageId + '/content?includeBlockContent=true');
      const body = content.content;
      if (typeof body !== 'string') throw Error('Zoho message body unavailable');
      rows.push({ ref: 'mail:' + m.messageId, at: new Date(Number(m.receivedTime || m.sentDateInGMT)).toISOString(),
        subject: m.subject, body, own, folder: String(m.folderId), reply: own ? null : m.fromAddress });
    }
    if (page.length < 100) break;
  }
  return { rows };
}

if (!['volume','mail'].includes(mode)) throw Error('Choose volume or mail');
console.log(JSON.stringify(await (mode === 'volume' ? volume() : mailbox())));
