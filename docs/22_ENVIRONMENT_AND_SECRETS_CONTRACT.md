# 22 — Environment & Secrets Contract

## 1. Purpose

Dokumen ini menetapkan kontrak configuration dan secret management untuk AI Business Operator agar local, development, staging, dan production memiliki batas yang jelas.

Prinsip utama:

- configuration bukan secret;
- secret tidak pernah disimpan di source code;
- credential provider hanya tersedia di runtime yang membutuhkan;
- environment production terpisah dari non-production;
- test menggunakan credential/test account yang aman;
- rotasi credential tidak membutuhkan perubahan business logic.

## 2. Environment Model

Minimum environment:

| Environment | Tujuan | Data | External Side Effect |
|---|---|---|---|
| `local` | development individu | fixture/synthetic | disabled by default |
| `dev` | integration development | synthetic/safe data | tightly controlled |
| `staging` | release validation | sanitized/test data | sandbox/test only |
| `prod` | real users | production data | allowed by policy |

Tidak boleh menggunakan credential production untuk local development.

## 3. Configuration Classes

### Non-secret configuration

Contoh:

```text
APP_ENV
APP_BASE_URL
LOG_LEVEL
DATABASE_POOL_SIZE
QUEUE_NAME
OPERATOR_MODEL_NAME
FEATURE_VOICE_ENABLED
```

### Secret configuration

Contoh:

```text
DATABASE_URL
SESSION_SECRET
ENCRYPTION_KEY
PROVIDER_API_KEY
PROVIDER_CLIENT_SECRET
MAKE_WEBHOOK_SECRET
VOICE_PROVIDER_SECRET
```

Nama aktual dapat disesuaikan dengan implementation stack, tetapi klasifikasi harus dipertahankan.

## 4. Secret Rules

Dilarang:

- commit secret ke Git;
- menaruh secret di frontend bundle;
- menulis secret ke log;
- mengirim secret ke model AI;
- menyimpan credential provider di prompt;
- hard-code credential di test;
- membagikan production credential ke developer yang tidak membutuhkannya.

Gunakan secret manager/platform secret store pada deployment nyata.

## 5. Runtime Configuration

Application membaca configuration melalui satu configuration module.

Configuration module bertanggung jawab untuk:

- membaca environment variables;
- validasi required fields;
- type coercion;
- default non-sensitive values;
- fail-fast untuk configuration invalid;
- redaction pada diagnostic output.

Business module tidak boleh membaca `process.env` atau mekanisme environment secara tersebar.

## 6. Validation

Startup validation harus membedakan:

- missing required config;
- malformed config;
- invalid environment combination;
- missing provider credential;
- unavailable optional provider.

Optional provider boleh disabled tanpa membuat seluruh application gagal, selama capability registry menandainya secara eksplisit.

## 7. Provider Credentials

Setiap provider adapter memiliki credential boundary sendiri.

Contoh conceptual mapping:

```text
source adapter
  └── provider credential reference
        └── secret manager/runtime
```

Core Demand Intelligence tidak boleh menerima raw provider credential.

Adapter hanya menerima credential yang diperlukan untuk request provider.

## 8. Make.com Secrets

Make.com digunakan sebagai integration/automation layer.

Webhook secret, connection token, atau credential Make tidak boleh masuk ke canonical DemandObject.

Payload dari Make harus melewati validation dan provenance handling sebelum menjadi business data.

Make credential tidak memberikan permission tambahan terhadap source.

## 9. Encryption

Minimum:

- encryption in transit;
- encryption at rest untuk production data dan secret storage;
- application-level encryption bila ada field dengan kebutuhan perlindungan tambahan.

Encryption key tidak boleh disimpan di repository.

## 10. Rotation

Secret yang mendukung rotasi harus dapat diganti tanpa perubahan source code.

Rotation procedure minimal:

1. issue new credential;
2. store in secret manager;
3. deploy/reload runtime;
4. validate connectivity;
5. revoke old credential;
6. record audit event;
7. verify no residual old credential usage.

## 11. Least Privilege

Credential harus memiliki permission minimum.

Contoh:

- read-only credential untuk discovery;
- write permission hanya untuk action provider yang memang diperlukan;
- webhook credential hanya untuk endpoint yang relevan.

Jangan menggunakan satu credential super-admin untuk semua adapter.

## 12. Local Development

Local development harus menyediakan:

- `.env.example` tanpa secret nyata;
- fixture data;
- mock provider;
- fake/test credentials bila diperlukan;
- external side effect disabled by default.

Contoh:

```text
.env.example
DATABASE_URL=
PROVIDER_API_KEY=
MAKE_WEBHOOK_SECRET=
```

File `.env` lokal yang berisi secret harus masuk `.gitignore`.

## 13. CI/CD

CI/CD harus:

- tidak mencetak secret;
- menggunakan repository/environment secret store;
- menjalankan secret scanning;
- memisahkan credentials berdasarkan environment;
- memblokir deployment bila required production configuration invalid.

Test pipeline sebaiknya menggunakan mock/sandbox daripada production API.

## 14. Incident Response

Jika secret diduga bocor:

1. anggap credential compromised;
2. revoke/rotate segera;
3. cari penggunaan credential tersebut;
4. periksa audit/log tanpa mengekspos secret;
5. deploy credential pengganti;
6. dokumentasikan incident dan remediation.

Jangan mencoba menghapus bukti audit untuk menyembunyikan incident.

## 15. Acceptance Criteria

- tidak ada secret nyata di repository;
- configuration tervalidasi saat startup;
- local/dev/staging/prod terpisah;
- provider credential terisolasi di adapter boundary;
- logs melakukan redaction;
- secret rotation tidak membutuhkan perubahan business logic;
- production side effect tidak aktif pada local secara default;
- CI memiliki secret scanning;
- deployment gagal secara jelas ketika required secret/configuration tidak tersedia.
