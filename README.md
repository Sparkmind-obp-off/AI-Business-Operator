# AI Business Operator

## Project Overview

- **Goal:** turn permitted, evidence-backed demand signals into traceable opportunities and approved actions.
- **Current phase:** Session 3 — deterministic, provider-neutral Demand Intelligence with process-local ingestion storage.
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

The ingestion endpoint requires an `Idempotency-Key` header (8–128 safe characters). It returns `202` for newly processed events, `200` for duplicates, `409` for conflicting reuse of a key, and `400`/`422` for malformed or invalid input. No query parameters are currently implemented.

## Data Architecture

Canonical domain contracts live in `src/domain/contracts.ts`. Session 2 structural normalization still produces honest `unknown` semantic fields. Session 3 consumes that canonical `DemandObject` through `src/intelligence`, validates a separate `DemandIntelligenceResult`, and never mutates the observed source facts. Rule matches become evidence references; classifications, confidence, and freshness remain explicit inferences. The synthetic fixture, ingestion path, and intelligence path do not access a provider or require credentials. Provider fields are accepted only under provider metadata namespaces, while secrets and secret-like keys are rejected.

The repository interface maps conceptually to `sources → raw_events → demand_objects → demand_evidence`, but its current implementation is an in-memory, process-local map. It is **not durable production persistence** and can reset between Cloudflare isolates or deployments. Intelligence results are currently computed on request and are not durably stored. Provider-specific logic remains outside canonical business logic.

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
- Opportunity creation and deterministic scoring behavior.
- AI Operator, tool registry execution, approval workflow, external actions, Make.com, live providers, voice, and polished UI.

## Recommended Next Step

Proceed to **Phase 4 — Opportunity Database** with evidence linkage, lifecycle history, and retrieval while adding durable storage behind the existing repository boundaries. After Gate 4, implement Phase 5 deterministic scoring. D1 is a candidate for Cloudflare deployment, but no production database architecture is claimed yet.

## Deployment

- **Target:** Cloudflare Pages (BYOK)
- **Production URL:** https://ai-business-operator.pages.dev
- **GitHub:** https://github.com/Sparkmind-obp-off/AI-Business-Operator
- **Status:** deployed and verified through Cloudflare BYOK.
- **Configuration:** `wrangler.jsonc`; production secrets must be set through Cloudflare, never source control.
- **CI note:** `ci/github-actions.yml.example` is ready to activate, but the current GitHub App token cannot create workflow files without the `workflows` permission. `ci/validate.sh` provides the same local/CI gates now.

See `docs/26_SESSION_1_IMPLEMENTATION_NOTES.md` for implementation reconciliation and scope boundaries.
