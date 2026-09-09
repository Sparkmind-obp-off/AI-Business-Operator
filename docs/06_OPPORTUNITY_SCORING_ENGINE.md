# 06 — Opportunity Scoring Engine

## Goal

Rank opportunities by evidence and business attractiveness rather than by volume alone.

## Initial scoring model

Score 0–100 using weighted dimensions:

- Demand strength — 25%
- Commercial intent — 20%
- Frequency/recurrence — 15%
- Urgency — 10%
- Ability to reach/serve the market — 10%
- Competition/market gap — 10%
- Execution feasibility — 10%

`score = Σ(normalized_dimension × weight)`

## Evidence adjustment

Confidence and evidence quality act as modifiers. A single weak signal must not outrank multiple independent high-quality signals merely because its language is enthusiastic.

## Opportunity bands

- 80–100: Priority — investigate/act now
- 65–79: Strong candidate — validate and prepare action
- 50–64: Watchlist — gather more evidence
- <50: Low priority / archive

## Deterministic v1 rules

`opportunity-scoring-v1` uses validated canonical Opportunity, DemandObject, and DemandIntelligenceResult data only.

Base normalized values:

- evidence strength: `strong=1`, `moderate=0.65`, `weak=0.25`;
- commercial intent: `strong=1`, `possible=0.6`, `none/unknown=0`;
- recurrence: `repeated=1`, `single=0.25`, `unknown=0`;
- urgency: `immediate=1`, `time_bound=0.65`, `unknown=0`;
- reachability: `public_business_channel=1`, `source_reply=0.7`, `unknown/not_permitted=0`;
- competition/market gap and execution feasibility: `0` with explicit `unknown` status until canonical evidence exists.

Inference confidence modifiers are `high=1`, `moderate=0.8`, and `low=0.5`. Freshness modifiers are `fresh=1`, `aging=0.75`, `stale=0.4`, and `invalid_future=0`. The component formula is:

`normalized value × confidence modifier × freshness modifier × weight`

Unknown dimensions stay visible and contribute zero; the implementation does not invent competition, feasibility, buyer, budget, or market-size evidence. Scores are prioritization signals, not guarantees of purchase, conversion, or revenue.

## Human-in-the-loop

AI may recommend a score and explain it. The user can override the score, and the override must be recorded with a reason. The baseline Phase 5 slice does not yet expose the human override workflow.

## Learning

Outcome feedback such as contacted, replied, qualified, paid, rejected, or invalid is fed back into scoring calibration.
