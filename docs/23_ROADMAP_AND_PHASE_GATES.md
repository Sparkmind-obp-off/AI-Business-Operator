# 23 — Roadmap & Phase Gates

## 1. Purpose

Dokumen ini mengubah seluruh blueprint menjadi roadmap dengan gate yang dapat diverifikasi.

Aturan utama: **jangan lanjut ke fase berikutnya hanya karena kode sudah dibuat. Lanjut jika exit criteria terpenuhi.**

Roadmap mengikuti dependency architecture:

`Foundation → Contracts → Ingestion → Demand → Opportunity → Scoring → Operator → Adapters → Actions → Voice → Learning`

## 2. Phase 0 — Repository Foundation

### Scope

- project structure;
- configuration module;
- lint/format/typecheck;
- test runner;
- CI baseline;
- error handling dasar;
- health endpoint.

### Gate 0

Pass jika:

- repository dapat di-install/build/test;
- CI berjalan;
- environment validation tersedia;
- tidak ada secret committed;
- architecture folders mengikuti Implementation Contract.

## 3. Phase 1 — Canonical Data Contracts

### Scope

Implement:

- Source;
- RawEvent;
- DemandObject;
- DemandEvidence;
- Opportunity;
- Score;
- Action;
- AuditEvent.

### Gate 1

Pass jika schema dan validation test tersedia serta provenance dapat ditelusuri dari demand ke source/raw event.

## 4. Phase 2 — Ingestion Gateway

### Scope

`Source → Adapter → RawEvent → Validation → Normalizer`

Implement:

- ingestion endpoint/service;
- idempotency;
- raw payload preservation sesuai privacy policy;
- normalization;
- deduplication;
- provenance.

### Gate 2

Pass jika fixture source dapat masuk sampai canonical DemandObject tanpa duplicate dan tanpa kehilangan provenance.

## 5. Phase 3 — Demand Intelligence

### Scope

- signal classification;
- facts vs inference;
- commercial intent;
- urgency;
- recurrence;
- evidence strength;
- confidence;
- freshness.

### Gate 3

Pass jika fixture test menghasilkan classification yang deterministic/terkendali dan uncertainty tidak disajikan sebagai fakta.

## 6. Phase 4 — Opportunity Database

### Scope

- opportunity creation;
- evidence linkage;
- lifecycle state;
- search/filter;
- status transitions;
- history.

### Gate 4

Pass jika demand dapat dikonversi menjadi opportunity dengan evidence yang dapat dibuka kembali.

## 7. Phase 5 — Scoring Engine

### Scope

Gunakan scoring contract pada `06_OPPORTUNITY_SCORING_ENGINE.md`.

Implement:

- weighted dimensions;
- confidence/evidence modifiers;
- score versioning;
- score history;
- human override dengan alasan.

### Gate 5

Pass jika scoring test memverifikasi formula, boundaries, ranking, dan perubahan score dapat diaudit.

## 8. Phase 6 — AI Business Operator

### Scope

Operator harus dapat:

1. memahami goal;
2. membaca opportunity/evidence;
3. menyusun plan;
4. memilih tool;
5. memvalidasi result;
6. menjelaskan evidence;
7. meminta approval bila diperlukan;
8. membuat action record;
9. mencatat outcome.

### Gate 6

Pass jika Operator dapat menyelesaikan vertical slice end-to-end tanpa fabricated completion dan dengan audit trail.

## 9. Phase 7 — Provider Adapters

### Scope

Rollout provider secara bertahap berdasarkan Provider Capability Matrix.

Prioritas:

1. official API;
2. authorized integration;
3. search/index provider;
4. permitted collection mechanism.

Make.com dapat menjadi integration path tanpa memindahkan canonical business logic ke Make.

### Gate 7

Provider dianggap production-ready hanya jika capability, authorization, provenance, error handling, rate-limit behavior, dan compliance review sudah jelas.

## 10. Phase 8 — Action Layer

### Scope

- action creation;
- approval;
- execution;
- cancellation;
- retry/idempotency;
- outcome recording.

### Gate 8

Pass jika read-only flow tetap aman dan setiap external side effect melewati permission/approval policy yang sesuai.

## 11. Phase 9 — Voice Interface

### Scope

Voice menjadi interface tambahan, bukan architecture baru.

Implement:

- speech input;
- intent extraction;
- context;
- streaming progress;
- interruption;
- tool transparency;
- approval;
- spoken result;
- text fallback.

### Gate 9

Pass jika task yang sama dapat dieksekusi melalui voice dan text menggunakan orchestration contract yang sama.

## 12. Phase 10 — Feedback & Learning

### Scope

- action outcomes;
- user feedback;
- score calibration;
- provider performance;
- opportunity conversion;
- recommendation quality.

### Gate 10

Pass jika feedback dapat disimpan dan digunakan untuk improvement tanpa mengubah historical audit records secara retroaktif.

## 13. MVP / Soft Launch Gate

MVP siap diuji ke pengguna terbatas jika:

- Gates 0–6 pass;
- minimal satu source path nyata atau authorized integration tersedia;
- provenance dapat ditelusuri;
- opportunity scoring stabil;
- Operator tidak fabricated;
- approval gate aktif untuk side effects;
- observability dan audit minimum aktif;
- secrets/configuration contract diterapkan;
- critical security tests pass;
- recovery path untuk provider failure tersedia.

## 14. Provider Expansion Gate

Jangan menambah banyak provider sekaligus.

Urutan:

1. validate one source deeply;
2. validate canonical normalization;
3. measure signal quality;
4. validate opportunity conversion;
5. baru tambah provider berikutnya.

Provider yang gagal capability/compliance review tetap `disabled` atau `limited`.

## 15. Production / Scale Gate

Sebelum scale:

- load/performance baseline tersedia;
- monitoring dashboard aktif;
- alerting aktif;
- secret rotation procedure diuji;
- backup/recovery tervalidasi;
- data retention policy diterapkan;
- action failure recovery diuji;
- provider degradation tidak membuat sistem mengarang hasil;
- cost monitoring tersedia.

## 16. Go / No-Go Checklist

### GO

Semua critical acceptance criteria pass, unresolved issue tidak memiliki risiko blocking, dan audit/observability dapat mendeteksi failure utama.

### NO-GO

Jika salah satu kondisi berikut terjadi:

- secret exposure;
- provenance hilang;
- external action dapat terjadi tanpa permission;
- scoring menghasilkan nilai invalid;
- Operator mengklaim action berhasil tanpa bukti;
- provider restriction harus dibypass agar flow bekerja;
- audit trail critical tidak tersedia;
- recovery path belum teruji.

## 17. Implementation Cadence

Setiap increment harus berupa vertical slice kecil:

`contract → implementation → test → observability → audit → review`

Hindari membangun banyak layer kosong sekaligus.

Setelah setiap gate:

1. run test suite;
2. inspect logs/audit;
3. verify contract;
4. record known limitations;
5. baru lanjut.

## 18. Final Product Path

Target akhir bukan sekadar dashboard pencarian.

Targetnya adalah:

`User Voice/Text Goal → Demand Intelligence → Opportunity → Score → Operator Plan → Approval → Action → Outcome → Learning`

Dengan source dan provider sebagai interchangeable adapters, bukan sebagai pusat business logic.
