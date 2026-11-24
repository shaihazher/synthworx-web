import http from 'node:http';
import { createCultureSite } from './culture-register/site.mjs';
const serveCultureRegister = createCultureSite();
import { createArrivalSite } from './arrival-slip/site.mjs';
const serveArrivalSlip = createArrivalSite();
import handler from 'serve-handler';
import { acceptInquiry } from './inquiries.mjs';
import { captionIntake } from './caption-intake.mjs';
import { serveOffhours } from './offhours.mjs';
import { createFederalDesk } from './federal-desk.mjs';
const serveFederalDesk = createFederalDesk();
import { createOutcomeSite } from './outcome-prompt/site.mjs';
const serveOutcomePrompt = createOutcomeSite();

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
    response.writeHead(301, { Location: `https://${canonicalHost}/audience-cut` });
    response.end();
    return;
  }

  const pathname = (request.url || '/').split('?')[0];
  if ((pathname === '/culture-register' || pathname.startsWith('/culture-register/')) && !pathname.startsWith('/culture-register/assets/')) {
    void serveCultureRegister(request, response);
    return;
  }
  if (pathname === '/arrival-slip' || pathname.startsWith('/arrival-slip/')) {
    void serveArrivalSlip(request, response);
    return;
  }
  if (pathname === '/outcome-prompt' || pathname.startsWith('/outcome-prompt/')) {
    void serveOutcomePrompt(request, response);
    return;
  }
  if (pathname === '/federal-desk' || pathname.startsWith('/federal-desk/')) {
    void serveFederalDesk(request, response);
    return;
  }
  if (pathname === '/offhours' || pathname.startsWith('/offhours/')) {
    void serveOffhours(request, response);
    return;
  }
  if (['/caption-desk/intake', '/caption-desk/order'].includes(pathname) && ['GET', 'HEAD'].includes(request.method)) {
    const incoming = new URL(request.url, 'https://synthworx.com').searchParams;
    if (['payment_id', 'subscription_id', 'email', 'license_key', 'status'].some(key => incoming.has(key))) {
      // Checkout can append buyer and transaction details. Keep only the fields the destination uses.
      const retained = new URLSearchParams();
      for (const key of ['service', 'src']) if (incoming.has(key)) retained.set(key, incoming.get(key));
      const location = pathname + (retained.size ? '?' + retained : '');
      response.writeHead(303, { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
      response.end();
      return;
    }
  }
  if (pathname === '/caption-desk/api/intake') {
    void captionIntake(request, response);
    return;
  }

  if (pathname === '/inquiries') {
    acceptInquiry(request, response, process.env.ZOHO_ACCOUNT_ID ? notify : undefined).catch(() => {
      console.error('Audience Cut inquiry could not be saved');
      if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: false, message: 'Please email hello@synthworx.com or try again later.' }));
    });
    return;
  }

  if (['/work/pikki', '/work/pikki/', '/pdfs/pikki.pdf', '/products/pikki', '/products/pikki/', '/pikki', '/pikki/'].includes(pathname)) {
    const destination = pathname === '/pdfs/pikki.pdf' ? '/extension' : '/';
    response.writeHead(301, { Location: `https://pikki.synthworx.com${destination}?utm_source=synthworx&utm_campaign=pikki-shortcut` });
    response.end();
    return;
  }
  const retired = { contact: '/audience-cut#contact', services: '/audience-cut#service', work: '/audience-cut#case-study', proof: '/audience-cut#case-study', security: '/privacy', automation: '/', products: '/#products', about: '/', notes: '/' };
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
      {
        source: 'culture-register/assets/**/*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        source: 'caption-desk/**/*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
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
