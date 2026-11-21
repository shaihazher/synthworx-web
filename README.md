# Audience Cut

The public site at https://synthworx.com serves independent producers and distributors preparing a US film release. The site runs Astro with a Node server on the existing synthworx-site Railway service. Push the tested site to main to deploy.

Run npm ci, npm run check, npm run build and npm test. For a local production preview set PORT and INQUIRY_DIR to a private temporary directory before running npm start.

## Contact inbox

The form posts to /inquiries. Each accepted inquiry is a private JSON file on the synthworx-site production volume at /data/audience-cut. The server confirms a submission only after writing and syncing the file. Review the inbox in the linked service with:

    railway ssh -- ls -lt /data/audience-cut
    railway ssh -- cat /data/audience-cut/RECORD-ID.json

Reply from hello@synthworx.com. The form does not send automatic emails or add contacts to outreach. Access to the inbox requires authenticated Railway project access. For an individual deletion request, match the email and inquiry before deleting that specific record.
