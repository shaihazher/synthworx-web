---
title: "3–10× fewer tokens: index the page, don't describe it"
subtitle: "A browser agent that sends element references instead of DOM, screenshots, or coordinates — and why the token bill is an architecture decision."
date: 2026-10-28
readingTime: "9 min"
summary: "How Tappi Browser reduces browser-agent token usage by indexing interactive elements, returning bounded observations, and keeping the action surface typed. Includes the token arithmetic and the failure modes the design removes."
order: 2
---

## The bill is in the observation

A browser agent spends most of its tokens looking at things it will not act on.

A typical page is 80–150 KB of HTML. Tokenised, that is roughly 20,000–40,000 tokens before the model has done anything. A screenshot is cheaper in tokens but more expensive in reasoning: the model has to find the target visually, reason about coordinates, and recover when the layout shifts. A DOM dump is explicit but enormous, and most of it is navigation, footer links, tracking attributes, and inline styles the task does not need.

The cost compounds. An agent that takes twenty steps and reads the page on each one has paid for the page twenty times. The model context fills with markup, the important state gets buried, and the agent starts repeating itself.

Tappi Browser started from a simple observation: the browser already parsed the page. It knows which elements are interactive, what role they have, and where they are. The model should ask for a *reference* to an element, not for the page.

## The reference model

The indexer walks the DOM, including open shadow roots and frames, and assigns a stable reference to each interactive element. The model sees a compact inventory:

```text
[ref=e12] link "Pricing"
[ref=e18] button "Start free trial"
[ref=e24] textbox "Work email"
[ref=e31] button "Continue"
```

An action is a typed call against a reference:

```json
{ "action": "click", "ref": "e18" }
```

The browser resolves `e18` at action time and clicks the element. The model never receives a selector, a coordinate, or a DOM subtree. It receives the element it asked for, plus a bounded amount of surrounding state.

That is the core trade: move the representation work from the model to the browser.

## The token arithmetic

Take a 120 KB page. The exact token count depends on the tokeniser, but a reasonable estimate is 4 characters per token, so about 30,000 tokens for the raw HTML.

A reference inventory for the same page might contain 40–80 interactive elements. At roughly 8–15 tokens per line, that is 400–1,200 tokens. Call it 1,000 tokens to be conservative.

That is a **30× reduction** on the first observation. The measured range for Tappi is **3–10×** across real tasks, not 30×, for three reasons:

1. **Not every page is 120 KB.** A small form may be 10 KB, where the raw read is already cheap.
2. **The agent still needs content.** Reading a paragraph, a table, or a confirmation message costs tokens. The reference inventory is not the whole observation.
3. **The baseline is not always a full DOM dump.** Some browser tools already prune the DOM. The comparison is against conventional browser tooling, not a strawman.

The range is honest because the baseline is a range. The architectural point holds: the observation is bounded by the number of things the agent can act on, not by the size of the page.

## Bounded observations

A reference inventory is necessary but not sufficient. If every tool result returns the whole inventory, the agent still pays for the page on every step.

Tappi bounds the observation at the tool boundary:

- A click returns the element that was clicked, whether it succeeded, and the small set of state changes that matter (navigation, dialog, validation message).
- A read returns the requested region, not the page.
- A failed action returns the reason in a named form — `not_found`, `covered`, `disabled`, `detached` — so the agent can recover without re-reading everything.

This is the difference between a tool that *can* return a small result and a tool that *does* return a small result. The interface enforces the bound.

## The real browser

The agent runs in a Chromium-based browser and drives the user's signed-in session through CDP. It is not a separate headless profile.

That choice is about capability, not just detection. A headless profile has no SSO, no cookies, no extensions, and no history. The tasks that matter — a work dashboard, a banking portal, a SaaS admin — are behind a login. A browser agent that cannot use the user's session cannot do the work.

It also removes the `navigator.webdriver` footprint that headless automation leaves. The page sees a normal browser because it is one.

The trade is that the agent shares a session with the user. Tappi isolates agent work in its own tab group and keeps the user's tabs separate. The agent can act; the user can see what it is doing.

## Playbooks

Most agents start from zero on every site. A domain that is used every day should get cheaper and more reliable over time.

A playbook records the steps that worked: the URL pattern, the sequence of references and actions, the checks between steps, and the failure modes that were observed. On the next run, the agent starts from the known path and only explores when the path breaks.

This is not a hard-coded script. The playbook is a prior, not a program. If the page changes, the checks fail and the agent falls back to exploration. The playbook is updated with what worked.

The token effect is largest on repeat tasks: a workflow that took twenty exploratory steps can take five known steps, with a much smaller observation at each one. The reliability effect is larger still. The agent is not rediscovering the same page every morning.

## What this removes

The design removes three failure modes that look like model problems but are interface problems:

**"The agent clicked the wrong thing."** A reference is resolved by the browser against the element it indexed. The model is not guessing a coordinate or a CSS selector. If the reference is stale, the tool returns `detached` instead of clicking something else.

**"The agent stopped and nobody knows why."** A failure is named: the element was covered, the frame was not ready, the dialog was open, the action timed out. The agent gets a specific state to recover from. The trace says what happened.

**"The context filled up and it forgot the task."** The observation is bounded, so the context is spent on the task and the state, not on markup. A long session stays coherent for longer.

None of this is a better model. It is a better interface between the model and the browser.

## What it does not solve

- **Visual tasks.** If the task depends on the rendered appearance — a chart, a layout bug, a CAPTCHA — the agent needs a screenshot. Tappi supports screenshots; they are just not the default observation.
- **Canvas and closed shadow DOM.** If the page does not expose accessible elements, the indexer cannot reference them. The agent falls back to coordinates or application-specific tools.
- **Sites that fight automation.** Some sites detect and block any agent, regardless of footprint. The answer is usually a first-party integration or a human in the loop, not a stealthier browser.
- **Task planning.** A small, referenced observation makes planning easier, but it does not make a weak model a good planner. The model still has to decide what to do.

## The general lesson

Browser agents are usually designed as "model plus tools." The token bill is treated as a property of the model. In practice, most of the bill is a property of the observation interface.

If you are building an agent over a large, structured surface — a browser, a document system, a codebase, a CRM — the first design question is not which model to use. It is what the model is allowed to see on each step, and how small you can make that while still letting it act.

The open-core SDK and a runnable fixture that demonstrates the token accounting are in [tappi-goes-bonsai](https://github.com/shaihazher/tappi-goes-bonsai).
