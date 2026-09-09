# 18 — UX/UI DESIGN SYSTEM

## 1. Purpose

UI AI Business Operator harus membuat alur **Demand → Opportunity → Action** mudah dipahami tanpa mengorbankan evidence, provenance, approval, dan kontrol user.

Visual design harus mendukung keputusan bisnis, bukan sekadar menjadi dashboard dekoratif.

---

## 2. UX Principles

1. **Evidence first** — user dapat melihat dasar rekomendasi.
2. **Actionable** — setiap insight memiliki next step yang jelas.
3. **Progressive disclosure** — detail teknis muncul saat dibutuhkan.
4. **Human control** — consequential action membutuhkan kontrol yang sesuai.
5. **Explainable score** — score dapat dibuka menjadi komponen.
6. **Freshness visible** — waktu capture/publish terlihat.
7. **Failure visible** — error tidak disembunyikan.
8. **Voice and text parity** — voice, dashboard, dan text memakai capability yang sama.

---

## 3. Primary Navigation

Minimum navigation:

- Overview
- Demand Signals
- Opportunities
- Actions
- Operator
- Sources
- Activity / Audit
- Settings

Voice interface dapat menjadi persistent entry point, bukan aplikasi terpisah.

---

## 4. Overview Dashboard

Dashboard harus menjawab:

- Apa demand baru?
- Opportunity mana yang paling penting?
- Mengapa opportunity tersebut penting?
- Apa yang harus dilakukan berikutnya?
- Apa yang sedang berjalan?
- Apa yang gagal atau membutuhkan approval?

Komponen utama:

- priority opportunities
- recent demand
- score distribution
- action queue
- source health
- operator activity

---

## 5. Demand Signal Card

Minimum information:

- title/summary
- source
- published/captured time
- intent
- commercial signal
- urgency
- evidence strength
- source link/reference
- related opportunity

Jangan menampilkan inference sebagai fakta.

---

## 6. Opportunity Detail

Opportunity page menjadi pusat decision-making.

Section:

1. Opportunity summary
2. Why it matters
3. Evidence
4. Score breakdown
5. Related demand signals
6. Market/segment context
7. Recommended actions
8. Action history
9. Outcome/learning

Score breakdown harus menunjukkan faktor yang meningkatkan atau menurunkan score.

---

## 7. Action Center

Action center menampilkan:

- draft actions
- awaiting approval
- executing
- completed
- failed
- cancelled

Untuk action berisiko, UI wajib menampilkan:

- target
- intended effect
- exact/preview content jika ada
- permissions
- risk level
- approval control

---

## 8. Operator UI

Operator UI harus memperlihatkan execution timeline:

`Goal → Plan → Tool → Evidence → Decision → Approval → Action → Result`

User dapat:

- melihat progress
- interrupt/cancel bila capability mendukung
- membuka evidence
- approve/reject action
- retry failed operation

AI tidak boleh membuat UI menyatakan "completed" jika backend belum mengonfirmasi completion.

---

## 9. Voice UX

Voice interaction:

- push-to-talk atau continuous mode sesuai runtime
- transcript visible
- tool/action progress visible
- confirmation prompt untuk consequential action
- interruption support
- fallback ke text/card result

Contoh:

> "Cari peluang jasa website travel yang sedang dibutuhkan minggu ini."

UI menampilkan sumber, evidence, opportunity candidates, score, dan next action.

---

## 10. States

Setiap data-driven component harus memiliki state:

- loading
- empty
- success
- partial
- error
- stale
- unauthorized
- unavailable

Jangan menggunakan blank screen sebagai error handling.

---

## 11. Status Language

Gunakan bahasa yang membedakan fakta dan inference.

Contoh:

- `Terdeteksi` untuk observed signal.
- `Diperkirakan` untuk model inference.
- `Direkomendasikan` untuk operator recommendation.
- `Menunggu approval` untuk action gated.
- `Berhasil` hanya setelah execution confirmation.

---

## 12. Accessibility

Minimum:

- keyboard navigation
- visible focus state
- semantic controls
- sufficient text readability
- non-color-only status indication
- accessible labels
- responsive layouts
- reduced-motion consideration

---

## 13. Responsive Strategy

Prioritas:

1. Desktop dashboard untuk research/operations.
2. Tablet untuk monitoring.
3. Mobile untuk quick review, approval, dan voice interaction.

Core business capability tidak boleh hanya tersedia pada desktop.

---

## 14. Design Tokens

Design system harus memiliki token terpusat untuk:

- typography
- spacing
- radius
- elevation
- borders
- semantic status
- interaction states
- layout widths

Exact visual values boleh berubah selama semantic hierarchy dan accessibility tetap terjaga.

---

## 15. Component Boundaries

Komponen UI tidak boleh memiliki business logic canonical seperti scoring atau provider authentication.

Pattern:

`UI Component → API/Query Layer → Application Service → Domain`

Preview/formatting boleh berada di frontend; authoritative decision berada di backend/domain layer.

---

## 16. UX Acceptance Criteria

UI slice dianggap selesai jika:

- user dapat memahami data source
- evidence dapat dibuka
- score dapat dijelaskan
- recommended action jelas
- approval state jelas
- error/partial state dapat dipahami
- responsive behavior diuji
- keyboard/accessibility baseline terpenuhi

---

## 17. Non-Goals

Jangan membangun:

- dashboard penuh sebelum vertical slice backend bekerja
- visual AI yang menyembunyikan evidence
- chat UI yang menjadi business logic kedua
- autonomous action UI tanpa permission model
