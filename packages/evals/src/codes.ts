// Stable error codes for the validator messages of packages/core. A message can hold slot text, so
// the codes are what the kit stores and prints. A code is dot-separated IDs, never content:
//   <rule>                          unresolved_marker, instructions_too_long, description_too_long,
//                                   starters_count, name_too_long, starter_too_long,
//                                   placeholder_not_declared
//   <rule>.<slot>                   missing_slot, slot_not_string, empty_required_slot,
//                                   slot_too_long, inline_optional_space
//   forbidden_content.<slot>.<kind> one per core forbidden pattern (FORBIDDEN_KINDS)
//   guardrail_missing.g<n>          n = 1-based position in GUARDRAIL_LINES
//   section_missing.h<n>            n = 1-based position in REQUIRED_HEADINGS
// Slot names and kinds are template IDs (golden rule 7 holds). The Copilot Studio flow reports the
// same codes (T-023, T-024); the parity check compares them one by one, with multiplicity.
import { GUARDRAIL_LINES, REQUIRED_HEADINGS } from '@agent-composer/core';

/** Fixed map from each core forbidden pattern (its source text) to a rule-kind ID. */
export const FORBIDDEN_KINDS: ReadonlyMap<string, string> = new Map([
  [String.raw`\{\{|\}\}`, 'braces'],
  [String.raw`[\r\n]`, 'line_break'],
  ['`', 'backtick'],
  [String.raw`^\s*#`, 'heading_marker'],
  ['ignore (all|any|the|previous|above)', 'ignore_pattern'],
  ['disregard', 'disregard'],
  [
    String.raw`\b(send|forward|delete|move)\b[^.;]*\b(automatically|without (asking|review))`,
    'auto_send_pattern',
  ],
]);

const SLOT = /^[a-z][a-z0-9_]*$/;
const UNKNOWN_ERROR = 'unknown_error';

const withSlot: [RegExp, string][] = [
  [/^missing slot: ([a-z][a-z0-9_]*)$/, 'missing_slot'],
  [/^slot is not a string: ([a-z][a-z0-9_]*)$/, 'slot_not_string'],
  [/^empty required slot: ([a-z][a-z0-9_]*)$/, 'empty_required_slot'],
  [/^slot too long: ([a-z][a-z0-9_]*) \(/, 'slot_too_long'],
  [/^inline optional slot must start with a space: ([a-z][a-z0-9_]*)$/, 'inline_optional_space'],
];

const bare: [RegExp, string][] = [
  [/^unresolved slot marker/, 'unresolved_marker'],
  [/^instructions too long:/, 'instructions_too_long'],
  [/^placeholder not declared in placeholders_left:/, 'placeholder_not_declared'],
  [/^description too long/, 'description_too_long'],
  [/^need exactly \d+ conversation starters/, 'starters_count'],
  [/^starter too long:/, 'starter_too_long'],
  [/^agent name too long/, 'name_too_long'],
];

const FORBIDDEN_RE = /^forbidden content in slot ([a-z][a-z0-9_]*): \/([\s\S]*)\/$/;

function indexed(message: string, prefix: string, list: readonly string[], code: string, tag: string) {
  if (!message.startsWith(prefix)) return null;
  const i = list.indexOf(message.slice(prefix.length));
  return i < 0 ? UNKNOWN_ERROR : `${code}.${tag}${i + 1}`;
}

export function errorCode(message: string): string {
  const f = FORBIDDEN_RE.exec(message);
  if (f) {
    const kind = FORBIDDEN_KINDS.get(f[2]!);
    return kind === undefined ? UNKNOWN_ERROR : `forbidden_content.${f[1]!}.${kind}`;
  }
  for (const [re, code] of withSlot) {
    const m = re.exec(message);
    if (m && SLOT.test(m[1]!)) return `${code}.${m[1]!}`;
  }
  for (const [re, code] of bare) if (re.test(message)) return code;
  return (
    indexed(message, 'guardrail missing: ', GUARDRAIL_LINES, 'guardrail_missing', 'g') ??
    indexed(message, 'section missing: ', REQUIRED_HEADINGS, 'section_missing', 'h') ??
    UNKNOWN_ERROR
  );
}

const WARNINGS: [RegExp, string][] = [
  [/^email address in slot /, 'email_in_slot'],
  [/^instructions above target:/, 'above_target'],
];

export const warningCode = (message: string): string => {
  for (const [re, code] of WARNINGS) if (re.test(message)) return code;
  return 'unknown_warning';
};
