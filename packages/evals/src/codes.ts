// Stable codes for the validator messages of packages/core. A message can hold slot text, so the
// codes are what the kit stores and prints. The Copilot Studio flow reports the same codes.

const ERRORS: [RegExp, string][] = [
  [/^missing slot:/, 'missing_slot'],
  [/^slot is not a string:/, 'slot_not_string'],
  [/^empty required slot:/, 'empty_required_slot'],
  [/^slot too long:/, 'slot_too_long'],
  [/^forbidden content in slot /, 'forbidden_content'],
  [/^inline optional slot must start with a space:/, 'inline_optional_space'],
  [/^unresolved slot marker/, 'unresolved_marker'],
  [/^instructions too long:/, 'instructions_too_long'],
  [/^guardrail missing:/, 'guardrail_missing'],
  [/^section missing:/, 'section_missing'],
  [/^placeholder not declared in placeholders_left:/, 'placeholder_not_declared'],
  [/^description too long/, 'description_too_long'],
  [/^need exactly \d+ conversation starters/, 'starters_count'],
  [/^starter too long:/, 'starter_too_long'],
  [/^agent name too long/, 'name_too_long'],
];

const WARNINGS: [RegExp, string][] = [
  [/^email address in slot /, 'email_in_slot'],
  [/^instructions above target:/, 'above_target'],
];

function lookup(table: [RegExp, string][], text: string, fallback: string): string {
  for (const [re, code] of table) if (re.test(text)) return code;
  return fallback;
}

export const errorCode = (message: string): string => lookup(ERRORS, message, 'unknown_error');
export const warningCode = (message: string): string => lookup(WARNINGS, message, 'unknown_warning');
