# Work windows

A window is one Claude Code session with a clear scope. Start every window with `/clear`, then set the lead's model and effort, then paste the prompt. The lead reads the state from `docs/PROGRESS.md`, so no context from earlier sessions is needed.

## Rules for every window

1. **Before the start:** check the usage of the 5-hour window. If more than 40% is used, wait for the reset.
2. **New session:** `/clear`, `/model <model>`, `/effort <level>`, then the prompt.
3. **At 85% usage:** tell the lead: "Finish the current step, save the state in docs/PROGRESS.md and stop." After the reset: "Read docs/PROGRESS.md, check on disk what is really done, and continue with the first unfinished step of the current window."
4. **Human steps first:** a window starts only when its human prerequisites are done.
5. **Eval runs cost money:** the lead asks before `pnpm eval` (the settings ask for approval).

## Phase 0 and phase 1

| Window | Tickets | Lead | Workers (model · effort) | Human prerequisites |
|---|---|---|---|---|
| W0 | Plan | Opus · high | none | Repository created, package copied, `CLAUDE.md` symlink |
| W1 | T-001, T-002 | Opus · medium | platform-dev (Sonnet · medium), reviewer (Opus · high) | GitHub repository exists |
| W2 | T-003, T-010 | Opus · medium | test-engineer, core-dev ×2 in parallel (Sonnet · medium), reviewer | none |
| W3 | T-004, T-005, T-014 | Opus · medium | test-engineer, core-dev (T-004 then T-005), prompt-engineer (Opus · high, T-014), reviewer | none |
| W4 | T-011, T-012 | Opus · high | architect (Opus · high, ADR for the pipeline), core-dev, prompt-engineer, test-engineer, reviewer | Azure OpenAI deployment in an EU data zone; `AOAI_*` variables set locally (Q-04) |
| W5 | T-013, baseline evals | Opus · high | test-engineer, prompt-engineer (Opus · high), reviewer | Budget for eval runs approved |
| W6 | T-020 spike | Opus · medium | researcher (Haiku · medium; Sonnet · medium if the docs are unclear), platform-dev | Test Power Platform environment; Windows machine or cloud PC if the Copilot Studio extension needs it |
| W7 | T-022 to T-025 | Opus · medium (Fable · medium if all four in one window) | platform-dev, prompt-engineer (T-023), tech-writer (T-025), test-engineer, reviewer | T-021 done: environment, agent shell, first clone (Q-05) |
| W8 | Reserve: fixes after the internal test | Opus · medium | as needed | Internal test with two users done |

## Phase 2a (outline; prompts follow after the pilot decision)

| Window | Tickets | Workers |
|---|---|---|
| W9 | T-030, T-031 | architect (ADR for auth and data), web-dev, test-engineer, reviewer |
| W10 | T-037, T-038 | platform-dev, reviewer; human runs the first deployment |
| W11 | T-032 | web-dev, tech-writer, test-engineer, reviewer |
| W12 | T-033, T-034 | architect (result page contract), web-dev, core-dev, tech-writer, reviewer |
| W13 | T-035, T-036, T-050 | web-dev, test-engineer, reviewer |
| W14 | T-051 preparation | reviewer (full security pass), tech-writer (checklist for the external test) |

## Prompts

### W0 · Plan
```
/clear
/model opus
/effort high
```
Prompt: the text in `KICKOFF_PROMPT.md`.

### W1 · Scaffold and CI
```
/clear
/model opus
/effort medium
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md and the approved plan. In this window do ONLY tickets T-001 and T-002 from docs/07-backlog.md, using the pipeline in AGENTS.md: platform-dev implements, reviewer checks. Use docs/agent-team/brief-template.md for every brief.
Before you close: check that every acceptance criterion of T-001 and T-002 is met, that python3 -I reference/composer_ref.py still validates both golden examples, and that docs/checklists/T-002.md tells me how to set branch protection. Update docs/PROGRESS.md, show me a one-screen summary and stop. Do not start T-003.
```

### W2 · Profile types and model client
```
/clear
/model opus
/effort medium
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md. In this window do ONLY T-003 and T-010. They do not depend on each other: first test-engineer writes failing tests for both, then two core-dev instances work in parallel in their own worktrees, then reviewer checks each ticket. Maximum 3 agents at the same time.
Before you close: verify the acceptance criteria, merge only tickets with ACCEPT or ACCEPT WITH CHANGES (changes done), update docs/PROGRESS.md, show me a one-screen summary and stop.
```

### W3 · Renderer, validator and presets
```
/clear
/model opus
/effort medium
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md. In this window do ONLY T-004, T-005 and T-014. T-005 starts after T-004 is merged. T-014 (prompt-engineer, Opus high) runs in parallel to T-004.
The renderer and validator must give byte-identical results to reference/composer_ref.py for examples/ and evals/negative/. test-engineer writes these golden tests first. reviewer checks each ticket.
Before you close: run the golden tests yourself, update docs/PROGRESS.md, show me a one-screen summary and stop.
```

### W4 · Generator pipeline and job description extraction
```
/clear
/model opus
/effort high
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md. First check that the AOAI_* environment variables are set; if not, stop and tell me.
In this window do ONLY T-011 and T-012. Step 1: architect writes an ADR for the generator pipeline (request building, structured output, retry with validator errors, stored metadata). Step 2: test-engineer writes failing tests with a mocked model. Step 3: core-dev implements T-011; prompt-engineer writes prompts/extract-profile.system.md and the five test job descriptions for T-012, core-dev wires it. Step 4: reviewer checks both tickets.
Run one real generation for each golden profile and show me the validator reports. Ask me before any eval run. Update docs/PROGRESS.md, show me a one-screen summary and stop.
```

### W5 · Eval harness and baseline
```
/clear
/model opus
/effort high
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md and evals/cases.md. In this window do ONLY T-013: test-engineer builds packages/evals and creates the missing profiles in evals/profiles/; prompt-engineer writes the judge prompt from the rubric and checks it on G-01 and G-02. Then ask me for approval and run the full suite once as the baseline. Save the report in evals/runs/.
If a case is under its threshold, do not change prompts in this window. List the weak cases with the reason in docs/PROGRESS.md as input for the next window. Then reviewer checks T-013. Show me a one-screen summary with the scores per case and stop.
```

### W6 · Pilot spike
```
/clear
/model opus
/effort medium
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md and docs/05-mvp-copilot-studio.md. In this window do ONLY T-020. researcher collects the current facts (prompt tool limits, structured output of prompt tools, agent flow string functions, calling a flow as a tool, platform support of the Copilot Studio extension for Visual Studio Code) with sources. platform-dev prepares the test steps that I must run in the test environment as docs/checklists/T-020.md.
Write docs/spikes/T-020.md with the facts, the open points that need my test, and your recommended option (A, B or C). Update docs/PROGRESS.md, show me a one-screen summary and stop. Do not start pilot development.
```

### W7 · Pilot build
```
/clear
/model opus
/effort medium
```
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md, docs/spikes/T-020.md (including my test results) and docs/05-mvp-copilot-studio.md. Check that T-021 is done and the agent YAML is in pilot/copilot-studio/; if not, stop and tell me.
In this window do T-022, T-023, T-024 and T-025 with the option chosen in the spike. platform-dev builds the interview agent and the agent flow; prompt-engineer builds the prompt tool content; tech-writer writes the pilot guide; test-engineer writes the golden pilot tests; reviewer checks each ticket. Maximum 3 agents at the same time.
Write docs/checklists/T-024.md for the steps I must do (push, publish, connections). Update docs/PROGRESS.md, show me a one-screen summary and stop.
```

### W8 · Reserve
```text
You are the lead per AGENTS.md. Read docs/PROGRESS.md and the notes from the internal pilot test. Fix only the issues listed there, through the normal pipeline. Update docs/PROGRESS.md, show me a one-screen summary and stop.
```
