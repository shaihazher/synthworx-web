import { randomUUID } from 'node:crypto';
import path from 'node:path';
import products from './feedback-products.json' with { type: 'json' };
import { formError, readWebsiteForm, takeSubmissionSlot } from './form-input.mjs';
import { saveInquiry } from './notification.mjs';

export function feedbackDirectory() {
  return process.env.FEEDBACK_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH &&
    path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'product-feedback'));
}

export async function acceptFeedback(req, res, notify) {
  res.setHeader('Cache-Control', 'no-store');
  const json = req.headers.accept?.includes('application/json');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      throw formError(405, 'Use the feedback form to send a note.');
    }
    const fields = await readWebsiteForm(req);
    const slug = fields.get('product');
    if (!Object.hasOwn(products, slug) || fields.getAll('product').length !== 1) {
      throw formError(422, 'Choose a product or the Synthworx website.');
    }
    if (!fields.get('website')) {
      const message = fields.get('message')?.trim();
      const email = fields.get('email')?.trim() || '';
      if (!message || message.length > 2000 || message.includes('\0') || fields.getAll('message').length !== 1) {
        throw formError(422, 'Enter a note of up to 2,000 characters.');
      }
      if (fields.getAll('email').length > 1 || email.length > 254 || (email && !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email))) {
        throw formError(422, 'Check the reply email or leave it blank.');
      }
      takeSubmissionSlot(req, 'feedback');
      const directory = feedbackDirectory();
      if (!directory) throw Error('Feedback storage unavailable');
      await saveInquiry(directory, {
        id: randomUUID(), received: new Date().toISOString(), type: 'feedback',
        product: products[slug].name, message, email, notification: { status: 'pending' }
      });
      if (notify) void notify();
    }
    if (json) {
      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, message: 'Thank you. Your feedback was received.' }));
    } else {
      res.writeHead(303, { Location: '/feedback/received/' + slug });
      res.end();
    }
  } catch (error) {
    const status = error.status || 503;
    if (!error.status) console.error('Product feedback could not be saved');
    const message = error.status ? error.message : 'We couldn’t save your feedback. Please try again or email hello@synthworx.com.';
    res.writeHead(status, { 'Content-Type': (json ? 'application/json' : 'text/plain') + '; charset=utf-8' });
    res.end(json ? JSON.stringify({ ok: false, message }) : message);
  }
}
