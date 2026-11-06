---
title: "The seven ways production AI fails"
subtitle: "A field guide to the failure modes I look for in a diagnostic — and the first fix for each one."
date: 2026-11-05
readingTime: "12 min"
summary: "Seven repeatable failure modes: the half-working vendor tool, the manual document workflow, classification at scale, the agent that stops on record 41, the runaway bill, the expensive wrong answer, and the unowned roadmap."
order: 4
---

## The failures repeat

Every production AI system is different. The failure modes are not.

After enough diagnostics, the same seven shapes appear. They are not model failures in the narrow sense. They are system failures that show up as model behaviour: a wrong answer, a slow request, a bill that does not match the demo, an agent that stops without a reason.

The list is useful for two reasons. It helps a buyer recognise their own problem in someone else's language. And it gives an engineer a checklist that is about the system, not the prompt.

## 1. The vendor sold something that half-works

**What it looks like.** The demo was strong. The contract is signed. In production the tool is right often enough that nobody catches the rest, and the rest is expensive: a claim paid, a quote mispriced, a record misclassified.

**What is usually wrong.** The vendor optimised for the demo distribution. Your data is different: messier, longer, more multilingual, more edge cases, or missing the metadata the tool assumes. The integration passes the output straight into the workflow without a confidence check.

**What to measure.** Accuracy by segment, not overall. The cost of a false positive versus a false negative. The percentage of outputs that receive human review. The time from a wrong output to detection.

**The first fix.** Put a verification layer between the tool and the decision. Route low-confidence outputs to a person or a second model. Measure by segment so the failures stop hiding in the average. Then decide: fix the integration, replace the tool, or retire the workflow.

## 2. A document workflow is eating people

**What it looks like.** Thousands of PDFs, emails, forms, or scans a month. People read them, key data into another system, and check each other. The team is not doing knowledge work; it is moving text between two boxes.

**What is usually wrong.** Extraction is treated as a model problem when it is a pipeline problem. There is no schema, no validation, no confidence threshold, and no exception queue. The model is asked to return a clean answer without being given a way to say “I cannot read this.”

**What to measure.** Straight-through processing rate. Field-level accuracy, not document-level. Cost per document including human review. The percentage of exceptions and the time to clear them.

**The first fix.** Define the schema and the validation rules before touching the model. Extract field by field. Send anything below threshold to an exception queue with the source region attached. The target is not 100% automation; it is a known, measured split between automatic and human handling.

## 3. The classification problem nobody wants to own

**What it looks like.** Tens of thousands of categories, codes, labels, or intents. A rule engine that used to work and now does not. An LLM that is asked to classify into 219 classes and returns a plausible answer with no calibration.

**What is usually wrong.** The team is comparing the wrong things. A generative model is asked to produce a label as text, when the task is a closed-set decision. The eval set is small and unrepresentative. Nobody has measured the accuracy that is actually achievable before promising it.

**What to measure.** Top-1 and top-3 accuracy by class. Calibration, not just accuracy. Cost and latency per item. The confusion pairs that matter operationally.

**The first fix.** Treat it as a ranking problem over a fixed label set, not a generation problem. Measure a simple baseline first: keyword rules, embeddings, a smaller model. Then test whether a probe or a classifier beats it. If the accuracy is not there, the answer may be to narrow the label set or change the process, not to buy a bigger model.

## 4. The agent works in the demo and fails on real records

**What it looks like.** The agent drives a browser or a SaaS tool, gets through forty records, and stops on the forty-first for a reason nobody can reproduce. The logs show a click. They do not show why the click did nothing.

**What is usually wrong.** The agent is given an unbounded page, an untyped action surface, and no check between steps. It is asked to do geometry with a screenshot or guess a selector from a DOM dump. When the page changes, the failure is silent.

**What to measure.** Success rate by step, not by run. The number of retries per record. The failure codes and their frequency. The time to recover from a failed step. The cost per completed record.

**The first fix.** Replace the observation with a bounded inventory of actionable elements. Make each action typed and each failure named: not found, detached, covered, disabled, timeout. Put a check between steps. Use a fixed recipe where the path is known, and reserve the model for the parts that need judgment. A failure that names itself is recoverable; a failure that looks like a click is not.

## 5. The AI bill is out of control

**What it looks like.** A monthly invoice nobody can explain. The team knows the token price, not the cost per completed workflow. Most of the bill is going to a small number of requests that do not need the largest model.

**What is usually wrong.** There is no cost model in the request path. Every request goes to the same model with the same context. Retries and retrieval calls are not counted. The cache is a hope, not a measured hit rate.

**What to measure.** Cost per successful outcome. Cost by route, model, and customer segment. Tokens per request and per workflow. Cache hit rate. Retry rate. The share of spend on requests that could be handled by a cheaper path.

**The first fix.** Put a router in front of the model fleet. Send the easy majority to a smaller model or a cached answer. Cap context. Count every call, including retrieval and retries. Set a cost budget per workflow and alert on it. The target is not the lowest token price; it is the lowest cost per completed outcome at the required quality.

## 6. A wrong answer is expensive

**What it looks like.** The output is used in a decision with consequences: a price quoted, a claim paid, a compliance statement made, a customer told something. The model is usually right, and the exception is the problem.

**What is usually wrong.** There is no source for the claim, no refusal path, and no separation between “the model said” and “the business approved.” The system is optimised for answer rate, not for the cost of a wrong answer.

**What to measure.** The cost of a wrong answer, by category. The percentage of answers with a source. The percentage that should have been refused. The time to detect a wrong answer. The human review rate on high-consequence outputs.

**The first fix.** Put verification between the model and the decision. Require a source for every factual claim. Add a refusal path for anything that cannot be sourced. Route high-consequence outputs to a person. Make the system say “I do not know” in a way the workflow can handle. A lower answer rate with a known error rate is better than a higher answer rate with an unknown one.

## 7. Nobody owns the AI roadmap

**What it looks like.** The board has a mandate. Vendors are pitching. Every option sounds plausible. The engineering team is busy, the data team is separate, and no one has the authority or the time to rank the options.

**What is usually wrong.** The company is buying tools before it has a decision framework. There is no cost model, no eval standard, no build-versus-buy rule, and no owner for the outcome. The roadmap is a list of pilots, not a sequence of decisions.

**What to measure.** The number of active AI initiatives and their owners. Spend by initiative. The decision each initiative is supposed to inform. The time from pilot to production. The number of pilots that were stopped on purpose.

**The first fix.** Write the decision framework before the next vendor call: what must be true for a build, what must be true for a buy, what must be true to wait. Assign one owner for the portfolio. Rank by value and risk, not by enthusiasm. Kill the pilots that cannot reach production. A roadmap with fewer, owned decisions is better than a longer list of experiments.

## The common thread

None of these failures is fixed by a better prompt.

They are fixed by moving a decision out of the model and into the system: a schema, a threshold, a router, a verification step, a named failure, an owner. The model is one component. The system is what survives production.

That is also why a diagnostic comes before a build. The failure mode determines the fix. Without the diagnosis, every fix looks like “try a better model,” and the expensive ones get tried in the wrong order.

The diagnostic is two weeks and $12,500. It identifies the failure mode, the cost, and the first three moves. If it does not find at least three opportunities worth 10× the fee, it is refunded. [Start here](/contact#diagnostic).
