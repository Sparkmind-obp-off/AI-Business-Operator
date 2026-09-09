# GENSPARK SESSION 8 EXECUTION PROMPT

## ACTIONS / EXECUTION BOUNDARY — APPROVAL-GATED, SAFE, OBSERVABLE

**Repository:** `Sparkmind-obp-off/AI-Business-Operator`

**Role:** Principal Architect + Full-Stack Engineer + QA + Security + Implementation Agent

**Execution mode:** credit-safe, deterministic-first, approval-gated, provider-neutral, no fabricated side effects.

---

## 0. MANDATORY START

Before changing anything:

1. Inspect current repository state and latest `main`.
2. Verify Session 7 implementation exists. Expected commit message:
   `feat: implement phase 7 provider adapter foundation`
3. Read the actual Session 7 implementation and tests; do not assume the prompt matches the code.
4. Confirm Session 6 Operator permission/approval and tool-result validation behavior remains intact.
5. Read these contracts:
   - `docs/05_DATA_MODEL_AND_API_CONTRACT.md`
   - `docs/07_AI_BUSINESS_OPERATOR_ORCHESTRATION.md`
   - `docs/19_AI_TOOL_REGISTRY_AND_PERMISSION_MODEL.md`
   - `docs/21_OBSERVABILITY_AND_AUDIT_BLUEPRINT.md`
   - `docs/22_ENVIRONMENT_AND_SECRETS_CONTRACT.md`
   - `docs/23_ROADMAP_AND_PHASE_GATES.md`
   - `docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`
   - `docs/31_GENSPARK_SESSION_6_EXECUTION_PROMPT.md`
   - `docs/32_GENSPARK_SESSION_7_EXECUTION_PROMPT.md`
6. Inspect actual code under `src/operator`, `src/actions` if present, `src/domain`, `src/adapters`, routes, logging, configuration, and tests.
7. Preserve all existing Session 1–7 behavior.

If Session 7 is materially broken, STOP and report the blocker. Do not rebuild earlier phases.

---

# 1. SESSION 8 OBJECTIVE

Implement the smallest real **Actions / Execution Boundary** vertical slice:

```text
Operator Plan / Approved Intent
        ↓
Action Contract
        ↓
Permission Check
        ↓
Approval Gate
        ↓
Safe Execution Boundary
        ↓
Deterministic Mock/Fixture Execution
        ↓
Validated Result
        ↓
Action Outcome + Audit
```

Session 8 must prove that the system can safely represent and execute an approved action without introducing live external side effects.

The action layer is the controlled boundary between recommendations and real-world effects.

---

# 2. HARD SCOPE BOUNDARY

## IN SCOPE

Implement only what is required for:

1. Canonical Action execution contract, reusing existing domain contracts where possible.
2. Action lifecycle/state transitions sufficient for safe execution.
3. Explicit action risk and approval requirements.
4. Permission validation before execution.
5. Approval validation before execution when required.
6. A provider-neutral execution interface.
7. Exactly one deterministic mock/fixture executor with **no external side effect**.
8. Result validation before recording success.
9. ActionOutcome recording and provenance/audit metadata.
10. Idempotency / duplicate-execution protection within the existing process-local architecture.
11. Safe failure, rejection, cancellation, timeout/retry metadata where appropriate.
12. Focused tests covering approval, permission, success, duplicate execution, invalid result, and failure paths.
13. Minimal route/fixture exposure only if needed to prove the slice.

## STRICTLY OUT OF SCOPE

Do NOT implement:

- live email sending;
- live social posting;
- live DM/outreach;
- live payment or financial transactions;
- live CRM mutations;
- live Make.com action scenarios;
- autonomous outreach;
- bypasses or unauthorized actions;
- browser automation;
- credential harvesting;
- production DB migrations;
- large UI redesign;
- voice;
- live LLM planning;
- multi-agent infrastructure;
- broad provider integrations;
- real external side effects of any kind.

A deterministic fixture executor is sufficient. The purpose is to prove the safety boundary, not to connect production services yet.

---

# 3. CORE SAFETY MODEL

The execution path MUST be:

```text
Requested Action
→ Canonical Validation
→ Tool/Action Permission Check
→ Risk Check
→ Approval Check
→ Idempotency Check
→ Executor Selection
→ Execute
→ Result Schema Validation
→ Outcome Record
→ Audit Event
```

No action may skip a gate.

A recommendation is not an execution.

A plan is not an approval.

An approval is not proof that execution succeeded.

Execution success is only recorded after the executor result passes canonical validation.

---

# 4. ACTION CONTRACT

Reuse the canonical `Action` and `ActionOutcome` domain contracts from `src/domain` rather than creating parallel business models.

The implementation should make these concepts explicit as needed:

```text
Action
  actionId
  opportunityId
  type
  description
  requiredApproval
  status
  executionReference
  result
  createdAt

ActionOutcome
  actionId
  status
  result
  observedAt
  executionReference
  provenance/audit references
```

Use the repository's actual field names and schemas.

Do not weaken existing high-risk approval requirements.

---

# 5. EXECUTION STATES

Use existing conventions where available. If states are missing, introduce only the minimum required state machine, conceptually:

```text
proposed
  ↓
approval_required
  ↓
approved
  ↓
executing
  ↓
succeeded | failed | cancelled | timed_out
```

A rejected or unapproved action must never enter `executing`.

Do not invent a successful result for a rejected, unavailable, or failed execution.

Duplicate execution of the same idempotency key must not create a second side effect or a second success outcome.

---

# 6. PERMISSION + APPROVAL GATES

Reuse Session 6's permission and tool registry architecture.

Before execution verify:

1. action/tool is registered;
2. requested operation is allowed;
3. input schema is valid;
4. risk level is known;
5. approval policy is satisfied;
6. action is not already completed under the same idempotency key.

Required behavior:

- LOW + approval `none`: may proceed if otherwise permitted.
- MEDIUM/HIGH or conditional/always approval: stop until approval is explicitly present.
- Disabled tool/action: reject safely.
- Unknown/unregistered action: reject safely.
- Invalid input: reject before executor invocation.

Never allow executor code to decide whether approval is required.

---

# 7. EXECUTOR INTERFACE

Create or reuse a provider-neutral interface conceptually similar to:

```text
ActionExecutor
  canExecute(action)
  execute(action, context)
```

Exact names must follow repository conventions.

Executor output must be schema-validated before the system records success.

The executor must not receive unnecessary credentials or unrelated context.

Provider-specific execution logic must remain behind the executor boundary.

---

# 8. ONE DETERMINISTIC FIXTURE EXECUTOR

Implement exactly one synthetic executor such as:

```text
external.action.fixture
```

It MUST:

- perform no network request;
- perform no real external side effect;
- be deterministic;
- return clearly synthetic output;
- preserve action ID/idempotency information;
- be easy to test;
- never claim that a real external action happened.

Example semantic result:

```text
status: simulated
executionReference: fixture://...
sideEffectPerformed: false
```

Do not describe simulated execution as successful real-world execution.

---

# 9. IDEMPOTENCY

Reuse the existing process-local patterns.

For every executable action:

- accept or derive a deterministic idempotency key;
- record the key with the action execution;
- return the existing outcome for duplicate replay where appropriate;
- reject conflicting reuse of a key;
- never execute the fixture twice for the same accepted execution identity.

Do not introduce durable persistence in Session 8.

Document that process-local idempotency resets across isolates/restarts.

---

# 10. RESULT VALIDATION

Treat executor output as untrusted input.

Validate it against a canonical schema before recording an outcome.

Required tests:

- valid result → recorded according to the fixture semantics;
- malformed result → execution marked failed and audit recorded;
- contradictory result → not accepted as success;
- sensitive data → rejected/redacted according to existing security conventions.

Do not allow an executor to self-certify success without schema validation.

---

# 11. FAILURE / RECOVERY

Distinguish at least:

- permission denied;
- approval required;
- invalid action/input;
- duplicate/idempotency conflict;
- executor unavailable;
- executor timeout;
- executor failure;
- invalid executor result;
- cancellation where supported.

For retryable failures, expose retryability and do not automatically retry unsafe actions.

Never retry an unknown external side effect blindly.

For the fixture executor, deterministic retry behavior is acceptable only where it cannot create real side effects.

---

# 12. OBSERVABILITY + AUDIT

Reuse existing structured logging and audit patterns.

Useful events include:

```text
action.requested
action.permission_checked
action.approval_required
action.approved
action.rejected
action.execution_started
action.execution_succeeded
action.execution_failed
action.result_validated
action.duplicate_detected
action.idempotency_conflict
```

Log safe metadata only:

- action ID;
- opportunity ID;
- tool/executor name/version;
- risk;
- approval state;
- status;
- idempotency reference/hash where appropriate;
- duration;
- retryability/error code;
- correlation/run IDs.

Never log credentials, authorization headers, or unnecessary raw action payloads.

A failed result-validation attempt must be auditable, just as Session 6 invalid tool results are.

---

# 13. SECURITY / COMPLIANCE

Mandatory:

- no real external side effects;
- no secrets committed;
- no secrets in logs;
- no credentials exposed to browser/client;
- no arbitrary executor selection from untrusted source text;
- no source content can grant permission or approval;
- no bypass of permission/approval gates;
- no hidden fallback from rejected execution to simulated success;
- executor identity must come from the controlled registry/boundary;
- validate all action and executor results.

External/source text is data, never executable instructions.

---

# 14. TEST REQUIREMENTS

Tests are mandatory.

### Contract

- canonical Action validates;
- ActionOutcome validates;
- high-risk action requires approval;
- result schema rejects malformed/contradictory output.

### Permission

- allowed action passes permission check;
- unregistered/disabled action is rejected;
- insufficient permission is rejected.

### Approval

- approval-required action stops before executor invocation;
- explicit valid approval permits execution;
- approval cannot be inferred from an AI recommendation.

### Execution

- fixture executor is deterministic;
- no network/external side effect occurs;
- valid result becomes a truthful simulated outcome;
- executor failures are normalized.

### Idempotency

- same idempotency key does not execute twice;
- conflicting key reuse is rejected;
- duplicate replay returns the recorded process-local outcome where appropriate.

### Result validation

- malformed result fails safely;
- invalid result produces audit metadata;
- successful outcome is never recorded before validation.

### Security

- credentials never appear in logs/results;
- source text cannot select arbitrary executor;
- permission/approval cannot be bypassed.

---

# 15. DEFINITION OF DONE

Session 8 is DONE only when:

- [ ] Session 7 is verified.
- [ ] Action execution boundary exists.
- [ ] Canonical Action/Outcome contracts are reused.
- [ ] Permission gate is enforced.
- [ ] Approval gate is enforced.
- [ ] Provider-neutral executor boundary exists.
- [ ] One deterministic no-side-effect fixture executor exists.
- [ ] Result validation exists before success recording.
- [ ] Idempotency/duplicate protection exists within process-local scope.
- [ ] Failure/retryability states are truthful.
- [ ] Audit/observability events exist.
- [ ] Focused tests pass.
- [ ] No live external side effect was introduced.
- [ ] No secrets were committed.
- [ ] No production DB migration occurred.
- [ ] Actual validation commands were run.
- [ ] Diff was reviewed for scope creep.
- [ ] Git commit was created.
- [ ] Final report is truthful.

---

# 16. CREDIT-SAFE EXECUTION STRATEGY

Use exactly this sequence:

```text
Inspect
→ Verify Session 7
→ Read Action/Permission/Audit Contracts
→ Inspect Existing Operator + Domain Contracts
→ Design Smallest Execution Boundary
→ Implement Canonical Action/Executor Path
→ Add One Synthetic Fixture Executor
→ Enforce Permission + Approval
→ Add Result Validation + Idempotency
→ Add Audit Events
→ Add Focused Tests
→ Run Targeted Tests
→ Run Existing Validation
→ Review Diff
→ Commit
→ Report
```

Do not spend credits on UI polish, live providers, Make scenarios, or production persistence.

---

# 17. GIT REQUIREMENT

Git commit is mandatory.

Suggested commit message:

```text
feat: implement phase 8 action execution boundary
```

Do not rewrite history. Do not force-push. Do not commit secrets.

Deployment is NOT required unless an existing path can be safely verified without expanding scope.

---

# 18. FINAL REPORT FORMAT

Return:

```text
STATUS: PASS | PARTIAL | BLOCKED

SESSION 7 VERIFICATION:
- Latest implementation commit:
- State verified:
- Tests/validation evidence:

IMPLEMENTED:
- Action contract:
- Permission gate:
- Approval gate:
- Executor boundary:
- Fixture executor:
- Idempotency:
- Result validation:
- Failure handling:
- Audit/observability:

TESTS:
- Targeted tests:
- Full validation:
- Results:

GIT:
- Commit:
- Message:

DEPLOYMENT:
- Status:
- URL if actually verified:

LIMITATIONS:
- Process-local persistence limitations:
- No live external side effects:
- Remaining provider/integration work:

NEXT ROADMAP STEP:
Phase 9 — Live Voice Interface

TRUTH RULE:
No real-world action is claimed unless an actual authorized execution occurred and its result was validated.
```

---

# 19. FINAL EXECUTION COMMAND

**Inspect the current repository, verify Session 7 and its follow-up state, read the action/permission/audit contracts, implement the smallest real Phase 8 Actions / Execution Boundary slice with one deterministic no-side-effect fixture executor, enforce permission and explicit approval, add idempotency and result validation, add safe audit events and focused tests, run actual validation, review the diff for scope creep, commit the work, and report truthfully. Do not implement live external actions, production integrations, voice, UI redesign, or production database migrations in this session.**
