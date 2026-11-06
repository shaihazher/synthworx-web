---
title: "Long-context memory is a cache problem"
subtitle: "What a 1.1M-token session taught me about KV stores, attention probes, and the limits of a bigger context window."
date: 2026-10-20
readingTime: "11 min"
summary: "A technical note on Kamaloki: writing a session's KV cache to disk, probing it for relevant spans, and splicing them back into a small model's context. Includes the measured results and the parts that did not work."
order: 1
---

## The token number is not the memory

A model advertised with a 1M-token context is not a model that remembers a 1M-token session. It is a model that can accept 1M tokens in one forward pass, at a cost that grows with the sequence, on hardware that has to hold the whole KV cache.

For an agent that runs for hours, that distinction is the whole problem. Every new turn either re-reads the session or loses it. Re-reading is expensive and slow; losing it is a product failure. The usual workarounds — summarise the history, retrieve text chunks, stuff the last N turns — all trade one failure for another. A summary loses the exact detail. Text retrieval loses the model's own representation of the detail. A tail window forgets everything older.

Kamaloki started from a different premise: the model already computed a representation of the session when it read it. Keep that representation. Retrieve from it. Put the relevant part back into the model's context when it is needed.

That is a cache problem, not a context-window problem.

## The constraints

The reference machine was an Apple laptop with 8 GB of target memory. The model was Gemma 4 E4B, 4-bit, running through MLX. The session was a real 1.1M-token agent transcript: 94 exchanges, 15 planted facts, and 42 questions about the work in the session.

The targets were deliberately narrow:

- Recall planted facts that appear exactly once, anywhere in the session.
- Keep peak memory under the 8 GB budget.
- Assemble the history for a question in under a second, not tens of seconds.
- Preserve the model's answers. An approximation that changes behaviour is not a memory system.

The comparison points were a frontier model reading the raw session and the same small model holding the last 107K tokens raw.

## Architecture

Kamaloki has four parts: a writer, a store, a probe, and a splicer.

**The writer** runs alongside the model. As the session is processed, it writes the KV cache for each block to disk. Old blocks are compacted: only the global-attention layers are kept, at 4-bit, with keys rotated back to position zero and quantised per channel. The sliding-window layers are dropped for old blocks because they cannot attend that far back anyway. The compact store is about 4.8 KB per token, down from roughly 57 KB per token for the full cache.

**The store** is append-only. A save writes only what is new. Each block keeps per-chunk mean keys as a resident representative, so candidate selection does not re-read the full block.

**The probe** scores the current query's attention against the stored keys and selects the spans that matter. At 1.1M tokens, scoring took 0.67 s and the whole step — probe plus rebuild — took 2.3 s. Probe cost is close to flat from 0.5M to 1.1M tokens because the two-level index only engages above a threshold.

**The splicer** takes the selected spans and puts them back into the model's working context. The stored keys were written at their original positions. RoPE rotation moves every token in a span by the same delta, so the span can be placed at a new logical position without re-running the model. The most recent turns are computed fresh; the splice only supplies the distant memory.

The assembled context for the test question was about 28K tokens: system prompt, two retrieved spans, and the recent tail. The session was 1.1M tokens. The model never saw the other 1.07M.

## Results

The planted-fact set is the clean measure. Each fact appears exactly once, so there is no way to answer it from the recent tail.

| System | Overall | Planted facts | Old facts (≥20 exchanges) | Peak memory | Per question |
|---|---:|---:|---:|---:|---:|
| DeepSeek Flash, raw session (~981K tokens) | 96.5% | 13/15 | 11/12 | cloud | — |
| **Kamaloki, E4B, ~28K working context** | **89.5%** | **15/15** | **12/12** | **4.93 GB** | **3.4 s** |
| Kamaloki, two-level probe | 87.7% | 13/15 | 10/12 | 4.93 GB | 3.3 s |
| E4B, last 107K raw tokens, no retrieval | 50.9% | 2/15 | 0/12 | 8.25 GB | — |

A 4B model with a 28K working context recalled **15/15** planted facts from a session 40× longer. The frontier model reading the raw session recalled 13/15.

History assembly — the time between a question arriving and the model being able to generate — was **0.78 s** with splicing versus **24.6 s** for a full gold re-prefill. That is the **31×** number. It is not a generation speedup; it is the cost of rebuilding the context.

The overall score is lower than the frontier model's because 6 of the 42 transcript questions were missed. Those questions are about task data that recurs across the session; the no-retrieval baseline still gets 27/42 of them, which tells you the set is not a clean memory test. The planted facts are.

## What did not work

Two results matter as much as the wins.

**The 4B model could not do the agentic tasks.** On a separate 14-task suite, Kamaloki's model scored 0/14 while DeepSeek Flash scored 14/14. The memory harness worked. The model could not plan and call tools well enough. A memory architecture does not turn a small model into a capable agent; it only gives a capable-enough model access to a longer history. That boundary is worth stating plainly.

**The two-level probe cost recall at this scale.** It was added for sessions above ~2M tokens, where a flat probe over every chunk becomes expensive. At 1.1M tokens it lost one planted fact (13/15 vs 15/15) and saved no meaningful time (3.3 s vs 3.4 s). It is disabled by default at this scale. The lesson is that an index optimised for a larger scale can be worse at the scale you are actually running.

There was also a real memory bug. On turns of 28K–68K tokens, the step rebuild peaked at 9.21 GB because it spliced the full span through all 24 layers in float32, even though the 20 sliding layers keep only their last 511 entries. Loading and rotating only the entries that survive brought the peak to 7.85 GB. The worst case is now about 8.0 GB, during scoring, with both the probe cache and the live cache alive. That is inside the 8 GB target with no headroom. An 8 GB total Mac would need more work: bf16 drill keys, freeing the live cache while probing, or a smaller turn budget.

## Why this generalises

The specific model assumptions — 42 layers, four global-attention layers, proportional RoPE, a 512-token sliding window — are Gemma 4 details. The pattern is not:

1. **Separate storage from context.** The session lives in a store. The context is a working set.
2. **Probe the model's own representation.** Attention against stored keys is a better relevance signal than embedding similarity over text chunks, because it is the representation the model will actually use.
3. **Rotate instead of recompute.** Position is metadata. Moving a span is cheaper than re-running it.
4. **Measure recall on facts that appear once.** Anything that recurs can be answered from the tail and will flatter the system.
5. **Measure the cost of assembly separately from generation.** A memory system that takes 25 seconds to assemble is not usable, even if the answer is right.

The same pattern applies to document sets, support histories, codebase context, and multi-day agent sessions. The unit changes; the architecture does not.

## What I would build next

- **A model-agnostic adapter layer.** The current implementation is tied to one model family's layer layout and RoPE. A clean adapter interface would let the same store and probe work across families.
- **A confidence signal on the probe.** The current probe returns a ranking, not a calibrated probability. A cheap way to say "the memory does not contain this" would prevent confident answers from weak evidence.
- **A cost model in the loop.** The system should choose how much memory to assemble based on the question's value and the token budget, not a fixed 28K window.
- **A public benchmark with real sessions.** The synthetic harness is useful; real agent transcripts with planted facts are better. The [kamaloki-bench](https://github.com/shaihazher/kamaloki-bench) repo is the start of that.

The point is not that a 4B model beats a frontier model. It does not. The point is that a small model with the right memory can answer questions that its context window says it should not be able to answer — at a memory and latency cost you can measure before you commit.
