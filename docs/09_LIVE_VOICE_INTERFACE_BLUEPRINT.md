# 09 — AI Live Voice Interface Blueprint

## Vision

The user should eventually be able to say what they need and watch the Business Operator research, reason, prepare work, and execute approved actions.

## Voice loop

`Speech → Intent → Context → Plan → Tool calls → Progress events → Result → Speech`

## Requirements

- streaming speech input/output;
- interruption/barge-in;
- visible action timeline;
- tool-call transparency;
- confirmation for risky actions;
- persistent conversation context;
- cancellation;
- recovery after tool failure.

## UX principle

Voice is an interface, not the business engine. The same orchestration APIs must be usable from voice, text, dashboard, and future clients.

## Example

User: “Cari peluang jasa website travel yang sedang dibutuhkan minggu ini.”

Operator: searches permitted sources → gathers evidence → deduplicates → scores opportunities → shows top candidates → asks whether to prepare outreach/portfolio.

## Safety boundary

Voice commands must not silently authorize external messages, purchases, account changes, or other consequential actions. Require explicit confirmation according to tool risk policy.

## Session 9 provider-neutral foundation

The executable foundation is intentionally synthetic and process-local:

`Synthetic normalized utterance → deterministic intent/confidence → bounded voice context → existing Operator → existing tool/permission/approval policy → existing ActionExecutionService → validated result → voice response`

The voice layer defines explicit `created`, `active`, `interrupted`, `cancelled`, `completed`, and `failed` session states plus correlated turns and progress events. Context retains at most four compact prior-turn references and excludes raw audio, secrets, credentials, full source payloads, and unlimited history.

A voice action request stops at the Operator's existing approval gate. Explicit confirmation is accepted only while the session holds the exact pending approval reference produced by that Operator run. Generic `yes`/`oke`/`lanjut` without pending context returns clarification and cannot invoke the action service. Voice never calls an executor directly.

Interruption is a deterministic process-local state marker; it does not claim true asynchronous provider cancellation. Cancellation is terminal, clears pending approval, blocks later turns, and does not replay a completed or pending action. No unsafe automatic retry is provided.

`GET /api/v1/fixtures/voice-session` demonstrates this path with synthetic text and a validated no-side-effect fixture action. It is not live audio, WebRTC, STT/TTS, a live LLM, durable voice storage, or production voice.
