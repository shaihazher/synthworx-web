---
title: "Pikki: a live, paid Chrome extension"
subtitle: "A job-search agent that proves which jobs are real, finds people who can refer you, and applies without inventing facts."
label: "Independent product"
year: "2026"
sector: "Consumer AI · Chrome extension"
summary: "Pikki is a live product with three paid plans, a local-first data model, and a self-updating native helper. It checks postings for ghost-job and scam signals, finds referral paths, and prepares applications from a verified profile."
metric:
  value: "Live"
  label: "paid product · $19 / $39 / $79 plans"
stack:
  - "Chrome extension"
  - "Local database"
  - "Gemini Nano on-device"
  - "Native update helper"
  - "Job-board integrations"
stats:
  - value: "3"
    label: "paid plans"
  - value: "16+"
    label: "job boards"
  - value: "Local"
    label: "data by default"
  - value: "Live"
    label: "in production"
order: 4
featured: true
---

## Context

Job hunting runs on bad leads. A large share of postings are ghost jobs or stale reposts, employment scams are rising, and most applicants have no route to a referral. Pikki is a Chrome extension that treats those as product problems, not content problems.

It is live at [pikki.synthworx.com](https://pikki.synthworx.com), with a free tier and three paid plans ($19, $39, $79 per month). It runs in the user's own signed-in Chrome.

## The problem

The product had to do four things at once, on consumer hardware, without becoming another source of fabricated applications:

1. **Tell a real job from a ghost job.** A posting can be an old repost, a resume-collection ad, or an outright scam. The user needs evidence, not a score.
2. **Find a way in.** Referred candidates are hired at a much higher rate than cold applicants, but most seekers do not know who to ask.
3. **Apply honestly.** A generated resume that invents a title or a date is worse than no application. The system must only reword what is already true.
4. **Keep the data local.** Resumes, answers, jobs, and applications live on the user's computer. The server passes model requests through and keeps counts, not content.

## Architecture

Pikki is split between the extension, a local data layer, an on-device model path, and a server that brokers model calls. The extension owns the user's session and the page; the server never holds the user's resume.

<div class="arch-flow">
  <div class="arch-node"><b>Side panel</b><span>profile · plans · queue</span></div>
  <div class="arch-arrow">→</div>
  <div class="arch-node arch-node--accent"><b>Local DB</b><span>resume · jobs · applications</span></div>
  <div class="arch-arrow">→</div>
  <div class="arch-node"><b>Model path</b><span>Nano · DeepSeek · server</span></div>
  <div class="arch-arrow">→</div>
  <div class="arch-node"><b>Job sites</b><span>user's signed-in session</span></div>
  <div class="arch-arrow">→</div>
  <div class="arch-node"><b>Review</b><span>user approves · submits</span></div>
</div>
<p class="arch-note">Simplified. CAPTCHAs and account creation always wait for the user.</p>

The key decisions:

- **Local-first.** The database is on the user's machine. Model requests are proxied; the text is not stored. The optional profile backup is unticked by default in the UK, EU, and EEA.
- **On-device where it fits.** Searching, scoring, the fake-job check, people search, Gmail status, and outreach drafts run on Chrome's built-in Gemini Nano where the machine supports it. A user can add their own DeepSeek key to unlock the rest at no model charge from Pikki.
- **Evidence, not verdicts.** A ghost-job or scam flag quotes the page or record that produced it. The user can check the reasoning.
- **Approval gates.** Pikki never solves a CAPTCHA, never creates an account without approval, and never submits twice. The user decides whether Pikki clicks the final Submit.
- **No invented facts.** Tailored resumes reword existing content. Anything the system cannot answer from the profile comes back as a question.
- **A self-updating native helper.** Because the extension is installed outside the Chrome Web Store, a small native helper updates it from a signed, checksummed download. The helper takes no address, path, or command from anything except Pikki.

## What I did

- Designed and built the product end to end: extension, local data model, model routing, job-board integrations, billing, and update path.
- Built the ghost-job and scam checks with page-level evidence.
- Built the referral search and outreach drafting flow.
- Built the application preparation and submission flow with approval gates and a no-fabrication rule.
- Built the local-first privacy model and the public privacy page.
- Shipped it as a live paid product with three plans, not a demo.

## Results

| Measure | Result |
|---|---|
| Status | **Live, paid, in production** |
| Plans | **Free · $19 · $39 · $79 per month** |
| Job boards | **16+**, including LinkedIn, Indeed, Naukri, Workday, Greenhouse |
| Data model | **Local database**; server keeps counts, not content |
| Update path | **Self-updating native helper** with checksum verification |
| Model path | **On-device Nano** where supported; user-supplied key optional |

This is a product case study, not a client engagement. There is no client metric to report. The proof is that the product is live, priced, and used — with a privacy page that describes exactly what leaves the machine.

<div class="metric-inline">
  <div><strong>Live</strong><span>paid product</span></div>
  <div><strong>3</strong><span>paid plans</span></div>
  <div><strong>16+</strong><span>job boards</span></div>
  <div><strong>Local</strong><span>data by default</span></div>
</div>

## What it proves

A working product with pricing and a privacy page is stronger evidence than a deck. It also forces the unglamorous parts — install, update, billing, data residency, approval gates — to be real. Those are the parts that decide whether an AI product survives contact with users.

The product is live at [pikki.synthworx.com](https://pikki.synthworx.com). The source stays private; the architecture and demo are in [pikki-showcase](https://github.com/shaihazher/pikki-showcase).
