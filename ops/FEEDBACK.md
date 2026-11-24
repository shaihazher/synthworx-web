# Reviewing Synthworx product feedback

Run the review at the start of the product’s daily and weekly workflow. From this checkout, use `python3 ops/feedback.py review PRODUCT daily` or `python3 ops/feedback.py review PRODUCT weekly`. The product names accepted by the command are `arrival-slip`, `audience-cut`, `caption-desk`, `culture-register`, `federal-desk`, `outcome-prompt`, `pikki-jobs` and `synthworx` for general site feedback. Audience Cut’s two reviews also own the general site queue.

The command reads the production form records and product-addressed Zoho messages, including already-read and archived correspondence. It reconciles the website’s email copies by feedback ID. Federal includes its native form and Audience Cut includes film inquiries. Inquiries can be buyer requests without containing a product complaint. Outcome Prompt also returns completed rewrites and voluntary votes by rewrite date and free or paid use. A vote supplies a signal to investigate. The counts exclude QA sessions. A failed source produces an error and a nonzero exit. Retry that source and report the missing coverage if it remains unavailable. The `--summary` option hides message contents and does not acknowledge them.

Read the actual notes, including anonymous ones. Direct email with a feedback subject that names no product goes to the general queue for routing. Also open the product’s regular support and customer threads, feedback from deliveries, and any product-specific sources identified in its runbook. Use `add PRODUCT REF "short description"` for each piece of user feedback found in another source, including praise, suggestions and reports that need no change. Use the Zoho `mail:MESSAGE_ID` when applicable, or a stable private source reference. Include the original private thread or folder reference when the other operator needs it to read the full note. Record a disposition so the other cadence can review it independently. Reuse the existing reference for a repeat sighting of one message. Independently reported instances of the same problem are evidence of recurrence. Link them to the same fix.

On the daily run, reproduce a reported problem through the affected visitor, free or paid path. Correct a verified in-scope gap in the product, copy, fulfillment or operating workflow as soon as feasible. Publish through the product’s established release procedure and repeat the original action on the released surface. For service changes, check the actual deliverable. If evidence is inconclusive, record the question and next check. A practical adjustment can be justified by one reproducible report. Follow the product’s existing authority for correspondence and use an optional reply address when a reply is appropriate.

On both cadences, also open a feedback route from the product and exercise one customer task, even when the inbox is quiet. Rotate visitor, free-user and paid-customer paths across runs. If a route has changed or delivery is in doubt, use a labeled internal note to verify receipt. Repair a reproducible gap and record the affected path and result.

On the weekly run, read the source notes yourself. Review recurring themes, open items, the past week’s decisions, and fixes the daily operator recorded. Recheck the customer path and the promised effect where measurable. Reopen ineffective repairs. Implement and verify justified changes during the review, including improvements to the daily workflow. Give remaining work a specific next action, owner and date. If no change is justified, record why. Put the reference and result in the product’s existing dated report. Keep email addresses, customer documents and full note text private.

Use `python3 ops/feedback.py` followed by one of these commands. `CADENCE` is `daily` or `weekly`.

```
record PRODUCT CADENCE REF open "Owner and next action" --next YYYY-MM-DD
record PRODUCT CADENCE REF fixed "What changed" --proof "Release or service record, customer path exercised, observed result"
record PRODUCT CADENCE REF closed "Why no further change is justified"
record PRODUCT CADENCE REF seen "Independent check and result"
record PRODUCT CADENCE REF qa "Internal test receipt and confirmation"
route PRODUCT CADENCE REF CORRECT_PRODUCT "Reason, owner and next action" --next YYYY-MM-DD
```

An open item stays visible across runs. A disposition made on one cadence stays available to the other for independent review. The command stores source IDs, decisions and verification history in `~/.local/state/synthworx/feedback/reviews.sqlite` on the operating Mac. Full message bodies come from the original private sources. Match the original note before classifying QA or a duplicate. Use `route` when a note belongs to another product. Record a reproducible failure of the feedback route itself as a product issue and check recovery end to end with a labeled internal test.
