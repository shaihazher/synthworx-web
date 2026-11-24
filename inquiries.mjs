import { randomUUID } from 'node:crypto';
import { inboxDirectory, saveInquiry } from './notification.mjs';

import { readWebsiteForm, takeSubmissionSlot } from './form-input.mjs';

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

export async function acceptInquiry(req, res, notify) {
  const fail = (status, message) => reply(req, res, status, message);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(405, 'Submit the inquiry form to contact us.');
  }
  let fields;
  try { fields = await readWebsiteForm(req); }
  catch (error) {
    if (error.status) return fail(error.status, error.message);
    throw error;
  }
  if (fields.get('website')) return reply(req, res, 201, 'Received.');
  const record = {};
  for (const [key, limit] of Object.entries({ name: 100, email: 254, film: 180, decision: 2500 })) {
    const value = fields.get(key)?.trim();
    if (!value || value.length > limit || fields.getAll(key).length !== 1 || value.includes('\0')) return fail(422, 'Please complete each field within the displayed length limits.');
    record[key] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return fail(422, 'Please enter a valid reply email.');
  try { takeSubmissionSlot(req, 'inquiry'); }
  catch (error) { return fail(error.status, error.message); }
  const dir = inboxDirectory();
  if (!dir) return fail(503, 'The form is temporarily unavailable. Please email hello@synthworx.com.');
  const id = randomUUID();
  await saveInquiry(dir, { id, received: new Date().toISOString(), ...record, notification: { status: 'pending' } });
  if (notify) void notify();
  console.info('Audience Cut inquiry received', id);
  return reply(req, res, 201, 'Inquiry received.');
}
