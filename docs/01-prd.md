# Product requirements: Agent Composer

Working name. Status: draft 1.0, 2026-11-14. Owner: product owner (business). Readers: the development agent team and reviewers.

## 1. Summary

Agent Composer creates personalized instructions for agents in Microsoft 365 Copilot. The first agent type is an email-triage agent. The agent reviews the user's mail of the last 7 days, selects the 10 threads that need the user's action, proposes a solution and drafts replies.

The user describes the job in a short guided form. Agent Composer returns ready-to-paste fields for Agent Builder in Microsoft 365 Copilot: name, description, instructions and conversation starters, plus a personal setup guide. Agent Composer never reads the user's mailbox.

The product starts as a pilot agent in Copilot Studio (phase 1) and becomes a multi-tenant SaaS application on Azure (phase 2). The architecture is ready for more agent types (phase 3).

## 2. Problem

- Microsoft 365 Copilot lets every licensed user build a personal agent. Few users do it well. Good instructions need prompt-engineering skill, knowledge of the platform limits (8,000 characters, knowledge sources), and a clear model of the user's own priorities.
- A generic "summarize my inbox" prompt gives generic results. The value comes from role context: whose emails matter, what is high impact, what counts as action. Two hand-made examples (a CIO and a TPRM data analyst) show that the same structure works for very different roles when the role context changes.
- Organizations that roll out Copilot want measurable adoption. A repeatable, governed way to create useful personal agents helps.

## 3. Goals and non-goals

### Goals
- G1. A user without prompt-engineering skill creates a working, personalized email-triage agent in under 15 minutes.
- G2. Every generated instruction set meets the platform limits and the Microsoft best practices for declarative agent instructions (clear steps with goal, action and transition; explicit output format; self-check; examples where needed).
- G3. The quality is consistent across roles, industries and the languages Slovak, Czech, English and German.
- G4. The product is sellable: to organizations (licenses for many users) and through consultants who run workshops for client managers.

### Non-goals (v1)
- Agent Composer does not create the agent in the user's tenant automatically. The user pastes the fields. (Automatic packaging is phase 3, see FR-15.)
- Agent Composer does not read, store or process email content.
- No agent types other than email triage in phase 1 and 2a.
- No mobile app. The web app must work on a phone, but Agent Builder itself is desktop and web only.

## 4. Personas

| Persona | Example | Needs |
|---|---|---|
| Executive | CIO of an insurance company, board member | Fast setup, decisive drafts, focus on approvals, escalations, regulator and board |
| Specialist | Data and business analyst in TPRM | Focus on data requests, deadlines, registers, audits; no delegation |
| Copilot adoption lead (buyer, org admin) | Head of digital workplace | Rollout to many users, shared org context, usage numbers, data protection proof |
| Consultant (partner) | AI consultant running workshops for SMEs | Create and manage profiles for many client users, branded output, reuse of role presets |

## 5. User journeys

**J1. Self-service user (phase 1 and 2)**
1. The user opens Agent Composer and signs in with the work account (phase 2) or opens the pilot agent in Microsoft 365 Copilot (phase 1).
2. The user selects or confirms a role preset, or pastes a job description.
3. The user answers four short steps: role, work content, people and priorities, language and style.
4. The user confirms the profile summary.
5. Agent Composer generates and validates the fields and shows a quality report.
6. The user fills the remaining placeholders in the app, copies each field into Agent Builder, and follows the setup guide.
7. After one week the app asks for feedback and offers to tune the instructions.

**J2. Organization rollout (phase 2b)**
1. The admin buys a plan (Microsoft Marketplace or invoice) and signs in.
2. The admin sets the organization context once: description, common stakeholder groups, regulator, one mandatory rule.
3. Users of the tenant sign in; the org context is applied to their profiles automatically.
4. The admin sees adoption numbers (profiles, generations, feedback scores). The admin never sees profile content of individual users unless the user shares it.

**J3. Consultant workshop (phase 2b)**
1. The consultant creates a client workspace.
2. In a workshop, the consultant fills profiles together with each manager.
3. The consultant exports a branded setup pack per person (HTML or PDF).

## 6. Functional requirements

Priority: M = must, S = should, C = could. Phase: 1 = pilot agent, 2a = SaaS core, 2b = commercial and org features, 3 = extensions.

| ID | Requirement | Prio | Phase |
|---|---|---|---|
| FR-1 | Guided interview in four steps (role; work content; people and priorities; language and style) with examples for each question. | M | 1, 2a |
| FR-2 | Accept a pasted job description and propose responsibilities, topics and stakeholders from it. The user confirms or corrects. | M | 1, 2a |
| FR-3 | Show a profile summary and require confirmation before generation. | M | 1, 2a |
| FR-4 | Generate slot values with the LLM (`prompts/generator.system.md`) and render the instructions from the fixed, versioned template. | M | 1, 2a |
| FR-5 | Validate every result (`docs/04-generation-and-validation.md`). Never show an invalid result as ready. Retry generation once with the error list. | M | 1, 2a |
| FR-6 | Return name, description, instructions, four conversation starters, placeholders to fill, assumptions and up to three improvement questions. | M | 1, 2a |
| FR-7 | Show a quality report: character count against 8,000, checks passed, placeholders left. | M | 2a |
| FR-8 | Let the user fill placeholders in place, with live character count and re-validation. | M | 2a |
| FR-9 | One-click copy per field. Export as Markdown and as a personal setup guide (HTML; PDF in 2b). | M | 2a |
| FR-10 | Sign in with Microsoft Entra ID (multi-tenant). Prefill name, job title, department and preferred language from Microsoft Graph with the `User.Read` permission only. | M | 2a |
| FR-11 | Save profiles and generated versions. Show the difference between two versions. Regenerate after a role change. | S | 2a |
| FR-12 | Role preset library: at least 8 presets in 2a (executive, IT manager, finance, risk and compliance, data analyst, project manager, sales, HR). A preset proposes typical values; the user can change all of them. | S | 2a |
| FR-13 | Organization context set by an admin and applied to all profiles of the tenant (organization description, common stakeholders, one mandatory rule). | S | 2b |
| FR-14 | Consultant workspace: many client organizations, profiles per person, branded export. | S | 2b |
| FR-15 | Export a Microsoft 365 app package with a declarative agent manifest (latest schema version), for admin upload. Allow email scoping to folders where the platform supports it. | C | 3 |
| FR-16 | Tuning mode: the user pastes one agent answer and describes what was wrong; the generator proposes changed slot values; the user accepts or rejects them. | S | 2b |
| FR-17 | Further templates (meeting preparation, document review, weekly status). Template selection is a profile field from day one. | C | 3 |
| FR-18 | User interface in Slovak and English (2a), Czech and German (2b). | M | 2a |
| FR-19 | Subscription and billing through Microsoft Marketplace SaaS offer (landing page, webhook, fulfillment API) and a manual invoice option. | M | 2b |
| FR-20 | Feedback prompt one week after generation (1-5 rating of top-10 relevance and draft quality, free text). | S | 2a |

## 7. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-1 | Privacy | No access to mailbox content. Graph permission `User.Read` only. Profile data is personal data under GDPR: data minimization, EU data residency, retention setting (default 24 months after last use), export and delete on request. |
| NFR-2 | Security | OWASP ASVS level 2. Entra ID SSO, tenant isolation on every query, secrets in Azure Key Vault, managed identities, no secrets in the repository. |
| NFR-3 | Quality | 100% of shown results pass the deterministic validator. Eval suite average ≥ 4.0 (judge rubric) before every release. |
| NFR-4 | Performance | Generation p95 under 30 seconds. UI interactions under 300 ms. |
| NFR-5 | Availability | 99.5% monthly for the SaaS app. |
| NFR-6 | Cost | LLM cost per generation under EUR 0.05 at list price. Track it per tenant. |
| NFR-7 | Accessibility | WCAG 2.1 AA. |
| NFR-8 | Observability | Structured logs and traces (OpenTelemetry to Application Insights). Never log profile content or generated text; log IDs, lengths, validator results and latency. |
| NFR-9 | Reproducibility | Every generation stores the template version, prompt version, model deployment and settings. |
| NFR-10 | Portability of prompts | Generated instructions work in Agent Builder and in a declarative agent manifest without change. |

## 8. Success metrics

- Activation: 60% of users who generate also confirm that they created the agent (in-app check or feedback).
- Time to agent: median under 15 minutes from sign-in to copy of instructions.
- First-pass validity: 95% of generations pass the validator without retry.
- Perceived relevance: average rating ≥ 4 of 5 for "the top 10 were the right emails" after one week.
- Commercial (phase 2b): number of paying organizations and seats; consultant workspaces.

## 9. Assumptions and constraints

- Email knowledge in Agent Builder requires a Microsoft 365 Copilot license for the user, uses the whole mailbox and cannot be scoped to folders in Agent Builder.
- Instructions are limited to 8,000 characters. The template targets 7,000 characters, so the user can add text.
- Microsoft changes the platform often (models, limits, schema versions). Every limit lives in configuration (`templates/*/template.json`) and is checked by a monthly platform review ticket.
- Agent Builder retrieves emails by search; it does not page through every email. The generated instructions must keep the coverage note.

## 10. Release plan

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Foundations | Core package (schema, renderer, validator, generator client), golden tests, eval harness | Golden tests green; eval G-01 and G-02 ≥ 4.5 |
| 1. Pilot agent | Copilot Studio agent with interview, prompt tool and validation; 5-10 pilot users | 8 of 10 pilot users create an agent; feedback collected |
| 2a. SaaS core | Web app, Entra sign-in, wizard, generation, quality report, export, profiles, presets, SK/EN | NFR-1 to NFR-8 met; security review passed |
| 2b. Commercial | Marketplace offer, org context, consultant workspace, tuning, CZ/DE, PDF | First paying customer live |
| 3. Extensions | App package export, more templates | Per template: own golden examples and evals |
