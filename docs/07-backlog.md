# Backlog

Each ticket has an owner type: **AGENT** (coding agents do it), **HUMAN** (the product owner or an admin must do it; agents prepare a checklist), or **AGENT+HUMAN** (agents prepare, a human executes one step). "Blocked by" lists tickets that must be done first. Start any ticket whose blockers are done.

Acceptance criteria (AC) are the definition of done for the ticket, in addition to the general Definition of Done in `AGENTS.md`.

## E0. Foundations

### T-001 Monorepo scaffold — AGENT
Blocked by: none
- pnpm workspace with `apps/web` (empty Next.js app), `packages/core`, `packages/evals`, `infra/`.
- TypeScript strict, ESLint, Prettier, Vitest configured. Scripts: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm eval`.
- Move `schemas/`, `templates/`, `prompts/`, `examples/`, `evals/`, `reference/` unchanged into the repo root.
- AC: all scripts run green on a clean clone; `README.md` explains setup in under 10 steps.

### T-002 CI pipeline — AGENT
Blocked by: T-001
- GitHub Actions: install, lint, typecheck, unit tests on every pull request; secret scanning; dependency audit.
- Job that runs `python3 -I reference/composer_ref.py` for both golden examples and compares with the TypeScript renderer output (added in T-004).
- AC: a pull request with a failing test cannot be merged (branch protection documented for the human).

### T-003 Profile types and validation — AGENT
Blocked by: T-001
- Generate TypeScript types and a zod schema from `schemas/agent-profile.schema.json`. Add normalization (`docs/04-generation-and-validation.md` § 2).
- AC: both golden profiles parse; 15+ unit tests for invalid input (too long, wrong enum, injection characters removed with warning).

### T-004 Template registry and renderer — AGENT
Blocked by: T-003
- Load template metadata and body; computed slots; rendering rules.
- AC: byte-identical output to `examples/*/expected-instructions.md`; unit tests for empty `line_optional` and `inline_optional` slots; template version in the output metadata.

### T-005 Validator — AGENT
Blocked by: T-004
- All checks from `docs/04-generation-and-validation.md` § 4, same results as the reference.
- AC: golden examples pass; `evals/negative/injection-slots.json` fails with the same 4 errors as the reference; table-driven tests for every check.

## E1. Generator

### T-010 Model client — AGENT
Blocked by: T-001
- Azure OpenAI client with managed identity (Entra ID auth, no keys in production), structured output with `schemas/generator-output.schema.json`, timeout 45 s, retry on transient errors, token and latency metrics.
- Configuration: endpoint, deployment name, API version from environment variables.
- AC: a mock-based unit test suite; an integration test that runs only when `AOAI_ENDPOINT` is set.

### T-011 Generator pipeline — AGENT
Blocked by: T-005, T-010
- Build the request (`docs/04-generation-and-validation.md` § 1), call, parse, render, validate, retry once with errors.
- Store prompt version, template version, model deployment and settings with the result.
- AC: end-to-end run with the golden profiles gives valid results; retry path covered by a test with a mocked bad first answer.

### T-012 Job description extraction — AGENT
Blocked by: T-010
- Separate prompt `prompts/extract-profile.system.md` (write it): text in, partial profile out (responsibilities, topics, stakeholders, regulations, seniority guess) with confidence per field.
- AC: 5 test job descriptions (write them, different roles); extracted fields reviewed in the eval report.

### T-013 Eval harness — AGENT
Blocked by: T-011
- `packages/evals`: runs `evals/cases.md` cases (create the missing profile files under `evals/profiles/`), deterministic checks, LLM judge with the rubric, report as JSON and Markdown.
- AC: `pnpm eval` produces a report; G-01 and G-02 ≥ 4.5; all others ≥ 4.0. Not part of the pull request CI; nightly and before release.

### T-014 Role presets — AGENT
Blocked by: T-003
- `presets/*.json` for 8 roles (FR-12): typical responsibilities, stakeholders, impact areas, urgency signals, confidential topics. English values; UI labels via i18n.
- AC: each preset, combined with a minimal profile, passes the eval threshold.

### T-015 Slovak instruction template (optional) — AGENT
Blocked by: T-013, decision Q-06
- `templates/email-triage/v1-sk/` derived from the English frame; Slovak golden examples.
- AC: eval results not worse than the English template for Slovak users.

## E2. Phase 1 pilot in Copilot Studio

### T-020 Spike: platform limits — AGENT+HUMAN
Blocked by: T-001
- Verify in a test environment: prompt tool length for the generator prompt with template and examples; structured JSON output of the prompt tool; agent flow string functions; calling a flow as a tool; current support of the Copilot Studio VS Code extension on the product owner's OS.
- AC: `docs/spikes/T-020.md` with results and the chosen option (A, B or C from `docs/05-mvp-copilot-studio.md`).

### T-021 Environment and agent shell — HUMAN
Blocked by: Q-04, Q-05
- Create the Power Platform environment; create the empty agent; clone it to the repository with the Copilot Studio extension; grant the pilot users access.
- AC: agent YAML in `pilot/copilot-studio/` is committed.

### T-022 Interview — AGENT
Blocked by: T-020, T-021
- Agent instructions from `prompts/mvp-interview-agent.instructions.md`; optional adaptive card for step 4.
- AC: test conversations for both golden users produce the golden profiles (field by field).

### T-023 Prompt tool — AGENT
Blocked by: T-020, T-021
- `GenerateEmailTriageSlots` with the generator prompt, template and examples (option from T-020).
- AC: with the golden profiles, results pass the flow validator in 9 of 10 runs.

### T-024 Render and validate flow — AGENT+HUMAN
Blocked by: T-023
- Agent flow as specified; flow definition exported to the repository.
- AC: golden output identical to `expected-instructions.md`; injection case rejected.

### T-025 Pilot guide — AGENT
Blocked by: T-022
- One-page HTML guide for pilot users (what the pilot does, privacy statement, how to give feedback).
- AC: reviewed by the product owner.

### T-026 Pilot run and evaluation — HUMAN
Blocked by: T-024, T-025
- Run the pilot (5-10 users, at least 4 roles); collect feedback; agents write the evaluation report from the collected data.
- AC: exit criteria in `docs/05-mvp-copilot-studio.md` checked; go or no-go for phase 2.

## E3. Phase 2a SaaS core

### T-030 Entra ID sign-in — AGENT
Blocked by: T-001
- Multi-tenant app registration documented as a checklist for the human; MSAL sign-in; `User.Read` prefill; session handling.
- AC: sign-in works with two test tenants; no other Graph scopes requested.

### T-031 Data model — AGENT
Blocked by: T-030
- Prisma schema per `docs/02-architecture.md`; migrations; tenant filter helper; encryption of `profile.data` and `generation.result` with a Key Vault key.
- AC: integration test proves tenant isolation.

### T-032 Wizard UI — AGENT
Blocked by: T-003, T-014, T-031
- Five steps per `docs/03-input-model.md`; presets; paste job description (calls T-012); Fluent UI; SK and EN.
- AC: Playwright test completes both golden profiles; WCAG checks (axe) without serious issues; works at 400 px width.

### T-033 Generate and result page — AGENT
Blocked by: T-011, T-032
- Generation with progress state; result page with fields, copy buttons, quality report (`docs/04-generation-and-validation.md` § 5), inline placeholder editing with live validation.
- AC: p95 under 30 s in staging; invalid results never shown as ready.

### T-034 Export and setup guide — AGENT
Blocked by: T-033
- Markdown and HTML export; personal setup guide (same content as the hand-made guides: steps in Agent Builder, knowledge settings, starters, test checklist, limits).
- AC: exports open correctly; guide text reviewed by the product owner.

### T-035 Versions and diff — AGENT
Blocked by: T-033
- AC: user can compare two generations; regenerate after profile change.

### T-036 Feedback — AGENT
Blocked by: T-033
- In-app feedback one week after generation (email reminder is optional and needs Q-02).
- AC: feedback stored and shown in an internal report.

### T-037 Infrastructure — AGENT+HUMAN
Blocked by: Q-04
- Bicep for Container Apps, PostgreSQL, Key Vault, Application Insights, Front Door, model deployment; GitHub Actions deployment with OIDC.
- AC: staging deploys from `main`; production deploys from a release tag with manual approval.

### T-038 Observability — AGENT
Blocked by: T-037
- OpenTelemetry; content-free logging rule enforced by a lint rule or a logger wrapper; dashboards for latency, error rate, cost per tenant.
- AC: a test proves that profile text never appears in logs.

## E4. Phase 2b commercial and organization

### T-040 Organization context — AGENT
Blocked by: T-031
- Admin role (Entra app role); org context form; merge rules from `docs/04-generation-and-validation.md` § 2; mandatory rule validated like a slot.
- AC: org rule appears in every generation of the tenant; admin sees only aggregate numbers.

### T-041 Consultant workspace — AGENT
Blocked by: T-040, Q-09
- AC: consultant manages several client workspaces; branded HTML and PDF export.

### T-042 Microsoft Marketplace SaaS offer — AGENT+HUMAN
Blocked by: T-030, Q-01, Q-02, Q-03
- Landing page with Entra SSO; resolve the marketplace token; activate the subscription; webhook endpoint (secured); plan changes and cancellation; Partner Center steps as a human checklist.
- AC: end-to-end test in the Marketplace test environment (preview audience).

### T-043 Plans, quotas and metering — AGENT
Blocked by: T-042
- AC: quotas enforced per plan; usage visible to the tenant admin.

### T-044 Tuning mode — AGENT
Blocked by: T-033
- Prompt `prompts/tune.system.md` (write it): agent answer + user complaint in, changed slots out; diff shown; user accepts or rejects.
- AC: 5 tuning cases in evals with judge ≥ 4.0.

### T-045 Czech and German — AGENT
Blocked by: T-032
- AC: UI, labels and keyword packs complete; evals R-02 and R-03 pass.

## E5. Operations and compliance

### T-050 Privacy features — AGENT
Blocked by: T-031, Q-07
- Retention job; export and delete for users; tenant offboarding.
- AC: tests for each function.

### T-051 Security review — HUMAN
Blocked by: T-033, T-037
- External penetration test or structured review against OWASP ASVS level 2. Agents fix findings.

### T-052 Legal documents — HUMAN
Blocked by: Q-02
- See `docs/06-security-privacy.md` § Compliance tasks.

### T-053 Monthly platform review — AGENT (recurring)
Blocked by: none
- Check Microsoft documentation for changes: instruction limit, Agent Builder knowledge options, declarative agent schema version, model availability in the EU data zone. Update `template.json` limits and open tickets.

## E6. Phase 3 extensions

### T-060 App package export — AGENT
Blocked by: T-033, Q-08
- See `docs/02-architecture.md` § 4. Read-only capabilities only.
- AC: package validates with the Microsoft 365 Agents Toolkit and installs in a test tenant.

### T-061 Second template: meeting preparation — AGENT
Blocked by: T-013
- New template folder with two golden examples and eval cases; no code changes outside the registry.
