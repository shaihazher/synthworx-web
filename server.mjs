import http from 'node:http';
import handler from 'serve-handler';

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
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '**/*.@(jpg|jpeg|png|webp|svg|woff2|pdf|css|js)',
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
