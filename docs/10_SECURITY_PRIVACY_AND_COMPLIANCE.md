# 10 — Security, Privacy & Compliance

## Principles

1. Least privilege.
2. Credentials stay server-side.
3. Encrypt secrets and sensitive data at rest/in transit where supported.
4. Record provenance and audit events.
5. Minimize personal data.
6. Separate public evidence from private account data.
7. Respect source terms, API policies, rate limits, and applicable law.

## Contact data

A phone number, email address, or social handle is not automatically fair game. Store and expose contact information only when the source and intended use permit it and when it is necessary for the user's legitimate workflow.

## Scraping/collection boundary

The product must not bypass login walls, CAPTCHAs, technical access controls, rate limits, or platform restrictions. If a source is unavailable through an authorized method, the system marks the source unavailable rather than pretending to have access.

## AI security

- tool allowlists;
- schema validation;
- prompt-injection defenses at ingestion boundaries;
- untrusted-source content treated as data, never as system instructions;
- approval gates for consequential actions;
- audit logs for agent decisions and tool calls.

## Retention

Raw source data should have a defined retention period. Derived intelligence should retain provenance sufficient to explain how it was produced.
