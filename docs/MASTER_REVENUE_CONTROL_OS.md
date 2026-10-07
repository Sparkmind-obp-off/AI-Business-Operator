
# Master Revenue Control OS

Status: INTERNAL / DESIGN LOCK v0.1

## Purpose
Internal control plane for a product-led digital business.

Canonical loop:
Demand → Opportunity → Offer/Product → Free Utility → Content → Distribution → Interest → Pipeline → Transaction → Delivery → Retention → Learning

The system is not the public brand. It is the operating system behind public brands, products and utilities.

## Layer 1 — Internal Control Plane
- Command Center
- Product Registry
- Free Tool Registry
- Content Registry
- Distribution Registry
- Opportunity / Lead Pipeline
- Customer / Retention
- Experiments
- Metrics
- Next Actions

### Command Center
One internal view of:
- active products
- free tools
- content and campaigns
- distribution accounts
- traffic and tool usage
- leads and opportunities
- pipeline
- paid transactions
- retention
- experiments
- alerts
- recommended next actions

### Product Registry
Canonical fields:
product, type, problem, target segment, offer, price, status, public URL, free-tool relationship, upgrade path, fulfillment, recurring/one-time model.

### Free Tool Registry
Canonical fields:
tool identity, problem, target segment, public URL, version, funnel destination, events, usage, activation, result generated, CTA, upgrade conversion, retention/referral signals.

### Content Registry
Canonical fields:
content ID, source idea, problem, product/tool relation, platform, account, format, status, publish date, CTA, destination URL, reach, clicks, tool starts, qualified actions, conversions.

### Distribution Registry
Track distribution surfaces separately from content:
Instagram, TikTok, YouTube, Facebook, Google/Search, communities, directories, partners/referrals.

One canonical content asset may have many distributions.

### Opportunity / Lead Pipeline
Primary lifecycle:
captured → qualified → interested → offer_presented → checkout_started → paid → fulfilled → active → retained → expanded

Terminal states:
lost, disqualified, refunded, churned

Every opportunity needs:
source, first-touch, latest-touch, related tool/content, problem, product/offer, value, stage, next action, owner, timestamps.

## Layer 2 — Public Acquisition
Free utilities are acquisition products.
Initial generic family:
1. Lost Lead Checker
2. WhatsApp Business Audit
3. Website Conversion Audit
4. AI Automation Opportunity Scanner
5. Follow-up Readiness Checker

Do not build all five immediately. Ship one strong utility first.

## Layer 3 — Content & Distribution
Content pillars:
1. Problem discovery
2. Free-tool demonstration
3. Before/after
4. Real audit
5. Experiment
6. Customer/result proof
7. Product education
8. Strategic build evidence

Default CTA:
Use the free tool.

## Layer 4 — Revenue Pipeline
Examples:
tool_used → result_viewed → upgrade_clicked → checkout_started → paid
tool_used → qualified_problem → human_assist_requested → offer → paid

Attention is not commercial intent. The system must distinguish them.

## Layer 5 — Learning
Track:
- which problem attracts demand
- which tool gets used
- which content creates tool usage
- which channel creates qualified users
- which tool creates upgrades
- which offer converts
- which customers retain
- which assets should be killed, improved or expanded

## Canonical loop
Demand Signal → Opportunity → Product/Offer → Free Utility → Content → Distribution → Visitor → Tool Usage → Intent/Lead → Pipeline → Transaction → Delivery → Outcome → Retention/Referral → Learning → next Demand/Opportunity

## Control principle
The operator must always be able to answer:
What is working?
What is not working?
Where is the bottleneck?
What should happen next?

The operator should not need ten disconnected dashboards.
