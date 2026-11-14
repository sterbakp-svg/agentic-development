# AGENTS.md

Instructions for coding agents (Claude Code) working in this repository. `CLAUDE.md` is a symlink to this file.

## What this product is

Agent Composer creates personalized instructions for email-triage agents in Microsoft 365 Copilot. The user describes the job; the app returns ready-to-paste fields for Agent Builder. The app never reads a mailbox. Read `docs/01-prd.md` first, then `docs/02-architecture.md`.

## Golden rules

1. **The template frame is fixed.** The LLM fills only slots. Never let generated text change text outside the slots.
2. **Golden examples are the contract.** `examples/*/expected-instructions.md` must render byte-identical. If a change to a template changes them, it is a new template version and needs the product owner's approval.
3. **The reference implementation decides.** When the docs and `reference/composer_ref.py` disagree, the reference wins for renderer and validator behavior. Report the difference in `docs/08-open-questions.md`.
4. **Guardrails stay.** Every generated agent is read-only, treats email content as data, uses facts from the emails only, and keeps the self-check. No ticket may remove or weaken these lines.
5. **Limits come from configuration.** Read limits from `templates/<id>/<version>/template.json`. Never hard-code 8,000 or other platform numbers in code.
6. **No mailbox access.** Request no Graph scope other than `openid profile User.Read`.
7. **No content in logs.** Never log profile fields, slots or generated text. Log IDs, lengths, validator results, latency and token counts.
8. **Tenant isolation.** Take the tenant ID only from the validated token. Every database query filters by it.

## Repository layout

| Path | Content |
|---|---|
| `apps/web` | Next.js app (phase 2) |
| `packages/core` | Profile, templates, renderer, validator, generator, guide |
| `packages/evals` | Eval runner and judge |
| `schemas/` | JSON schemas (profile, generator output) |
| `templates/` | Versioned agent templates |
| `prompts/` | System prompts (generator, pilot interview, later extraction and tuning) |
| `examples/` | Golden examples |
| `evals/` | Eval cases and runs |
| `reference/` | Python reference of renderer and validator |
| `pilot/copilot-studio/` | Phase 1 agent YAML and flow definition |
| `infra/` | Bicep |
| `docs/` | Specification |

## Commands

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test            # unit tests, includes golden render tests
pnpm eval            # LLM evals, needs AOAI_* environment variables, costs money
python3 -I reference/composer_ref.py validate templates/email-triage/v1 <profile.json> <slots.json>
```

## Conventions

- TypeScript strict; no `any` without a comment that explains why.
- Runtime validation with zod at every boundary (API input, model output, database JSON).
- Small modules with one job; public API of `packages/core` through `src/index.ts` only.
- Tests next to the code (`*.test.ts`). Table-driven tests for validator rules.
- User-facing text in i18n files (`apps/web/messages/{sk,en}.json`). Write it in plain, short sentences.
- Commit messages: `T-xxx: <what changed>`.

## How to work on tickets

1. Pick a ticket from `docs/07-backlog.md` whose blockers are done. Do not start **HUMAN** tickets; write a checklist for the human in `docs/checklists/T-xxx.md` instead.
2. Create a branch `t-xxx-short-name`.
3. Write tests first for the acceptance criteria.
4. Implement. Keep the change inside the ticket scope.
5. Run lint, typecheck and tests. For changes to `prompts/`, `templates/` or model settings, also run `pnpm eval` and attach the summary.
6. Update docs that the change affects.
7. Open a pull request with: ticket ID, what changed, how it was tested, open points.
8. Update `docs/PROGRESS.md`: ticket status, date, short note.

## Definition of done

- Acceptance criteria of the ticket met and covered by tests.
- Lint, typecheck, unit tests green in CI.
- Golden render tests green.
- No new warning in the security scan.
- Docs updated.

## The agent team

The main Claude Code session is the **lead** (tech lead and orchestrator). The lead plans, writes briefs, delegates, checks results, merges and keeps `docs/PROGRESS.md` current. The lead writes code only for small fixes that are faster than a brief.

| Agent | Model · effort | Owns | Typical tickets |
|---|---|---|---|
| lead (main session) | Opus, high for planning, medium for routine; Fable for long multi-ticket windows | plan, briefs, merges, `docs/PROGRESS.md` | all |
| `architect` | Opus · high | ADRs in `docs/adr/`, interface contracts | before T-011, T-031, T-033, T-040, T-042, T-060 |
| `prompt-engineer` | Opus · high | `prompts/`, `templates/`, `examples/`, `presets/`, `evals/` | T-012, T-014, T-015, T-023, T-044, T-061 |
| `core-dev` | Sonnet · medium · worktree | `packages/core` | T-003 to T-005, T-010, T-011 |
| `web-dev` | Sonnet · medium · worktree | `apps/web` | T-030 to T-036, T-040, T-041, T-043 to T-045 |
| `platform-dev` | Sonnet · medium · worktree | `infra/`, `.github/`, `pilot/copilot-studio/` | T-001, T-002, T-020 to T-024, T-037, T-038, T-042, T-060 |
| `test-engineer` | Sonnet · medium · worktree | tests, golden tests, Playwright, eval runs | every implementation ticket, T-013 |
| `reviewer` | Opus · high · read-only | review verdicts | every ticket before merge |
| `researcher` | Haiku · medium | `docs/research/` | T-020, T-053, platform questions |
| `tech-writer` | Sonnet · medium | i18n texts, guides, `docs/checklists/` | T-025, T-034, every HUMAN ticket |

### Pipeline for one ticket
1. **Lead:** checks blockers, writes the brief from `docs/agent-team/brief-template.md`.
2. **architect** (only if the ticket needs a design decision): ADR first.
3. **test-engineer:** failing tests from the acceptance criteria, on the ticket branch.
4. **Implementer** (core-dev, web-dev, platform-dev or prompt-engineer): makes the tests pass in its worktree. Agents with `isolation: worktree` work in a temporary copy of the repository and return their branch. The lead merges the test branch into the ticket branch and checks out the ticket branch before starting the implementer, so the implementer starts from the failing tests.
5. **reviewer:** verdict. REWORK goes back to the implementer with the blocking issues. Maximum 2 rework rounds; then the lead decides and records why in `docs/PROGRESS.md`.
6. **Lead:** merges, updates `docs/PROGRESS.md`, tells the product owner in two sentences what is done.

### Rules for the lead
- Run at most 3 subagents at the same time.
- Give each subagent one brief with everything it needs. A subagent does not see your conversation.
- Never accept work without the reviewer's ACCEPT or ACCEPT WITH CHANGES (with the changes done).
- Do the small things yourself. Do not start a subagent "just in case".
- Before you close a ticket, check that every file in the definition of done exists and is complete.
- Work in the windows from `docs/agent-team/windows.md`. At the end of each window, update `docs/PROGRESS.md` so that the next session can start from it alone.

## When you are unsure

Add the question with your recommendation to `docs/08-open-questions.md` and continue with other tickets. Do not guess on decisions about data, permissions, pricing or guardrails.
