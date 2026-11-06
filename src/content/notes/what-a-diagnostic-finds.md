---
title: "What a paid AI diagnostic actually finds"
subtitle: "The document is not a strategy deck. It is the arithmetic, the failure modes, and the three decisions that matter — before you spend the build budget."
date: 2026-11-02
readingTime: "8 min"
summary: "What the two-week AI Production Diagnostic contains, what it typically finds, and why it comes before a build. Includes the cost model, the eval gap, and the go/no-go."
order: 3
---

## The diagnostic is a decision document

A diagnostic is not a precursor to a proposal. It is the product.

The buyer is about to spend $50,000 to $500,000 on an AI system, or they are already spending it and the invoice is not producing the result they expected. The diagnostic exists to replace assumptions with numbers: what the workflow costs today, where the system breaks, what each failure costs, and what to do first.

Two weeks, fixed fee, written output. If the answer is “do not build this,” that is a successful diagnostic. It has saved the build budget and the six months.

## What goes in

The output is one document, plus a recorded walkthrough and one written round of questions. It has five parts.

**1. The current-state map.** The workflow, the systems it touches, the model and provider, the retrieval path, the evaluation method (or the absence of one), the deployment shape, and the people who own each part. This is not a architecture diagram for its own sake. It is the map that shows where the system can fail.

**2. The cost and latency model.** Volume × tokens × price, plus retrieval, infrastructure, retries, and human review. Every assumption is labelled as an assumption. The model produces a cost per request, a monthly run rate, and a sensitivity table: what happens if volume doubles, if the model changes price, if the cache hit rate falls.

**3. The failure-mode register.** A list of the ways the system can be wrong, slow, expensive, insecure, or non-compliant — with the evidence for each one and a cost estimate. Not a generic risk list. The failure modes that are specific to this workflow and this architecture.

**4. The evaluation gap.** What is measured today, what is not, and what a useful eval set would look like. Most teams have a demo set, not an eval set. A demo set is chosen to pass. An eval set is chosen to catch the failures that matter.

**5. The ranked plan and the recommendation.** What to do first, what to avoid, what each would take, and a buy / build / wait recommendation. The ranking is by leverage, not by effort. The first item is usually the one that changes the cost or the failure rate fastest.

## What it usually finds

The specifics vary. The shape repeats.

### The model is not the problem

The most common finding is that the model is doing work the system should do. A prompt is carrying business logic that belongs in code. A retrieval step is missing metadata. A validation layer does not exist. The model is asked to be accurate on inputs that should have been rejected before inference.

The fix is usually not a better model. It is moving a decision out of the prompt and into a deterministic check, a filter, or a schema.

### The cost is in the wrong place

Teams usually know the model price per token. They do not know the cost per completed workflow. The difference is retries, retrieval calls, context that is re-sent on every turn, and human review of failures.

A cost model often shows that 60–80% of spend goes to a small set of requests that could be routed to a cheaper path, cached, or batched. The first fix is not a new provider. It is routing and measurement.

### The eval set is a demo set

A demo set is built to show the system works. An eval set is built to show where it fails. Most teams have the first and call it the second.

The diagnostic looks at the examples, the labelling, the scoring, and the decision threshold. It asks: if the model got worse tomorrow, would you know? If the answer is no, the eval gap is the highest-risk item on the list.

### The failure is silent

A wrong answer that looks confident is more expensive than an error message. The system needs a verification path: a source, a confidence signal, a refusal, or a human review step. The diagnostic checks whether a failure announces itself or disappears into the workflow.

### The team cannot operate it

A system that only the builder can run is a dependency, not an asset. The diagnostic checks the runbooks, the dashboards, the on-call path, the deployment process, and the cost controls. If the team cannot operate the system without the person who built it, that is a finding.

## What it is not

- It is not a pitch for a build. The recommendation can be “do not build.”
- It is not a code review of every file. It is a review of the system and the decisions that matter.
- It is not a free discovery call with a document attached. It is two weeks of work.
- It is not a guarantee of revenue. It is a guarantee that the arithmetic and the failure modes are written down.

## Why two weeks

Three days reading the systems and the examples. Four days on the cost model, the eval gap, and the failure modes. Three days writing the document and preparing the readout.

It is not longer because a report nobody reads is worth nothing. The constraint forces the ranking: if everything is a priority, nothing is.

## Why $12,500

The fee buys two weeks of senior attention and replaces the work most firms spread across three meetings and a proposal. It is priced so that only people who intend to act on it buy it.

The guarantee is simple: if the diagnostic does not identify at least three opportunities worth 10× the fee, it is refunded. If it does, the fee is credited 50% toward a sprint or build signed within 30 days.

The arithmetic matters more than the document. A $12,500 diagnostic that stops a $150,000 build from going in the wrong direction has paid for itself before the first line of code.

## What happens after

Three outcomes:

1. **Build.** The diagnostic produces the scope, the acceptance criteria, and the eval baseline. The build starts from evidence.
2. **Buy.** The right answer is a product the team can buy without me. I say so in writing. The diagnostic still tells them what to configure, what to measure, and what to avoid.
3. **Wait.** The workflow is not expensive enough, the data is not ready, or the team has a more important problem. The document says so, and the money stays in the business.

The diagnostic is the entry point because it is the smallest unit of work that produces a decision. Everything else is a consequence of that decision.
