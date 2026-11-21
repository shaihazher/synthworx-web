# Audience Cut

The public site at https://synthworx.com serves independent producers and distributors preparing a US film release. The site runs Astro with a Node server on the existing synthworx-site Railway service. Push the tested site to main to deploy.

Run npm ci, npm run check, npm run build and npm test. For a local production preview set PORT and INQUIRY_DIR to a private temporary directory before running npm start.

## Contact inbox

The form posts to /inquiries. Each accepted inquiry is a private JSON file on the synthworx-site production volume at /data/audience-cut. The server confirms a submission only after writing and syncing the file. Review the inbox in the linked service with:

    railway ssh -- ls -lt /data/audience-cut
    railway ssh -- cat /data/audience-cut/RECORD-ID.json

Reply from hello@synthworx.com. Every new inquiry queues an immediate internal notification to hello@synthworx.com through Zoho Mail. The sender’s contact email is included in the body. The private record tracks pending or sent status. A single worker retries failures on the attached volume after restarts. Older records without a notification field are historical. Railway holds ZOHO_ACCOUNT_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN as runtime settings. The form does not enroll contacts in outreach. Access to the inbox requires authenticated Railway project access. For an individual deletion request, match the email and inquiry before deleting that specific record.
