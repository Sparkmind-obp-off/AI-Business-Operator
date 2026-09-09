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

## Human-in-the-loop

AI may recommend a score and explain it. The user can override the score, and the override must be recorded with a reason.

## Learning

Outcome feedback such as contacted, replied, qualified, paid, rejected, or invalid is fed back into scoring calibration.
