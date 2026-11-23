import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://synthworx.com');
  const body = `User-agent: *
Allow: /
Disallow: /offhours/api/
Disallow: /offhours/access
Disallow: /federal-desk/api/
Disallow: /federal-desk/delivery
Disallow: /outcome-prompt/api/
Disallow: /outcome-prompt/receipt

Sitemap: ${new URL('sitemap-index.xml', base).toString()}
Sitemap: ${new URL('caption-desk/sitemap.xml', base).toString()}
Sitemap: ${new URL('offhours/sitemap.xml', base).toString()}
Sitemap: ${new URL('federal-desk/sitemap.xml', base).toString()}
Sitemap: ${new URL('outcome-prompt/sitemap.xml', base).toString()}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
