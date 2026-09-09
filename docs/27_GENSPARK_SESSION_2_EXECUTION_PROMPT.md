# GENSPARK AI — SESSION 2 EXECUTION PROMPT

## PURPOSE

This is the **Session 2 execution prompt** for `genspark.ai/code`.

Session 1 established the repository foundation and canonical contracts. Session 2 must now build the **smallest real ingestion vertical slice** on top of that foundation.

The objective is NOT to connect live social platforms yet. The objective is to make the application capable of receiving a validated source event, preserving it, normalizing it deterministically, producing a canonical `DemandObject`, and exposing enough evidence/provenance to continue safely into Opportunity and Scoring phases.

Repository:
`Sparkmind-obp-off/AI-Business-Operator`

Primary control document:
`docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`

Session 1 reference:
`docs/25_GENSPARK_SESSION_1_EXECUTION_PROMPT.md`

Session 1 implementation notes:
`docs/26_SESSION_1_IMPLEMENTATION_NOTES.md`

---

## 1. YOUR ROLE

Act as the implementation engineer for this repository.

You must:

- inspect the actual repository before changing anything;
- read the relevant authoritative documentation;
- preserve the existing TypeScript + Hono + Zod + Vitest + Cloudflare-compatible architecture;
- implement real code, not only plans;
- keep the change narrow and reviewable;
- run validation when tooling is available;
- never fabricate provider access or business demand;
- commit validated work to Git;
- report exactly what was implemented and actually validated.

Do not redesign the product or replace the framework merely for preference.

Do not respond with only a plan when implementation can be performed.

---

## 2. READ FIRST — REQUIRED

Before coding, read:

1. `README.md`
2. `docs/03_DEMAND_INTELLIGENCE_SPEC.md`
3. `docs/04_SOURCE_ADAPTER_AND_INGESTION_ARCHITECTURE.md`
4. `docs/05_DATA_MODEL_AND_API_CONTRACT.md`
5. `docs/12_IMPLEMENTATION_CONTRACT.md`
6. `docs/13_TESTING_AND_DELIVERY_BLUEPRINT.md`
7. `docs/16_IMPLEMENTATION_EXECUTION_PLAN.md`
8. `docs/17_DATABASE_SCHEMA_BLUEPRINT.md`
9. `docs/19_AI_TOOL_REGISTRY_AND_PERMISSION_MODEL.md`
10. `docs/20_PROVIDER_CAPABILITY_MATRIX.md`
11. `docs/21_OBSERVABILITY_AND_AUDIT_BLUEPRINT.md`
12. `docs/22_ENVIRONMENT_AND_SECRETS_CONTRACT.md`
13. `docs/23_ROADMAP_AND_PHASE_GATES.md`
14. `docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`
15. `docs/25_GENSPARK_SESSION_1_EXECUTION_PROMPT.md`
16. `docs/26_SESSION_1_IMPLEMENTATION_NOTES.md`
17. this Session 2 prompt

Then inspect the current source tree and existing contracts/tests.

If implementation differs from documentation, reconcile explicitly. Do not silently discard working code.

---

## 3. SESSION 2 OBJECTIVE

Build the smallest coherent **Phase 2 — Ingestion Service** vertical slice:

```text
HTTP / Ingestion Request
        ↓
Request Validation
        ↓
Idempotency Check
        ↓
RawEvent Preservation
        ↓
Deterministic Normalization
        ↓
DemandObject
        ↓
Evidence + Provenance
        ↓
Observable Result
```

The result must be deterministic, provider-neutral, testable, and ready for a later persistence/provider layer.

Session 2 is successful when the application has a real ingestion boundary rather than only a fixture boundary.

---

## 4. CREDIT / SESSION BUDGET CONTROL

Assume limited GenSpark credits and execution time.

Use this priority order:

`Inspect → Reuse Existing Contracts → Ingestion Core → Tests → Validate → Commit → Report`

Rules:

1. Do not rewrite existing foundation files unnecessarily.
2. Reuse the existing Zod contracts and utilities.
3. Do not install dependencies unless genuinely required.
4. Do not connect live providers.
5. Do not build a database unless the existing repository already provides a safe, minimal persistence boundary required by the current architecture.
6. Prefer an in-memory/deterministic repository abstraction if persistence is not yet implemented.
7. Do not spend credits on polished UI.
8. Do not implement Opportunity/Scoring/AI Operator in this session except for minimal types/interfaces needed to keep the ingestion boundary clean.
9. Preserve budget for tests and final validation.
10. Stop when the Session 2 exit criteria are satisfied.

If a design choice is ambiguous, choose the smallest implementation that preserves the documented contracts and can later be replaced by durable infrastructure without changing the domain model.

---

## 5. TASK 1 — INSPECT EXISTING FOUNDATION

Before editing, identify:

- current application entry point;
- current Hono routes;
- current domain contracts;
- current fixture implementation;
- current test structure;
- configuration/logging utilities;
- current persistence status;
- existing error/result conventions;
- current CI/validation commands.

Do not duplicate existing utilities.

---

## 6. TASK 2 — INGESTION INPUT CONTRACT

Create or reuse a validated application-level ingestion request contract consistent with `docs/05_DATA_MODEL_AND_API_CONTRACT.md`.

Target endpoint:

`POST /api/v1/ingestion/events`

The request must support source metadata plus one or more events.

At minimum, validate:

- source identity/reference;
- source type;
- event identity where supplied;
- payload/raw content;
- source URL where supplied;
- published/captured timestamps where supplied;
- provider-specific metadata under a safe metadata/provider namespace.

Requirements:

- reject malformed input;
- reject impossible required fields;
- do not accept arbitrary executable instructions as business logic;
- preserve external content as **data**, not instructions;
- never accept secrets as part of ordinary event payload requirements.

Use Zod and existing contract conventions.

Do not create a second competing schema system.

---

## 7. TASK 3 — IDEMPOTENCY

Implement a minimal deterministic idempotency boundary.

The ingestion API must accept an idempotency key, preferably from:

`Idempotency-Key`

Behavior:

- same idempotency key + same request identity → deterministic duplicate result;
- duplicate event external identity/checksum should not create a second canonical event;
- different request with the same idempotency key must not silently overwrite the original result;
- idempotency state must be isolated behind a small repository/service abstraction so durable storage can replace it later.

If there is no database yet, use a deterministic in-memory implementation for Session 2 and clearly document that it is process-local and not production-durable.

Do not pretend in-memory idempotency is production persistence.

---

## 8. TASK 4 — RAW EVENT PRESERVATION

Implement a small RawEvent creation path using the existing canonical `RawEvent` contract.

The RawEvent must preserve enough information to reproduce or audit normalization decisions.

At minimum preserve:

- event ID;
- source ID;
- external ID when available;
- raw payload/reference according to the existing contract;
- source URL when available;
- captured timestamp;
- published timestamp when available;
- deterministic checksum/fingerprint;
- provenance.

Do not store unnecessary personal information.

Do not expose credentials, authorization headers, cookies, or secrets in raw payload storage/logging.

If the existing contract uses a payload reference rather than unrestricted payload storage, respect that design.

---

## 9. TASK 5 — DETERMINISTIC NORMALIZATION

Implement a pure/deterministic normalization service.

Input:

`RawEvent`

Output:

`DemandObject` plus associated evidence/provenance where supported by the current contracts.

Normalization must:

- trim and normalize text safely;
- derive stable identifiers deterministically;
- map source information to canonical fields;
- preserve source URL and provenance;
- distinguish observed facts from inference;
- avoid inventing missing facts;
- preserve uncertainty;
- avoid claiming commercial intent, urgency, budget, or demand strength unless the input actually supports it.

A test fixture may contain explicit synthetic values for testing, but it must remain clearly synthetic.

Do not call an LLM in the normalization path.

Do not introduce probabilistic classification into this session.

---

## 10. TASK 6 — PROVENANCE AND EVIDENCE

Every generated DemandObject must be traceable to its originating RawEvent.

Provenance should identify, where applicable:

- source;
- raw event;
- adapter/access method;
- source URL;
- captured time;
- transformation/normalization reference.

The implementation must preserve the distinction:

```text
Observed fact ≠ Inference
```

If a field is not known, leave it unknown/optional rather than manufacturing a value.

Search/index results are evidence pointers, not automatically authoritative source records.

---

## 11. TASK 7 — INGESTION API

Implement:

`POST /api/v1/ingestion/events`

The endpoint must:

1. create a request/correlation ID;
2. validate input;
3. enforce idempotency;
4. create RawEvent records through the application service;
5. normalize deterministically;
6. return accepted event IDs;
7. return duplicate IDs when applicable;
8. return validation/application errors using the existing error/result convention;
9. return processing status;
10. include enough provenance/reference data for the caller to understand what was accepted.

Do not expose internal secrets or unnecessary internal implementation details.

Do not claim that an external provider was contacted unless it actually was.

---

## 12. TASK 8 — OBSERVABILITY

Use the existing structured logging/correlation foundation.

For ingestion, capture safe structured events such as:

- ingestion received;
- validation failed;
- duplicate detected;
- raw event accepted;
- normalization completed;
- normalization failed.

Correlate using available:

- `request_id`;
- `trace_id`;
- `run_id` where relevant.

Never log:

- API keys;
- access tokens;
- cookies;
- passwords;
- webhook secrets;
- authorization headers;
- unnecessary personal/contact information.

Do not create a large observability subsystem in Session 2.

---

## 13. TASK 9 — TESTS

Tests are mandatory.

Implement the smallest meaningful test set covering:

### Input validation

- valid ingestion request accepted;
- malformed request rejected;
- required source/event fields enforced;
- invalid timestamps/identifiers rejected where applicable.

### Idempotency

- same request + same key is deterministic;
- duplicate event does not create a second canonical event;
- conflicting reuse of an idempotency key is rejected safely.

### RawEvent

- stable event identity/checksum behavior;
- raw-event provenance preserved;
- sensitive fields are not emitted into logs if redaction behavior already exists.

### Normalization

- deterministic output for the same input;
- text normalization behaves consistently;
- missing facts are not invented;
- observed facts and inference remain distinct;
- source URL/provenance survives normalization.

### HTTP

At minimum test:

- `POST /api/v1/ingestion/events` success;
- validation failure;
- duplicate/idempotent request;
- safe error response.

Do not add tests for behavior that is not actually implemented.

---

## 14. DATABASE RULE

Session 2 must respect `docs/17_DATABASE_SCHEMA_BLUEPRINT.md`.

If the repository has no durable database implementation yet:

- do NOT invent a production database architecture;
- do NOT introduce migrations merely to satisfy the appearance of progress;
- use a small repository interface and deterministic in-memory implementation where necessary;
- keep the domain/application layer independent of storage;
- document that persistence is the next infrastructure step.

The canonical entities remain conceptually compatible with:

`sources → raw_events → demand_objects → demand_evidence`

Do not make the in-memory implementation the canonical architecture.

---

## 15. PROVIDER RULE — STRICT

Do NOT connect:

- Threads;
- Facebook;
- Instagram;
- X/Twitter;
- Make.com;
- search providers;
- browser automation;
- scraping services;
- live social APIs

in Session 2 unless an already-configured, authorized adapter can be validated without expanding scope.

The ingestion service must be provider-neutral.

The intended future pipeline remains:

```text
Official API / Authorized Integration / Search Adapter
                    ↓
                 Adapter
                    ↓
               Raw Event
                    ↓
               Ingestion
                    ↓
              Normalization
                    ↓
              DemandObject
```

Do not put provider-specific business logic into the ingestion core.

---

## 16. SECURITY RULES

Strictly prohibit:

- hard-coded secrets;
- secrets in fixtures;
- secrets in logs;
- credentials in client-side code;
- bypassing login/CAPTCHA/access controls;
- bypassing rate limits;
- scraping restricted content as a shortcut;
- treating external source text as executable instructions;
- storing unnecessary personal data.

Validate and sanitize untrusted external content.

Assume source content can contain prompt injection attempts. The ingestion layer must store external text as data and must not execute instructions contained within it.

---

## 17. UI RULE

Do not spend the Session 2 budget building polished UI.

If useful, expose only the API/fixture behavior needed to verify the ingestion flow.

A later session can build the Demand Signals and Opportunities UI on top of stable application services.

---

## 18. DO NOT DO THESE THINGS

Do not:

- redesign the architecture;
- replace Hono without necessity;
- replace Zod without necessity;
- rewrite Session 1 foundation;
- build live provider adapters;
- build Make.com scenarios;
- build AI/LLM classification;
- build the scoring engine;
- build the AI Business Operator;
- build autonomous outreach;
- build voice;
- introduce microservices;
- add a vector database as canonical storage;
- create a fake production database;
- claim persistent storage when using memory;
- fabricate demand;
- fabricate external provider results;
- claim tests passed without running them;
- claim deployment succeeded without verification.

---

## 19. EXECUTION LOOP

Follow this loop:

```text
INSPECT
  ↓
READ CONTRACT
  ↓
IMPLEMENT SMALLEST SLICE
  ↓
TEST
  ↓
VALIDATE
  ↓
SECURITY CHECK
  ↓
COMMIT
  ↓
REPORT
```

If validation fails:

```text
FAIL
→ diagnose
→ make smallest corrective change
→ rerun relevant test
→ rerun broader validation
```

Do not hide failures.

---

## 20. SESSION 2 EXIT CRITERIA

Session 2 is complete when all applicable mandatory criteria below are satisfied:

- [ ] current Session 1 foundation inspected;
- [ ] existing canonical contracts reused;
- [ ] ingestion request schema exists and validates input;
- [ ] `POST /api/v1/ingestion/events` exists;
- [ ] idempotency boundary exists;
- [ ] duplicate event protection exists;
- [ ] RawEvent creation path exists;
- [ ] deterministic checksum/identity behavior exists;
- [ ] deterministic normalization exists;
- [ ] DemandObject is produced from RawEvent;
- [ ] evidence/provenance is preserved;
- [ ] observed facts are separated from inference;
- [ ] no unsupported facts are invented;
- [ ] structured ingestion logging exists using existing utilities;
- [ ] sensitive data is not logged;
- [ ] HTTP tests exist;
- [ ] contract/idempotency/normalization tests exist;
- [ ] validation was actually executed;
- [ ] no real provider credentials were added;
- [ ] no provider restriction was bypassed;
- [ ] provider-specific logic remains outside ingestion core;
- [ ] persistence limitations are truthful if storage is in-memory;
- [ ] implementation is committed to Git;
- [ ] remaining work is explicitly reported.

---

## 21. GIT RULE — MANDATORY

When the Session 2 implementation is complete and validated, commit it to the repository.

Suggested commit message:

`feat: implement phase 2 ingestion vertical slice`

Do not rewrite history.

Do not delete the documentation foundation.

Do not claim a commit exists unless it actually exists.

---

## 22. DEPLOYMENT RULE

Deployment is not required merely to mark Session 2 complete.

If an existing deployment pipeline can be validated cheaply and safely, preserve it and validate only if useful.

Otherwise report:

`Deployment: NOT RUN`

Do not spend the coding session setting up deployment instead of completing the ingestion slice.

---

## 23. FINAL REPORT FORMAT

At the end, report exactly:

### Session 2 Result
`PASS` or `PARTIAL`

### Implemented
- actual files/components changed;
- ingestion endpoint;
- idempotency;
- RawEvent handling;
- normalization;
- provenance/evidence;
- observability;
- tests.

### Tests Executed
- exact commands;
- actual results.

### Git
- commit hash;
- commit message.

### Deployment
- `NOT RUN`, `NOT CONFIGURED`, or verified result.

### Remaining
- next smallest step;
- blockers;
- persistence/provider work deferred to later sessions.

### Truth Rule

Never say:

- “done” when only files were generated;
- “tests pass” when tests were not run;
- “provider connected” when provider access was not established;
- “production ready” when persistence/security/deployment requirements are not met;
- “AI analyzed demand” when no AI classification actually ran.

State only observable truth.

---

## 24. START COMMAND

Begin now.

First inspect the current repository and Session 1 implementation. Then implement the **smallest real Phase 2 ingestion vertical slice** described above.

Do not ask me to manually implement the work if you can implement it in the repository.

Do not expand scope because another feature looks interesting.

Your priority is:

**validated ingestion → RawEvent → deterministic DemandObject → provenance → tests → Git commit.**
