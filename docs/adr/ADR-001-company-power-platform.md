# ADR-001: Delivery to one company's Power Platform

- Status: **Accepted, 2026-11-18** (decision of the product owner)
- Deciders: product owner. Written by: architect.
- Affects: `docs/02-architecture.md`, `docs/05-mvp-copilot-studio.md`, `docs/06-security-privacy.md`, `docs/07-backlog.md`, `docs/agent-team/windows.md`, `docs/08-open-questions.md`, `evals/cases.md`, `AGENTS.md` (commands and step 5), README § Configuration.

## 1. Context

- The plan so far: phase 0 TypeScript core with real model calls through our own Azure OpenAI (T-010, T-011, T-013), a short pilot in Copilot Studio (phase 1), then a multi-tenant SaaS on Azure (phase 2).
- The first target is now **one company**, for testing first. The company already has a Power Platform **test** and a **production** environment and uses Microsoft 365 Copilot and Copilot Studio. It has **no** Azure OpenAI or Foundry API that we can call.
- The company's IT deploys. We hand over artifacts and checklists.
- W4 (T-011, T-012) and W5 (T-013) are blocked by H-3 (Azure OpenAI) and H-4 (eval budget). Phase 0 cannot close on the old plan without a paid Azure resource.
- The phase 1 design (`docs/05-mvp-copilot-studio.md`, `docs/02-architecture.md` § 2 last paragraph) already runs the whole generation inside Copilot Studio: interview agent, prompt tool, render-and-validate agent flow. The T-020 desk part (`docs/spikes/T-020.md`) shows that every guardrail check can be built in the flow exactly or stricter (Q-13).

## 2. Decision

1. **Product path = Copilot Studio in the company tenant.** The product for now is a Power Platform solution that the company runs. No own Azure subscription, no own Azure OpenAI, not for development and not for evals (option B of the product owner).
2. **Model calls happen only inside Copilot Studio** (the prompt tool `GenerateEmailTriageSlots`). Nothing in the repository calls a model.
3. **Evals are run by hand** in the company test environment, with a written procedure and a result form. A human scores with the existing rubric.
4. **Q-04 is decided:** the separate environments are the company's Power Platform test and production environments. **Q-10 is decided as a requirement:** the company environment must be in an EU region, and the prompt tool model must process data in the EU (checked, not assumed; see § 6 and proposal P-6).
5. `packages/core` is the **reference and test oracle**, not a deployed service.
6. The SaaS architecture (`docs/02-architecture.md` § 3 to § 4) is **deferred**, not deleted.

## 3. Delivery

### 3.1 What is delivered

One Power Platform solution, built in the company test environment, moved to production by the company's IT.

| Component | Type | Notes |
|---|---|---|
| Agent "Agent Composer" | Copilot Studio custom agent, generative orchestration | Instructions from `prompts/mvp-interview-agent.instructions.md`. Sign-in only, no other Graph scope. No email knowledge source. |
| `GenerateEmailTriageSlots` | Prompt tool | Text from `prompts/generator.system.md` + template + examples (spike option A or B). Inputs: `profile_json` (text), `retry_errors` (text, empty on the first call). Output: JSON per `schemas/generator-output.schema.json`. |
| `RenderAndValidate` | Agent flow, called as a tool | As in `docs/05-mvp-copilot-studio.md`. Uses no connector. Template body, slot names and limits are flow constants generated from `templates/email-triage/v1/` by `pilot/copilot-studio/spike/build.mjs` (golden rule 5). |
| Feedback store | Dataverse table in the solution (proposal P-8) | 3 answers per user; no email content. |
| Retry | Agent orchestration (topic) | Prompt tool, then flow. On errors: one more prompt tool call with `retry_errors`, then flow again. After the second failure the agent says the result is not ready and shows no instructions (FR-5, NFR-3). |

### 3.2 Environments and transport

- **Test environment:** the solution is built here as an **unmanaged** solution with a company publisher (never in the Default solution). Internal tests and manual evals run here.
- **Production environment:** the company's IT imports a **managed** solution exported from test. Pilot users use production only (proposal P-10).
- **Transport:** solution export and import. Manual export and import, or Power Platform pipelines if the company uses them (proposal P-3). Our repository and our CI never connect to the company tenant and hold no company credentials.
- **Environment-specific values** go into environment variables and connection references, which IT sets on import (proposal P-4). Template limits are **not** environment variables: they belong to the template version and are the same in both environments.

### 3.3 What the repository holds and what is built by hand

| In the repository (source of truth) | Built by hand in the UI (checklists in `docs/checklists/`) |
|---|---|
| Agent YAML (clone through the VS Code extension, or unpacked solution through `pac`; open until the T-020 test) | Solution and publisher in the test environment |
| Flow definition (exported, unpacked) | Agent shell and first clone (T-021) |
| Prompt text (`prompts/`, generated paste files) | Prompt tool: paste text, define inputs and output, if the solution or YAML cannot carry it (unconfirmed, T-020) |
| Flow constants generated from `templates/` | Flow build, if the definition cannot be imported |
| Golden test data (`examples/`, `evals/`), manual eval results (`evals/runs/`) | Connections, environment variables, publish, sharing, channel |
| Checklists for the T-020 test, T-021, T-024, handover and import | Settings for run history and transcripts (§ 6), security role for the feedback table |

The public repository must not hold company-specific data (company name, environment URLs, user names). Where the exported solution carries them, see proposal P-7.

## 4. Role of `packages/core`

- **Test oracle for the flow.** The flow output for the golden profiles must be byte-identical to `examples/*/expected-instructions.md`; the injection case must fail with the reference errors or stricter (Q-13). Golden rule 3 still holds: the reference decides; core matches the reference.
- **Checker for manual eval outputs.** The raw prompt tool JSON saved from each manual eval run is validated in the repository with the core validator and the reference. The result must agree with the flow result for that run, or the flow is stricter. This gives parity evidence on real model output, without any model call from the repository.
- **Input builder.** Core prepares the `profile_json` that the human pastes for eval cases (profile normalization, preset merge per `schemas/preset.schema.json`).
- **Profile rules.** The forbidden-content checks for computed slots with user text (Q-18) are specified by core and rebuilt in the flow.
- **Model client (T-010) stays in the repository, unused in this path.** README § Configuration applies only to the deferred SaaS path. Its unit tests keep running in CI; the integration test stays skipped (no `AOAI_ENDPOINT`).

## 5. Consequences per ticket

No ticket is cancelled as a whole. Cancelled are parts: W4, the LLM judge and `pnpm eval` runner of T-013, real-model runs of T-010, and spike option C (Azure Function).

| Group | Tickets | Status | What changes |
|---|---|---|---|
| Done, kept | T-001 to T-005, T-010 | unchanged | T-010 stays, unused in this path. |
| Generator in TypeScript | T-011 | **deferred** (SaaS) | Its job (build request, call, validate, retry once) moves into T-023 and T-024: prompt tool plus flow plus retry topic. |
| Extraction | T-012 | **changed** | No separate prompt tool for now: the interview agent already extracts from a pasted job description. Keep the AC: 5 test job descriptions, run by hand through the agent in the test environment, scored in the manual eval form. A separate `prompts/extract-profile.system.md` only if the evals show weak extraction. |
| Evals | T-013 | **changed** | Manual eval procedure plus result form (contract in § 8). Deterministic part: flow result plus repository validation of the saved outputs (100% must pass). Quality part: a **human scores with the same rubric** (`evals/cases.md`), same thresholds: G-01 and G-02 at 4.5 or more, all others 4.0 or more, no criterion under 3. `packages/evals` keeps only model-free tools (input builder, output validation, score summary). Correct `evals/cases.md` L3 (no `pnpm eval`, no CI). |
| Presets | T-014 | **changed** | Closes with the first manual eval run (PR-01 to PR-08). |
| Slovak template | T-015 | unchanged | Still blocked by Q-06; its eval is manual. |
| Spike | T-020 | **changed** | Hands-on test runs in the company **test environment** (a trial environment cannot publish). Option C is no longer available. New test points in § 9. |
| Environment and shell | T-021 | **changed** | Environment exists (Q-04). Create a company publisher and a solution first, then the agent shell inside it, then clone. Blocked by the T-020 test and maker access in the company test environment, no longer by Q-04. |
| Interview, prompt tool | T-022, T-023 | **changed** | Built inside the solution. T-023 adds the `retry_errors` input and the retry topic. The "9 of 10 runs" AC is measured by hand and recorded in the eval form. T-022 includes the feedback topic (Q-14, P-8). |
| Flow | T-024 | **changed** | Inside the solution; secure inputs and outputs on the trigger and on every action that carries content (§ 6); Q-18 checks; flow constants generated from `templates/`; definition exported and unpacked to the repository. |
| Pilot guide | T-025 | **changed** | Privacy statement reflects that all data stays in the company tenant; reviewed by the company too. |
| Pilot run | T-026 | **changed** | Runs in the **production** environment after the IT import. Go or no-go decides on a company rollout, not on phase 2a. |
| New | T-027 (proposed) | **new**, AGENT+HUMAN | Solution packaging and IT handover: export (unmanaged source to the repository, managed zip for IT), handover checklist (§ 7), release notes, rollback steps, solution checker result. |
| New | T-028 (proposed) | **new**, HUMAN | Company IT imports into production; smoke test with both golden profiles in production. |
| SaaS core | T-030 to T-038 | **deferred** | Phase 2a. The content-free logging rule of T-038 moves into T-024 and T-027 for this path. Static setup steps from T-034 live in T-025 for now. |
| Commercial | T-040 to T-045 | **deferred** | Phase 2b. Evals R-02 and R-03 still run by hand (they test the generator, not the UI). |
| Operations | T-050, T-051, T-052 | **deferred** | Retention, security review and legal work for the SaaS. In this path the company's own policies, review and records of processing apply (P-13). |
| Platform review | T-053 | **changed** | Reviews Copilot Studio and Power Platform facts (prompt tool models and EU processing, Copilot Credits rates, flow limits, extension support), not Azure OpenAI. |
| Phase 3 | T-060, T-061 | **deferred** | T-061 now blocked by the changed T-013. |

Changes to open questions (for the lead): Q-04 and Q-10 decided as above. Q-05 partly answered (tenant = the company; users, roles and internal approval still open). Q-11 obsolete (no own model calls), replaced by P-2. **Q-12:** T-012 and T-014 close with the first manual eval run in the test environment, not with a `pnpm eval` baseline. Q-13 stays and **is the validation rule in production**. Q-14 replaced by P-8. Q-16 obsolete (there are no automated evals).

## 6. Security and privacy in this path

- **Data stays in the company tenant.** Profiles, generated slots, instructions and feedback exist only in the company's Copilot Studio, Dataverse and flow run history. We hold no copy. Eval data in the repository comes only from fictional profiles, never from pilot users.
- **No mailbox access by our artifacts.** The solution contains no Outlook or Graph mail connector and no email knowledge source. The agent uses sign-in only (golden rule 6). The only connector is Dataverse for feedback. The email agent the user later builds in Agent Builder is the user's own agent, as before.
- **Guardrails unchanged (golden rule 4).** The template frame is fixed in the flow constants (golden rule 1). Every generated agent stays read-only, treats email as data, uses facts from the emails only, keeps the self-check.
- **Validation in production = Q-13 rule.** The flow validator may be stricter than the reference, never weaker. The parity table in `docs/spikes/T-020.md` § 4 is the contract. Invalid results are never shown as ready.
- **Tenant isolation (golden rule 8).** One tenant, no shared store. The rule is met by not having a cross-tenant store. Inside the tenant: the feedback table is readable only through a dedicated security role (P-8).
- **Logging (golden rule 7).** We add no logging of our own. The platform stores content in places we must limit:

| Where | What it stores by default | What to do (verify names and defaults in the T-020 test) |
|---|---|---|
| Agent flow run history | Inputs and outputs of the trigger and of each action, including `profile_json`, slots and rendered instructions (about 28 days for cloud flows) | Turn on **secure inputs** and **secure outputs** on the trigger, on "Respond to the agent", and on every action that holds content. No Compose actions that echo content. Run history may then show only status, duration and lengths. |
| Copilot Studio conversation transcripts | Full conversation in Dataverse (default retention about 30 days) | Turn off saving transcripts for this agent if the company allows; otherwise the shortest retention and access for named admins only (P-9). |
| Copilot Studio analytics | Session metrics, topic use | Keep; content-free. |
| Feedback table | 3 answers, free text | Topic tells users not to paste email content or names. Retention set by the company. |

- **Data residency (Q-10).** IT confirms on the handover checklist: environment region Europe; prompt tool model is a Microsoft-hosted model (no external model such as Claude or Grok); the setting that lets generative AI data move across geographies is off, and the prompt tool works with it off (P-6). If it does not, stop and ask the product owner.

## 7. Handover checklist (outline for T-027)

1. Solution version, release notes, template version, prompt version, spike option (A or B).
2. Managed zip; import steps; connection references and environment variables to set.
3. Settings: secure inputs and outputs present; transcripts setting; feedback table security role.
4. Data residency checks (§ 6).
5. Smoke test in production: both golden profiles through the flow, output byte-identical; injection case rejected.
6. Sharing with pilot users; channel; licenses and Copilot Credits capacity (P-2).
7. Rollback: re-import the previous managed version.

## 8. Contract for the manual evals (T-013)

Record per run, saved in the repository under `evals/runs/` (exact paths: prompt-engineer and test-engineer decide). Only fictional eval profiles.

```ts
type RubricCriterion =
  | "role_fit" | "faithfulness" | "stakeholder_order"
  | "language" | "placeholders" | "questions";
type Score = 1 | 2 | 3 | 4 | 5;

interface ManualEvalRun {
  runId: string;            // "2026-11-25-copilot-studio"
  date: string;             // ISO date
  environment: "company-test";
  solutionVersion: string;  // as shown in the solution list
  templateVersion: string;  // from template.json
  promptVersion: string;    // header of prompts/generator.system.md
  promptOption: "A" | "B";  // from the T-020 test
  model: string;            // prompt tool model name as shown in the UI
  scorers: string[];        // role labels, not names: "product-owner", "domain-user-1"
  cases: ManualEvalCase[];
}

interface ManualEvalCase {
  caseId: string;           // "G-01", "PR-03", "JD-02" (job descriptions for T-012)
  attempt: number;          // 1..n; T-023 AC uses 10 attempts per golden profile
  inputFile: string;        // profile_json that was pasted, built by core
  outputFile: string;       // raw prompt tool JSON, copied by the human
  retried: boolean;         // true if the retry path ran
  flow: { valid: boolean; errorCodes: string[]; warningCodes: string[]; chars: number };
  scores?: Record<string, Record<RubricCriterion, Score>>; // per scorer; only judged attempts
  note?: string;            // short note on the output of a fictional profile
}

// Produced in the repository without model calls:
interface ManualEvalCaseSummary {
  caseId: string;
  repoValid: boolean;       // core validator on outputFile
  parity: "same" | "flow-stricter" | "flow-weaker"; // "flow-weaker" blocks release (Q-13)
  meanScore: number | null; // over criteria and scorers
  minCriterion: number | null;
  threshold: 4.0 | 4.5;
  pass: boolean;
}
```

Example: `{ caseId: "G-01", repoValid: true, parity: "same", meanScore: 4.6, minCriterion: 4, threshold: 4.5, pass: true }`.

## 9. New test points for the T-020 hands-on test

In addition to the open points in `docs/spikes/T-020.md`:

1. Prompt tool, agent flow and agent are solution components; export and import of a test solution into a second environment keeps them working.
2. Secure inputs and outputs exist for agent flows and hide content in run history.
3. Name and default of the transcript setting; can it be turned off per agent.
4. Prompt tool works with cross-geography data movement turned off; which models are offered in the EU environment.
5. Flow run cost for a user with a Microsoft 365 Copilot license (free or credits).

If a condition that used to lead to option C occurs, stop: option C needs Azure, which this decision excludes (P-12).

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Prompt tool not solution-aware | Rebuilt by hand in production; drift between environments | Test point 1; paste file and checklist with exact settings |
| Only two environments: test is also the build environment | No clean test of the managed import before production | Smoke test in production before sharing; or a third environment (P-3) |
| Run history and transcripts keep content | Breach of golden rule 7 in spirit | § 6 settings, verified on the handover checklist |
| Manual evals are slower and subjective | Fewer runs; scorer bias | Fixed form, two scorers for G-01 and G-02 (P-11), repository validation of every saved output |
| Company-specific data in the public repository | Disclosure of the company and its setup | P-7 |
| Copilot Credits run out | Flow and prompt calls blocked | P-2; capacity alert by IT |

## 11. Alternatives considered

| Alternative | Why not |
|---|---|
| SaaS on our Azure (phase 2 as planned) | One company first; the company would send profile data to our tenant, needs contracts, Marketplace and a paid subscription before any user test. Deferred. |
| Option A: our own Azure OpenAI for development and evals, product in Copilot Studio | Paid Azure resource and budget (H-3, H-4) for a model that differs from the one the company runs; evals would not measure the real prompt tool. |
| **Option B: everything in the company's Copilot Studio, manual evals (chosen)** | Cheapest, uses what the company already has, evals measure the real platform. Cost: manual evals, more UI work, less automation. |

## 12. Proposed open questions (for `docs/08-open-questions.md`; the lead assigns Q numbers)

| ID | Question | Recommendation |
|---|---|---|
| P-1 | Who owns the solution in the company: publisher name and prefix, maker in the test environment, approver of production imports? | Company IT owns the publisher and production; the product owner is maker in test; one named IT contact approves imports. |
| P-2 | Licensing: do all pilot users have Microsoft 365 Copilot licenses (agent flow runs free), and who provides Copilot Credits for the prompt tool in test and production (about 1.4 credits per generation with option A, double with a retry)? | Confirm licenses for every pilot user; IT assigns a small credit capacity to both environments with an alert. |
| P-3 | ALM tool: Power Platform pipelines, or manual export and import? Is a third (development) environment possible? | Manual export by the product owner, import by IT; pipelines if the company already uses them. Ask for a development environment; if not, smoke test in production before sharing. |
| P-4 | Environment variables and connection references: which values differ per environment? | Only per-environment values (feedback reader role or group). Template limits stay flow constants from `template.json`. A connection reference for every connector; the render flow uses none. |
| P-5 | Authoring tool: Copilot Studio VS Code extension or `pac`? | Decide after the T-020 test. The solution export is the transport either way. |
| P-6 | Data residency check: who confirms region, Microsoft-hosted model and the cross-geography setting? | IT confirms on the handover checklist; stop if the prompt tool needs cross-geography movement. |
| P-7 | The repository is public. Exported solution files may carry company name, publisher prefix, environment URLs. Where do company-specific artifacts live? | Public repository keeps company-neutral source (prompts, template, flow constants, checklists, YAML without company values). The company-specific export and the managed zip go to a private location chosen by the company. |
| P-8 | Feedback store (replaces Q-14): Dataverse table or SharePoint list? | Dataverse table in the solution (moves with the solution, security role). SharePoint list only if the company forbids custom tables. |
| P-9 | Run history and transcripts: may transcripts be turned off for this agent, and who may see run history? | Secure inputs and outputs required; transcripts off if allowed, else shortest retention; run history visible to the maker and named IT admins only. |
| P-10 | Where does the pilot run? | Internal test and evals in test; pilot users only in production after the IT import. |
| P-11 | Who scores the manual evals, and how many scorers? | Two scorers for G-01 and G-02 (product owner plus one domain user), one scorer for the rest; the prompt author alone must not decide a release. |
| P-12 | Spike option C is gone. If the test hits a C condition (fewer than 9 of 10 valid runs, flow weaker than the reference, over 100 s), what then? | Try B first. If B fails too, stop and present options; do not decide in a ticket. |
| P-13 | Processing roles: the company is controller; the product owner's side supplies artifacts and has maker access. Who does records of processing and the DPIA screening? | The company's data protection officer, with our pilot guide and § 6 as input. T-052 stays deferred. |
| P-14 | Presets in the pilot interview: offered to pilot users, or used only in evals for now? | Evals only in the first release; add to the interview after the pilot if users ask. |

## 13. Proposed order of windows (the lead decides)

Old numbers stay. W4 is dropped. W9 to W14 (phase 2a) are deferred. New windows get new numbers.

| Order | Window | Content | Blocked by |
|---|---|---|---|
| 1 | W5 (changed) | T-013 manual eval kit: procedure, result form, input builder, output validation, score summary, missing `evals/profiles/`; T-012 job descriptions; update `docs/checklists/T-020.md` with § 9 | none (no model calls); can run while the human does the T-020 test |
| 2 | W6 (continued, HUMAN) | T-020 hands-on test in the company test environment; spike result, option A or B | maker access in the company test environment |
| 3 | T-021 (HUMAN) | Publisher, solution, agent shell, first clone | T-020 test, P-1, P-5 |
| 4 | W7 (changed) | T-022 to T-025 inside the solution; retry topic; secure inputs and outputs | T-021 |
| 5 | W8 (changed) | Internal test with two golden users; first manual eval run (closes T-012, T-014, T-023 AC); fixes | W7 |
| 6 | W15 (new) | T-027 packaging and IT handover | W8 evals pass; P-3, P-4, P-7 |
| 7 | T-028 (HUMAN) | IT import to production; smoke test | W15; P-2, P-6, P-9 |
| 8 | T-026 (HUMAN) | Pilot in production | T-028; Q-05 users |
| 9 | W16 (new) | Pilot evaluation report, fixes, next release as a new solution version | T-026 |
