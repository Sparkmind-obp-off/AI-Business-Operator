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
