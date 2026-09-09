# GENSPARK SESSION 7 EXECUTION PROMPT

## PROVIDER ADAPTERS — CAPABILITY-AWARE SOURCE INTEGRATION

**Repository:** `Sparkmind-obp-off/AI-Business-Operator`

**Role:** Principal Architect + Full-Stack Engineer + QA + Security + Implementation Agent

**Execution mode:** credit-safe, provider-neutral, evidence-first, capability-aware, no bypasses, no fabricated access.

---

## 0. MANDATORY START

Before changing anything:

1. Inspect the current repository state.
2. Verify the latest commits on `main`.
3. Confirm Session 6 implementation exists. The expected implementation message is:
   `feat: implement phase 6 ai business operator orchestration`
4. Also inspect any follow-up fixes after Session 6. Do not assume the repository stopped at the initial Session 6 commit.
5. Read the actual current code, not only this prompt.
6. Read these documents:
   - `docs/04_SOURCE_ADAPTER_AND_INGESTION_ARCHITECTURE.md`
   - `docs/05_DATA_MODEL_AND_API_CONTRACT.md`
   - `docs/08_MAKE_INTEGRATION_CONTRACT.md`
   - `docs/14_MASTER_TRACEABILITY_MATRIX.md`
   - `docs/19_AI_TOOL_REGISTRY_AND_PERMISSION_MODEL.md`
   - `docs/20_PROVIDER_CAPABILITY_MATRIX.md`
   - `docs/21_OBSERVABILITY_AND_AUDIT_BLUEPRINT.md`
   - `docs/22_ENVIRONMENT_AND_SECRETS_CONTRACT.md`
   - `docs/23_ROADMAP_AND_PHASE_GATES.md`
   - `docs/24_GENSPARK_AI_MASTER_BUILD_PROMPT.md`
   - `docs/30_GENSPARK_SESSION_5_EXECUTION_PROMPT.md`
   - `docs/31_GENSPARK_SESSION_6_EXECUTION_PROMPT.md`
7. Inspect the actual implementations under `src/ingestion`, `src/adapters`, `src/operator`, `src/domain`, routes, logging, configuration, and tests.
8. Preserve all existing Session 1–6 behavior.

If Session 6 is materially broken, STOP and report the blocker instead of rebuilding previous phases.

---

# 1. SESSION 7 OBJECTIVE

Implement the smallest real **Provider Adapter / Capability-Aware Source Integration** vertical slice:

```text
Provider Capability
        ↓
Source Configuration
        ↓
Provider Adapter
        ↓
Raw Event / Evidence Pointer
        ↓
Existing Ingestion Gateway
        ↓
Existing Normalization
        ↓
Demand Intelligence
```

Session 7 is about establishing a clean adapter boundary and proving one safe provider path.

The adapter layer must translate provider-specific access into the canonical ingestion contract.

The canonical application must NOT become provider-specific.

---

# 2. HARD SCOPE BOUNDARY

## IN SCOPE

Implement only what is required for:

1. Provider-neutral adapter interface.
2. Capability-aware provider metadata.
3. Source configuration compatible with the canonical `Source` contract.
4. Adapter health/access status representation.
5. One deterministic provider adapter fixture or safe mock adapter proving the complete boundary.
6. Adapter → existing ingestion gateway integration.
7. Provenance/access-method preservation.
8. Pagination/retry/rate-limit metadata interfaces where appropriate.
9. Truthful unavailable/approval-required/degraded states.
10. Safe structured logging and audit metadata.
11. Focused tests for capability, adapter behavior, ingestion handoff, provenance, and failure states.
12. Minimal route/fixture exposure only if needed to prove the slice.

## STRICTLY OUT OF SCOPE

Do NOT implement:

- broad live social-media integrations;
- Threads live API;
- Instagram live API;
- Facebook live API;
- X/Twitter live API;
- job-board production integrations;
- scraping infrastructure;
- browser automation;
- CAPTCHA bypass;
- login bypass;
- rate-limit bypass;
- paywall bypass;
- unofficial/private APIs;
- stolen/leaked credentials;
- Make.com production scenarios;
- autonomous collection at scale;
- AI/LLM classification changes;
- new scoring logic;
- Operator changes except the minimum adapter/tool metadata needed for compatibility;
- external outreach;
- action execution;
- voice;
- production DB migrations;
- large UI redesign;
- multi-agent infrastructure;
- arbitrary connector execution.

One provider adapter is enough to prove the architecture. Do not build a dozen adapters merely for completeness.

---

# 3. PROVIDER STRATEGY

Follow this priority:

```text
First-party official API
        ↓
Authorized integration / automation
        ↓
Search / index provider
        ↓
Explicitly permitted collection
```

The adapter must expose capability truthfully.

Possible capability states from the canonical model include:

- `available`
- `approval_required`
- `integration_available`
- `limited`
- `unavailable`
- `degraded`
- `unknown`

Do not turn `approval_required` into `available`.

Do not turn `unavailable` into a successful empty result.

Do not fabricate provider events.

---

# 4. ADAPTER CONTRACT

Create or reuse a provider-neutral interface conceptually similar to:

```text
ProviderAdapter
  getCapabilities()
  getStatus()
  validateConfiguration()
  fetch(request)
```

Exact names must follow the existing repository conventions.

The adapter should expose enough metadata for the ingestion layer to know:

- provider;
- source type;
- supported operations;
- auth mode;
- capability status;
- approval requirement;
- rate-limit metadata when known;
- pagination support when known;
- identity stability when known;
- freshness expectations;
- provenance/access method;
- terms/compliance reference;
- retryability;
- last sync/error status.

Do not leak provider credentials to callers.

Do not place provider-specific logic in the canonical Domain/Opportunity/Scoring/Operator core.

---

# 5. SOURCE CONFIGURATION

Reuse the canonical `Source` contract.

A source configuration should identify the provider and capability without pretending that access exists.

Conceptually:

```text
Source
  sourceId
  provider
  sourceType
  capabilities
  authMode
  status
  termsReference
```

If the provider requires approval or credentials that are absent, represent that state explicitly.

Never silently fall back to fake data.

---

# 6. ONE SAFE ADAPTER IMPLEMENTATION

Implement exactly one small adapter path sufficient to demonstrate:

```text
Provider Adapter
      ↓
RawEvent
      ↓
Existing Ingestion Gateway
      ↓
DemandObject
      ↓
Existing Demand Intelligence
```

Preferred implementation for credit safety:

- deterministic fixture adapter;
- or an already-authorized, existing provider path if the repository already contains one and it can be verified safely.

A fixture adapter is acceptable and preferred if no live provider access is already configured.

The fixture MUST be clearly marked as fixture/synthetic and must never be presented as live provider data.

If a real provider is used, every result must be based on actual access and carry truthful provenance.

---

# 7. MAKE.COM BOUNDARY

Make.com remains an **authorized integration/automation layer**, not canonical business logic.

Do not implement a live Make scenario in Session 7 unless an existing repository contract makes it trivial and safe.

If a Make adapter boundary is useful, define only the interface/metadata required to support a future or existing authorized integration.

Canonical flow remains:

```text
Source
 → Provider/Integration Adapter
 → RawEvent
 → Ingestion Gateway
 → Normalizer
 → Demand Intelligence
```

Make must not become the source of truth for:

- Opportunity;
- Score;
- permissions;
- credentials;
- audit;
- canonical provenance;
- business logic.

---

# 8. PROVENANCE REQUIREMENTS

Every adapter-produced event must preserve provenance required by the canonical contracts.

At minimum preserve:

- source ID;
- provider;
- source type;
- source URL when available;
- captured timestamp;
- published timestamp when available;
- access method;
- adapter/provider reference;
- external event ID when available;
- transformation/reference metadata.

The adapter must not strip provenance before handing data to ingestion.

Search/index results are evidence pointers, not proof of complete provider access.

---

# 9. RAW EVENT RULE

The adapter must hand off data using the existing RawEvent/ingestion contract.

Do not create a parallel provider-specific persistence model.

Raw source payload should be preserved according to existing privacy/retention rules, but do not put unnecessary raw content into logs.

Idempotency must reuse existing ingestion patterns.

If an external ID is available, use it consistently.

If not available, use an existing deterministic identity/checksum strategy rather than random dedupe behavior.

---

# 10. CAPABILITY-AWARE FAILURE HANDLING

Tests and implementation must distinguish at least:

### AVAILABLE

Adapter can return data through the declared path.

### APPROVAL REQUIRED

Adapter reports that access requires authorization/approval and does not pretend to fetch data.

### UNAVAILABLE

Adapter cannot access the provider. Return a truthful unavailable state.

### DEGRADED

Adapter can operate with a known limitation; preserve that limitation in status/metadata.

### RATE LIMITED

Do not bypass the limit. Return a retryable/limited state according to the contract.

### INVALID CONFIGURATION

Reject safely before attempting access.

### PROVIDER ERROR

Return normalized error metadata without exposing credentials or sensitive provider responses.

---

# 11. SECURITY / COMPLIANCE

Mandatory rules:

- credentials stay server-side;
- never commit secrets;
- never log secrets;
- never log authorization headers;
- never expose credentials to browser/client code;
- no login bypass;
- no CAPTCHA bypass;
- no access-control bypass;
- no rate-limit bypass;
- no paywall bypass;
- no unofficial access presented as guaranteed service;
- source content remains untrusted data;
- provider terms/compliance metadata remains visible where required.

If access is not permitted, stop at the adapter boundary.

---

# 12. OBSERVABILITY

Reuse existing structured logging.

Useful events include:

```text
adapter.capability_checked
adapter.configuration_validated
adapter.fetch_started
adapter.fetch_succeeded
adapter.fetch_partial
adapter.fetch_failed
adapter.rate_limited
adapter.approval_required
adapter.unavailable
adapter.ingestion_handoff
```

Log safe metadata only:

- provider;
- source ID;
- adapter name/version;
- status;
- duration;
- event count;
- request/correlation ID;
- retryability/error code.

Do not log raw source text or credentials.

---

# 13. TEST REQUIREMENTS

Tests are mandatory.

### Capability

- capability metadata validates;
- available state is truthful;
- approval-required state is preserved;
- unavailable state is preserved;
- degraded/limited state is preserved.

### Configuration

- valid configuration passes;
- invalid configuration fails safely;
- credentials are not returned to callers/logs.

### Adapter

- fixture adapter returns deterministic events;
- provider metadata is attached;
- source/external IDs are preserved;
- timestamps/provenance are preserved;
- repeated fetches are deterministic.

### Ingestion handoff

- adapter output enters existing ingestion gateway;
- existing validation/normalization is reused;
- idempotency/dedupe behavior is preserved;
- resulting DemandObject remains traceable to the adapter event.

### Failure

- approval-required does not fetch;
- unavailable does not fabricate empty/success data;
- rate limit does not trigger a bypass;
- provider error becomes truthful normalized failure;
- partial results remain marked partial if supported.

### Security

- no secrets in logs;
- no credentials in client-facing output;
- malicious source text remains data;
- adapter cannot invoke arbitrary code/tool from provider content.

### Provider neutrality

- canonical ingestion/domain logic does not import provider-specific business rules unnecessarily;
- adding a second provider later would fit the same interface.

---

# 14. DEFINITION OF DONE

Session 7 is DONE only when:

- [ ] Session 6 and any follow-up fixes were verified.
- [ ] Provider adapter boundary exists.
- [ ] Capability model is explicit and truthful.
- [ ] Source configuration uses canonical contracts.
- [ ] One safe adapter path is implemented.
- [ ] Adapter output reaches existing ingestion.
- [ ] RawEvent/provenance are preserved.
- [ ] Idempotency/dedupe reuse existing patterns.
- [ ] Approval/unavailable/degraded/rate-limited states are handled truthfully.
- [ ] Structured safe logs exist.
- [ ] Tests cover success and failure paths.
- [ ] No bypasses or unauthorized access were introduced.
- [ ] No secrets were committed.
- [ ] No large provider expansion occurred.
- [ ] No production DB migration occurred.
- [ ] Actual validation commands were run.
- [ ] Diff was reviewed for scope creep.
- [ ] Git commit was created.
- [ ] Final report is truthful.

---

# 15. CREDIT-SAFE EXECUTION STRATEGY

Do not build multiple live integrations.

Do not spend credits on UI polish.

Do not refactor working Phase 1–6 architecture.

Use this sequence:

```text
Inspect
→ Verify Session 6 + follow-up fixes
→ Read Provider/Adapter Contracts
→ Inspect Existing Ingestion
→ Design Smallest Adapter Boundary
→ Implement One Adapter/Fixture
→ Integrate with Ingestion
→ Add Focused Tests
→ Run Targeted Tests
→ Run Existing Validation
→ Review Diff
→ Commit
→ Report
```

If no live provider credentials/access are available, use a clearly labeled deterministic fixture and continue. Do not manufacture live access.

---

# 16. GIT REQUIREMENT

Git commit is mandatory.

Suggested commit message:

```text
feat: implement phase 7 provider adapter foundation
```

Do not rewrite previous history.
Do not force-push.
Do not commit secrets.

Deployment is **NOT required** unless an existing deployment path can be safely verified without expanding scope.

---

# 17. FINAL REPORT FORMAT

Return exactly:

```text
STATUS: PASS | PARTIAL | BLOCKED

SESSION 6 VERIFICATION:
- Latest implementation commit:
- Follow-up fixes:
- State verified:

IMPLEMENTED:
- Adapter interface:
- Capability model:
- Source configuration:
- Adapter/fixture:
- Ingestion handoff:
- Provenance:
- Failure handling:
- Observability:

TESTS:
- Exact commands run:
- Exact results:
- Test count if available:
- Validation status:

GIT:
- Commit SHA:
- Commit message:
- Working tree status if known:

DEPLOYMENT:
- Status:
- URL if actually verified:
- Environment if actually verified:

LIMITATIONS:
- Explicitly list live providers, approvals, credentials, or capabilities not actually available.

NEXT ROADMAP STEP:
Phase 8 — Actions / Execution Boundary

TRUTH RULE:
Only claim provider access, data retrieval, implementation, execution, deployment, or verification that actually occurred and is evidenced. Never present fixture data as live provider data. Never claim a provider capability merely because an adapter interface exists.
```

---

# 18. FINAL EXECUTION COMMAND

Start now.

**Inspect the repository, verify Session 6 and all follow-up fixes, read the provider contracts, implement the smallest real Phase 7 provider-adapter slice, connect it to the existing ingestion boundary, test it, validate it, review the diff, commit it, and report truthfully.**

Do not wait for another instruction unless a genuine blocker prevents safe implementation.
