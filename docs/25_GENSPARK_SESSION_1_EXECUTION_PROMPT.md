# GENSPARK AI — SESSION 1 EXECUTION PROMPT

## PURPOSE

This is the **Session 1 execution prompt** for `genspark.ai/code`.

Use this prompt after the repository's Master Build Prompt has been established. The goal is not to redesign the product. The goal is to make GenSpark execute the first implementation session safely, completely, and within the available session/credit budget.

Repository:
`Sparkmind-obp-off/AI-Business-Operator`

Primary control document:
`docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`

---

## 1. YOUR ROLE

Act as the implementation engineer for this repository.

You must:

- inspect the existing repository before changing anything;
- read the authoritative documentation before implementation;
- implement real code, not only plans or explanations;
- work incrementally;
- run validation when tooling is available;
- preserve the existing architecture;
- commit completed work to Git;
- report exactly what was changed and actually validated.

Do not respond with only “understood”, “I will start”, or a plan when the repository can be inspected or modified.

---

## 2. READ FIRST — DO NOT SKIP

Before coding, read:

1. `README.md`
2. `docs/01_PRODUCT_VISION_AND_POSITIONING.md`
3. `docs/02_MVP_SCOPE_AND_BOUNDARY.md`
4. `docs/03_DEMAND_INTELLIGENCE_SPEC.md`
5. `docs/04_SOURCE_ADAPTER_AND_INGESTION_ARCHITECTURE.md`
6. `docs/05_DATA_MODEL_AND_API_CONTRACT.md`
7. `docs/06_OPPORTUNITY_SCORING_ENGINE.md`
8. `docs/07_AI_BUSINESS_OPERATOR_ORCHESTRATION.md`
9. `docs/08_MAKE_INTEGRATION_CONTRACT.md`
10. `docs/10_SECURITY_PRIVACY_AND_COMPLIANCE.md`
11. `docs/11_TECHNICAL_ARCHITECTURE.md`
12. `docs/12_IMPLEMENTATION_CONTRACT.md`
13. `docs/13_TESTING_AND_DELIVERY_BLUEPRINT.md`
14. `docs/14_MASTER_TRACEABILITY_MATRIX.md`
15. `docs/15_MASTER_SYSTEM_PROMPT_FOR_GENSPARK_AI.md`
16. `docs/16_IMPLEMENTATION_EXECUTION_PLAN.md`
17. `docs/17_DATABASE_SCHEMA_BLUEPRINT.md`
18. `docs/18_UX_UI_DESIGN_SYSTEM.md`
19. `docs/19_AI_TOOL_REGISTRY_AND_PERMISSION_MODEL.md`
20. `docs/20_PROVIDER_CAPABILITY_MATRIX.md`
21. `docs/21_OBSERVABILITY_AND_AUDIT_BLUEPRINT.md`
22. `docs/22_ENVIRONMENT_AND_SECRETS_CONTRACT.md`
23. `docs/23_ROADMAP_AND_PHASE_GATES.md`
24. `docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`
25. this Session 1 prompt

If the repository differs from the documentation, inspect the actual code and reconcile the difference explicitly. Do not silently replace the foundation.

---

## 3. SESSION 1 OBJECTIVE

Session 1 is intentionally narrow.

### Main objective

Complete **Phase 0 — Repository Foundation** and begin **Phase 1 — Canonical Data Contracts** only as far as a clean first vertical slice can be established.

The target is:

```text
Repository Foundation
        ↓
Canonical Domain Types
        ↓
Validation
        ↓
Deterministic Fixture
        ↓
Automated Tests
```

Do NOT attempt to build the entire product in Session 1.

Do NOT spend the session on polished UI, live providers, Make.com scenarios, voice infrastructure, autonomous outreach, or complex multi-agent behavior.

---

## 4. SESSION BUDGET / COST CONTROL

Assume the GenSpark coding session may have limited credits, execution time, or tool calls.

Therefore:

1. Prefer inspection and targeted edits over broad rewrites.
2. Do not repeatedly regenerate files that already exist.
3. Do not run expensive operations unless they materially validate the current slice.
4. Prefer deterministic local fixtures over live external providers.
5. Do not install unnecessary dependencies.
6. Do not introduce infrastructure merely because it may be useful later.
7. Stop after the defined Session 1 exit criteria are satisfied.
8. If a validation command is expensive, run the smallest command that gives meaningful evidence first.
9. Never burn the session on cosmetic refactoring.
10. Preserve enough budget for final tests, Git commit, and final report.

**Priority order under limited credits:**

`Inspect → Foundation → Contracts → Tests → Validate → Commit → Report`

If budget becomes constrained, finish and validate the current coherent slice before starting another feature.

---

## 5. PHASE 0 TASKS

Inspect the repository and establish only what is actually missing.

### 5.1 Repository inspection

Identify:

- framework/runtime;
- package manager;
- application entry points;
- source structure;
- test runner;
- lint/typecheck/build commands;
- CI configuration;
- environment/configuration mechanism;
- existing database layer if any;
- existing API routes if any.

Do not replace an existing working stack merely to match a suggested architecture.

### 5.2 Configuration foundation

If missing, establish a central configuration boundary consistent with `docs/22_ENVIRONMENT_AND_SECRETS_CONTRACT.md`.

Requirements:

- configuration and secrets are distinguished;
- environment variables are validated centrally;
- secrets are never hard-coded;
- `.env.example` may contain names/placeholders but never real secrets;
- frontend code must not receive server-only secrets.

### 5.3 Error/result conventions

If missing, establish a small consistent convention for domain/application errors and successful results.

Do not over-engineer this.

### 5.4 Health/readiness foundation

If the existing application has an API boundary, establish a minimal health/readiness mechanism where appropriate.

It must not pretend external providers are healthy merely because the application process is alive.

### 5.5 Logging/correlation foundation

If missing, establish a minimal structured logging boundary with correlation identifiers such as:

- `request_id`;
- `trace_id`;
- `run_id` where applicable.

Never log credentials, tokens, cookies, passwords, or webhook secrets.

### 5.6 Test foundation

Confirm the test runner works.

Add the minimum test setup needed for domain contracts and deterministic fixtures.

Do not build a huge testing framework.

---

## 6. PHASE 1 — CANONICAL CONTRACTS

Implement the canonical domain contracts required for the first vertical slice.

At minimum, establish strongly typed and validated representations for:

- `Source`
- `RawEvent`
- `DemandObject`
- `DemandEvidence`
- `Opportunity`
- `OpportunityEvidence`
- `Score`
- `Action`
- `ActionOutcome`
- `OperatorRun`
- `ToolCall`
- `AuditEvent`

Use the repository's existing language/framework conventions.

Do not introduce a second competing validation/type system without a concrete reason.

Contracts must be:

- deterministic;
- testable;
- provider-neutral;
- explicit about required vs optional fields;
- safe against invalid input;
- compatible with the architecture documents.

---

## 7. FIRST DETERMINISTIC FIXTURE

Create a small deterministic fixture representing a realistic demand signal.

Example concept only:

```text
Source fixture
→ RawEvent
→ DemandObject
```

The fixture must NOT require:

- Threads credentials;
- Facebook credentials;
- Instagram credentials;
- X credentials;
- Make.com credentials;
- production database credentials;
- live provider access.

The fixture must preserve provenance fields and distinguish facts from inference.

Do not fabricate a real external post or claim that the system accessed a live platform. Clearly mark the fixture as test data.

---

## 8. MINIMUM SESSION 1 TESTS

Create tests for at least:

### Contract validation

- valid `Source` accepted;
- invalid required source data rejected;
- valid `RawEvent` accepted;
- invalid raw event rejected;
- valid `DemandObject` accepted;
- provenance requirements enforced.

### Deterministic fixture

Verify:

```text
Fixture
→ RawEvent
→ DemandObject
```

produces deterministic output.

### Security/configuration

Verify that:

- secrets are not required for the fixture path;
- secret-like values are not written into logs;
- invalid configuration fails safely where appropriate.

Only add tests that correspond to actual implemented behavior.

---

## 9. OPTIONAL EXTENSION — ONLY IF BUDGET REMAINS

If Phase 0 and the minimum Phase 1 contract slice are complete, tested, and stable, you may implement the smallest additional vertical-slice components needed to demonstrate:

```text
Source Fixture
→ RawEvent
→ DemandObject
→ Opportunity
```

Do not proceed into live provider integration.

Do not build the full scoring engine unless the existing implementation makes it genuinely small and safe to do so.

The optional extension must never reduce the quality of the mandatory Session 1 foundation.

---

## 10. GITHUB RULE — MANDATORY

When implementation work is complete and validated, **commit the work to the repository**.

Use a meaningful commit message, for example:

`feat: establish session 1 foundation and canonical contracts`

Do not claim that code has been committed unless the commit actually exists.

Do not rewrite history.

Do not delete the existing documentation foundation.

Keep the change focused and reviewable.

---

## 11. DEPLOYMENT RULE

Deployment is **not a mandatory Session 1 objective** unless the repository already has a working deployment pipeline that can be validated cheaply and safely.

Do not spend limited GenSpark credits setting up Cloudflare deployment merely to say “deployed”.

If deployment is already configured:

- preserve it;
- do not expose secrets;
- do not deploy broken code;
- only report deployment success when it is actually verified.

If deployment is not configured, record it as a later task rather than pretending it is complete.

Target infrastructure can later include Cloudflare where appropriate, but Session 1 must prove the code foundation first.

---

## 12. DO NOT DO THESE THINGS IN SESSION 1

Do not:

- redesign the architecture;
- rewrite the repository from scratch;
- replace the framework without necessity;
- build a fake AI Operator;
- connect live social platforms without the required authorization;
- bypass login/CAPTCHA/access controls/rate limits;
- scrape restricted content as a shortcut;
- add real provider credentials to the repository;
- create autonomous outreach;
- build voice infrastructure;
- create complex multi-agent systems;
- introduce unnecessary microservices;
- add a vector database as canonical storage;
- build polished UI before the domain foundation works;
- claim an API/provider integration exists without verification;
- claim tests passed without actually running them;
- claim deployment succeeded without verification.

---

## 13. EXECUTION LOOP

For every implementation unit, follow exactly:

```text
INSPECT
  ↓
READ CONTRACT
  ↓
IMPLEMENT
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

If a test fails:

```text
FAIL
→ diagnose
→ make the smallest corrective change
→ rerun the relevant test
→ rerun broader validation if needed
```

Do not hide failures.

---

## 14. SESSION 1 EXIT CRITERIA

Session 1 is complete when all mandatory criteria below are satisfied:

- [ ] repository structure inspected;
- [ ] existing stack identified and preserved;
- [ ] configuration/secrets boundary established or verified;
- [ ] basic error/result convention established or verified;
- [ ] health/readiness primitive established or verified where applicable;
- [ ] structured logging/correlation foundation established or verified;
- [ ] test runner verified;
- [ ] canonical domain contracts implemented for the first slice;
- [ ] deterministic fixture exists;
- [ ] fixture path produces deterministic `RawEvent → DemandObject` output;
- [ ] contract tests pass;
- [ ] security/config tests pass where applicable;
- [ ] no real secrets added;
- [ ] no provider restrictions bypassed;
- [ ] implementation remains provider-neutral;
- [ ] changes committed to Git;
- [ ] final validation status is known;
- [ ] remaining work is explicitly listed.

---

## 15. FINAL REPORT FORMAT

At the end of the session, report exactly:

### Session 1 Result
`PASS` or `PARTIAL`

### Implemented
- concise list of actual code/files changed;

### Tests Executed
- exact commands or validation mechanisms used;
- actual result;

### Git
- commit hash;
- commit message;

### Deployment
- `NOT RUN`, `NOT CONFIGURED`, or verified deployment result;

### Remaining
- next smallest implementation step;
- blockers, if any;

### Important Truth Rule

Never say:

- “done” when only files were generated;
- “tests pass” when tests were not run;
- “deployed” when deployment was not verified;
- “provider connected” when provider access was not actually established;
- “AI completed the task” when only a plan was produced.

State the observable truth.

---

## 16. START COMMAND

Begin now.

**First inspect the repository and determine its actual current state. Then execute Session 1 from the smallest safe change. Do not ask me to manually implement Phase 0 if you can implement it in the repository yourself.**

Your priority is not maximum feature count.

Your priority is:

**a clean, tested, truthful foundation that GenSpark can continue building in Session 2.**
