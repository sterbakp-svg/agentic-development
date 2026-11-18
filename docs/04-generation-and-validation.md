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

Implemented in `packages/core/src/profile` (`prepareProfile`), in this order:

1. From every string remove invisible characters (Unicode Cc, Zl, Zp, bidi controls U+202A–U+202E and U+2066–U+2069, U+200B, U+FEFF; U+200C and U+200D stay), backticks and the sequences `{{` and `}}`, until nothing is left to remove (``{`{x}`}`` becomes `x`); then trim. One linear pass gives this result. Record a warning per field and kind when something is removed.
2. Remove empty array items and exact duplicates.
3. Validate against the schema and apply its defaults (only inside objects that are present).
4. Merge `org_context.common_stakeholders` into `stakeholders` with relation `internal_function`, unless the user already lists them (same `role_or_group` or `name`, case-insensitive). The merged list keeps the schema limit of 20: the user's own entries first; a warning `common_stakeholders_truncated` when common entries are left out.

Input deeper than 8 levels is rejected (`too_deep`); the function never throws. Issues and warnings carry only a path (schema keys, indices, `*`) and a code, never input values.

## 3. Rendering

Follow `templates/email-triage/v1/template.json` → `rendering_rules`. The reference implementation is `reference/composer_ref.py` (`render`). The TypeScript renderer must produce byte-identical output for:
- `examples/cio-insurance/` → `expected-instructions.md`
- `examples/tprm-analyst/` → `expected-instructions.md`

## 4. Validation

The reference implementation is `reference/composer_ref.py` (`validate`); the TypeScript port is `packages/core/src/validator` (`validate`), proven equal with a differential corpus in `packages/core/test-fixtures/validate/`. Errors block the result. Warnings show in the quality report.

| Check | Type |
|---|---|
| Every LLM slot exists; required slots are not empty | error |
| Slot length ≤ `max_chars` | error |
| Slot has no line break, backtick, heading marker, `{{` or `}}` | error |
| Slot has no override pattern ("ignore previous …", "disregard", automatic send/forward/delete/move) | error |
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
