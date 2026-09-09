# 12 — Implementation Contract

## Repository rules

- `/docs` is the architecture source of truth.
- Application code must map to documented capabilities.
- Provider-specific code belongs under adapter/integration modules.
- Secrets never enter source control.
- Every feature must include tests appropriate to its risk.

## Module boundaries

```text
src/
  app/                 # application bootstrap and routing
  domain/              # business entities and rules
  ingestion/           # ingestion gateway and validation
  adapters/            # source/provider adapters
  intelligence/        # demand analysis and classification
  opportunities/       # scoring and opportunity lifecycle
  actions/             # action planning/execution
  agents/              # AI orchestration and tool registry
  voice/               # live voice interface
  security/            # auth, permissions, audit
  shared/              # cross-cutting utilities
```

## Definition of done

A feature is complete only when:

1. its contract is documented;
2. implementation respects module boundaries;
3. happy-path and failure-path tests exist;
4. provenance/audit requirements are satisfied;
5. secrets and permissions are reviewed;
6. the user-visible behavior is demonstrable.

## AI implementation rule

AI coding agents must read the relevant documents before modifying architecture. They should implement in small vertical slices and validate each slice before proceeding.
