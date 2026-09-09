# 05 — Data Model & API Contract

## Core entities

### Source

`source_id, provider, source_type, capabilities, auth_mode, status, terms_reference`

### RawEvent

`event_id, source_id, external_id, payload_reference, source_url, captured_at, published_at, checksum, provenance`

### DemandObject

`demand_id, event_ids[], problem, audience, market, intent_type, evidence_strength, commercial_intent, urgency, recurrence, contactability, confidence, created_at, updated_at`

### Opportunity

`opportunity_id, demand_ids[], title, offer_hypothesis, target_segment, score, score_breakdown, evidence_summary, recommended_action, status, owner, created_at, updated_at`

### Action

`action_id, opportunity_id, type, description, required_approval, status, execution_reference, result, created_at`

## API principles

- Version all public application APIs.
- Keep provider-specific fields under provider namespaces.
- Use idempotency keys for ingestion.
- Never expose source credentials to the browser.
- Return provenance with evidence-backed intelligence.

## Example ingestion contract

`POST /api/v1/ingestion/events`

Request contains source metadata plus one or more normalized/raw events.

Response returns accepted event IDs, duplicate IDs, validation errors, and processing status.

## Example opportunity endpoint

`GET /api/v1/opportunities?status=qualified&min_score=70`

## Privacy

Only store personal/contact information when necessary, lawful, and supported by the source's permitted use. Prefer business/entity-level contact channels over personal information.
