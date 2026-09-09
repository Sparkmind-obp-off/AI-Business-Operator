# 20 — PROVIDER CAPABILITY MATRIX

## 1. Purpose

Dokumen ini menjadi kontrak evaluasi provider/source tanpa menjadikan provider tertentu sebagai fondasi business logic.

Provider capability dapat berubah. Karena itu status harus dapat diperbarui tanpa mengubah canonical model.

---

## 2. Capability Dimensions

Setiap provider dinilai pada:

- discovery/search capability
- read access
- write access
- official API availability
- approval requirement
- authorized integration availability
- webhook/event support
- pagination
- rate limits
- identity/reference stability
- freshness
- provenance quality
- terms/compliance constraints
- operational reliability

---

## 3. Capability Status

Gunakan status:

- `available` — dapat digunakan melalui jalur yang telah diverifikasi
- `approval_required` — capability ada tetapi membutuhkan approval/access
- `integration_available` — tersedia melalui authorized integration path
- `limited` — hanya sebagian capability tersedia
- `unavailable` — belum tersedia secara sah/teknis
- `degraded` — sebelumnya tersedia tetapi sedang bermasalah
- `unknown` — belum diverifikasi

`unknown` tidak boleh diperlakukan sebagai `available`.

---

## 4. Adapter Strategy

Urutan prioritas:

1. First-party official API
2. Authorized integration/automation provider
3. Search/index provider untuk discovery
4. Other explicitly permitted mechanism

Jika jalur resmi membutuhkan approval, jangan memalsukan capability. Tandai `approval_required` dan gunakan alternatif yang sah bila tersedia.

---

## 5. Canonical Adapter Contract

Setiap adapter harus mengembalikan canonical structure yang compatible dengan ingestion gateway.

Minimum:

```text
provider
source_type
external_id
source_url
published_at
captured_at
content/summary
provenance
adapter_version
capability_status
```

Provider-specific fields boleh disimpan sebagai metadata/extension tanpa merusak canonical contract.

---

## 6. Make.com Path

Make.com dapat menjadi integration adapter ketika connector/authorization yang diperlukan tersedia.

Pattern:

`Provider → Make scenario → HTTPS/Webhook → Ingestion API → Canonical model`

Make tetap berada di integration layer dan tidak menjadi source of truth untuk opportunity/scoring/business logic.

---

## 7. Provider Verification Rule

Sebelum provider ditandai `available`, implementation harus dapat menjawab:

1. Capability apa yang tersedia?
2. Endpoint/connector apa yang digunakan?
3. Authorization apa yang dibutuhkan?
4. Data apa yang benar-benar dapat diperoleh?
5. Rate/usage constraint apa yang berlaku?
6. Provenance apa yang dapat dikembalikan?
7. Apa batasan terms/privacy?

Jika jawaban belum diketahui, status tetap `unknown` atau `approval_required`.

---

## 8. Example Matrix

| Capability | Official API | Authorized Integration | Search/Index | Browser Workflow |
|---|---|---|---|---|
| Read public signal | Prefer | Alternative | Possible | Conditional |
| Stable IDs | Usually best | Depends | Depends | Weak/variable |
| Write action | Provider-specific | Provider-specific | Usually no | Conditional |
| Provenance | Strong | Strong if mapped | Must preserve | Must preserve |
| Approval | May apply | May apply | Provider-specific | Must respect |
| Terms compliance | Required | Required | Required | Required |

Matrix ini adalah architectural classification, bukan klaim capability provider tertentu.

---

## 9. Capability Registry Fields

Suggested registry:

- `provider`
- `adapter`
- `capability`
- `status`
- `access_method`
- `authorization_type`
- `verified_at`
- `verified_by`
- `documentation_reference`
- `limitations`
- `last_error`
- `adapter_version`

---

## 10. Failure Semantics

Provider failure tidak boleh membuat application mengarang data.

Contoh:

`provider_timeout → retry policy → degraded/failed state → visible error → optional alternate adapter`

Fallback provider harus mempertahankan provenance sehingga user mengetahui data berasal dari jalur berbeda.

---

## 11. Provider Replacement

Canonical pipeline harus tetap:

`Adapter → RawEvent → Normalizer → DemandObject`

Mengganti provider hanya mengganti adapter/configuration selama canonical contract tetap kompatibel.

---

## 12. Governance

Capability matrix harus diperbarui ketika:

- API berubah
- access policy berubah
- connector berubah
- rate limit berubah
- integration gagal
- terms/privacy constraint berubah
- adapter version berubah

Perubahan capability tidak boleh dilakukan hanya di prompt AI.
