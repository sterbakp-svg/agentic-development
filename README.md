# Agent Composer: specification package

Working name. Draft 1.1, 2026-11-14 (1.1 adds the agent team).

Agent Composer creates personalized instructions for email-triage agents in Microsoft 365 Copilot. A user describes the job in a guided form. The app returns ready-to-paste fields for Agent Builder: name, description, instructions and conversation starters, plus a personal setup guide. The app never reads a mailbox.

This package is the input for the development agent team (Claude Code). It is written so that coding agents can implement it directly.

## Setup

1. Install Node.js 22 or later (`.nvmrc` pins 26) and pnpm 10 (`npm install -g pnpm@10`; Node 25 and later ship no corepack).
2. Clone the repository and open its root folder.
3. Run `pnpm install`.
4. Run `pnpm build` to build all workspace packages.
5. Run `pnpm test` for the unit tests.
6. Run `pnpm lint` and `pnpm typecheck` for style and type checks.
7. Run `pnpm eval` for the eval runner. It is a stub for now: it calls no model and needs no `AOAI_*` variables.
8. Run `pnpm --filter @agent-composer/web dev` to start the web app on http://localhost:3000.

## Configuration

The model client in `packages/core` reads these environment variables. It belongs to the deferred SaaS path; the current delivery path (ADR-001) uses the Copilot Studio prompt tool and needs none of them.

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `AOAI_ENDPOINT` | required | none | Azure OpenAI endpoint. https, host only: no path, query, fragment or credentials. |
| `AOAI_DEPLOYMENT` | required | none | Name of the model deployment. |
| `AOAI_API_VERSION` | required | none | API version used in the request URL. |
| `AOAI_TIMEOUT_MS` | optional | `45000` | Timeout per attempt in milliseconds. A positive whole number. |
| `AOAI_AUTH_MODE` | optional | `managed_identity` | `managed_identity` in Azure, `developer` for local sign-in (Azure CLI and similar). |
| `AZURE_CLIENT_ID` | optional | none | Client ID of a user-assigned managed identity. Leave empty for a system-assigned one. |

No API key: authentication is Entra ID only.

## How to start

One-time bootstrap (already done in this repository): copy the package into an empty Git repository and create the symlink `CLAUDE.md` → `AGENTS.md`.

1. Open Claude Code in the repository root, run `/clear`, `/model opus`, `/effort high`, and paste the text from `KICKOFF_PROMPT.md` (window W0).
2. Review the plan that the lead agent writes in `docs/PROGRESS.md`, then approve it.
3. Answer the questions in `docs/08-open-questions.md` when tickets need them.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs checks, audit, secret scan and the reference renderer on every pull request; branch protection is set up with `docs/checklists/T-002.md`.

## Contents

| File | Purpose |
|---|---|
| `KICKOFF_PROMPT.md` | Prompt that starts the agent team |
| `AGENTS.md` | Rules for coding agents in this repository, the agent team and the pipeline per ticket |
| `.claude/agents/` | Nine subagent definitions (architect, prompt-engineer, core-dev, web-dev, platform-dev, test-engineer, reviewer, researcher, tech-writer) |
| `.claude/settings.json` | Permission rules: no access to secrets, approval before push, installs and eval runs |
| `docs/agent-team/` | Brief template for subagents and the work windows with prompts |
| `docs/01-prd.md` | Product requirements: problem, personas, journeys, requirements, metrics, phases |
| `docs/02-architecture.md` | Architecture of core, pilot and SaaS; technology decisions; data model; API |
| `docs/03-input-model.md` | Inputs, their sources and the interview design |
| `docs/04-generation-and-validation.md` | Model request, rendering, validation, quality report |
| `docs/05-mvp-copilot-studio.md` | Phase 1 pilot in Copilot Studio |
| `docs/06-security-privacy.md` | Data classes, privacy principles, threat model, compliance tasks |
| `docs/07-backlog.md` | Epics and tickets with acceptance criteria and dependencies |
| `docs/08-open-questions.md` | Decisions the product owner must make |
| `prompts/generator.system.md` | System prompt of the generator (the core of the product) |
| `prompts/mvp-interview-agent.instructions.md` | Instructions of the phase 1 pilot agent |
| `schemas/` | JSON schemas of the profile and the generator output |
| `templates/email-triage/v1/` | Fixed template frame and slot definitions |
| `examples/` | Two golden examples (CIO, TPRM data analyst) with expected output |
| `evals/` | Evaluation cases, rubric and a negative test |
| `reference/composer_ref.py` | Reference renderer and validator (Python, standard library only) |

## Sources used for platform facts

- Microsoft Learn: Write effective instructions for declarative agents
- Microsoft Learn: Build agents with Agent Builder; Add knowledge sources
- Microsoft Learn: Declarative agent manifest schema (versions 1.3 to 1.8)
- Microsoft Learn: Copilot Studio extension for Visual Studio Code
- Microsoft Learn: Plan a SaaS offer; SaaS fulfillment APIs; landing page

Platform limits change. Ticket T-053 checks them every month.
