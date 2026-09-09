# AI Business Operator

AI Business Operator is a demand-first business operating system designed to discover real market demand, turn signals into scored opportunities, and orchestrate execution with AI agents.

## Core Principle

> Demand first → Intelligence → Opportunity → Action → Execution → Feedback.

We do not build random features first. The system should collect evidence of demand from real sources, normalize it, score opportunities, and help the operator decide what to build, sell, or pursue.

## Architecture

1. Source & Search Layer
2. Integration / Automation Layer (Make.com and other adapters)
3. Ingestion & Normalization Layer
4. Demand Intelligence Layer
5. Opportunity Database
6. Scoring & Prioritization Engine
7. AI Business Operator / Orchestration Layer
8. Action & Execution Layer
9. Feedback / Learning Layer
10. Live Voice Interface

## Data-source strategy

Official APIs are preferred whenever available and permitted. Approval-gated APIs must not block the entire product. Where a source cannot be accessed through an approved first-party API, the system may use a compliant third-party integration or automation provider such as Make.com, subject to that provider's terms, the source platform's terms, privacy requirements, and applicable law.

The application layer must remain provider-agnostic: changing an ingestion provider must not require rewriting Demand Intelligence or the Operator.

## Documentation

See `/docs` for the product, business, data, architecture, security, implementation, testing, and AI-agent contracts.

## Status

Phase 0 — Architecture and documentation foundation.
