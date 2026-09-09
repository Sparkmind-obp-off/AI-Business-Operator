# AI Business Operator

## Project Overview

- **Goal:** turn permitted, evidence-backed demand signals into traceable opportunities and approved actions.
- **Current phase:** Session 1 — repository foundation and canonical data contracts.
- **Stack:** TypeScript, Hono, Zod, Vitest, Vite, Cloudflare Pages.
- **Architecture:** provider-neutral modular monolith; `/docs` remains the source of truth.

## Completed Features

- Central runtime configuration validation with separate public and server-secret boundaries.
- Structured JSON logging with request/trace correlation IDs and secret redaction.
- Liveness and readiness endpoints; readiness explicitly does not assert external provider health.
- Versioned Zod contracts and inferred TypeScript types for Source, RawEvent, DemandObject, DemandEvidence, Opportunity, OpportunityEvidence, Score, Action, ActionOutcome, OperatorRun, ToolCall, and AuditEvent.
- Deterministic synthetic `Source → RawEvent → DemandObject` fixture with fact/inference separation and complete provenance.
- Automated contract, fixture, security/configuration, and HTTP endpoint tests.
- GitHub Actions validation for lint, typecheck, tests, build, and basic tracked-secret scanning.

## Functional URIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Minimal Session 1 entry page |
| `GET` | `/health/live` | Process/application liveness |
| `GET` | `/health/ready` | Configuration readiness and truthful provider status |
| `GET` | `/api/v1/fixtures/demand-signal` | Deterministic synthetic DemandObject demonstration |

No query parameters are currently implemented.

## Data Architecture

Canonical domain contracts live in `src/domain/contracts.ts`. The Session 1 fixture is synthetic test data and does not access a provider or require credentials. No database is used yet; persistence and migrations are deferred to the next appropriate phase. Provider-specific extensions must remain outside canonical business logic.

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
# all gates
npm run validate
```

## Not Yet Implemented

- Database schema/migrations and canonical persistence.
- Ingestion API, idempotency, and deduplication beyond the deterministic fixture boundary.
- Demand intelligence provider/model integration.
- Opportunity creation and deterministic scoring behavior.
- AI Operator, tool registry execution, approval workflow, external actions, Make.com, live providers, voice, and polished UI.

## Recommended Next Step

Implement the smallest Phase 2 ingestion service around the existing schemas: validated input, idempotency key, raw-event preservation policy, deterministic normalization, and provenance tests. Choose persistence only after defining the migration and deployment boundary.

## Deployment

- **Target:** Cloudflare Pages (BYOK)
- **Production URL:** not yet deployed at the time of this README update
- **GitHub:** https://github.com/Sparkmind-obp-off/AI-Business-Operator
- **Configuration:** `wrangler.jsonc`; production secrets must be set through Cloudflare, never source control.

See `docs/26_SESSION_1_IMPLEMENTATION_NOTES.md` for implementation reconciliation and scope boundaries.
