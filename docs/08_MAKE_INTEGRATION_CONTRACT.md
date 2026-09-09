# 08 — Make.com Integration Contract

## Purpose

Make.com is an external integration/automation layer used to connect supported sources and workflows without coupling the application to provider-specific implementation details.

## Pattern

`Source → Make scenario → HTTPS/Webhook → Ingestion API → Normalizer → Demand Intelligence`

or, where appropriate:

`Application → Make webhook → External service → Result → Application callback`

## Responsibilities of Make

- source connector authentication;
- scheduling;
- supported connector operations;
- transformation that is operationally necessary;
- retry/error routing;
- delivery to our application endpoint.

## Responsibilities of our application

- canonical data model;
- provenance;
- deduplication;
- demand analysis;
- scoring;
- business logic;
- authorization;
- audit log;
- user-facing decisions.

## Provider abstraction

Each Make scenario must map to a logical adapter name such as `threads.make`, `instagram.make`, `facebook.make`, or `search.make`. The rest of the application only knows the canonical adapter contract.

## Migration rule

When a first-party API becomes available and approved, add a first-party adapter and run both paths during validation. Once quality and permissions are confirmed, traffic can be moved without changing downstream schemas.

## Compliance rule

Make is not permission to access data that the underlying source does not permit. Every scenario must use an authorized connector/API/workflow and respect source policies.
