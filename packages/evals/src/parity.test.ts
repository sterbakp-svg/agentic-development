// Parity of the flow result with the repository result (ADR-001 section 4, T-020 spike section 4, Q-13).
import { describe, expect, it } from 'vitest';
import { computeParity } from './parity';
import { errorCode, warningCode } from './codes';

const ok = { valid: true, errorCodes: [] as string[] };
const bad = (...c: string[]) => ({ valid: false, errorCodes: c });

describe('computeParity (flow may be stricter than the reference, never weaker)', () => {
  const rows: [string, { valid: boolean; errorCodes: string[] }, { valid: boolean; errorCodes: string[] }, string][] = [
    ['both valid', ok, ok, 'same'],
    ['both reject with the same codes', bad('forbidden_content'), bad('forbidden_content'), 'same'],
    ['same codes in another order', bad('a_1', 'b_2'), bad('b_2', 'a_1'), 'same'],
    ['repo valid, flow rejects', ok, bad('forbidden_content'), 'flow-stricter'],
    ['both reject, flow has extra code', bad('slot_too_long'), bad('slot_too_long', 'heading_marker'), 'flow-stricter'],
    ['both reject, flow knows other code only', bad('forbidden_content'), bad('heading_marker'), 'flow-weaker'],
    ['repo rejects, flow accepts', bad('forbidden_content'), ok, 'flow-weaker'],
    ['both reject, flow misses one repo code', bad('a_1', 'b_2'), bad('a_1', 'c_3'), 'flow-weaker'],
  ];
  it.each(rows)('%s', (_n, repo, flow, expected) => {
    expect(computeParity(repo, flow)).toBe(expected);
  });
});

describe('parity compares per code, with multiplicity (review B1)', () => {
  const f = (slot: string, kind: string) => `forbidden_content.${slot}.${kind}`;
  const four = [
    f('tools', 'line_break'),
    f('tools', 'heading_marker'),
    f('discretion_rule', 'ignore_pattern'),
    f('discretion_rule', 'auto_send_pattern'),
  ];
  it('a flow that reports only one of four forbidden errors is flow-weaker', () => {
    for (const one of four) expect(computeParity(bad(...four), bad(one))).toBe('flow-weaker');
  });
  it('the same kind in another slot does not count', () => {
    expect(computeParity(bad(f('tools', 'backtick')), bad(f('role_line', 'backtick')))).toBe('flow-weaker');
  });
  it('a code that the repository reports twice must be reported twice', () => {
    expect(computeParity(bad('starter_too_long', 'starter_too_long'), bad('starter_too_long'))).toBe('flow-weaker');
    expect(computeParity(bad('starter_too_long'), bad('starter_too_long', 'starter_too_long'))).toBe('flow-stricter');
  });
  it('all four reported is same, with extras is flow-stricter', () => {
    expect(computeParity(bad(...four), bad(...[...four].reverse()))).toBe('same');
    expect(computeParity(bad(...four), bad(...four, f('tools', 'backtick')))).toBe('flow-stricter');
  });
});

describe('error code vocabulary (IDs, never content)', () => {
  const rows: [string, string][] = [
    ['missing slot: tools', 'missing_slot.tools'],
    ['slot is not a string: tools', 'slot_not_string.tools'],
    ['empty required slot: role_line', 'empty_required_slot.role_line'],
    ['slot too long: role_line (300 > 200)', 'slot_too_long.role_line'],
    ['forbidden content in slot tools: /[\\r\\n]/', 'forbidden_content.tools.line_break'],
    ['inline optional slot must start with a space: waiting_parties', 'inline_optional_space.waiting_parties'],
    ['unresolved slot marker in rendered text', 'unresolved_marker'],
    ['instructions too long: 9000 > 8000', 'instructions_too_long'],
    ['guardrail missing: You only read and draft.', 'guardrail_missing.g3'],
    ['section missing: # WORKFLOW', 'section_missing.h4'],
    ['placeholder not declared in placeholders_left: [x]', 'placeholder_not_declared'],
    ['description too long', 'description_too_long'],
    ['need exactly 4 conversation starters', 'starters_count'],
    ['starter too long: x', 'starter_too_long'],
    ['agent name too long', 'name_too_long'],
    ['something new', 'unknown_error'],
    ['forbidden content in slot tools: /a rule that does not exist/', 'unknown_error'],
    ['guardrail missing: text that is not a guardrail', 'unknown_error'],
    ['missing slot: Not-An-ID', 'unknown_error'],
  ];
  it.each(rows)('%s -> %s', (text, code) => {
    expect(errorCode(text)).toBe(code);
  });

  it('maps the two warnings and never returns the input text', () => {
    expect(warningCode('email address in slot tools; names are enough')).toBe('email_in_slot');
    expect(warningCode('instructions above target: 7500 > 7000')).toBe('above_target');
    expect(warningCode('novel text with secret')).toBe('unknown_warning');
  });
});
