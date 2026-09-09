# 21 — Observability & Audit Blueprint

## 1. Purpose

Dokumen ini menetapkan standar observability dan audit untuk AI Business Operator.

Tujuan utama:

- mengetahui apakah pipeline berjalan;
- menemukan kegagalan dengan cepat;
- menghubungkan satu request dengan seluruh tool call dan action;
- membedakan data yang benar-benar terjadi dari inference AI;
- menyediakan jejak audit untuk keputusan dan external side effect;
- menjaga observability tidak membocorkan secret atau data sensitif.

Observability bukan business logic dan tidak boleh menjadi sumber kebenaran domain.

## 2. Three Pillars

### 2.1 Structured Logs

Semua service menggunakan log terstruktur, bukan string bebas sebagai format utama.

Minimum field:

- `timestamp`
- `level`
- `service`
- `environment`
- `event_name`
- `request_id`
- `trace_id`
- `run_id` bila terkait Operator
- `user_id` atau tenant reference yang sudah diminimalkan
- `provider` bila terkait adapter
- `duration_ms` bila relevan
- `status`
- `error_code` bila gagal

Log harus aman untuk dikirim ke sistem observability terpusat.

### 2.2 Metrics

Minimum metric families:

- request count;
- request latency;
- application error rate;
- ingestion throughput;
- ingestion lag;
- normalization failure rate;
- deduplication rate;
- demand classification volume;
- opportunity creation/qualification rate;
- scoring latency dan distribution;
- operator run success/failure;
- tool-call success/failure;
- approval wait time;
- action execution success/failure;
- provider availability/error rate;
- voice session latency bila voice aktif.

Metric label harus dibatasi agar cardinality tidak meledak.

### 2.3 Traces

Trace digunakan untuk request yang melewati beberapa layer.

Contoh:

`request → operator run → opportunity query → tool call → provider adapter → ingestion → action`

Trace harus mempertahankan correlation identifier yang konsisten tanpa menyimpan secret di span attributes.

## 3. Correlation IDs

Gunakan identifier berikut secara terpisah:

- `request_id`: satu inbound request;
- `trace_id`: satu distributed execution trace;
- `run_id`: satu Operator execution;
- `tool_call_id`: satu invocation tool;
- `action_id`: satu action domain object.

Identifier tidak boleh digunakan sebagai pengganti authorization.

## 4. Audit Event Model

Audit event minimum:

- `source.connected`
- `source.sync_started`
- `source.sync_completed`
- `source.sync_failed`
- `demand.created`
- `demand.updated`
- `demand.classified`
- `opportunity.created`
- `opportunity.scored`
- `opportunity.status_changed`
- `operator.run_started`
- `operator.run_completed`
- `operator.run_failed`
- `tool.invoked`
- `tool.denied`
- `approval.requested`
- `approval.granted`
- `approval.rejected`
- `action.created`
- `action.executed`
- `action.failed`
- `action.cancelled`
- `provider.capability_changed`
- `security.policy_blocked`

Audit record minimum:

```text
id
occurred_at
actor_type
actor_id
tenant_id
entity_type
entity_id
event_name
request_id
trace_id
run_id
metadata_redacted
result_status
```

Audit records bersifat append-only dari sisi domain. Koreksi dilakukan melalui event baru, bukan menghapus histori secara diam-diam.

## 5. Redaction & Privacy

Jangan log:

- API keys;
- access tokens;
- refresh tokens;
- cookies/session values;
- password;
- secret webhook URLs;
- full private message content bila tidak diperlukan;
- data pribadi yang tidak dibutuhkan untuk diagnosis.

Gunakan redaction middleware sebelum log dikirim.

Contoh:

```text
Authorization: [REDACTED]
api_key: [REDACTED]
access_token: [REDACTED]
```

Content dari source eksternal diperlakukan sebagai untrusted data.

## 6. Provider Health

Setiap adapter harus dapat melaporkan:

- availability;
- authentication state tanpa mengekspos credential;
- last successful sync;
- last failure;
- retryability;
- rate-limit state bila tersedia;
- capability status;
- freshness/ingestion lag.

Provider failure tidak boleh disamarkan sebagai hasil bisnis kosong.

## 7. Alerts

Baseline alert:

- ingestion failure berulang;
- ingestion lag melewati threshold;
- error rate meningkat;
- provider unavailable;
- authorization expired;
- queue backlog meningkat;
- action failure meningkat;
- abnormal tool denial rate;
- audit pipeline gagal;
- secret/configuration validation gagal saat startup.

Alert harus menunjuk ke service, environment, trace/request reference, dan error category yang relevan.

## 8. Dashboards

Dashboard minimum:

### System Health

- request rate;
- latency;
- error rate;
- queue health;
- database health.

### Demand Intelligence

- events ingested;
- normalized demand;
- duplicate rate;
- classification distribution;
- freshness.

### Opportunity

- opportunities by lifecycle status;
- score distribution;
- qualification rate;
- time from demand to opportunity.

### Operator

- runs;
- success/failure;
- tool calls;
- approval waits;
- execution outcomes.

### Provider

- availability;
- error rate;
- sync freshness;
- capability state.

## 9. Reliability Baseline

MVP baseline harus mendefinisikan threshold operasional sebelum production/soft launch.

Contoh kategori threshold:

- API latency p95;
- API error rate;
- ingestion lag;
- provider sync failure rate;
- action failure rate;
- audit write failure rate.

Nilai threshold dapat berubah berdasarkan traffic nyata. Threshold tidak boleh dipakai untuk mengubah business score secara diam-diam.

## 10. Failure Semantics

Setiap failure diklasifikasikan minimal sebagai:

- transient;
- retryable;
- permanent;
- authorization;
- validation;
- policy blocked;
- provider unavailable;
- unknown.

Retry harus idempotent dan memiliki batas.

Jika sebuah langkah gagal, Operator tidak boleh mengatakan berhasil hanya karena workflow berhenti tanpa error yang terlihat.

## 11. Audit vs Product Data

Product/domain data menjawab: **apa yang terjadi pada bisnis?**

Audit data menjawab: **siapa/apa yang menyebabkan perubahan itu, kapan, dan melalui jalur apa?**

Observability menjawab: **apakah sistem berjalan dengan benar dan di mana masalahnya?**

Ketiganya saling terkait tetapi tidak boleh dicampur menjadi satu model.

## 12. Acceptance Criteria

Dokumen ini dianggap terimplementasi jika:

- setiap request memiliki correlation identifiers;
- critical tool calls dapat ditrace;
- critical domain changes menghasilkan audit event;
- secrets tidak muncul pada log normal maupun error path;
- provider health dapat dipantau;
- ingestion/operator/action failure dapat dibedakan;
- dashboard dasar tersedia;
- alert kritis memiliki owner dan recovery path;
- audit tidak dapat diam-diam diubah oleh business workflow.
