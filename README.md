# Agent Composer: specification package

Working name. Draft 1.1, 2026-11-14 (1.1 adds the agent team).

Agent Composer creates personalized instructions for email-triage agents in Microsoft 365 Copilot. A user describes the job in a guided form. The app returns ready-to-paste fields for Agent Builder: name, description, instructions and conversation starters, plus a personal setup guide. The app never reads a mailbox.

This package is the input for the development agent team (Claude Code). It is written so that coding agents can implement it directly.

## Setup

1. Install Node.js 22 or later (`.nvmrc` pins 26) and pnpm 10 (`corepack enable` is enough).
2. Clone the repository and open its root folder.
3. Run `pnpm install`.
4. Run `pnpm build` to build all workspace packages.
5. Run `pnpm test` for the unit tests.
6. Run `pnpm lint` and `pnpm typecheck` for style and type checks.
7. Run `pnpm eval` for the eval runner. It is a stub for now: it calls no model and needs no `AOAI_*` variables.
8. Run `pnpm --filter @agent-composer/web dev` to start the web app on http://localhost:3000.

## How to start

1. Create an empty Git repository and copy this package into its root.
2. Create the symlink `CLAUDE.md` → `AGENTS.md`.
3. Open Claude Code in the repository root, run `/clear`, `/model opus`, `/effort high`, and paste the text from `KICKOFF_PROMPT.md` (window W0).
4. Review the plan that the lead agent writes in `docs/PROGRESS.md`, then approve it.
5. Answer the questions in `docs/08-open-questions.md` when tickets need them.

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
