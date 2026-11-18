# T-020 Platform facts: Copilot Studio prompt tools, agent flows, VS Code extension, pac CLI

Research date: 2026-11-15. Scope: facts only. No option (A, B or C) is chosen here.
Date format: `ms.date` / `updated_at` from the Learn page header. "no date shown" where the page has none.

## Unclear

What I could not find, or where sources disagree:

1. **Prompt tool limits.** No page gives a maximum length for prompt instructions, a maximum output token count, or a limit on the number or size of inputs.
2. **Prompt tool JSON output.** JSON output (with or without a schema) is documented for the agent flow prompt node only. Not documented for prompt tools in an agent: schema format, validation, nested objects, string arrays, and how the agent receives the result.
3. **Agent flow output types.** Input types are listed (Number, String, Boolean). Output types from "Respond to the agent" are not stated. Array outputs are not confirmed.
4. **Flow response timeout.** Three values: 100 seconds (flow-agent page), two minutes (express mode preview page), 120 seconds (Power Automate limits page, from a secondary reading). Which one applies to a Copilot Studio agent flow tool is not settled.
5. **`length()` unit.** Not stated whether it counts UTF-16 code units or characters.
6. **Line breaks in expressions.** No documented method. `decodeUriComponent` exists. Use of `'%0A'` is not documented.
7. **Regex functions.** None found in the function reference (I read about the first half of the page). Full read not confirmed.
8. **Developer environment capacity.** Quota row exists ("Trial or developer environments": 10 RPM / 200 RPH). What a developer environment includes for Copilot Studio is not documented.
9. **Power Automate license for agent flows.** Not stated whether an agent flow also needs a Power Automate license beyond Copilot Credits.
10. **macOS arm64.** The VS Code extension install page lists "macOS" without an architecture. Windows is listed as "x64 architecture". Apple silicon support is not confirmed.
11. **Windows 365 Cloud PC and Dev Box.** No Microsoft page found that covers the extension on these.
12. **Solution export of agents.** Agent flows are said to be included in solutions. Prompt tools and agents as solution components are not explicitly confirmed.
13. **Agent instruction length.** Community sources say 8,000 characters. Not confirmed on Microsoft Learn. A separate 2,000-character limit exists for prompt modification in generative answers (search snippet only, page not opened).
14. **Harness.** Several pages say the prompt node is not available in workflows of the Microsoft Copilot harness. The pilot design assumes the standard harness. Check the agent type in the environment.
15. **Test panel billing.** One page says prompts in topics or actions run from the agent test panel are free. Another page says prompts in agent flows always consume credits, also in test. Which applies to a prompt tool called by generative orchestration in the test chat is not clear.
16. **Basic tier unit.** Message management page (2026-06-16) says "per 1K tokens, or 1K characters". Billing page (2026-10-30) says "per 1,000 tokens". Conflict.
17. **Default model.** An older AI Builder page says GPT 3.5 (May 2024). The current page says GPT-4.1 mini. I use the current page.
18. **Reported bug.** A Microsoft Q&A thread (Feb 2026) says "Add Output" was disabled in the Copilot Studio prompt tool. Not verified as fixed.

## Key findings

- Prompt tools in an agent consume Copilot Credits. The default model is GPT-4.1 mini (basic rate), with a per-call context window of 128K tokens. No instruction character cap is documented. [S1, S5, S6]
- No documented JSON schema format or validation for prompt tools. JSON output with or without a schema is documented only for the agent flow prompt node (Text, JSON, Document). [S2]
- An agent flow tool must have the "When an agent calls the flow" trigger and a "Respond to the agent" action, be published, and have the asynchronous response toggle off. Input types are limited to Number, String and Boolean. [S12, S13]
- Timeout conflict: the flow-agent page says the flow must respond within 100 seconds (updated 2026-11-04). The express mode preview page says two minutes by default (2026-05-28). [S12, S11]
- The expression reference lists the string functions needed (replace, length, contains, indexOf, nthIndexOf, split, trim, toLower, toUpper, slice, substring). `contains` is case-sensitive. No regex function appears in the part I read. `length()` unit is not stated. [S9]
- The VS Code extension is GA (blog dated 2026-01-14). The install page lists macOS, but for Windows it says "x64 architecture". Apple silicon is not stated. [S18, S15]
- A Claude Code plugin exists at `microsoft/skills-for-copilot-studio` (MIT). It needs the VS Code extension for push, pull and clone. `pac` runs on macOS via the .NET tool. `pac data` and `pac package deploy/show` are Windows only. [S19, S20]

## Fact table

Status key: **C** = confirmed by docs. **U** = unclear in docs. **T** = needs hands-on test.

| ID | Q | Statement | Value | Source | Date | Confidence / status |
|---|---|---|---|---|---|---|
| 1.1 | Q1 | Default prompt model | GPT-4.1 mini, basic rate, context up to 128K tokens | S1 | ms.date 2026-08-04; updated 2026-09-17 | high, C |
| 1.2 | Q1 | Selectable models | GPT-4.1 mini, GPT-4.1, GPT-5 chat, GPT-5 reasoning, GPT-5.2 reasoning, GPT-5.3 chat, Claude Sonnet 4.6, Claude Opus 4.6, Grok 4.1 Fast (Non-reasoning). Anthropic and Grok are external models. Model list is "periodically updated". | S1 | as 1.1 | high, C |
| 1.3 | Q1 | Where the limit applies | Context window is per model call, in tokens, enforced by the model provider. Per-turn total can exceed one window. | S1 | as 1.1 | high, C |
| 1.4 | Q1 | Message and tool response content | "Limited by the selected model's context window". Connector payload 5 MB (public cloud). | S5 | ms.date 2026-10-27; updated 2026-11-13 | high, C |
| 1.5 | Q1 | Prompt instruction length cap | NOT DOCUMENTED. Page says long instructions "can lead to latency, timeouts, or issues handling the prompt." | S2, S3 | S2 ms.date 2026-06-25; updated 2026-11-12 | high that no cap is listed, U |
| 1.6 | Q1 | Output token limit for prompt tools | NOT DOCUMENTED | S1, S2, S4 | as above | high that none is listed, U |
| 1.7 | Q1 | Input count or size for prompt tools | NOT DOCUMENTED | S3, S4 | S3 ms.date 2026-09-11; S4 ms.date 2026-10-16 | high that none is listed, U |
| 1.8 | Q1 | Characters or tokens | Model context window is in tokens. No character cap found for prompt tools. | S1, S5 | as above | high, C |
| 1.9 | Q1 | Token-to-character ratio in a Microsoft example | Example: "4,200 tokens (about 16,000 characters)" for prompt input plus output (including system prompt). Ratio about 3.8 characters per token. Illustrative only. | S6 (billing examples) | ms.date 2026-10-30; updated 2026-11-12 | medium, C (illustrative) |
| 1.10 | Q1 | Instruction cap in agent instructions (not prompt tool) | 8,000 characters per community sources (S25). 2,000 characters for prompt modification in generative answers (search snippet, S23). Neither confirmed on a Learn page. | S23 (snippet), S25 (community) | none shown | low, U |
| 1.11 | Q1 | Default model in an older AI Builder page | AI Builder page says GPT 3.5 as of May 2024. Superseded by S1. | S26 | older page, date not read | low, U |
| 2.1 | Q2 | Output types in agent flow prompt node | Text (single string), JSON (structured object with named fields, "with or without specifying a schema"), Document (Word file). | S2 | ms.date 2026-06-25; updated 2026-11-12 | high, C for the agent flow node |
| 2.2 | Q2 | JSON output for prompt tools in an agent | NOT DOCUMENTED. S3 and S4 list no output options. | S3, S4 | as above | high that it is not listed, U |
| 2.3 | Q2 | JSON validation | NOT DOCUMENTED | S2, S3, S4 | as above | high that it is not listed, U |
| 2.4 | Q2 | Nested objects and string arrays | NOT DOCUMENTED | S2, S3, S4 | as above | high that it is not listed, U |
| 2.5 | Q2 | How the agent gets prompt output | Prompt result in an agent is read from the custom variable `Output.predictionOutput.text`. Typed record: not documented. | S1 | as 1.1 | medium, U for JSON |
| 2.6 | Q2 | Reported issue | "Add Output" disabled in Copilot Studio prompt tool, Feb 2026. No resolution found. | S22 (snippet only) | Feb 2026 (thread) | low, U |
| 2.7 | Q2 | Output size into an agent | "An agent can only receive up to 1 MB of data from a workflow in a single action." | S13 | ms.date 2026-07-20; updated 2026-07-27 | high, C |
| 3.1 | Q3 | Which currency a prompt uses in an agent | Copilot Credits. AI Builder credits are not used in Copilot Studio. | S1, S7 | S1 as above; S7 ms.date 2026-06-16; updated 2026-06-15 | high, C |
| 3.2 | Q3 | Rate, basic text and generative tools | 0.1 Copilot Credit per 1,000 tokens (billing page: shown as "1 Copilot Credit per 10 responses"). Message page also says "or 1K characters". | S6, S7 | as above | high for tokens; conflict on characters, U |
| 3.3 | Q3 | Rate, standard tier | 1.5 Copilot Credits per 1,000 tokens (billing page: "15 Copilot Credits per 10 responses") | S6, S7 | as above | high, C |
| 3.4 | Q3 | Rate, premium tier | 10 Copilot Credits per 1,000 tokens | S6, S7 | as above | high, C |
| 3.5 | Q3 | Tier of GPT-4.1 mini (default) | "Basic rate" | S1 | as 1.1 | high, C |
| 3.6 | Q3 | Arithmetic for one call (for planning only) | Cost = billed tokens / 1,000 x rate. Example: 12,000 billed tokens at basic rate = 1.2 credits per call. Token count is the brief estimate, not measured. | derived from 3.2 and 3.5 | as above | medium, T for token count |
| 3.7 | Q3 | Free testing | Testing a prompt in prompt builder is free. Prompts in topics or actions from the agent test panel are free. Prompts in agent flows always consume credits, also in test. | S7, S1 | as above | medium, U (see Unclear 15) |
| 3.8 | Q3 | Trial environment | Trial lets you create agents and test them in the test chat. You cannot publish. | S8 | ms.date 2026-10-27; updated 2026-10-27 | high, C |
| 3.9 | Q3 | Quota for trial or developer environments | 10 RPM / 200 RPH for generative AI messages (includes AI tools and agent flow actions). Pay-as-you-go and paid packs: 100 RPM / 2,000 RPH. | S5 | ms.date 2026-10-27; updated 2026-11-13 | high, C |
| 3.10 | Q3 | Developer environment content | NOT DOCUMENTED beyond the quota row | S5, S8 | as above | high that not listed, U |
| 4.1 | Q4 | String function list | replace, length, contains, indexOf, lastIndexOf, nthIndexOf, split, trim, toLower, toUpper, slice, substring, startsWith, endsWith, concat, decodeUriComponent, encodeUriComponent. Works in Power Automate and Logic Apps. | S9 | ms.date 2026-07-21; updated 2026-10-14 | high, C |
| 4.2 | Q4 | `contains` | Case-sensitive. Works on strings, arrays and dictionaries. | S9 | as 4.1 | high, C |
| 4.3 | Q4 | `endsWith` | Not case-sensitive. (`startsWith` case behavior not read.) | S9 | as 4.1 | high, C; startsWith U |
| 4.4 | Q4 | `replace`, `split`, `trim`, `nthIndexOf`, `slice`, `substring` | One-line descriptions only: replace a substring; split by delimiter into array; remove leading and trailing whitespace; position of nth occurrence; slice and substring by position. | S9 | as 4.1 | medium, C (summary only) |
| 4.5 | Q4 | Regex or match function | None in the function list read. Read covered about the first half of the page. | S9 | as 4.1 | medium, U |
| 4.6 | Q4 | `length()` unit | "Return the number of items in a string or array." UTF-16 vs characters NOT DOCUMENTED. | S9 | as 4.1 | high that unit is not stated, T |
| 4.7 | Q4 | Line break handling | NOT DOCUMENTED. `decodeUriComponent` is documented ("replaces escape characters with decoded versions"). | S9 | as 4.1 | high that method not stated, T |
| 4.8 | Q4 | Expression length | 8,192 characters per expression. | S10 (summary of page) | ms.date 2026-11-10; updated 2026-11-11 | medium, re-check on page |
| 4.9 | Q4 | Expression evaluation size | 131,072 characters for `concat()`, `base64()`, `string()`. `concat` result also max 104,857,600 characters. | S10, S9 | as above | medium, re-check |
| 4.10 | Q4 | Actions per flow | 500 (summary). Express mode: 100 actions per flow run. | S10 (summary), S11 | S11 ms.date 2026-05-28; updated 2026-10-15 | medium (500); high (express 100) |
| 4.11 | Q4 | Variables per flow | 250 (summary) | S10 (summary) | as 4.8 | medium, re-check |
| 4.12 | Q4 | Variable content in express mode | 1,024 characters per variable (Set variable, Append to string, Initialize variable) | S11 | as 4.10 | high, C (only in express mode) |
| 4.13 | Q4 | Message size | 64 KB per connector response in express mode. 100 MB message size (summary of S10). | S11, S10 | as above | high (express), medium (100 MB) |
| 4.14 | Q4 | Variable size in standard flows | NOT FOUND on read pages | S10, S11 | none | U |
| 5.1 | Q5 | How a flow becomes a tool | Add from Tools > Add a tool > Flow. Needs "When an agent calls the flow" trigger and "Respond to the agent" action. Published. Asynchronous response toggle Off. Respond within the 100-second limit. | S12 | ms.date 2026-06-18; updated 2026-11-04 | high, C |
| 5.2 | Q5 | Timeout | 100 seconds (S12). Express mode page: "two minutes" by default (preview, 2026-05-28). Power Automate limits page (summary): 120 seconds for inbound request. | S12, S11, S10 | as above | conflict, T |
| 5.3 | Q5 | Input types | Number, String, Boolean only. No other input type is listed on the page. | S13 | ms.date 2026-07-20; updated 2026-07-27 | high, C |
| 5.4 | Q5 | Input fill | "Dynamically fill with AI" (default) or "Custom value" (fixed value, variable or Power Fx) | S13 | as 5.3 | high, C |
| 5.5 | Q5 | Output | Output parameters come from "Respond to agent". Types not stated. | S13 | as 5.3 | high that types not stated, U |
| 5.6 | Q5 | Response behavior | Default "Don't respond": agent uses tool output in its reply. "Send specific response" can use output variables. | S13 | as 5.3 | high, C |
| 5.7 | Q5 | Billing per agent-run flow | Orchestrated run: one "Autonomous action" (5 Copilot Credits) plus agent flow actions. Agent flow actions: 13 Copilot Credits per 100 actions. | S14, S6 | S14 ms.date 2026-11-03; updated 2026-11-12. S6 as 3.1 | high, C |
| 5.8 | Q5 | Test runs | Test runs in flow designer and agent test chat do not consume flow action capacity. | S14, S6 | as above | high, C |
| 5.9 | Q5 | Copilot Credit exemption | Agent flows with "When an agent calls the flow" trigger are included at no charge when the user has a Microsoft 365 Copilot license. Only for runs triggered that way. | S6 | as 3.1 | high, C |
| 5.10 | Q5 | Power Automate license for agent flows | NOT DOCUMENTED. Power Automate cloud flows use Power Automate licensing and are separate. | S6, S14 | as above | high that not stated, U |
| 5.11 | Q5 | Agent flow enforcement | When no Copilot Credits are available, new agent flow runs are blocked. Agent continues for non-flow answers. | S6 | as 3.1 | high, C |
| 5.12 | Q5 | Express mode | Preview. Needs "Respond to agent". Needs Copilot Studio plan. Only on upgraded environments. Delay and webhook actions not supported. Test in designer does not work with express mode. | S11 | ms.date 2026-05-28; updated 2026-10-15 | high, C (preview) |
| 6.1 | Q6 | Extension status | Generally available. Blog dated January 14, 2026. Overview page says GA with regular releases. | S16, S18 | S16 ms.date 2026-07-24; updated 2026-10-15. S18 2026-01-14 | high, C |
| 6.2 | Q6 | Operating systems | Windows (x64 architecture), Windows 10 1809 or later, Windows 11 (any version); macOS (architecture not stated). | S15 | ms.date 2026-07-24; updated 2026-10-15 | high for the list; arm64 U |
| 6.3 | Q6 | VS Code version | 1.80 or later (latest stable recommended) | S15 | as 6.2 | high, C |
| 6.4 | Q6 | Account requirements | Copilot Studio license or access; environment access; read and write on the agents. | S15 | as 6.2 | high, C |
| 6.5 | Q6 | Capabilities | Clone agent definition; edit components (topics, tools, triggers, settings, knowledge references); review and compare cloud vs local; sync (apply) to cloud; Git integration. | S16, S18 | S16 as 6.1 | high, C |
| 6.6 | Q6 | Tools and flows in the extension | Tools include Prompts and Workflows (Power Automate flows). Workflows sit in `workflows/` with `metadata.yaml` and `workflow.json`. | S17 | ms.date 2026-01-13; updated 2026-10-15 | medium, C for listing; push of a prompt tool needs T |
| 6.7 | Q6 | Older "preview, Windows x64 only" text | Found in search snippet of an older "Edit agents in VS Code (preview)" page. Not opened. Superseded by S15 and S16. | snippet | none shown | low, C (superseded) |
| 6.8 | Q6 | Claude Code plugin | `microsoft/skills-for-copilot-studio`. Plugin for Claude Code, GitHub Copilot CLI and VS Code. For STANDARD agents (YAML). | S19 | no date shown | high for purpose, medium |
| 6.9 | Q6 | Plugin prerequisites | Claude Code, GitHub Copilot CLI or VS Code. Node.js 18 or later. VS Code with the Copilot Studio extension is required for push, pull and clone. OS not stated. Python not listed (repo has requirements.txt). | S19 | no date shown | high, C |
| 6.10 | Q6 | Plugin license | MIT | S19 | no date shown | high, C |
| 6.11 | Q6 | Plugin install | `/plugin marketplace add microsoft/skills-for-copilot-studio` then `/plugin install copilot-studio@skills-for-copilot-studio`. Or local clone with `claude --plugin-dir`. | S19 | no date shown | high, C |
| 6.12 | Q6 | Plugin maturity | "292 Commits" shown. No latest-commit date. | S19 | no date shown | medium |
| 7.1 | Q7 | Windows on Arm VM on Apple silicon | Not listed. The install page requires "Windows (x64 architecture)". | S15 | as 6.2 | medium, C (by absence); T |
| 7.2 | Q7 | Windows 365 Cloud PC or Dev Box | NOT FOUND in Microsoft docs for the extension. Would need x64 Windows. | none | none | U, T |
| 7.3 | Q7 | pac on macOS | Install via VS Code extension, or .NET tool. Both listed for Windows, Linux and macOS. Apple silicon not stated. | S20 | ms.date 2026-08-04; updated 2026-08-06 | high for macOS, U for arm64; T |
| 7.4 | Q7 | pac commands Windows only | `pac data`, `pac package deploy`, `pac package show` | S20 | as 7.3 | high, C |
| 7.5 | Q7 | pac solution commands | export, import, pack, unpack, clone and sync are listed. No OS limit in the reference. YAML source control format needs pac 2.4.1 or later. | S21 | ms.date 2026-10-25; updated 2026-04-02 | high for list; medium for "no OS limit" |
| 7.6 | Q7 | Agents in solutions | Agent flows are part of solutions. Import of agents is supported (knowledge sources not processed on import). Prompt tools in solutions: NOT CONFIRMED. | S14, S5 | as above | medium, U; T |
| 7.7 | Q7 | Solution route vs VS Code route | Solution route: pac on macOS. VS Code route: needs x64 Windows per S15 unless arm64 macOS is confirmed. | S15, S20, S21 | as above | medium; T |

## Changes against our configuration

Marked CHANGED where a current source differs from `docs/05-mvp-copilot-studio.md` or the brief. Nothing in `templates/` was read or changed.

- **CHANGED. Platform support for the extension.** `docs/05-mvp-copilot-studio.md` line 36 says: "Preview documentation listed Windows x64 only. If the product owner works on macOS, plan a Windows machine or a cloud PC." Current pages (S15, S16) list macOS as a supported OS and say the extension is GA. Apple silicon is still not stated. Windows x64 is still required for the Windows side.
- **CHANGED. Status of the extension.** `docs/05` calls the extension a preview. Current overview page (S16, ms.date 2026-07-24) says GA. Blog (S18) dates GA to 2026-01-14.
- **CHANGED. Flow timeout.** The brief does not give one; `docs/05` does not mention it. Sources disagree (100 s vs two minutes). Design should plan for the lower value until tested.
- **CHANGED. Forbidden-pattern checks.** `docs/05` line 22 plans `contains()` checks for "ignore previous", "disregard", line breaks and backticks, and says `send`/`forward`/`delete`/`move` need word-boundary checks. `contains()` is case-sensitive (S9), so text must be lowercased (`toLower`) first. No regex function is documented, so word-boundary checks cannot be done with `contains()` alone. The reference validator behavior must be reproduced differently or moved to a service (Option C). This is a consequence, not a platform value.
- **CHANGED. Flow output types.** `docs/05` line 13 says the flow returns `instructions`, `chars`, `errors[]` and `warnings[]`. Output types from "Respond to the agent" are not stated (S13). Arrays are not confirmed. Mark as assumption until tested.
- **CHANGED. Naming.** The brief and `docs/05` say "prompt tool (formerly AI Builder prompts / prompt actions)". Current Learn name: "Prompt" tool, added under Tools > Add a tool > Prompt (S4). In agent flows the node is "Run a prompt" (S3).
- **CHANGED. Credits unit.** Message page (S7) says tokens or characters. Billing page (S6) says tokens only. Pilot cost estimates should use tokens.
- **NOT A PLATFORM VALUE. 8,000 characters.** `docs/05` line 22 uses 8,000 for `length()`. No Microsoft page confirms 8,000 as a Copilot Studio or flow limit. It is our configuration. Golden rule 5 says read it from `templates/<id>/<version>/template.json`.
- **NOT CONFIRMED. Agent instructions 5,785 characters (interview prompt 1.1.1 pasted from `# ROLE` on, `docs/05` line 11).** Fits under the 8,000 that community sources quote. No Learn page confirms an instruction cap.
- **BRIEF ESTIMATE, NOT A SOURCE.** Brief estimates 44,300 characters is about 11,000 to 12,000 tokens. S6 gives an illustrative ratio of about 3.8 characters per token (4,200 tokens for about 16,000 characters). Ratio is illustrative. Token count must be measured in the prompt tool test.

## Facts that decide option A, B or C

- Prompt tool instruction size: no documented cap. The only documented limit is the model context window (128K tokens for the default model). Option A (about 44,300 characters) must be tested in the prompt tool itself.
- Prompt tool JSON output (19 slots, nested or arrays): not documented for prompt tools. Only tested behavior will show whether the agent gets a usable structured result. The agent flow prompt node documents JSON, but that is a different component.
- Flow inputs are limited to Number, String and Boolean. The flow input must therefore be one string (`profile_json`). Output types are not documented, so array outputs (`errors[]`, `warnings[]`) need a test.
- Regex is not available in the documented expression functions. Word-boundary checks, and any check that depends on case-insensitive regex, need a different implementation or Option C.
- Flow timeout is 100 seconds or two minutes (sources conflict). Time for the flow part must stay below the lower value. The prompt tool's own latency is not covered by the flow limit. A 5-minute model-streaming timeout applies to web and Teams chat responses but not to tool execution (S5).
- Cost scales with prompt size: billed tokens = input (including instructions) plus output, at 0.1 credit per 1,000 tokens (basic tier, GPT-4.1 mini). Option A and B differ in size; the difference is proportional.
- Mac development path: the VS Code extension documents Windows x64 and macOS without arm64. Apple silicon support, and Windows-on-Arm VMs, are not documented. Choose the solution (pac) route or a Windows x64 machine only after a test on the Mac.
- `length()` unit and line-break handling: not documented. Length checks for Unicode text (Slovak diacritics, emoji) need a test against the reference validator.

## Sources

S1. Change the model version and settings: https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-model-settings (ms.date 2026-08-04; updated 2026-09-17)
S2. Add a prompt node to an agent flow: https://learn.microsoft.com/en-us/microsoft-copilot-studio/prompt-node-workflow (ms.date 2026-06-25; updated 2026-11-12)
S3. Use prompts to make your agent or agent flow perform specific tasks: https://learn.microsoft.com/en-us/microsoft-copilot-studio/nlu-prompt-node (ms.date 2026-09-11; updated 2026-09-13)
S4. Create a prompt: https://learn.microsoft.com/en-us/microsoft-copilot-studio/create-custom-prompt (ms.date 2026-10-16; updated 2026-10-21)
S5. Quotas and limits: https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-quotas (ms.date 2026-10-27; updated 2026-11-13)
S6. Billing rates and management: https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-messages-management (ms.date 2026-10-30; updated 2026-11-12)
S7. Licensing and Copilot Credits (AI Builder): https://learn.microsoft.com/en-us/ai-builder/message-management (ms.date 2026-06-16; updated 2026-06-15)
S8. Get access to Copilot Studio: https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing-subscriptions (ms.date 2026-10-27; updated 2026-10-27)
S9. Workflow definition language functions reference (Logic Apps and Power Automate expressions): https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-functions-reference (ms.date 2026-07-21; updated 2026-10-14). Full list also at https://learn.microsoft.com/en-us/azure/logic-apps/expression-functions-reference
S10. Limits of automated, scheduled, and instant flows (Power Automate): https://learn.microsoft.com/en-us/power-automate/limits-and-config (ms.date 2026-11-10; updated 2026-11-11). Values read through a secondary summary; re-check on the page.
S11. Speed up agent flow execution with express mode (preview): https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-flow-express-mode (ms.date 2026-05-28; updated 2026-10-15)
S12. Add an agent flow as a tool to an agent: https://learn.microsoft.com/en-us/microsoft-copilot-studio/flow-agent (ms.date 2026-06-18; updated 2026-11-04)
S13. Add Copilot Studio workflows as tools to agents (training): https://learn.microsoft.com/en-us/training/modules/copilot-studio-structured-automation/5-add-workflow-tools-agents (ms.date 2026-07-20; updated 2026-07-27)
S14. Agent flows overview: https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-overview (ms.date 2026-11-03; updated 2026-11-12)
S15. Install the Copilot Studio extension for Visual Studio Code: https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-install-configure (ms.date 2026-07-24; updated 2026-10-15)
S16. Overview of the Copilot Studio extension for Visual Studio Code: https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-overview (ms.date 2026-07-24; updated 2026-10-15)
S17. Edit your Copilot Studio agent in Visual Studio Code: https://learn.microsoft.com/en-us/microsoft-copilot-studio/visual-studio-code-extension-edit-agent-components (ms.date 2026-01-13; updated 2026-10-15)
S18. Copilot Studio extension for VS Code is now generally available (Microsoft 365 Developer Blog): https://devblogs.microsoft.com/microsoft365dev/copilot-studio-extension-for-visual-studio-code-is-now-generally-available/ (dated January 14, 2026)
S19. microsoft/skills-for-copilot-studio: https://github.com/microsoft/skills-for-copilot-studio (no date shown)
S20. Install and configure Power Platform CLI: https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction (ms.date 2026-08-04; updated 2026-08-06)
S21. pac solution command group: https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/solution (ms.date 2026-10-25; updated 2026-04-02)
S22. Microsoft Q&A thread "Add output is disabled in Copilot Studio's prompt tool" (Feb 2026): https://learn.microsoft.com/en-us/answers/questions/5768461/add-output-is-disabled-in-copilot-studios-prompt-t (search snippet only, not opened)
S23. Prompt modification for generative answers (2,000 characters): https://learn.microsoft.com/en-us/microsoft-copilot-studio/nlu-generative-answers-prompt-modification (search snippet only, not opened)
S24. Visual Studio Magazine, "Copilot Studio extension for VS Code goes GA" (2026-01-22): https://visualstudiomagazine.com/articles/2026/01/22/copilot-studio-extension-for-vs-code-goes-ga.aspx (search snippet only, not opened)
S25. Agent instruction limit of 8,000 characters: community sources only. No Learn page found. Listed for transparency only.
S26. AI Builder prompt model settings (older page, GPT 3.5 default, May 2024): https://learn.microsoft.com/en-us/ai-builder/prompt-modelsettings (not fetched in full; superseded by S1)

Notes on sources:
- S10 values (8,192 expression characters, 131,072 evaluation, 250 variables, 500 actions, 120 seconds) came through a summarized read of a long page. Check each on the page before using it in a design or a test pass criterion.
- S22, S23, S24 and S25 were not opened. They are listed only where a claim relies on a search snippet or community source.
