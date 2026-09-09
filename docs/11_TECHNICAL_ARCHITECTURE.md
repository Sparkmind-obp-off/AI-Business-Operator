# 11 — Technical Architecture

## Logical layers

```text
[Live Voice / Web UI]
          |
[AI Business Operator / Orchestrator]
          |
[Application Services]
  |       |        |
Demand  Opportunity Action
  |
[Intelligence Pipeline]
  |
[Canonical Data Layer]
  |
[Ingestion Gateway]
  |
[Source Adapter Layer]
  |-----------|-------------|-----------|
Official API  Make/Integration  Search/Other Authorized Sources
```

## Recommended deployment shape

- Web frontend: modern React/Next.js-style application or equivalent.
- API: stateless application service.
- Database: PostgreSQL-compatible relational database for core entities.
- Queue/event bus: introduced when ingestion volume requires asynchronous processing.
- Object storage: raw payloads/evidence where retention policy allows.
- Secrets: managed secret store/environment secrets; never committed to Git.
- Observability: structured logs, metrics, traces, audit events.

## Design rules

- Provider-agnostic interfaces.
- Idempotent ingestion.
- Async processing for expensive AI operations.
- Human approval gates for external side effects.
- Feature flags for experimental adapters.
- Versioned contracts.

## Scale path

Start as a modular monolith. Extract services only when a measured bottleneck, isolation requirement, or team boundary justifies the added operational complexity.
