# 17 — DATABASE SCHEMA BLUEPRINT

## 1. Purpose

Dokumen ini menetapkan blueprint persistence untuk AI Business Operator tanpa mengikat implementasi pada satu vendor database tertentu.

Relational database direkomendasikan sebagai canonical operational store karena entity relationship, auditability, filtering, dan transactional consistency penting untuk sistem ini.

---

## 2. Core Entities

Entity utama:

- `sources`
- `raw_events`
- `demand_objects`
- `demand_evidence`
- `opportunities`
- `opportunity_evidence`
- `scores`
- `actions`
- `action_outcomes`
- `operator_runs`
- `tool_calls`
- `audit_events`

---

## 3. Source

`Source` merepresentasikan asal data, bukan setiap item konten.

Minimum fields:

- `id`
- `provider`
- `source_type`
- `display_name`
- `status`
- `capability_metadata`
- `terms_reference`
- `created_at`
- `updated_at`

Contoh `source_type`:

- social
- forum
- job_board
- search
- marketplace
- integration
- manual

---

## 4. Raw Event

Raw event mempertahankan data masuk sebelum canonical normalization.

Minimum fields:

- `id`
- `source_id`
- `external_event_id`
- `payload_reference`
- `payload_hash`
- `captured_at`
- `published_at`
- `ingestion_version`
- `received_at`
- `processing_status`
- `error_code`

Constraints:

- unique `(source_id, external_event_id)` jika provider memberikan stable ID
- payload hash digunakan untuk membantu dedupe
- raw payload harus memiliki retention policy

---

## 5. Demand Object

Canonical demand signal.

Minimum fields mengikuti `03_DEMAND_INTELLIGENCE_SPEC.md`:

- `id`
- `source_id`
- `raw_event_id`
- `source_url`
- `published_at`
- `captured_at`
- `author_reference`
- `text`
- `summary`
- `topic`
- `market`
- `location`
- `intent_type`
- `evidence_strength`
- `commercial_intent`
- `urgency`
- `recurrence`
- `estimated_budget_signal`
- `contactability`
- `provenance`
- `classification_version`
- `created_at`
- `updated_at`

PII/contact data harus dipisahkan atau diminimalkan bila tidak diperlukan.

---

## 6. Demand Evidence

Satu demand signal dapat memiliki beberapa bukti.

Fields:

- `id`
- `demand_id`
- `evidence_type`
- `reference`
- `excerpt_reference`
- `strength`
- `captured_at`
- `metadata`

Evidence tidak boleh diganti dengan AI-generated explanation.

---

## 7. Opportunity

Opportunity mengelompokkan demand signals yang menunjukkan problem/market opportunity yang sama atau sangat terkait.

Fields:

- `id`
- `title`
- `problem_statement`
- `market`
- `segment`
- `status`
- `current_score`
- `score_version`
- `confidence`
- `recommended_next_action`
- `created_at`
- `updated_at`

Lifecycle:

`new → enriched → scored → qualified → action_ready → acted_on → measured → learned`

---

## 8. Opportunity Evidence

Relasi many-to-many antara opportunity dan demand signals.

Fields:

- `opportunity_id`
- `demand_id`
- `relationship_type`
- `weight`
- `created_at`

Tujuan utama: setiap opportunity dapat ditelusuri kembali ke evidence.

---

## 9. Score

Score harus versioned dan immutable sebagai historical record.

Fields:

- `id`
- `opportunity_id`
- `score_version`
- `total_score`
- `demand_strength`
- `commercial_intent`
- `frequency`
- `urgency`
- `reachability`
- `market_gap`
- `execution_feasibility`
- `evidence_adjustment`
- `confidence`
- `reasoning_summary`
- `created_at`

`current_score` pada opportunity adalah convenience field, bukan pengganti history.

---

## 10. Action

Action merepresentasikan pekerjaan yang dapat dilakukan operator.

Fields:

- `id`
- `opportunity_id`
- `action_type`
- `status`
- `risk_level`
- `requires_approval`
- `approved_at`
- `approved_by`
- `input_reference`
- `execution_reference`
- `created_at`
- `updated_at`

Status contoh:

`draft → awaiting_approval → approved → executing → completed`

Failure states:

`rejected`, `failed`, `cancelled`.

---

## 11. Action Outcome

Outcome digunakan untuk feedback loop.

Fields:

- `id`
- `action_id`
- `outcome_type`
- `result`
- `metrics`
- `external_reference`
- `observed_at`

---

## 12. Operator Run

Mencatat satu execution cycle AI Operator.

Fields:

- `id`
- `user_goal`
- `context_reference`
- `plan_reference`
- `status`
- `model_provider`
- `model_version`
- `started_at`
- `completed_at`
- `failure_code`

---

## 13. Tool Call

Setiap tool invocation harus dapat diaudit.

Fields:

- `id`
- `operator_run_id`
- `tool_name`
- `tool_version`
- `input_hash`
- `output_reference`
- `permission_decision`
- `approval_reference`
- `status`
- `started_at`
- `completed_at`
- `error_code`

Secret dan credential value tidak boleh disimpan sebagai input/output log.

---

## 14. Audit Event

Audit event mencatat perubahan penting dan security-relevant activity.

Minimum:

- `id`
- `actor_type`
- `actor_reference`
- `event_type`
- `entity_type`
- `entity_id`
- `metadata`
- `created_at`

Audit log harus append-oriented dan tidak menjadi tempat menyimpan secret.

---

## 15. Indexing Strategy

Index utama:

- source/status
- captured/published timestamps
- demand intent/market
- opportunity status/score
- opportunity lifecycle
- raw-event external identity
- audit entity/time

Full-text search dapat ditambahkan sesuai database/provider yang dipilih.

---

## 16. Tenant Boundary

Jika produk menjadi multi-tenant, semua business-owned records harus memiliki `tenant_id` atau equivalent isolation boundary.

Tenant isolation harus diuji pada application layer dan database policy bila tersedia.

---

## 17. Retention & Deletion

Retention ditentukan berdasarkan:

- legal/privacy requirements
- source terms
- operational value
- storage cost
- user deletion requests

Raw source payload biasanya memiliki retention lebih pendek daripada canonical business records.

Deletion workflow harus mempertimbangkan referential integrity, audit requirements, dan legal holds.

---

## 18. Migration Rules

- Semua schema change melalui migration.
- Migration harus backward-safe jika deployment membutuhkan rolling update.
- Destructive migration dipisahkan dari deployment yang mulai tidak menggunakan field lama.
- Seed data untuk development/test harus deterministic.
- Production data tidak boleh digunakan sebagai test fixture tanpa sanitization dan authorization.

---

## 19. Non-Goals

Blueprint ini tidak menetapkan:

- vendor database final
- ORM tertentu
- cloud provider tertentu
- exact SQL dialect
- vector database sebagai canonical store

Vector/search infrastructure dapat menjadi secondary index, tetapi canonical business state tetap mengikuti domain contract.
