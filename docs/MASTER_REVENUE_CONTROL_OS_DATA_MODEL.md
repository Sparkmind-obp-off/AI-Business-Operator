
# Master Revenue Control OS — Canonical Data Model

Status: INTERNAL / DESIGN LOCK v0.1

## Canonical objects
1. Brand
2. Account
3. Product
4. Offer
5. FreeTool
6. ContentIdea
7. ContentAsset
8. Distribution
9. VisitorSession
10. ToolSession
11. Lead
12. Opportunity
13. PipelineEvent
14. Transaction
15. Delivery
16. Customer
17. Subscription / Retention
18. Experiment
19. MetricSnapshot
20. Event

## Relationship
Brand
→ Accounts
→ Products → Offers
→ FreeTools
→ ContentAssets → Distributions
→ VisitorSession
→ ToolSession
→ Lead
→ Opportunity
→ PipelineEvents
→ Transaction
→ Delivery
→ Customer
→ Retention / Expansion

## Attribution
Record at minimum:
- first_touch
- last_touch
- converting_touch
- referrer
- campaign
- content_id
- distribution_id
- free_tool_id

Store events first. Calculate attribution views separately.

## Core events
page_viewed
tool_started
tool_completed
tool_result_viewed
cta_clicked
lead_captured
lead_qualified
pipeline_stage_changed
offer_viewed
checkout_started
payment_succeeded
delivery_started
delivery_completed
customer_activated
renewal
upgrade
referral
churn

## Metrics
Acquisition:
visitors, unique visitors, source, channel, content reach, CTR

Utility:
tool starts, completion rate, result views, repeat usage, tool-to-lead conversion

Revenue:
qualified opportunities, offer views, checkout starts, paid conversion, revenue, average order value, recurring revenue

Retention:
activation, repeat usage, repeat purchase, renewal, expansion, churn

Efficiency:
cost per qualified opportunity, cost per customer, revenue per visitor, revenue per tool user, revenue per content asset

## Source of truth rule
Metrics are projections from events.
The dashboard is not the source of truth.
The event/business-object layer is the source of truth.
