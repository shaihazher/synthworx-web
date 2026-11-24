const windows = new Map();
const interval = 15 * 60 * 1000;
const sweep = setInterval(() => {
  for (const [key, window] of windows) if (window.until <= Date.now()) windows.delete(key);
}, interval);
sweep.unref();

export function formError(status, message) {
  return Object.assign(new Error(message), { status });
}

export async function readWebsiteForm(req) {
  const origin = req.headers.origin;
  if (origin && origin !== 'https://synthworx.com' && origin !== 'https://www.synthworx.com'
      && (process.env.RAILWAY_ENVIRONMENT || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    throw formError(403, 'Please use the form on synthworx.com.');
  }
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    throw formError(415, 'Please use the website form.');
  }
  const max = 32 * 1024;
  if (Number(req.headers['content-length']) > max) throw formError(413, 'Please shorten your message.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw formError(413, 'Please shorten your message.');
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

export function takeSubmissionSlot(req, group) {
  const key = group + ':' + (req.headers['x-real-ip'] || req.socket.remoteAddress);
  const now = Date.now();
  let window = windows.get(key);
  if (!window || window.until <= now) {
    window = { count: 0, until: now + interval };
    windows.set(key, window);
  }
  if (window.count >= 6) throw formError(429, 'Please wait a few minutes before sending another message.');
  window.count++;
}
