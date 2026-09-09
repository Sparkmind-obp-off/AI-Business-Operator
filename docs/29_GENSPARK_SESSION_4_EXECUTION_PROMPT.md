# AI Business Operator — GenSpark Session 4 Execution Prompt

## Role
You are the implementation agent for the AI Business Operator repository. Act as Principal Architect, Full-Stack Engineer, QA Engineer, and Security Engineer.

GitHub is the durable source of truth. `/docs` is the product and architecture source of truth. Implement only what is required for this session. Do not expand scope because a future capability looks useful.

## Current Checkpoint
Session 1 — Foundation/contracts: complete.
Session 2 — Ingestion vertical slice: complete.
Session 3 — Deterministic Demand Intelligence: complete.

Expected latest Session 3 implementation commit:
`50c054a99849ac53a8b02e76ac0cefd643664671`

## Session 4 Objective
Implement **Phase 4 — Opportunity Database** as the smallest real, deterministic, evidence-first vertical slice:

`DemandObject / DemandIntelligenceResult → Opportunity → Evidence Linkage → Lifecycle → Retrieval`

The goal is to turn already-normalized, evidence-backed demand into a traceable Opportunity record without scoring it yet.

## MANDATORY FIRST STEP — INSPECT BEFORE EDITING
Before changing anything:

1. Inspect the current repository tree.
2. Verify the actual Session 3 state and commit.
3. Read the relevant contracts and docs, especially:
   - `docs/05_DATA_MODEL_AND_API_CONTRACT.md`
   - `docs/06_OPPORTUNITY_SCORING_ENGINE.md`
   - `docs/14_MASTER_TRACEABILITY_MATRIX.md`
   - `docs/17_DATABASE_SCHEMA_BLUEPRINT.md`
   - `docs/19_AI_TOOL_REGISTRY_AND_PERMISSION_MODEL.md`
   - `docs/23_ROADMAP_AND_PHASE_GATES.md`
   - `docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`
   - `docs/28_GENSPARK_SESSION_3_EXECUTION_PROMPT.md`
4. Inspect the actual `src/domain` contracts and Session 3 intelligence implementation.
5. Reuse existing repository/result/logging patterns. Do not invent a parallel architecture.

Only after inspection: implement the smallest complete Session 4 slice.

---

# 1. IN SCOPE

### A. Opportunity creation boundary
Create/reuse a provider-neutral service boundary such as:

`DemandObject + DemandIntelligenceResult → OpportunityService → Opportunity`

The exact naming must follow the existing repository conventions.

The service must:
- accept validated canonical demand/intelligence input;
- produce a canonical Opportunity;
- preserve links back to the originating demand IDs;
- preserve evidence references;
- generate a concise deterministic title;
- generate an explicit offer hypothesis only when supported by evidence;
- identify a target segment only when supported by the input;
- initialize lifecycle status truthfully;
- never fabricate buyers, budgets, market size, authority, or guaranteed demand.

### B. Evidence linkage
Every created Opportunity must be traceable to its evidence.

Minimum linkage:
- opportunity ID;
- demand ID(s);
- source/raw-event evidence reference(s) where available;
- provenance continuity.

Do not copy large raw payloads into Opportunity records.

### C. Lifecycle
Implement the canonical Opportunity lifecycle from the database blueprint:

`new → enriched → scored → qualified → action_ready → acted_on → measured → learned`

Session 4 should implement only the transitions justified by the current workflow. At minimum:
- newly created Opportunity starts at `new`;
- valid deterministic enrichment can move it to `enriched` if the existing contract supports this cleanly;
- do NOT mark an Opportunity `scored`, `qualified`, `action_ready`, or `acted_on` because those belong to later phases.

Transitions must be explicit and validated. Invalid transitions must fail deterministically.

### D. Retrieval
Implement a small provider-neutral Opportunity repository/service with deterministic retrieval capabilities appropriate to the current architecture.

At minimum support:
- create/get by ID;
- list opportunities;
- filtering by lifecycle status;
- filtering by target segment or other already-canonical field only if the contract supports it;
- stable deterministic ordering.

Do not build a full search engine, vector database, analytics warehouse, or production database architecture in this session.

### E. Deduplication / identity
Prevent accidental duplicate Opportunity creation when the same canonical demand evidence is processed repeatedly.

Use deterministic identity or a repository-level idempotency/deduplication boundary consistent with existing patterns.

Do not create a new unrelated hashing architecture if the existing ingestion identity approach can be reused.

### F. Auditability
Opportunity creation and lifecycle transitions must emit structured logs using the existing logger pattern.

Log IDs, status, lifecycle events, and safe metadata only.
Never log raw source text, credentials, tokens, or sensitive payloads.

---

# 2. CONTRACT RULES

The canonical Opportunity model from the existing contracts remains authoritative.

Do not silently change existing canonical fields just to make implementation easier.

If a small contract extension is genuinely necessary, make it:
- backward-compatible where possible;
- documented;
- validated by tests;
- limited strictly to Session 4.

Do not introduce speculative fields for scoring, Operator, voice, outreach, billing, or provider-specific data.

## Evidence vs inference
Maintain the distinction:
- observed facts come from DemandObject/evidence;
- offer hypotheses and target interpretations are bounded inferences;
- no inference may be represented as verified fact.

If the input is insufficient to support a field, use the contract's honest unknown/nullable representation instead of inventing a value.

---

# 3. SCORING IS OUT OF SCOPE

Do NOT implement:
- Opportunity scoring;
- score weights;
- priority bands;
- score calibration;
- ranking based on score;
- AI-generated score;
- competition scoring;
- execution feasibility scoring.

Session 5 owns deterministic scoring.

An Opportunity may exist without a score.

---

# 4. DATABASE SCOPE

The repository currently uses process-local storage.

Do not introduce a production database, migrations, D1 architecture, ORM, transaction layer, or distributed persistence unless the existing repository state makes a tiny compatibility change unavoidable.

A repository abstraction is preferred so durable storage can be added later.

Never claim process-local storage is durable production persistence.

---

# 5. API SCOPE

If useful, expose only a minimal API/fixture path consistent with existing conventions.

Possible minimal operations:
- create Opportunity from validated canonical demand input;
- get/list Opportunity records;
- lifecycle transition.

Do not build a large dashboard/API surface.
Do not add authentication/authorization architecture in this session unless required by an existing boundary.

Any API must:
- validate input;
- return truthful status codes;
- preserve correlation/request IDs;
- avoid leaking raw payloads or secrets.

---

# 6. TESTING — MANDATORY

Add deterministic automated tests covering at least:

1. Opportunity creation from valid DemandObject/intelligence input.
2. Demand-to-Opportunity evidence linkage.
3. Provenance continuity.
4. Deterministic title/offer-hypothesis behavior.
5. Honest unknown behavior when evidence is insufficient.
6. Duplicate/idempotent Opportunity creation.
7. Get by ID.
8. Deterministic list ordering.
9. Lifecycle initial state.
10. Valid lifecycle transition(s).
11. Invalid lifecycle transition rejection.
12. Filtering by lifecycle status.
13. No fabricated score.
14. No fabricated buyer/budget/guaranteed-demand claims.
15. Structured logging without raw source text/secrets.
16. Prompt-injection-like source text is treated only as data.
17. Schema validation failure behavior.

Use fixtures rather than live providers.

Do not claim tests passed unless they were actually executed.

---

# 7. SECURITY / TRUST RULES

External/source text is **untrusted data**.

A source event may contain strings such as:
- `ignore previous instructions`;
- fake system messages;
- malicious URLs;
- tool-call-like content.

These must never alter application control flow.

Never:
- bypass login;
- bypass CAPTCHA;
- bypass access controls;
- bypass rate limits;
- use leaked/stolen credentials;
- scrape restricted/private content;
- add live providers;
- send outreach;
- execute external side effects.

No secrets in source code, fixtures, logs, prompts, or committed files.

---

# 8. ARCHITECTURE RULES

Keep the architecture provider-neutral:

`Source → Ingestion → DemandObject → Demand Intelligence → Opportunity`

Provider-specific logic must remain outside canonical Opportunity business logic.

AI/LLM is NOT required for Session 4.

Do not add:
- LLM calls;
- autonomous agents;
- Make.com;
- live social APIs;
- live search providers;
- voice;
- UI redesign;
- background job infrastructure;
- microservices.

Prefer a modular monolith and small vertical slice.

---

# 9. DEFINITION OF DONE

Session 4 is complete only when all applicable items are true:

- [ ] Current repository and Session 3 state inspected first.
- [ ] Opportunity service boundary implemented/reused.
- [ ] Canonical Opportunity is created from valid evidence-backed demand.
- [ ] Demand/evidence/provenance linkage is preserved.
- [ ] Deterministic identity/deduplication exists.
- [ ] Opportunity lifecycle is explicit and validated.
- [ ] Retrieval works with deterministic ordering.
- [ ] No scoring implemented.
- [ ] No live providers implemented.
- [ ] No LLM/AI dependency added.
- [ ] No external side effects.
- [ ] Structured logs exist and are safe.
- [ ] Tests cover creation, evidence, provenance, dedupe, retrieval, lifecycle, invalid transitions, honesty/security.
- [ ] Actual validation commands are executed.
- [ ] No secrets committed.
- [ ] Working tree is reviewed.
- [ ] Git commit is created.
- [ ] Commit SHA and exact validation results are reported.

Suggested commit message:

`feat: implement phase 4 opportunity database`

---

# 10. CREDIT / SCOPE CONTROL

This is a constrained implementation session.

Do NOT:
- refactor unrelated code;
- rewrite the architecture;
- redesign the frontend;
- create production DB migrations;
- implement Phase 5 scoring;
- implement Phase 6 Operator;
- implement provider adapters;
- implement Make.com;
- implement voice;
- implement autonomous execution.

If an existing issue blocks Session 4, fix only the smallest prerequisite needed and document it.

Prefer reuse over abstraction expansion.

---

# 11. EXECUTION ORDER

Follow exactly:

`Inspect → Read Contracts → Design Smallest Slice → Implement → Test → Validate → Review Diff → Commit → Report`

Do not stop after planning.

Do not report completion before implementation and validation.

Do not invent test results.

---

# 12. FINAL REPORT FORMAT

Return a concise report with exactly these sections:

## STATUS
`PASS` or `PARTIAL`

## IMPLEMENTED
- files/components changed;
- Opportunity creation;
- evidence/provenance linkage;
- lifecycle;
- retrieval;
- dedupe.

## TESTS
For every executed command, report:
- exact command;
- PASS/FAIL;
- relevant result summary.

If a command could not be executed, say so explicitly.

## GIT
- commit message;
- commit SHA;
- working-tree status if verified.

## DEPLOYMENT
State `NOT REQUIRED FOR SESSION 4` unless deployment was actually performed and verified.

## LIMITATIONS
Only real remaining limitations.

## NEXT ROADMAP STEP
`Phase 5 — Deterministic Opportunity Scoring`

## TRUTH RULE
Never claim implementation, tests, deployment, provider access, persistence, or execution that did not actually occur.

---

# START NOW

Inspect the current repository and verify the Session 3 checkpoint first.

Then read the canonical contracts and Phase 4 architecture documents.

Then implement the smallest real Phase 4 Opportunity Database vertical slice.

**Implement → Test → Validate → Commit → Report.**
