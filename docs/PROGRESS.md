# Progress

State file of the lead. A new session starts from this file alone.

**Last update:** 2026-11-18 · after W3 · **Status: delivery path changed by ADR-001 (one company's Power Platform, Copilot Studio prompt tool, no Azure, manual evals, IT deploys). Phase 0 core done and kept as test oracle. Next window: W5 (changed: manual eval kit), in parallel with the T-020 hands-on test.**

## 1. The product in five sentences

1. Agent Composer turns a short guided interview about a person's job into ready-to-paste fields for Agent Builder in Microsoft 365 Copilot: name, description, instructions, four conversation starters and a setup guide for a personal email-triage agent.
2. The instructions come from a fixed, versioned template; the language model fills only 19 role-specific slots, and deterministic code computes the other 16 slots, renders the text and validates it.
3. The guardrails live in the fixed frame, so every generated agent is read-only, treats email content as data, uses facts from the emails only and keeps its self-check; a result that fails the validator is never shown as ready.
4. The app never reads a mailbox; it asks only for `openid profile User.Read`, keeps profile content out of logs and isolates tenants.
5. Delivery goes in steps: phase 0 builds the TypeScript core that must behave exactly like `reference/composer_ref.py`, phase 1 proves the idea with 5-10 pilot users in Copilot Studio, and phase 2 builds the multi-tenant SaaS on Azure.

## 2. What I checked in W0

| Check | Result |
|---|---|
| Reference `validate`, `examples/cio-insurance` | `ok: true`, 5,174 characters, no errors, no warnings |
| Reference `validate`, `examples/tprm-analyst` | `ok: true`, 5,983 characters, no errors, no warnings |
| Reference `render` against `expected-instructions.md` | Byte-identical for both examples |
| Reference `validate`, `evals/negative/injection-slots.json` | `ok: false` with the 4 expected errors (2 in `tools`, 2 in `discretion_rule`), same with either golden profile |
| Local tools | Python 3.9.6 and Node 26.13.0 present; **pnpm is not installed**; **the repository has no Git remote** |

## 3. Human prerequisites (product owner)

| # | What | Needed for | Status |
|---|---|---|---|
| H-1 | Create the GitHub repository and add it as `origin` | W1 | done (`sterbakp-svg/agentic-development`) |
| H-2 | Install pnpm | W1 | done (pnpm 10.34.9 via npm; Node 26 has no corepack) |
| H-3 | ~~Azure subscription and Azure OpenAI~~ | — | obsolete (ADR-001) |
| H-4 | ~~Eval budget (Q-11)~~ | — | obsolete (ADR-001); manual evals instead |
| H-5 | Test Power Platform environment; Windows machine or cloud PC if the Copilot Studio extension needs it | W6 (your test steps) | open |
| H-6 | Decide Q-05 and do T-021: pilot tenant, environment, agent shell, first clone | W7 | open |

H-6 has the longest lead time (tenant approval). It is the critical path of phase 1. Start it now.

## 4. Order of work

**Current order (ADR-001, 2026-11-18):** W1, W6 desk part, W2, W3 done → **W5 changed** (manual eval kit, T-012 job descriptions, T-020 checklist update) in parallel with the **T-020 hands-on test** (human) → T-021 (human) → W7 → W8 (internal test, first manual evals) → W15 new (T-027 packaging and IT handover) → T-028 (IT import, human) → T-026 (pilot, human) → W16 new (pilot evaluation). W4 dropped. W9 to W14 deferred. Details and blockers: ADR-001 § 13. The tables below are the original plan, kept for history.

Original order of windows: **W1 → W6 → W2 → W3 → W4 → W5 → W7 → W8**.

One approved change against `windows.md`: W6 runs directly after W1, not after W5. T-020 depends only on T-001, it needs no Azure resource, and its result (option A, B or C) and your test steps take calendar time. W2 and W3 are not blocked by any human decision, W4 and W5 are.

### Phase 0 · Foundations

| Window | Step | Ticket | Agent | Runs in parallel with |
|---|---|---|---|---|
| W1 | 1 | T-001 Monorepo scaffold | platform-dev | — |
| W1 | 2 | T-001 review, merge | reviewer, lead | — |
| W1 | 3 | T-002 CI pipeline, `docs/checklists/T-002.md` (branch protection) | platform-dev | — |
| W1 | 4 | T-002 review, merge | reviewer, lead | — |
| W2 | 1 | Failing tests for T-003 and T-010 | test-engineer | — |
| W2 | 2 | T-003 Profile types, zod, normalization | core-dev (1) | step 3 |
| W2 | 3 | T-010 Model client (mock tests only; no Azure needed) | core-dev (2) | step 2 |
| W2 | 4 | Reviews of T-003 and T-010, merge | reviewer ×2, lead | both reviews together |
| W3 | 1 | Golden and differential tests for T-004 | test-engineer | step 2 |
| W3 | 2 | T-014 Role presets (8 roles) | prompt-engineer | steps 1, 3, 4 |
| W3 | 3 | T-004 Template registry and renderer; finish the CI job from T-002 that compares the Python reference with the TypeScript renderer | core-dev | step 2 |
| W3 | 4 | T-004 review, merge | reviewer, lead | step 2 |
| W3 | 5 | Table-driven tests for T-005 | test-engineer | T-014 review |
| W3 | 6 | T-005 Validator | core-dev | — |
| W3 | 7 | T-005 review, merge | reviewer, lead | — |
| W4 | 0 | Check `AOAI_*`; stop if missing | lead | — |
| W4 | 1 | ADR for the generator pipeline in `docs/adr/` | architect | — |
| W4 | 2 | Failing tests with a mocked model for T-011 and T-012 | test-engineer | — |
| W4 | 3 | T-011 Generator pipeline | core-dev | step 4 |
| W4 | 4 | T-012 (ADR-001): the interview agent extracts from a pasted job description (`# PASTED JOB DESCRIPTION` in `prompts/mvp-interview-agent.instructions.md`); five test job descriptions in `evals/job-descriptions/`; a separate `prompts/extract-profile.system.md` only if the evals show weak extraction | prompt-engineer | step 3 |
| W4 | 5 | T-012: no wiring in `packages/core` (ADR-001); closes with the first manual eval run (W8, Q-12) | — | — |
| W4 | 6 | Reviews of T-011 and T-012, merge; one real generation per golden profile, validator reports shown to you | reviewer ×2, lead | both reviews together |
| W5 | 1 | T-013 `packages/evals`, missing profiles in `evals/profiles/` | test-engineer | step 2 |
| W5 | 2 | Judge prompt from the rubric, checked on G-01 and G-02 | prompt-engineer | step 1 |
| W5 | 3 | Your approval, then one full baseline run, report in `evals/runs/` | lead | — |
| W5 | 4 | T-013 review, merge | reviewer, lead | — |

Phase 0 exit: golden tests green; G-01 and G-02 at 4.5 or more. If the baseline is under the threshold, W5 only lists the weak cases. A prompt-tuning window (prompt-engineer, with evals before and after) then has to follow; `windows.md` has no such window yet.

### Phase 1 · Pilot in Copilot Studio

| Window | Step | Ticket | Agent | Runs in parallel with |
|---|---|---|---|---|
| W6 | 1 | T-020 current platform facts with sources | researcher | step 2 |
| W6 | 2 | T-020 test steps for you: `docs/checklists/T-020.md` | platform-dev | step 1 |
| W6 | 3 | `docs/spikes/T-020.md` with the recommended option A, B or C | lead | — |
| — | — | T-021 Environment and agent shell — **HUMAN**. I write `docs/checklists/T-021.md` (tech-writer) at the end of W6, when the spike facts are known | you | — |
| W7 | 0 | Check T-021 and the agent YAML in `pilot/copilot-studio/`; stop if missing | lead | — |
| W7 | 1 | Golden pilot tests | test-engineer | steps 2, 3 |
| W7 | 2 | T-022 Interview agent | platform-dev | steps 1, 3 |
| W7 | 3 | T-023 Prompt tool `GenerateEmailTriageSlots` | prompt-engineer | steps 1, 2 |
| W7 | 4 | T-024 Render and validate flow, `docs/checklists/T-024.md` | platform-dev | step 5 |
| W7 | 5 | T-025 Pilot guide (you review it) | tech-writer | step 4 |
| W7 | 6 | Reviews of T-022 to T-025, merge | reviewer, lead | max. 3 agents |
| W8 | — | Fixes after the internal test with the two golden users | as needed | — |
| — | — | T-026 Pilot run — **HUMAN**. I write `docs/checklists/T-026.md`; agents write the evaluation report from the data you collect | you | — |

Phase 1 exit: 8 of 10 pilot users create the agent; average relevance 4 or more; no guardrail failure; list of interview changes.

### Rules I apply in every window

- Pipeline per ticket: brief from `docs/agent-team/brief-template.md` → tests first → implementer → reviewer → merge. At most 3 subagents at the same time, at most 2 rework rounds.
- Model and effort of each subagent come from its agent file, or from the override in `windows.md`.
- I stop and ask when: a golden example or a guardrail would change; a new Graph permission, a paid Azure resource or a new external service is needed; a blocking question in `docs/08-open-questions.md` stops the next ticket.
- I ask before every `pnpm eval`.

## 5. Risks

| # | Risk | What I do about it |
|---|---|---|
| R-1 | **Python and JavaScript differ in details the reference depends on.** `len()` counts code points, `String.length` counts UTF-16 units; `\w`, `\b` and `\s` are Unicode-aware in Python and ASCII-only in JavaScript by default (Slovak letters next to "send" or in an email address); `strip()` and `trim()` remove different characters. Two golden examples do not show these cases. | test-engineer builds a differential corpus (diacritics, emoji, edge whitespace, each forbidden pattern) in W3. CI runs the Python reference and the TypeScript code on every case and compares the full result, not only the two examples. |
| R-2 | **Golden coverage is thin.** No example sets `org_rule`, an empty `display_name`, overview `en`, `cs` or `de`, or one working language. | Extra fixtures in W3. Their expected output is produced by the reference, never written by hand. The two golden examples stay untouched. |
| R-3 | **Phase 0 cannot finish without a paid Azure resource.** T-011 needs a real run, T-013 needs eval runs. | W1 to W3 and W6 run without it. W4 starts only after H-3. |
| R-4 | **T-014 and T-012 have acceptance criteria that need the eval harness**, which arrives later (W5). | See Q-12. |
| R-5 | **The pilot flow validates with `contains()` only**, which is weaker than the reference validator (no regular expressions). A weaker check touches the guardrail promise. | Q-13 decided: stricter, never weaker. Parity table in `docs/spikes/T-020.md` § 4; T-024 builds the checks and tests them against the reference. |
| R-6 | **Copilot Studio extension may not run on Apple silicon.** Docs (2026) list Windows x64 and macOS, no architecture for macOS. | T-020 test part 5; fallback `pac` CLI on macOS (part 5b). H-5. |
| R-7 | **Pilot tenant approval (Q-05) can take weeks** and blocks T-021 and all of W7. | Start now, in parallel with phase 0. |
| R-8 | **Prompt size.** The generator request carries the template, 35 slot definitions and two full examples. This matters for the prompt tool limit (T-020) and for cost (NFR-6). | Measure tokens in W4; T-020 checks the prompt tool limit; option B is the fallback. |
| R-9 | **Structured output in strict mode may reject `maxLength`, `minItems` and similar keywords.** | Already planned in `docs/02-architecture.md`: remove them from the request schema, enforce in the validator. The ADR in W4 fixes the details. |
| R-10 | **W1 needs many approvals**: `pnpm add`, `npm install` and `git push` each ask for your approval (`.claude/settings.json`). | Plan to be at the keyboard during W1. |

## 6. Questions added to `docs/08-open-questions.md`

Q-10 model deployments · Q-11 eval budget · Q-12 tickets whose AC need evals · Q-13 pilot validator parity · Q-14 pilot feedback topic has no ticket · Q-15 wrong path in a slot rule of `template.json` · Q-16 evals in CI or not. The file also has a new section with three differences between the docs and the reference (golden rule 3).

Blocking for the next windows: none for W1 to W3. Q-04, Q-10 block W4. Q-11 blocks W5. Q-05 blocks W7.

## 7. Ticket status

| Ticket | Status | Date | Note |
|---|---|---|---|
| W0 Plan | done, approved | 2026-11-14 | this file; the approval covers the plan, not the open questions Q-10 to Q-16 |
| T-001 | done | 2026-11-14 | reviewer ACCEPT WITH CHANGES, changes done by lead; dev audit finding accepted as R-A1 |
| T-002 | done | 2026-11-14 | reviewer ACCEPT WITH CHANGES, changes done by lead; PR #1 merged, CI green on PR and `main`; Q-17 resolved (repository public); ruleset `main protection` (id 27278504, no bypass); proof: PR #2 with a broken test was BLOCKED and a direct push to `main` was refused; secret scanning, push protection, Dependabot alerts and fork PR approval for all external contributors are on |
| T-003 | done | 2026-11-15 | tests first (test-engineer), core-dev; reviewer REWORK twice: round 1 (one-pass sanitizer, warning paths from unknown keys, merge over 20, deep input throws) fixed by core-dev; round 2 (fixpoint loop quadratic, CPU denial of service) fixed by the lead with a linear stack pass, proven equal to the fixpoint by a 3,000-case fuzz test and a 100,000-character speed test. After round 2 the reviewer checked the lead's fix: ACCEPT (100,000 characters in 7 ms instead of 4 s). Q-19, Q-20 |
| T-004 | done | 2026-11-18 | tests first with a 65-case render corpus produced only by the reference (`packages/core/test-fixtures/render/`, CI `--check`); core-dev; reviewer ACCEPT WITH CHANGES (18,000 random differential cases byte-identical; `pyStrip` equal to Python for all code points), changes done in round 1. D-4, E-1 to E-4 |
| T-005 | done | 2026-11-18 | tests first with a 126-case validate corpus from the reference; core-dev; two tests contradicted the reference and were set to the reference output by the lead (golden rule 3); reviewer ACCEPT WITH CHANGES (every code point of every pattern letter equal to Python `re.I`; 20,000 random cases byte-equal), doc changes and a linear `EMAIL_RE` done by the lead. E-5 to E-7 |
| T-010 | done | 2026-11-15 | tests first, core-dev; reviewer ACCEPT WITH CHANGES (Retry-After cap, managed identity only in production, config docs), done in round 1. Open for T-011: zod for the HTTP response, total deadline per call, `temperature` for reasoning deployments (Q-10). `.env.example` not added: blocked by the owner's permission rules |
| T-011 to T-013 | not started | | W4, W5 |
| T-012 | implemented, eval pending | 2026-11-18 | ADR-001 path: interview prompt 1.1.1 with `# PASTED JOB DESCRIPTION`; JD-01 to JD-05 in `evals/job-descriptions/`; missing eval profiles R-01 to P-01; `evals-data.test.ts`; T-020 checklist Part 5c (ADR § 9); Q-35 to Q-37. Reviewer ACCEPT WITH CHANGES, done in round 1. Closes with the first manual eval run (before/after 1.0.0 vs 1.1.1, W8, Q-12). |
| T-014 | implemented, eval pending | 2026-11-18 | 8 presets, `schemas/preset.schema.json`, merge rule in `docs/03-input-model.md`, eval cases PR-01 to PR-08; reviewer ACCEPT WITH CHANGES, done in round 1. Closes with the W5 baseline (Q-12). Owner: keep "Python or R" and "SQL" as data-analyst tools? |
| R-A2 | accepted | 2026-11-18 | GHSA-fc5q-39xc-vjpf (picomatch, dev-only, no fix); accepted by the product owner |
| T-015 | not planned | | optional; blocked by Q-06 |
| T-020 | desk part done, test open | 2026-11-15 | reviewer ACCEPT WITH CHANGES, changes done by lead (Unicode folding, stricter `#` rule, flow emulation self-check, Check lines, Q-18); research `docs/research/T-020-platform-facts.md`; checklist `docs/checklists/T-020.md`; paste files `pilot/copilot-studio/spike/`; `docs/spikes/T-020.md` recommends A on condition; Q-13 decided: stricter, never weaker |
| T-021 to T-026 | not started | | T-021 and T-026 are HUMAN; T-021 checklist after the T-020 test |

## 8. Next step

1. Product owner: answer the new questions Q-21 to Q-34 from ADR-001 (most need the company's IT). Most urgent: Q-21 (solution owner and publisher), Q-22 (licenses and Copilot Credits), Q-25 (VS Code extension or `pac`, from the T-020 test), Q-27 (company artifacts outside the public repository).
2. Product owner: maker access in the company test environment, then the T-020 hands-on test with `docs/checklists/T-020.md` (W5 adds the new test points from ADR-001 § 9).
3. Product owner: `AGENTS.md` still requires `pnpm eval` (Commands, step 5 of the ticket workflow). Changing it changes the workflow rules: may the lead replace it with the manual eval procedure?
4. Next window: W5 (changed), prompt to be written from ADR-001 § 13 row 1.
5. Small open decisions from W3: `.env.example`, E-4, Q-15 and D-4, data-analyst tools.
6. Every change to `main` needs a pull request with four green checks; nobody can bypass the ruleset.
