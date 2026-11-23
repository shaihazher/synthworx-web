# Production

The Railway project and service are both synthworx-site. Production serves https://synthworx.com from shaihazher/synthworx-web on GitHub. The www host redirects to the apex. The separate appsynthworx.com sending host redirects to the Audience Cut home when it reaches this service. Old consulting routes redirect to the relevant section.

Build with npm run build. Start with npm start. Verify deployment using the public home, the case study tabs and an inquiry receipt on the attached /data volume. Only the service's /dist directory serves public files. The private contact-inbox instructions are in README.md.

A site rollback uses the previous Railway deployment or a Git revert. Keep the volume attached through deploys and rollbacks. DNS and the existing Zoho mail records are independent of a site release.

Offhours Scout runs at https://synthworx.com/offhours. The scoped handler in offhours.mjs serves its existing Sites deployment under that path, including its member shelf, Sunday editions and billing routes. Catalog and product releases ship through the Offhours Scout project. The Synthworx site only needs redeployment when that routing or the corporate navigation changes.
