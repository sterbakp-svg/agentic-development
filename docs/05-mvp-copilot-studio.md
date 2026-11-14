# Phase 1: pilot agent in Copilot Studio

## Goal

Prove with 5-10 real users that the guided interview plus the generator gives agents that users keep. Learn which questions matter. Spend little: no web app, no database, no billing.

## Components

| Component | Copilot Studio element | Content |
|---|---|---|
| Agent "Agent Composer (pilot)" | Custom agent, generative orchestration | Instructions: `prompts/mvp-interview-agent.instructions.md` (4,615 characters) |
| `GenerateEmailTriageSlots` | Prompt tool | Instructions: `prompts/generator.system.md` + template + examples as fixed text in the prompt; input: `profile_json` (text); output: JSON (generator-output schema) |
| `RenderAndValidate` | Agent flow (Power Automate) called as a tool | Renders the template with string replacement and checks the rules listed below; returns `instructions`, `chars`, `errors[]`, `warnings[]` |
| Pilot feedback | Topic triggered by "feedback" | 3 questions (relevance 1-5, drafts 1-5, free text) stored in a Dataverse table or a SharePoint list |

## Rendering in the agent flow

The agent flow cannot run the TypeScript core. It implements the same rules with expressions:
1. Start from the template body stored as a flow constant (template version in the flow name).
2. For `line_optional` slots that are empty, first remove the full line (for `tools`: replace `- Tools: {{tools}}.` plus the line break with nothing; for `org_rule`: replace `- {{org_rule}}` plus the line break).
3. Replace every `{{slot}}` with its value (`replace()` per slot).
4. Checks in the flow: no `{{` left; `length()` ≤ 8,000; each guardrail line present (`contains()`); slot length limits; forbidden patterns (simple `contains()` checks for "ignore previous", "disregard", line breaks, backticks).
5. Return the result.

Golden test for the pilot: run the flow with the two golden examples (profile + slots) and compare the output with `examples/*/expected-instructions.md`. They must be identical.

## Fallback if the spike fails

If the prompt tool cannot hold the generator prompt with template and examples, or cannot return structured JSON reliably:
- Option B: put the examples in a shortened form (slots only, no rendered text) into the prompt.
- Option C: call an Azure Function (one HTTP endpoint) that runs `packages/core` and holds the model call. This moves the pilot closer to phase 2 and needs an Azure subscription.

## Development workflow with coding agents

- Copilot Studio agents can be cloned to local YAML files, edited, and pushed back with the Copilot Studio extension for Visual Studio Code. Microsoft also publishes a Copilot Studio plugin for Claude Code (`microsoft/skills-for-copilot-studio`) for YAML authoring, push and pull.
- Check the current platform support of the extension before starting. Preview documentation listed Windows x64 only. If the product owner works on macOS, plan a Windows machine or a cloud PC for the push and pull steps.
- Human steps: create the environment, connect the agent to the repository folder (first clone), publish, share with pilot users, and approve connections. The coding agents prepare everything else in the repository: YAML, flow definition, prompt text, test data, pilot guide.

## Pilot plan

| Week | Activity |
|---|---|
| 1 | Spike (T-020), environment and agent shell (T-021) |
| 2 | Interview, prompt tool, flow, golden test (T-022 to T-024) |
| 3 | Internal test with the two golden users; fix |
| 4-5 | Pilot with 5-10 users from at least 4 different roles; collect feedback after 1 week of agent use |
| 6 | Evaluate against exit criteria; decide on phase 2 |

Exit criteria: 8 of 10 pilot users create the agent; average relevance rating ≥ 4; no guardrail failure seen; list of interview changes for phase 2.
