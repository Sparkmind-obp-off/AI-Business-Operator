# AI Business Operator

## Project Overview

- **Goal:** turn permitted, evidence-backed demand signals into traceable opportunities and approved actions.
- **Current phase:** Session 7 — capability-aware, provider-neutral adapter foundation with one deterministic synthetic fixture path.
- **Stack:** TypeScript, Hono, Zod, Vitest, Vite, Cloudflare Pages.
- **Architecture:** provider-neutral modular monolith; `/docs` remains the source of truth.

## Completed Features

- Central runtime configuration validation with separate public and server-secret boundaries.
- Structured JSON logging with request/trace correlation IDs and secret redaction.
- Liveness and readiness endpoints; readiness explicitly does not assert external provider health.
- Versioned Zod contracts and inferred TypeScript types for Source, RawEvent, DemandObject, DemandEvidence, Opportunity, OpportunityEvidence, Score, Action, ActionOutcome, OperatorRun, ToolCall, and AuditEvent.
- Deterministic synthetic `Source → RawEvent → DemandObject` fixture with fact/inference separation and complete provenance.
- Automated contract, fixture, security/configuration, and HTTP endpoint tests.
- Validated `POST /api/v1/ingestion/events` boundary for one or more provider-neutral source events.
- Deterministic SHA-256 event identity, idempotency-key conflict handling, external-ID/checksum deduplication, and process-local repository abstraction.
- RawEvent preservation plus deterministic DemandObject and DemandEvidence normalization without LLM calls or unsupported classification claims.
- Structured ingestion lifecycle logs containing correlation and canonical IDs only; source payload content and credentials are not logged.
- Provider-neutral `DemandObject → DemandIntelligenceResult` service with deterministic rule-based signal/intent classification.
- Explicit `detected` facts versus `inferred` attributes, with bounded confidence, evidence basis, and stable source/raw-event provenance.
- Controlled commercial intent, evidence strength, urgency, recurrence, and freshness classification; unsupported signals remain unknown/low-confidence.
- Central freshness windows (`fresh ≤ 7 days`, `aging ≤ 30 days`, otherwise `stale`) with published-time preference, captured-time fallback, and explicit future-timestamp rejection state.
- Safe intelligence lifecycle logs and a deterministic synthetic fixture/API path; source text remains untrusted data and is not logged.
- Reproducible CI validation script plus a GitHub Actions workflow template for lint, typecheck, tests, build, audit, and basic tracked-secret scanning.
- Provider-neutral `DemandObject + DemandIntelligenceResult → Opportunity` service with canonical validation and deterministic identity.
- Traceable Opportunity records linking demand IDs, raw-event/source references, evidence relationships, and continuous provenance without duplicating raw payloads.
- Explicit lifecycle history with `new → enriched` as the only Phase 4 transition; later-phase states are rejected.
- Process-local Opportunity repository supporting create/get/list, status and segment filters, stable ordering, and duplicate suppression.
- Minimal Opportunity fixture and CRUD/lifecycle API routes with safe structured logs and correlation IDs.
- Provider-neutral `Opportunity + DemandObject + DemandIntelligenceResult → ScoreRecord` service using the canonical seven weighted dimensions.
- Explicit `opportunity-scoring-v1` formula metadata, transparent component contributions, conservative unknown handling, freshness/confidence modifiers, and deterministic score bands.
- Immutable process-local score history with input-fingerprint idempotency, latest-score retrieval, evidence references, and synchronized Opportunity `scored` lifecycle state.
- Minimal scoring fixture and `POST`/`GET` score API routes with safe `opportunity.scored` metadata logs and a non-guarantee disclaimer.
- Provider-neutral `Opportunity + Score + evidence → OperatorContext → deterministic plan` orchestration boundary without an LLM or live provider.
- Explicit tool registry metadata, input/output schema validation, permission checks, risk-aware approval gates, and a safe fixture executor limited to `opportunity.inspect`.
- High-risk `external.action.fixture` stops at `approval_required`; it cannot perform an external side effect before approval.
- Process-local OperatorRun, ToolCall, and append-oriented audit records preserve request/trace/run correlation while excluding raw source text and credentials.
- Prompt-injection-like source content remains data and cannot select tools, grant permission, or bypass approval.
- Provider-neutral `ProviderAdapter` boundary for capability discovery, status, configuration validation, and fetch operations.
- Explicit capability, authentication, pagination, rate-limit, identity-stability, freshness, approval, compliance, retryability, and adapter-health metadata.
- One deterministic Phase 7 fixture adapter proving `Adapter → RawEvent → existing Ingestion → DemandObject → existing Demand Intelligence`; it is always labeled synthetic and never claims live provider access.
- Truthful approval-required, unavailable, degraded/partial, rate-limited, invalid-configuration, and provider-error behavior without bypasses or fabricated empty success.
- Canonical Source preservation in process-local ingestion artifacts plus stable external IDs, timestamps, adapter provenance, transformation references, and existing idempotency/deduplication.
- Safe adapter lifecycle logs containing provider/source/adapter/status/count metadata only, without credentials or raw source text.

## Functional URIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Minimal Session 1 entry page |
| `GET` | `/health/live` | Process/application liveness |
| `GET` | `/health/ready` | Configuration readiness and truthful provider status |
| `GET` | `/api/v1/fixtures/demand-signal` | Deterministic synthetic DemandObject demonstration |
| `GET` | `/api/v1/fixtures/demand-intelligence` | Deterministic synthetic Demand Intelligence result |
| `POST` | `/api/v1/ingestion/events` | Validate, deduplicate, preserve, and deterministically normalize one or more source events |
| `POST` | `/api/v1/intelligence/classify` | Validate a canonical `{ "demand": DemandObject }` and return detected facts, bounded inferences, evidence, and provenance |
| `GET` | `/api/v1/fixtures/opportunity` | Deterministically create/retrieve the synthetic Opportunity fixture |
| `GET` | `/api/v1/fixtures/opportunity-score` | Calculate/retrieve the deterministic synthetic Score fixture |
| `POST` | `/api/v1/opportunities` | Create an Opportunity from canonical `{ "demand", "intelligence" }` input |
| `GET` | `/api/v1/opportunities` | List Opportunities; optional exact `status` and `segment` query filters |
| `GET` | `/api/v1/opportunities/:id` | Retrieve one Opportunity record and its evidence/lifecycle linkage |
| `POST` | `/api/v1/opportunities/:id/transitions` | Apply validated `{ "status", "reason" }` lifecycle transition |
| `POST` | `/api/v1/opportunities/:id/score` | Score an enriched Opportunity from canonical `{ "demand", "intelligence" }` input |
| `GET` | `/api/v1/opportunities/:id/score` | Retrieve latest Score and immutable process-local score history |
| `GET` | `/api/v1/fixtures/operator-run` | Run the complete deterministic Phase 6 fixture through the read-only tool boundary |
| `GET` | `/api/v1/fixtures/provider-adapter` | Run the synthetic Phase 7 provider adapter through ingestion and Demand Intelligence with capability/status metadata |
| `POST` | `/api/v1/operator/runs` | Run the Operator for `{ "goal", "opportunityId", "requestedTool?" }`; API permissions are intentionally limited to `opportunity.read` |
| `GET` | `/api/v1/operator/runs/:id` | Retrieve one process-local Operator run with bounded context, plan, tool decisions, and audit events |

The ingestion endpoint requires an `Idempotency-Key` header (8–128 safe characters). It returns `202` for newly processed events, `200` for duplicates, `409` for conflicting reuse of a key, and `400`/`422` for malformed or invalid input. No query parameters are currently implemented.

## Data Architecture

Canonical domain contracts live in `src/domain/contracts.ts`. Session 2 structural normalization still produces honest `unknown` semantic fields. Session 3 consumes that canonical `DemandObject` through `src/intelligence`, validates a separate `DemandIntelligenceResult`, and never mutates observed source facts. Session 4 consumes both validated records through `src/opportunities`, derives only bounded title/segment/offer fields, and stores source references plus lifecycle history in an `OpportunityRecord`. Session 5 consumes the validated Opportunity record, DemandObject, and DemandIntelligenceResult through `src/scoring`; it creates a separate immutable `ScoreRecord`, updates only the Opportunity score convenience fields/lifecycle, and exposes all seven contributions. Session 6 consumes only canonical Opportunity, latest consistent Score, compact evidence references, and provenance through `src/operator`; it creates a bounded context and deterministic plan before registry, permission, schema, approval, execution, result-validation, and audit gates. Session 7 adds `src/adapters` as the provider-specific boundary; the deterministic adapter validates a canonical Source, reports truthful capability/health state, emits canonical ingestion event inputs, reuses existing ingestion identity/deduplication, and hands resulting DemandObjects to the existing Demand Intelligence service. The fixture path does not access a live provider or require credentials. Provider fields remain outside canonical Opportunity, scoring, and Operator logic.

The repository interfaces map conceptually to `sources → raw_events → demand_objects → demand_evidence → opportunities → opportunity_evidence → scores`. Current ingestion, Opportunity, Score, and Operator run/audit implementations are in-memory, process-local maps. They are **not durable production persistence** and can reset between Cloudflare isolates or deployments. Intelligence results are computed on request and are not durably stored. Stable deterministic ordering and latest-score/run retrieval apply only within the current process-local repository instance.

## Local Usage

```bash
npm install
npm run validate
npm run build
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

Then open `http://localhost:3000`. Local defaults disable external side effects and require no secrets. Copy `.env.example` only when environment overrides are needed; never commit `.env` or `.dev.vars`.

## Validation Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
# all gates in the current checkout
npm run validate
# clean-install CI equivalent, including audit and secret scan
./ci/validate.sh
```

## Ingestion Example

```bash
curl -X POST http://localhost:3000/api/v1/ingestion/events \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: synthetic-demo-001' \
  -d '{
    "source": {
      "id": "source_manual_demo",
      "provider": "manual.demo",
      "sourceType": "manual",
      "displayName": "Synthetic demo source",
      "status": "available",
      "capabilities": ["submit_synthetic_event"],
      "authMode": "none",
      "termsReference": "https://fixture.example.test/terms",
      "adapter": { "name": "manual.fixture", "version": "1.0.0", "accessMethod": "fixture" },
      "providerMetadata": { "synthetic": true }
    },
    "events": [{
      "externalEventId": "synthetic-001",
      "sourceUrl": "https://fixture.example.test/events/synthetic-001",
      "capturedAt": "2026-09-09T12:00:00.000Z",
      "content": { "text": "Synthetic source content.", "language": "en" },
      "providerMetadata": { "synthetic": true }
    }]
  }'
```

External source text is stored as untrusted data and never executed as application instructions.

## Not Yet Implemented

- Durable database schema/migrations and canonical persistence.
- Authentication/authorization for the ingestion endpoint.
- Durable storage and history for Demand Intelligence results/classification revisions.
- Topic, market, location, budget, and contactability enrichment beyond the current narrow deterministic rules.
- Demand intelligence provider/model integration; no LLM classification is used in Session 3.
- Durable Opportunity persistence across Cloudflare isolates/deployments.
- Durable Score persistence across Cloudflare isolates/deployments.
- Human score override workflow and later outcome-based calibration.
- Live LLM planning, durable Operator/audit persistence, user approval submission/resume flow, and real action records/outcomes.
- Live provider credentials and live provider adapters; the implemented Phase 7 path is synthetic fixture data only.
- Live tool execution, external actions, Make.com scenarios, voice, authentication/authorization, and polished UI.

## Recommended Next Step

Proceed to **Phase 8 — Actions / Execution Boundary** while preserving the existing permission and approval gates. Durable storage remains a separate infrastructure increment; D1 is a candidate, but no production database architecture is claimed yet. Any future live provider must independently pass capability, authorization, provenance, rate-limit, and compliance review.

## Deployment

- **Target:** Cloudflare Pages (BYOK)
- **Production URL:** https://ai-business-operator.pages.dev
- **GitHub:** https://github.com/Sparkmind-obp-off/AI-Business-Operator
- **Status:** deployed and verified through Cloudflare BYOK.
- **Configuration:** `wrangler.jsonc`; production secrets must be set through Cloudflare, never source control.
- **CI note:** `ci/github-actions.yml.example` is ready to activate, but the current GitHub App token cannot create workflow files without the `workflows` permission. `ci/validate.sh` provides the same local/CI gates now.

See `docs/26_SESSION_1_IMPLEMENTATION_NOTES.md` for implementation reconciliation and scope boundaries.
