# Progress

State file of the lead. A new session starts from this file alone.

**Last update:** 2026-11-15 · window W6 · **Status: T-020 desk part done (research, test checklist, paste files, spike doc with option A recommended on condition). Waiting for the owner: hands-on test `docs/checklists/T-020.md` (needs H-5) and a yes on Q-13. Next window: W2.**

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
| H-3 | Decide Q-04 and Q-10: Azure subscription, Azure OpenAI deployment in an EU data zone, `AOAI_*` variables set locally | W4, W5 | open |
| H-4 | Approve the eval budget (Q-11) | W5 | open |
| H-5 | Test Power Platform environment; Windows machine or cloud PC if the Copilot Studio extension needs it | W6 (your test steps) | open |
| H-6 | Decide Q-05 and do T-021: pilot tenant, environment, agent shell, first clone | W7 | open |

H-6 has the longest lead time (tenant approval). It is the critical path of phase 1. Start it now.

## 4. Order of work

Approved order of windows: **W1 → W6 → W2 → W3 → W4 → W5 → W7 → W8**. W1 to W5 are phase 0; W6 to W8 are phase 1.

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
| W4 | 4 | T-012 `prompts/extract-profile.system.md` and five test job descriptions | prompt-engineer | step 3 |
| W4 | 5 | T-012 wiring in `packages/core` | core-dev | — |
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
| R-5 | **The pilot flow validates with `contains()` only**, which is weaker than the reference validator (no regular expressions). A weaker check touches the guardrail promise. | See Q-13. The spike T-020 must show which reference checks the flow can express. |
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
| T-003 to T-005 | not started | | |
| T-010 to T-014 | not started | | |
| T-015 | not planned | | optional; blocked by Q-06 |
| T-020 | desk part done, test open | 2026-11-15 | reviewer ACCEPT WITH CHANGES, changes done by lead (Unicode folding, stricter `#` rule, flow emulation self-check, Check lines, Q-18); research `docs/research/T-020-platform-facts.md`; checklist `docs/checklists/T-020.md`; paste files `pilot/copilot-studio/spike/`; `docs/spikes/T-020.md` recommends A on condition; Q-13 proposal "stricter, never weaker" |
| T-021 to T-026 | not started | | T-021 and T-026 are HUMAN; T-021 checklist after the T-020 test |

## 8. Next step

1. Product owner: run `docs/checklists/T-020.md` in a test environment (H-5), fill in the result form, send it with `pilot/copilot-studio/spike/results/`. About 3 to 4 hours.
2. Product owner: answer Q-13 (proposal: the pilot flow may be stricter than the reference, never weaker). Q-18 (computed slots with user text are not checked) goes into the T-003 brief.
3. Lead after the test: finish `docs/spikes/T-020.md` with the results and the final option; tech-writer writes `docs/checklists/T-021.md` for the chosen route (extension or `pac`).
4. Next window, not blocked by the test: W2 (T-003 and T-010), prompt in `docs/agent-team/windows.md`.
5. Every change to `main` needs a pull request with four green checks (`checks`, `audit`, `secret-scan`, `reference`); nobody can bypass the ruleset.
6. Note for the owner: the repository is public, so commit metadata shows the author emails. For new commits, set `git config user.email` to the GitHub noreply address.
7. T-004 brief must point to the placeholder comment in the `reference` job of `.github/workflows/ci.yml`.
