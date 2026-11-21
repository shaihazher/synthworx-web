import http from 'node:http';
import handler from 'serve-handler';
import { acceptInquiry } from './inquiries.mjs';

import { inboxDirectory, notificationWorker } from './notification.mjs';

const directory = inboxDirectory();
const notify = directory && notificationWorker(directory);
if (notify && (process.env.ZOHO_ACCOUNT_ID || process.env.RAILWAY_ENVIRONMENT)) {
  void notify();
  setInterval(notify, 30000).unref();
}

const port = Number(process.env.PORT || 4321);
const canonicalHost = 'synthworx.com';

const server = http.createServer((request, response) => {
  const host = (request.headers.host || '').split(':')[0].toLowerCase();

  // Canonical host: www -> apex. Railway terminates TLS and forwards HTTP.
  if (host === `www.${canonicalHost}`) {
    const location = `https://${canonicalHost}${request.url || '/'}`;
    response.writeHead(301, { Location: location });
    response.end();
    return;
  }

  // Sending domain: appsynthworx.com is used for outbound email. If it points at
  // this service, direct visitors to the Audience Cut landing page.
  const sendingHosts = new Set(['appsynthworx.com', 'www.appsynthworx.com']);
  if (sendingHosts.has(host)) {
    response.writeHead(301, { Location: `https://${canonicalHost}/` });
    response.end();
    return;
  }

  const pathname = (request.url || '/').split('?')[0];
  if (pathname === '/inquiries') {
    acceptInquiry(request, response, process.env.ZOHO_ACCOUNT_ID ? notify : undefined).catch(() => {
      console.error('Audience Cut inquiry could not be saved');
      if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: false, message: 'Please email hello@synthworx.com or try again later.' }));
    });
    return;
  }

  const retired = { contact: '/#contact', services: '/#service', work: '/#case-study', proof: '/#case-study', security: '/privacy', automation: '/', products: '/', about: '/', notes: '/' };
  const section = pathname.split('/')[1];
  if (Object.hasOwn(retired, section)) {
    response.writeHead(301, { Location: retired[section] });
    response.end();
    return;
  }
  handler(request, response, {
    public: 'dist',
    cleanUrls: true,
    trailingSlash: false,
    headers: [
      {
        source: '**/*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '**/*.@(woff2|css|js)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ],
  }).catch((error) => {
    console.error('request failed', error);
    if (!response.headersSent) response.writeHead(500);
    response.end('Internal server error');
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`synthworx.com listening on :${port}`);
});
