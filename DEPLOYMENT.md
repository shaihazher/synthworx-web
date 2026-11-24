# Production

The Railway project and service are both synthworx-site. Production serves https://synthworx.com from shaihazher/synthworx-web on GitHub. The www host redirects to the apex. The separate appsynthworx.com sending host redirects to the Audience Cut home when it reaches this service. Old consulting routes redirect to the relevant section.

Build with npm run build. Start with npm start. Verify the public product links, /audience-cut and its case study links after a homepage release. The inquiry tests exercise durable writes against a temporary directory. Only the service's /dist directory serves public files. The private contact-inbox instructions are in README.md.

A site rollback uses the previous Railway deployment or a Git revert. Keep the volume attached through deploys and rollbacks. DNS and the existing Zoho mail records are independent of a site release.

The former Offhours Scout storefront and all paths under `/offhours/` return HTTP 410.
