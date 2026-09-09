# 04 — Source Adapter & Ingestion Architecture

## Principle

Source access is an interchangeable adapter problem. The core application never depends directly on a single social platform or scraping provider.

## Adapter priority

### Tier 1 — First-party official APIs

Use official APIs whenever the required data and permissions are available.

Examples may include platform APIs for developer-approved access, search APIs, public data APIs, and APIs for services such as GitHub or YouTube.

### Tier 2 — Authorized integration / automation providers

Make.com or another authorized integration provider can act as an integration layer when it exposes the required source through a supported connector or HTTP integration.

The provider returns data to our ingestion endpoint. It does not become the business-logic layer.

### Tier 3 — Search/index providers

Search APIs can discover public web pages and indexed discussions where appropriate. Search results are evidence pointers, not automatically authoritative source records.

### Tier 4 — Browser/collection workflows

Only use where access is permitted and technically appropriate. Respect robots directives where applicable, terms of service, rate limits, authentication boundaries, privacy obligations, and platform policies. This tier must be isolated behind an adapter and must never be assumed to be universally available.

## Dual-path strategy

For approval-gated sources:

`Official API Adapter (preferred) ⇄ Integration Adapter (temporary/alternative)`

When the official API becomes available, the new adapter replaces or supplements the integration adapter without changing the normalized data contract.

## Canonical pipeline

`Source → Adapter → Raw Event → Validation → Normalizer → DemandObject → Intelligence → Opportunity`

## Failure handling

Each adapter must expose:

- authentication status;
- rate-limit status;
- source availability;
- last successful sync;
- error reason;
- retryability;
- provenance metadata.

## Critical constraint

No adapter may silently claim that it collected data it could not actually access.
