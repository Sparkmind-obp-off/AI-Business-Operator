# 14 — Master Traceability Matrix

| ID | Capability | Primary document | MVP |
|---|---|---|---|
| CAP-01 | Source adapters | 04 | Yes |
| CAP-02 | Ingestion | 04, 05 | Yes |
| CAP-03 | Demand intelligence | 03 | Yes |
| CAP-04 | Opportunity database | 05, 06 | Yes |
| CAP-05 | Opportunity scoring | 06 | Yes |
| CAP-06 | AI orchestration | 07 | Yes |
| CAP-07 | Make integration | 08 | Yes |
| CAP-08 | Security/privacy | 10 | Yes |
| CAP-09 | Voice interface | 09 | Later/MVP shell |
| CAP-10 | Testing/delivery | 13 | Yes |

## Traceability rule

Every implementation issue, pull request, and major code module should reference one or more capability IDs. Any undocumented capability is considered architecture drift until documented.

## Priority order

1. Foundation and contracts.
2. Ingestion.
3. Demand intelligence.
4. Opportunity database and scoring.
5. Operator orchestration.
6. Make/API adapters.
7. Action execution.
8. Voice interface.
9. Learning and optimization.
