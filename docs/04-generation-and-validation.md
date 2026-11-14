# Generation and validation

## 1. Generation request

The generator call has these parts, in this order:

1. **System message:** `prompts/generator.system.md` (unchanged).
2. **User message**, with three labeled blocks:
   - `TEMPLATE`: the body file and the `slots` array of `template.json`.
   - `EXAMPLES`: for each golden example, the profile, the slots and the rendered instructions.
   - `PROFILE`: the normalized profile JSON. Wrap it in a fenced block and label it as data.
3. **Response format:** structured output with `schemas/generator-output.schema.json`.

Settings: temperature 0.2; max output tokens 3,000; one retry on a validator error. In the retry, add a block `VALIDATOR_ERRORS` with the error list and the previous output.

## 2. Profile normalization (before the call)

- Trim all strings; remove empty array items; deduplicate.
- Remove control characters and the sequences `{{`, `}}` and backticks from every string. Record a warning when something is removed.
- Apply defaults from the schema.
- Merge `org_context.common_stakeholders` into `stakeholders` with relation `internal_function`, unless the user already lists them.

## 3. Rendering

Follow `templates/email-triage/v1/template.json` → `rendering_rules`. The reference implementation is `reference/composer_ref.py` (`render`). The TypeScript renderer must produce byte-identical output for:
- `examples/cio-insurance/` → `expected-instructions.md`
- `examples/tprm-analyst/` → `expected-instructions.md`

## 4. Validation

The reference implementation is `reference/composer_ref.py` (`validate`). Errors block the result. Warnings show in the quality report.

| Check | Type |
|---|---|
| Every LLM slot exists; required slots are not empty | error |
| Slot length ≤ `max_chars` | error |
| Slot has no line break, backtick, heading marker, `{{` or `}}` | error |
| Slot has no override pattern ("ignore previous …", "disregard", automatic send/forward/delete) | error |
| Inline optional slot starts with a space when not empty | error |
| Rendered text has no slot marker | error |
| Rendered text ≤ 8,000 characters | error |
| Rendered text ≤ 7,000 characters (target) | warning |
| All guardrail lines present (list in the reference) | error |
| All six section headings present | error |
| Every `[placeholder]` in the slots is in `placeholders_left` | error |
| Description ≤ 1,000 characters; exactly 4 starters, each ≤ 100 characters | error |
| Agent name ≤ 30 characters | error |
| Email address in a slot | warning |

Notes:
- The fixed text contains one intentional bracket example (`[<placeholder_word>: <example>]`). It is agent behavior, not a gap for the user. The UI shows only `placeholders_left` as items to fill.
- When the user fills placeholders in the UI, re-run the validator on the edited text (length and guardrails).

## 5. Quality report (shown to the user)

- Character count with a bar (limit 8,000; target 7,000).
- "Checks passed: n of n" with expandable details.
- Placeholders to fill, each with a short hint.
- Assumptions made by the generator.
- Up to three questions that would improve the agent, each with a button "Answer and regenerate".
