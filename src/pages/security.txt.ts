import type { APIRoute } from 'astro';
import { SITE } from '../data/site';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://synthworx.com');
  const body = `Contact: mailto:${SITE.email}
Contact: ${new URL('/contact', base).toString()}
Expires: 2027-11-06T00:00:00.000Z
Preferred-Languages: en
Canonical: ${new URL('/.well-known/security.txt', base).toString()}
Policy: ${new URL('/security', base).toString()}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
