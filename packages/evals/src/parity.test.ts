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

describe('error code vocabulary (stable codes for the repository error strings)', () => {
  const rows: [string, string][] = [
    ['missing slot: tools', 'missing_slot'],
    ['slot is not a string: tools', 'slot_not_string'],
    ['empty required slot: role_line', 'empty_required_slot'],
    ['slot too long: role_line (300 > 200)', 'slot_too_long'],
    ['forbidden content in slot tools: /x/', 'forbidden_content'],
    ['inline optional slot must start with a space: waiting_parties', 'inline_optional_space'],
    ['unresolved slot marker in rendered text', 'unresolved_marker'],
    ['instructions too long: 9000 > 8000', 'instructions_too_long'],
    ['guardrail missing: x', 'guardrail_missing'],
    ['section missing: ## X', 'section_missing'],
    ['placeholder not declared in placeholders_left: [x]', 'placeholder_not_declared'],
    ['description too long', 'description_too_long'],
    ['need exactly 4 conversation starters', 'starters_count'],
    ['starter too long: x', 'starter_too_long'],
    ['agent name too long', 'name_too_long'],
    ['something new', 'unknown_error'],
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
