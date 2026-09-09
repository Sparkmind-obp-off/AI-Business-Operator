# 16 — IMPLEMENTATION EXECUTION PLAN

## 1. Purpose

Dokumen ini menerjemahkan arsitektur dan kontrak pada `docs/` menjadi urutan implementasi yang dapat dieksekusi oleh engineer maupun GenSpark AI.

Prinsip utama:

> Bangun vertical slice yang benar-benar berjalan, bukan sekadar banyak module yang belum terhubung.

Fondasi yang sudah disepakati tidak boleh diubah hanya untuk mempercepat implementasi.

---

## 2. Source of Truth

Urutan referensi utama:

1. Product Vision — `01`
2. MVP Boundary — `02`
3. Demand Intelligence — `03`
4. Source/ Ingestion Architecture — `04`
5. Data Model & API Contract — `05`
6. Opportunity Scoring — `06`
7. Operator Orchestration — `07`
8. Make Integration — `08`
9. Live Voice — `09`
10. Security & Privacy — `10`
11. Technical Architecture — `11`
12. Implementation Contract — `12`
13. Testing & Delivery — `13`
14. Traceability Matrix — `14`
15. GenSpark Master Prompt — `15`

Jika implementasi menemukan konflik, jangan diam-diam mengubah fondasi. Tandai konflik, evaluasi terhadap source of truth, lalu lakukan perubahan dokumentasi secara eksplisit.

---

## 3. Execution Order

### Phase 0 — Repository Foundation

Target:

- project skeleton
- configuration loading
- environment separation
- logging
- error model
- dependency boundaries
- test runner
- CI baseline

Output minimum:

- application dapat start
- test suite dapat dijalankan
- configuration error dapat dideteksi lebih awal

### Phase 1 — Canonical Data Contracts

Implementasikan:

- Source
- RawEvent
- DemandObject
- Opportunity
- Action
- provenance metadata
- IDs and timestamps

Acceptance:

- schema tervalidasi
- serialization/deserialization stabil
- invalid payload ditolak
- backward compatibility rules terdokumentasi

### Phase 2 — Ingestion Gateway

Implementasikan:

`Adapter → RawEvent → Validation → Normalization → DemandObject`

Minimum capabilities:

- authenticated ingestion
- schema validation
- idempotency
- source attribution
- timestamps
- raw-event reference
- error response

### Phase 3 — Demand Intelligence

Implementasikan classifier dan enrichment awal:

- intent type
- demand strength
- commercial intent
- urgency
- recurrence
- evidence strength
- topic/market
- contactability

AI boleh membantu klasifikasi, tetapi canonical persistence dan validation tetap deterministic.

### Phase 4 — Opportunity Database

Implementasikan:

- grouping related demand
- deduplication
- evidence collection
- opportunity lifecycle
- search/filter
- status transitions

Contoh status:

`new → enriched → scored → qualified → action_ready → acted_on → measured → learned`

### Phase 5 — Scoring Engine

Implementasikan score 0–100 sesuai `06_OPPORTUNITY_SCORING_ENGINE.md`.

Wajib:

- deterministic calculation
- component breakdown
- evidence/confidence adjustment
- reason/explanation
- score version
- recalculation support

### Phase 6 — AI Business Operator

Operator membaca canonical data dan menggunakan tools terdaftar.

Flow:

`Goal → Context → Plan → Tool Call → Validate → Evidence → Approval → Execute → Outcome`

Operator tidak boleh langsung mengakses database/secret provider secara bebas.

### Phase 7 — Provider Adapters

Implementasikan adapter satu per satu.

Prioritas:

1. source yang paling mudah mendapatkan data secara sah
2. source yang memberikan demand signal bernilai tinggi
3. Make.com adapter untuk integration path
4. first-party adapter ketika akses resmi tersedia

Setiap adapter wajib memiliki capability status dan provenance.

### Phase 8 — Action Layer

Implementasikan action object dan approval workflow sebelum external side effect.

Contoh:

- draft outreach
- create research task
- prepare content brief
- prepare proposal
- send external message hanya setelah approval sesuai risk policy

### Phase 9 — Voice Interface

Voice menggunakan operator dan action APIs yang sama.

Tidak boleh membuat business logic kedua khusus voice.

### Phase 10 — Feedback & Learning

Catat:

- opportunity outcome
- action outcome
- user override
- false positive/negative
- source quality
- scoring calibration
- model/version metadata

---

## 4. Vertical Slice Strategy

Prioritaskan satu alur end-to-end sederhana:

`Source fixture → RawEvent → DemandObject → Opportunity → Score → Operator summary → Approval → Action record`

Setelah alur ini stabil, baru tambahkan provider nyata.

Tujuan pendekatan ini adalah memastikan seluruh lapisan terhubung sebelum jumlah integrasi bertambah.

---

## 5. Implementation Rules

- Jangan membuat provider-specific logic di domain core.
- Jangan menyimpan secret di source code.
- Jangan membuat AI sebagai source of truth.
- Jangan menganggap search result sebagai bukti pembelian.
- Jangan mengirim external action tanpa permission/approval yang sesuai.
- Jangan membuat adapter palsu yang mengklaim akses provider.
- Jangan menghapus provenance saat melakukan normalization.
- Jangan menambahkan dependency besar tanpa alasan arsitektural.
- Jangan memecah service terlalu dini.

---

## 6. Definition of Ready

Sebuah capability siap diimplementasikan jika:

- tujuan jelas
- input/output jelas
- owner layer jelas
- security boundary jelas
- test strategy tersedia
- dependency diketahui
- acceptance criteria tersedia

## 7. Definition of Done

Capability dianggap selesai jika:

- implementasi selesai
- contract terpenuhi
- tests relevan lulus
- error path ditangani
- provenance/audit tersedia jika relevan
- security check dilakukan
- dokumentasi diperbarui
- demonstrasi vertical slice berhasil

---

## 8. Execution Checkpoint

Setelah setiap phase, GenSpark AI harus melaporkan:

1. apa yang selesai
2. file yang berubah
3. contract yang terpenuhi
4. test yang dijalankan
5. masalah yang ditemukan
6. dependency phase berikutnya
7. apakah fondasi berubah atau tidak

Jika fondasi berubah, perubahan harus disebutkan secara eksplisit.
