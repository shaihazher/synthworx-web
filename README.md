# synthworx-web

**Live:** https://synthworx-site-production.up.railway.app (custom domains pending DNS) · **Target:** https://synthworx.com

The source for [synthworx.com](https://synthworx.com) — the website and proof library for **Synthworx**, a production AI consulting practice.

> AI that survives production.

## What this is

A static Astro site with seven primary pages and a small proof library:

| Route | Purpose |
|---|---|
| `/` | The 10-second test: headline, proof bar, three case studies, diagnostic CTA |
| `/work` | Four case studies with numbers |
| `/work/[slug]` | Full case study, architecture, results, PDF download |
| `/services` | Published fees and scope for the full offer ladder |
| `/about` | Amazon background, photo, location, how I work, what I do not do |
| `/products` | Pikki, Tappi, Tappi for Chrome, AI Tutor, browser-py |
| `/notes` | Two technical write-ups |
| `/notes/[slug]` | Full technical note |
| `/contact` | Email, no-free-calls policy, diagnostic request |
| `/proof` | Index of case studies, notes, live products, references, contract status |
| `/security` | NDA, data handling, incident notification, security contact |
| `/privacy`, `/terms` | Legal pages |

There is no blog, no newsletter, no CMS, no contact backend, and no analytics.

## Stack

- [Astro](https://astro.build) 7 — static output
- [Tailwind CSS](https://tailwindcss.com) 4 via the Vite plugin
- Astro content collections for case studies and notes
- `@astrojs/sitemap` for `sitemap-index.xml`
- Self-hosted fonts via Fontsource: Instrument Serif, Inter, JetBrains Mono
- A tiny Node static server (`server.mjs`) with a `www` → apex 301 and security headers

No client-side framework. One small inline script for reveal-on-scroll; the site is fully readable without JavaScript.

## Local development

```sh
npm ci
npm run dev          # http://localhost:4321
```

Build and preview the production output:

```sh
npm run build
npm run preview
# or serve the static output exactly as Railway does:
PORT=4321 npm start
```

Checks:

```sh
npm run check        # Astro/TypeScript diagnostics
npm run build
npm test             # content, link, SEO, and asset checks against dist/
```

## Content model

Case studies live in `src/content/caseStudies/*.md`; notes live in `src/content/notes/*.md`. The schema is in `src/content.config.ts`.

A case study frontmatter looks like this:

```yaml
---
title: "A 1.1M-token memory on an 8 GB laptop"
subtitle: "..."
label: "Independent R&D"       # Built at Amazon | Independent R&D | Independent product | Client engagement
year: "2026"
sector: "Local inference · long-context memory"
summary: "..."
metric:
  value: "15/15"
  label: "planted facts recalled from 1.1M tokens"
stack: ["MLX", "KV-cache store"]
stats:
  - value: "1.1M"
    label: "token session"
order: 2
featured: true
---
```

Labels are load-bearing. Do not use **Client engagement** unless a client has approved the description. Do not publish a metric that is not traceable to the work.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_SITE_URL` | `https://synthworx.com` | Canonical origin, sitemap, robots, RSS |
| `PORT` | `4321` | Port used by `npm start` on Railway |

Copy `.env.example` to `.env` for local overrides. Do not commit secrets; there are none in this project.

## Deploy to Railway

The repo includes `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

1. Create a Railway project and service from this repo (or `railway init` + `railway up`).
2. Set `PUBLIC_SITE_URL=https://synthworx.com`.
3. Deploy. Confirm the Railway URL serves the site before touching DNS.
4. In Railway, add custom domains `synthworx.com` and `www.synthworx.com`.
5. Copy the **CNAME target** and **TXT name/value** Railway shows (the apex and `www` targets are different).

Railway builds with Node 24 and serves `dist/` through `server.mjs`. The live service is `synthworx-site`; see [`DEPLOYMENT.md`](DEPLOYMENT.md) for the exact DNS records and verification steps. The server 301s `www.synthworx.com` to `synthworx.com`.

### Namecheap DNS cutover

Current records (verify before changing): `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com` are the old Vercel deployment. `pikki` CNAME points at Railway and must not change. Zoho MX/SPF/DKIM and Google verification records must not change.

Target:

| Type | Host | Value | TTL |
|---|---|---|---|
| ALIAS | `@` | `5xyqzsza.up.railway.app` | 5 min during cutover |
| CNAME | `www` | `7k8xv2p7.up.railway.app` | 5 min |
| TXT | `_railway-verify` | `railway-verify=bbbe573135738fa6113bd9076d78ce8eeaf0319a9dac478027d284803e3faa5b` | 5 min |
| CNAME | `pikki` | `apgqlbv9.up.railway.app` (unchanged) | 5 min |
| MX | `@` | Zoho records (unchanged) | — |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hello@synthworx.com` | 5 min |

Namecheap BasicDNS supports ALIAS at the apex, which can coexist with MX. A CNAME at the apex cannot.

After 48 hours of clean traffic, raise TTL to 1 hour. Canonical host is `https://synthworx.com`; `www` should 301 to the apex.

Verify:

```sh
dig +short A synthworx.com
dig +short CNAME www.synthworx.com
curl -I https://synthworx.com
curl -I https://www.synthworx.com
curl -I https://pikki.synthworx.com
```

Rollback: restore `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com`, and un-pause the Vercel deployment.

## PDFs

The case study PDFs in `public/pdfs/` are generated from the rendered pages with headless Chrome:

```sh
mkdir -p public/pdfs
for slug in amazon-llm-at-scale kamaloki-long-context tappi-browser pikki; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="public/pdfs/${slug}.pdf" \
    "http://localhost:4321/work/${slug}"
done
```

The print stylesheet hides the header, footer, and CTA buttons.

## Trust rules

- No fake logos, client names, testimonials, or “trusted by” claims.
- No unlabeled Amazon metrics; Amazon work is labelled **Built at Amazon** and sanitized.
- No “open source” claim on a private repo.
- No “open to jobs,” “freelance available,” or generic AI buzzwords.
- The diagnostic is the entry offer. No free calls, no free proposals.
- Publish prices. Do not add a “contact us for a custom quote” tier.

## License

Code is MIT licensed. Site copy, case studies, images, and the Synthworx name are © Synthworx DNS Ventures LLC; not licensed for reuse. See `LICENSE`.
