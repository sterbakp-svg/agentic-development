# Open questions for the product owner

Coding agents: when you need a decision that is not in the docs, add it here with your recommendation and stop work on that point. Do not guess on items marked **blocking**.

| ID | Question | Recommendation | Blocking for |
|---|---|---|---|
| Q-01 | Final product name and domain ("Agent Composer" is a working name; check trademarks). | Decide before the Marketplace listing. | T-042 |
| Q-02 | Legal entity that publishes the product (Partner Center account, invoices, contracts). | Own company of the product owner. | T-042, T-052 |
| Q-03 | Pricing: per user per month, per organization, or per consultant workspace. | Per user per month with a minimum per organization; consultant plan with a client limit. | T-042, T-043 |
| Q-04 | Azure subscription and tenant for development and production. | Separate subscriptions for staging and production. | T-021, T-037 |
| Q-05 | Pilot users: who, which roles, which tenant. Pilot in the product owner's employer tenant needs internal approval. | Use a tenant you control, or a client tenant with written consent. | T-021, T-026 |
| Q-06 | Default instruction language: English only (recommended) or also Slovak instructions. | English instructions; overview and drafts in the user's language. | T-015 |
| Q-07 | Data retention default (24 months proposed). | 24 months, admin can shorten. | T-050 |
| Q-08 | May the product ever enable email write capabilities (newer manifest versions support triage and supervised send)? | No in v1 to 2b; revisit with customer demand and a separate risk review. | T-060 |
| Q-09 | Branding for consultant exports (logo, colors). | Product owner's brand by default; client branding in the consultant plan. | T-041 |
