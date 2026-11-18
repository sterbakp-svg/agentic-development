# Manual eval procedure (T-013)

The model runs only in the Copilot Studio prompt tool `GenerateEmailTriageSlots` in the company test environment (ADR-001). Nothing in this repository calls a model. A person runs the cases, scores them with the rubric in `evals/cases.md`, and the repository kit checks the saved outputs and builds the report.

Use only fictional profiles and job descriptions. This repository is public: never save real names, mail content or company data in `evals/runs/`.

## What you need

- Maker access to the company test environment and the solution with the prompt tool.
- This repository, `pnpm install` done.
- The case list in `evals/cases.md`, fictional profiles in `evals/profiles/` and `examples/`, job descriptions for `JD-*` cases in `evals/job-descriptions/`.

## Steps for one run

Run all commands from the repository root. Pick a run id, for example `2026-11-25-copilot-studio`, and make the folder `evals/runs/<runId>/`.

1. **Build the input.** For each profile case:

   ```bash
   pnpm --filter @agent-composer/evals cli build-input \
     --profile evals/profiles/preset-sales.json \
     --out evals/runs/<runId>/PR-05-1.input.json
   ```

   For a preset case from a thin profile, add `--preset sales` (an id from `presets/`, or a path to a preset file). The command applies the preset with the merge rule of `docs/03-input-model.md` ("Role presets"), then core `prepareProfile`, and writes one line of JSON: the `profile_json` text. Without `--out` it prints the line to the terminal (add `--silent` after `pnpm` to hide the pnpm header). An invalid profile stops with exit code 2 and a list of paths and codes.
2. **Paste.** Open the prompt tool in the test environment. Paste the content of the input file into `profile_json`. Leave `retry_errors` empty. Run it.
3. **Save the output.** Copy the raw JSON that the prompt tool returns into `evals/runs/<runId>/PR-05-1.output.json`. Do not edit it. Name pattern: `<caseId>-<attempt>.input.json` and `<caseId>-<attempt>.output.json`.
4. **Run the flow.** Give the same output to the `RenderAndValidate` flow (through the agent, as in production). Note whether it says valid, which error codes and warning codes it returns, and how many characters the instructions have. If the retry path ran, set `retried` to true and save the output of the final attempt.
5. **Fill the result form.** Copy `evals/runs/TEMPLATE.json` to `evals/runs/<runId>/run.json` and fill it (fields below). Keep one entry in `cases` per attempt.
6. **Score.** Each scorer reads the rendered instructions and gives 1 to 5 for the six criteria of `evals/cases.md`. Enter them under `scores.<scorer label>`. G-01 and G-02 need two scorers (P-11): the product owner and one domain user. All other cases need one. The prompt author alone must not decide a release.
7. **Check the outputs.**

   ```bash
   pnpm --filter @agent-composer/evals cli check evals/runs/<runId>/run.json
   ```

   For each case it prints `repoValid` (core validator on your saved output), `parity` with the flow result, and the character counts. Exit code 3 means the flow is weaker than the validator: **release blocking**, stop and tell the lead.
8. **Summary.**

   ```bash
   pnpm --filter @agent-composer/evals cli summary evals/runs/<runId>/run.json
   ```

   It writes `summary.json` and `report.md` next to `run.json` and prints the report. Commit the run folder.

## The result form (`run.json`)

The exact contract is `ManualEvalRun` in ADR-001 § 8. Machine-readable: `schemas/manual-eval-run.schema.json` (checks shape; the kit also checks the cross-field rules below). `evals/runs/TEMPLATE.json` is a filled example.

| Field | Content |
|---|---|
| `runId`, `date` | Folder name and ISO date. |
| `environment` | Always `company-test`. |
| `solutionVersion` | As shown in the solution list. |
| `templateVersion` | From `templates/email-triage/v1/template.json`. `check` reports `template_version_mismatch` if it differs. |
| `promptVersion` | Header of `prompts/generator.system.md`. |
| `interviewPromptVersion` | Version of `prompts/mvp-interview-agent.instructions.md`. Required when the run has a `JD-*` case. |
| `promptOption` | `A` or `B` (T-020 test). |
| `model` | Prompt tool model name as shown in the UI. |
| `scorers` | Role labels, not names: `product-owner`, `domain-user-1`. Lower case, digits and `-`. |
| `cases[]` | One entry per attempt. |

Per case: `caseId` (for example `G-01`, `PR-03`, `JD-02`), `attempt` (1, 2, ...; T-023 uses 10 attempts per golden profile), `inputFile`, `outputFile` (paths relative to the run folder, no `..`), `retried`, `flow` (`valid`, `errorCodes`, `warningCodes`, `chars`), optional `scores`, optional `note` (short, never copy mail or profile text), optional `expectReject`.

Rules the kit enforces:

- `flow.valid` is true exactly when `flow.errorCodes` is empty.
- Every scorer in `scores` is listed in `scorers`. Every scorer gives all six criteria, each a whole number 1 to 5.
- `caseId` plus `attempt` is unique.
- Files are read only inside the run folder and only up to 1 MB.
- `expectReject: true` marks a negative case such as S-03 (`evals/negative/injection-slots.json`): the validator and the flow must both reject the output.

### Job description cases (JD-\*, T-012)

A `JD-*` case tests the interview agent, not the render. It has no `inputFile`, `outputFile` or `flow` (the form refuses them). `repoValid` and `parity` show `n/a`. The case passes on scores alone (mean 4.0 or more, no score under 3) and cannot pass without scores. The run must name `interviewPromptVersion`.

### Error codes

The flow reports codes, not texts. A code is made of IDs, never content: slot names and rule kinds are template IDs. The repository vocabulary is `packages/evals/src/codes.ts`; the flow (T-023, T-024) must emit exactly these codes, one per error:

| Code | Meaning |
|---|---|
| `missing_slot.<slot>`, `slot_not_string.<slot>`, `empty_required_slot.<slot>`, `slot_too_long.<slot>`, `inline_optional_space.<slot>` | Slot checks, for example `slot_too_long.role_line`. |
| `forbidden_content.<slot>.<kind>` | One code per forbidden pattern in a slot. Kinds: `braces`, `line_break`, `backtick`, `heading_marker` (a line starting with `#`), `ignore_pattern`, `disregard`, `auto_send_pattern`. Example: `forbidden_content.tools.line_break`. |
| `guardrail_missing.g<n>`, `section_missing.h<n>` | `n` is the 1-based position of the guardrail line or heading in `packages/core/src/validator/guardrails.ts`. |
| `unresolved_marker`, `instructions_too_long`, `description_too_long`, `starters_count`, `starter_too_long`, `name_too_long`, `placeholder_not_declared` | Checks without a slot ID. Report the code once per error (two starters too long: two times). |

A flow check that the repository does not have may use its own code in lower snake case with dots between IDs. A stricter flow check that replaces a reference check reports the reference code (for example `contains('#')` reports `forbidden_content.<slot>.heading_marker`, and a check for `automatically` or `without review` reports `forbidden_content.<slot>.auto_send_pattern`). The vocabulary belongs to a template version: the `g<n>` and `h<n>` positions change when the lists in `guardrails.ts` change. Warning codes: `email_in_slot`, `above_target`. `unknown_error` in a result means that core reported something that `codes.ts` does not know: file a bug.

## How the result is computed

**Parity** compares the flow with the repository validator on the same saved output (Q-13: the flow may be stricter, never weaker).

| Repository | Flow | Parity |
|---|---|---|
| accepts | accepts | `same` |
| rejects with codes C | rejects with exactly C | `same` |
| rejects with codes C | rejects with C and more | `flow-stricter` |
| accepts | rejects | `flow-stricter` |
| rejects | accepts | `flow-weaker` |
| rejects with codes C | rejects but misses one code of C | `flow-weaker` |

Codes are compared one by one, with their count: `forbidden_content.tools.line_break` and `forbidden_content.tools.heading_marker` are two codes, so a flow that catches only one of the four errors of `evals/negative/injection-slots.json` is `flow-weaker`. `check` uses `packages/core` only (no second implementation). That core agrees with `reference/composer_ref.py` is enforced by the CI job `reference`, not by this kit.

`flow-weaker` is release blocking: `check` and `summary` exit with code 3 and the report starts with a banner. If both accept but the character counts differ, the case fails with `chars_mismatch` (the flow rendered different text).

**Pass rule** per case, over all attempts of the case (`evals/cases.md`, ADR-001 § 5, § 8):

- `repoValid`: true when the validator accepts every attempt. A negative case (`expectReject`) fails when any attempt is accepted.
- `parity`: the worst of the attempts (`flow-weaker`, then `flow-stricter`, then `same`).
- `meanScore`: mean over all six criteria, all scorers and all judged attempts (an attempt is judged when it has `scores`). `minCriterion`: the lowest single score.
- `threshold`: 4.5 for G-01 and G-02, 4.0 for all other cases.
- The case passes when `meanScore >= threshold`, `minCriterion >= 3`, `repoValid` is true, parity is not `flow-weaker`, and the case has no problem such as `chars_mismatch`. One score of 2 or less fails the case, even if the mean is high.
- Every case that is not a negative case needs at least one judged attempt: without one it fails with `not_scored` (this holds for golden and preset cases too, not only JD cases). G-01 and G-02 need at least one judged attempt that two scorers scored.
- A negative case (`expectReject`) passes when the repository rejects every attempt and the flow is not weaker. It needs no scores.

A retry or an extra attempt that nobody scored does not fail the case as long as another attempt was judged.

`summary.json` holds `cases` (one row per `caseId`, with the ADR fields `caseId`, `repoValid`, `parity`, `meanScore`, `minCriterion`, `threshold`, `pass`, plus `attempts`, `judgedAttempts`, `scorerMeans`, `notScored`, `reasons`), `entries` (one row per attempt, detail only), `counts` (over cases, plus `attempts`), `allPass` and `releaseBlocking`. `allPass`, the exit code and the report verdict come from the `cases` rows. The report never prints slot text, profile text or notes: only ids, codes, lengths and scores.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks pass. |
| 1 | At least one case failed (including `not_scored`). |
| 2 | Usage error, unreadable file or a run file that does not match the schema. |
| 3 | Flow weaker than the validator in at least one case: release blocking. |

## Where things are

| Path | Content |
|---|---|
| `packages/evals/src/` | The kit (schemas, input builder, check, summary, CLI) and its tests. |
| `schemas/manual-eval-run.schema.json` | JSON Schema of the result form. |
| `evals/cases.md` | Cases and rubric. |
| `evals/runs/TEMPLATE.json` | Result form template. |
| `evals/runs/<runId>/` | One folder per run: `run.json`, inputs, outputs, `summary.json`, `report.md`. |
