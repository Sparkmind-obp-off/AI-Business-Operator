# 13 — TESTING AND DELIVERY BLUEPRINT

## 1. Purpose

This document defines the quality gates for the AI Business Operator. Every implementation must be testable, observable, reproducible, and safe to deliver.

Core rule:

> A feature is not complete because it works once. It is complete when its contract, failure modes, permissions, provenance, and regression behavior are verified.

## 2. Testing Layers

### 2.1 Unit Tests

Test deterministic domain logic in isolation:

- normalization
- deduplication
- scoring
- confidence calculation
- validation rules
- permission checks
- tool schemas
- state transitions

Unit tests must be fast and deterministic.

### 2.2 Integration Tests

Verify boundaries between modules and providers:

- ingestion gateway → normalizer
- normalizer → DemandObject
- DemandObject → scoring engine
- scoring → Opportunity
- operator → application services
- Make adapter → ingestion API
- official provider adapter → ingestion API
- action service → audit log

Use provider mocks/fixtures where live credentials are unnecessary.

### 2.3 Contract Tests

Every external adapter must prove that its output conforms to the canonical ingestion contract.

Minimum checks:

- required fields exist
- timestamps are valid
- provenance is present
- source identity is preserved
- duplicate delivery is idempotent
- unsupported fields do not corrupt canonical data
- authentication and authorization failures are surfaced explicitly

### 2.4 End-to-End Tests

Test complete user journeys from UI/operator request through result:

1. configure source
2. ingest permitted data
3. normalize demand signals
4. classify and score
5. create opportunity
6. inspect evidence
7. generate an action
8. require approval where necessary
9. execute action
10. record outcome

### 2.5 Voice E2E Tests

Voice must exercise the same orchestration contracts as text and dashboard interfaces.

Example:

`User voice → intent → context → plan → research tools → opportunity results → spoken summary`

Voice-specific tests cover interruption, cancellation, malformed intent, missing context, tool failure, and confirmation gates.

## 3. Test Data Strategy

Use deterministic fixtures representing:

- explicit service requests
- job/project requirements
- repeated pain points
- weak commercial signals
- high-intent opportunities
- duplicate posts/events
- stale signals
- incomplete source payloads
- conflicting signals
- provider errors
- unauthorized/private data

Never use real private user data merely to make a test realistic.

## 4. Scoring Verification

The scoring engine must have golden test cases for each score band:

- 80–100: Priority
- 65–79: Strong
- 50–64: Watchlist
- below 50: Low

Tests must verify that changes to scoring weights or evidence modifiers are intentional and reviewable.

## 5. Security Tests

Required checks include:

- authentication and authorization
- tenant isolation where multi-tenant deployment exists
- secret exposure prevention
- input/schema validation
- prompt-injection resistance for untrusted source content
- tool allowlist enforcement
- approval-gate enforcement
- audit-log integrity
- rate-limit handling
- unsafe external-action prevention

The system must treat external content as untrusted data, not as executable instructions.

## 6. Failure and Recovery Tests

Every adapter and major service must define:

- timeout behavior
- retry policy
- idempotency behavior
- partial failure behavior
- dead-letter/error path where applicable
- user-visible error state
- recovery procedure

The operator must never claim an action succeeded unless the underlying service confirms success.

## 7. Delivery Gates

### Gate A — Foundation

- repository structure valid
- environment configuration documented
- database migration strategy established
- CI executes successfully
- baseline tests pass

### Gate B — Intelligence Core

- ingestion contract works
- normalization works
- DemandObject is persisted
- provenance is retained
- scoring is deterministic and tested

### Gate C — Operator

- operator can inspect opportunities
- tool registry is enforced
- plans are traceable
- failures are surfaced
- approval gates work

### Gate D — Integrations

- at least one permitted source path works end-to-end
- Make integration follows the adapter contract
- provider failures are observable
- no unsupported access mechanism is presented as available

### Gate E — Action

- action generation works
- approval is required for consequential external actions
- execution status is recorded
- outcomes are stored

### Gate F — Voice

- voice uses the same orchestration APIs
- interruption/cancellation works
- tool progress is visible
- confirmation rules remain enforced

## 8. CI/CD Requirements

CI should run at minimum:

1. formatting/lint checks
2. type/static checks
3. unit tests
4. integration/contract tests
5. security checks
6. build verification

Deployment should be environment-aware and must not expose production secrets to tests or client-side code.

## 9. Release Checklist

Before release, confirm:

- [ ] requirements mapped to documentation
- [ ] tests exist for changed behavior
- [ ] migrations reviewed
- [ ] security impact reviewed
- [ ] permissions reviewed
- [ ] provenance/audit behavior verified
- [ ] provider limitations documented
- [ ] error/recovery behavior verified
- [ ] build succeeds
- [ ] CI passes
- [ ] rollback path understood
- [ ] no fabricated capability claims

## 10. Definition of Done

A delivery is DONE only when:

- implementation follows the architecture and contracts
- deterministic logic has automated tests
- integrations have contract coverage
- security and permission boundaries are tested
- user-visible failures are handled
- provenance and auditability are preserved
- consequential actions remain approval-controlled
- CI/build checks pass
- documentation is updated
- the feature can be demonstrated from a clean environment

## 11. Traceability

Primary references:

- Product/MVP: `01_PRODUCT_VISION_AND_POSITIONING.md`, `02_MVP_SCOPE_AND_BOUNDARY.md`
- Demand: `03_DEMAND_INTELLIGENCE_SPEC.md`
- Ingestion: `04_SOURCE_ADAPTER_AND_INGESTION_ARCHITECTURE.md`
- Data/API: `05_DATA_MODEL_AND_API_CONTRACT.md`
- Scoring: `06_OPPORTUNITY_SCORING_ENGINE.md`
- Operator: `07_AI_BUSINESS_OPERATOR_ORCHESTRATION.md`
- Make: `08_MAKE_INTEGRATION_CONTRACT.md`
- Voice: `09_LIVE_VOICE_INTERFACE_BLUEPRINT.md`
- Security: `10_SECURITY_PRIVACY_AND_COMPLIANCE.md`
- Architecture: `11_TECHNICAL_ARCHITECTURE.md`
- Implementation: `12_IMPLEMENTATION_CONTRACT.md`
- Traceability: `14_MASTER_TRACEABILITY_MATRIX.md`
- GenSpark implementation control: `15_MASTER_SYSTEM_PROMPT_FOR_GENSPARK_AI.md`
