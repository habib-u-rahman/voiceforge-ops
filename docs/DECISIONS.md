# Architecture Decision Log

Short record of the intentional design choices behind VoiceForge Ops, so future
changes (including AI-assisted ones) can be checked against *why* things are
built this way, not just *what* the code currently does.

## ADR-001: Multi-agent pipeline instead of one LLM call

**Decision:** Split `parse_actions_service` into specialist agents — Intent
Agent, Calendar Agent, Task Agent, Communication Agent, Risk Agent — each with
a single narrow responsibility, chained in `backend/app/services.py`.

**Why:** A single prompt asking an LLM to extract actions *and* judge risk
*and* resolve scheduling conflicts *and* estimate latency produces less
reliable, less auditable output than a chain where each stage reasons over
the previous stage's already-verified output. It also lets us log a
per-request `agent_trace` for transparency.

**Implication for future changes:** New action types should get their own
enrichment step (or extend an existing specialist), not a new field bolted
onto the Intent Agent's prompt.

## ADR-002: Conflict detection and rescheduling are deterministic code, not LLM output

**Decision:** `_calendar_agent` / `_find_conflict` / `_find_next_free_slot` in
`backend/app/services.py` compute scheduling conflicts and the next free slot
in plain Python against real datetime ranges, instead of asking the LLM to
reason about overlaps.

**Why:** LLMs hallucinate calendar math. Conflict detection is ground truth
that downstream risk assessment depends on, so it must be deterministic.

**Implication for future changes:** Don't move conflict/reschedule logic back
into a prompt. If the rules change (e.g. business hours, step size), change
the Python constants, not the Intent Agent's system prompt.

## ADR-003: Risk Agent reasons over the enriched action set, not the raw transcript

**Decision:** `_risk_agent` runs last, after Calendar/Task/Communication
enrichment, and receives the already-conflict-checked actions plus
`conflict_notes` — not just the raw user transcript.

**Why:** Risk/confidence scoring is only meaningful against the actions that
will actually be dispatched (post-rescheduling), not the agent's first draft.

**Implication for future changes:** If a new enrichment stage changes an
action's timing, recipient, or scope, it must run *before* the Risk Agent in
the pipeline, not after.

## ADR-004: Groq (Whisper-v3 + a hosted chat model) for the full ASR + reasoning path

**Decision:** Both transcription and multi-intent parsing run on Groq's LPU
inference (`whisper-large-v3` for ASR, currently `openai/gpt-oss-120b` for
chat/reasoning — swapped in 2026-08 after Groq deprecated
`llama-3.3-70b-versatile`), not OpenAI or a local model.

**Why:** The demo's value proposition is sub-second, executive-usable voice
command turnaround; Groq's LPU latency is the enabling factor, not the
specific model ID — the chat model is expected to change again as Groq's
catalog evolves, and that's fine as long as it still supports JSON mode.

**Implication for future changes:** Don't introduce a slower model in the
critical path without also revisiting the "sub-500ms" latency claims surfaced
in the UI (`Header.jsx`) and README.

## ADR-005: Webhook dispatch and Supabase logging are independent failure domains

**Decision:** In `dispatch_actions_service`, a failed Make.com webhook does
not prevent writing the audit log row to Supabase, and vice versa — each has
its own try/except and status flag.

**Why:** The audit trail must survive even if the downstream integration is
unreachable during a live demo; judges seeing a "SAVED" audit log despite a
webhook hiccup is the point of the try/except split.

**Implication for future changes:** Don't wrap both calls in one try/except
block that would make one dependent on the other's success.
