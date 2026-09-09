# 07 — AI Business Operator Orchestration

## Role

The AI Business Operator is the reasoning and orchestration layer above deterministic application services.

## Core loop

1. Understand user goal.
2. Inspect current opportunities and evidence.
3. Plan actions.
4. Call approved tools.
5. Validate results.
6. Present decisions and evidence.
7. Request approval where required.
8. Execute approved actions.
9. Record outcomes.

## Agent roles

- Research Agent — discovers and summarizes evidence.
- Demand Analyst — converts evidence into DemandObjects.
- Opportunity Analyst — scores and qualifies opportunities.
- Strategy Agent — proposes offers and positioning.
- Execution Agent — prepares or performs approved internal actions.
- Outreach Agent — drafts external communications; sending requires policy/approval controls.
- Feedback Agent — records outcomes and improves prioritization.

## Tool policy

Agents may only call tools explicitly registered in the tool registry. Each tool has permissions, input schema, risk level, and approval requirements.

## Deterministic boundary

AI should not directly own critical persistence, authentication, authorization, billing, or source credential management. Those remain application-controlled services.

## Failure behavior

If a tool fails, the agent reports the actual failure and either retries safely, chooses an available alternative, or asks the user. It never fabricates completion.
