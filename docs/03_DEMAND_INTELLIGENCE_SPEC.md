# 03 — Demand Intelligence Specification

## Purpose

Demand Intelligence transforms source events into evidence-backed descriptions of what people or organizations need, want, ask for, or are actively paying for.

## Demand signal categories

- explicit request;
- job/project requirement;
- repeated pain point;
- purchase intent;
- comparison/recommendation request;
- unmet service need;
- recurring workflow problem;
- product gap;
- trend with commercial relevance.

## Required fields

Each demand record should contain:

- `demand_id`
- `source_id`
- `source_type`
- `source_url`
- `captured_at`
- `published_at` when available
- `author_or_entity` when legally and technically appropriate
- `text_or_summary`
- `topic`
- `market`
- `location` when relevant and non-sensitive
- `intent_type`
- `evidence_strength`
- `commercial_intent`
- `urgency`
- `recurrence`
- `estimated_budget_signal` when evidenced
- `contactability` as a coarse status, not a mandate to expose personal data
- `provenance`
- `raw_event_reference`

## Intelligence rules

1. Separate observed facts from AI inference.
2. Preserve source provenance.
3. Never convert weak signals into certainty.
4. Prefer repeated independent signals.
5. Penalize stale signals.
6. Deduplicate near-identical posts/events.
7. Keep an audit trail for AI classifications and score changes.

## Output

The primary output is a `DemandObject`, which is consumed by the Opportunity Engine.
