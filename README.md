# Synthworx

The product index at https://synthworx.com lists the active Synthworx products by name and task. Product names, descriptions and destinations are maintained in `src/data/products.ts`. The independent film release service and its case studies live at https://synthworx.com/audience-cut. The site runs Astro with a Node server on the existing synthworx-site Railway service. Push the tested site to main to deploy.

Run npm ci, npm run check, npm run build and npm test. For a local production preview set PORT and INQUIRY_DIR to a private temporary directory before running npm start.

## Homepage artwork

The [index-box cover](src/assets/portfolio/card-index.webp) was made with the built-in ImageGen tool. The product cards use the Arrival Slip receipt, Caption Desk station photograph, and Pikki bird from their respective sites. The résumé and prompt excerpts are typeset from those products’ published examples.

<details>
<summary>Generation prompt for the index-box cover</summary>

Create a photorealistic editorial studio photograph for the hero of an independent software studio’s product index. Landscape 3:2. The single subject is a beautiful vintage vermilion-orange painted steel desktop index-card file, open at the top, full of warm ivory index cards with six staggered large stagger-cut tab dividers in deep cobalt blue, wine red, ochre yellow, forest green, pale lavender, and burnt orange. A real, three-dimensional mid-century office object with subtly worn powder coat, crisp folded edges. Three-quarter front view from a little above, seeing the forward face and right side, a small blackened brass rectangular label holder on the front with a small ivory insert neatly typeset 'INDEX' in plain uppercase black. The open container has no lid in the frame. The stepped tabs are clearly visible peeking out in depth, unmarked. Object centered, entire object visible with generous neutral breathing room all around; object fills about 72% of image width. It rests on a continuous matte, very light warm putty-gray studio sweep, no horizon line. Directional daylight from upper left, a gentle but distinct soft shadow cast to the right. Physical paper fibres and matte painted steel with fine subtle film grain. Balanced sophisticated print-catalogue product photography, restrained, confident color and convincing realism. No other objects, no people, no illustration, no decorative graphics, no watermark, no captions.

</details>

## Product feedback

Both the daily and weekly product operators use the [feedback review procedure](ops/FEEDBACK.md) to read source notes, act on verified gaps and check each other’s fixes.

Read new notes in the **Inbox** of hello@synthworx.com in [Zoho Mail](https://mail.zoho.in/). Website notes use the subject `<product name> feedback` and include the reply address when the sender supplies one. A company-sent form notification is an internal copy. Use the reply email in its body to contact the writer. Pikki and Culture Register also receive direct email from users. Outcome Prompt's one-click ratings remain in its aggregate product metrics.

The product index links to /feedback. Product-specific links preselect the destination. The server saves notes privately on the attached Railway volume before confirming receipt, then queues a Zoho notification with retries. In the synthworx-site service, use `railway ssh -- ls -lt /data/product-feedback` to find a note by its ID. Federal Evidence Desk's own form keeps its existing records in `/data/federal-evidence-desk/feedback`, sends new notes to the same mailbox and still appears in that product's private site snapshot. To test the shared form locally, set FEEDBACK_DIR to a private temporary directory.

## Contact inbox

The form posts to /inquiries. Each accepted inquiry is a private JSON file on the synthworx-site production volume at /data/audience-cut. The server confirms a submission only after writing and syncing the file. Review the inbox in the linked service with:

    railway ssh -- ls -lt /data/audience-cut
    railway ssh -- cat /data/audience-cut/RECORD-ID.json

Reply from hello@synthworx.com. Every new inquiry queues an immediate internal notification to hello@synthworx.com through Zoho Mail. The sender’s contact email is included in the body. The private record tracks pending or sent status. A single worker retries failures on the attached volume after restarts. Older records without a notification field are historical. Railway holds ZOHO_ACCOUNT_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN as runtime settings. The form does not enroll contacts in outreach. Access to the inbox requires authenticated Railway project access. For an individual deletion request, match the email and inquiry before deleting that specific record.


## Caption Desk

The caption checker and its managed service live at https://synthworx.com/caption-desk. Railway serves the public files in `public/caption-desk`. The browser processes captions locally. The same-origin `/caption-desk/api/intake` endpoint relays submitted diagnostics to the existing Caption Desk queue. Its runtime credential authorizes intake forwarding only. Operator access and buyer data stay in the separate Caption Desk system.
