# Deployment handoff

**Railway project:** `synthworx-site` (ID `8897d4a2-2556-4043-96fe-910096c15725`)
**Service:** `synthworx-site` (ID `9ed5921b-4ed4-427e-8445-a6188d55d758`)
**Railway URL:** https://synthworx-site-production.up.railway.app
**Repo:** https://github.com/shaihazher/synthworx-web

The site is a static Astro build served by `server.mjs`. Nixpacks installs with `npm ci`, the build command is `npm run build`, and the start command is `npm run start`.

## Custom domains

| Domain | Railway ID | Railway target | Status |
|---|---|---|---|
| `synthworx.com` | `3ebfb92c-9dcb-445b-ba19-8bdc65d10a82` | `5xyqzsza.up.railway.app` | Live · 200 · cert valid |
| `www.synthworx.com` | `c9a285d3-0fa8-49dc-a949-7fc1e54f9a29` | `7k8xv2p7.up.railway.app` | Live · 301 → apex · cert valid |

Railway issued separate targets for the apex and `www`. Use each target for its own record; do not assume they are the same.

## Namecheap → Domain List → synthworx.com → Manage → Advanced DNS

Namecheap BasicDNS supports **ALIAS at the apex**. That is required because a CNAME at `@` cannot coexist with the Zoho MX records.

### Delete

- `A @ → 76.76.21.21` (old Vercel)
- `CNAME www → cname.vercel-dns.com` (old Vercel)

### Add

| Type | Host | Value | TTL |
|---|---|---|---|
| ALIAS | `@` | `5xyqzsza.up.railway.app` | 5 min |
| CNAME | `www` | `7k8xv2p7.up.railway.app` | 5 min |
| TXT | `_railway-verify` | `railway-verify=bbbe573135738fa6113bd9076d78ce8eeaf0319a9dac478027d284803e3faa5b` | 5 min |
| TXT | `_railway-verify.www` | `railway-verify=bb5e7309f14d81cbeb67ce0dc32ef0f19e787f74844532053fea036fd7930f2a` | 5 min |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@synthworx.com` | 5 min |

### Keep

- `CNAME pikki → apgqlbv9.up.railway.app` (Pikki is live; do not touch)
- `MX @ → mx.zoho.in` 10, `mx2.zoho.in` 20, `mx3.zoho.in` 50
- `TXT @ → v=spf1 include:zoho.in ~all`
- `TXT @ → zoho-verification=...`
- `TXT @ → google-site-verification=...` (two records)

Add the Zoho DKIM TXT record from **Zoho Admin → Email Authentication** if it is not already present. Do not change MX.

## Verify

```sh
dig +short ALIAS synthworx.com
dig +short CNAME www.synthworx.com
dig +short TXT _railway-verify.synthworx.com
dig +short TXT _dmarc.synthworx.com
curl -I https://synthworx.com
curl -I https://www.synthworx.com
curl -I https://pikki.synthworx.com
```

Note: `dig` has no ALIAS type. Use `dig +short A synthworx.com` after propagation; Railway's ALIAS resolves to its edge.

Verified 2026-11-06: apex `200`, `www` `301` to apex, Railway certificates valid. Public resolvers are updated; a local resolver that cached the old Vercel records may show `402` until its TTL expires.

## Canonical / redirect

The Astro site uses `PUBLIC_SITE_URL=https://synthworx.com`. The canonical tag and sitemap use the apex. `server.mjs` 301s `www.synthworx.com` to the apex.

## DMARC cleanup

Authoritative DNS currently returns two `_dmarc` TXT records:

- `v=DMARC1; p=none; rua=mailto:hello@synthworx.com`
- `v=DMARC1; p=none; rua=mailto:postmaster@synthworx.com`

Keep one. Delete the duplicate in Namecheap so DMARC is not ambiguous. `hello@` is preferred because it is the monitored mailbox.

## Rollback

1. Re-add `A @ → 76.76.21.21`.
2. Re-add `CNAME www → cname.vercel-dns.com`.
3. Un-pause the Vercel project.
4. Keep the Railway service running until the rollback is confirmed.

Keep a screenshot of the old DNS records for 7 days.

## Railway notes

- `NIXPACKS_NODE_VERSION=24` is set on the service. Astro 7 requires Node 22.23.4+.
- `railway.json` is still used for build/start commands. Railway marks it as Config as Code and says it works until 2026-12-01. Before that date, migrate to `.railway/railway.ts` or set the commands in the service settings.
- Region: Southeast Asia. Fine for a static site; the CDN edge handles US readers.
- No database, no secrets, no volumes.

## Environment

| Variable | Value |
|---|---|
| `PUBLIC_SITE_URL` | `https://synthworx.com` |
| `NIXPACKS_NODE_VERSION` | `24` |
| `PORT` | injected by Railway |
