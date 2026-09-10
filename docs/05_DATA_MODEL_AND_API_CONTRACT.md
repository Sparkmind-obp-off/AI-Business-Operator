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

## Session 4 Opportunity record boundary

The canonical `Opportunity` remains unchanged. The Phase 4 provider-neutral repository stores an `OpportunityRecord` wrapper containing:

- one canonical `Opportunity` with `currentScore` and `scoreVersion` set to `null` until Phase 5;
- `OpportunityEvidence[]` links to canonical demand IDs;
- compact source/raw-event references and continuous provenance;
- append-only lifecycle history for the transitions implemented in the current phase;
- a deterministic identity key derived from canonical demand evidence.

The current implementation is process-local and non-durable. It supports get/list plus exact lifecycle-status and segment filters with stable `createdAt`, then ID ordering. Session 4 permits only `new → enriched`; future lifecycle transitions remain reserved for their owning phases.

## Session 5 Score record boundary

The canonical `Score` remains the immutable scoring decision. The Phase 5 provider-neutral repository stores a `ScoreRecord` wrapper containing:

- one canonical `Score` with explicit `opportunity-scoring-v1` version;
- a deterministic score band and transparent seven-component breakdown;
- bounded confidence/freshness modifiers and explicit unknown evidence states;
- compact Opportunity, Demand, RawEvent, and Source evidence references without raw source text;
- a deterministic input fingerprint and formula metadata.

`Opportunity.currentScore` and `Opportunity.scoreVersion` are convenience fields updated when scoring succeeds; they do not replace score history. Repeated scoring with an identical fingerprint reuses the existing score. Changed validated scoring input creates another immutable history record. Current storage is process-local and non-durable.

Minimal API operations are `POST /api/v1/opportunities/:id/score` for an enriched Opportunity and `GET /api/v1/opportunities/:id/score` for latest/history retrieval.

## Session 8 Action execution boundary

The canonical `Action` and `ActionOutcome` remain the business records. The Phase 8 provider-neutral execution wrapper adds:

- explicit action permission, registered risk, and approval-policy checks before invocation;
- matching approval metadata for approval-required actions rather than inference from recommendations or source text;
- deterministic action and idempotency identity checks before controlled executor selection;
- one synthetic fixture executor returning `status: simulated`, `synthetic: true`, and `sideEffectPerformed: false`;
- untrusted executor-result validation before a completed Action or successful ActionOutcome can be recorded;
- normalized failure, timeout, retryability, duplicate, and idempotency-conflict metadata;
- append-oriented audit events with request/trace correlation and safe execution provenance.

The current repository is process-local. Action outcomes and idempotency records reset across isolates/restarts. The only exposed Phase 8 route is `GET /api/v1/fixtures/action-execution`; it proves the boundary and performs no live external action.

## Session 9 Voice interface boundary

Voice remains an interface over existing application services. The provider-neutral `src/voice` boundary defines explicit session and turn lifecycles, deterministic intent with confidence, a four-turn compact context window, correlation-safe progress events, pending-approval references, interruption/cancellation semantics, and machine-readable plus human-readable responses.

The voice layer calls the existing Operator and never an action executor directly. Action requests first pass through the existing tool registry, permission, and approval policy. An explicit approval reuses the exact pending approval reference issued by the Operator and calls the existing Session 8 `ActionExecutionService`; only its validated result may produce a completed/simulated response. Generic confirmation without pending context and unknown/low-confidence input remain clarification-only. The implementation is synthetic, process-local, non-durable, stores no raw audio, and performs no live provider call or external side effect.

The exposed `GET /api/v1/fixtures/voice-session` route proves the deterministic path and is explicitly not live audio, STT/TTS, an LLM, or production voice.

## Privacy

Only store personal/contact information when necessary, lawful, and supported by the source's permitted use. Prefer business/entity-level contact channels over personal information.
