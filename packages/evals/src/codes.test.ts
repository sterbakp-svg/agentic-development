// The code map must cover everything that core `validate` can report (review B1).
import {
  FORBIDDEN_IN_SLOTS,
  GUARDRAIL_LINES,
  loadTemplate,
  prepareProfile,
  REQUIRED_HEADINGS,
  validate,
} from '@agent-composer/core';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { errorCode, FORBIDDEN_KINDS, warningCode } from './codes';
import { GOLDEN_PROFILE, GOLDEN_SLOTS, templateDir } from './fixtures';

type Obj = Record<string, unknown>;
const profile = (() => {
  const r = prepareProfile(JSON.parse(GOLDEN_PROFILE));
  if (!r.ok) throw new Error('golden profile must be valid');
  return r.profile;
})();
const golden = (): Obj & { slots: Obj; conversation_starters: string[] } => JSON.parse(GOLDEN_SLOTS);

/** Copy of the template folder, so that a test can change a limit or the frame. */
function templateCopy(edit: (dir: string) => void): ReturnType<typeof loadTemplate> {
  const dir = join(mkdtempSync(join(tmpdir(), 'evals-codes-')), 'v1');
  cpSync(templateDir, dir, { recursive: true });
  edit(dir);
  return loadTemplate(dir);
}
function withLimits(limits: Obj) {
  return templateCopy((dir) => {
    const file = join(dir, 'template.json');
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    Object.assign(meta.limits, limits);
    writeFileSync(file, JSON.stringify(meta));
  });
}
const base = () => loadTemplate(templateDir);

const run = (t: ReturnType<typeof loadTemplate>, out: unknown) => validate(t, profile, out).errors.map(errorCode);

const with_ = (mutate: (g: ReturnType<typeof golden>) => void) => {
  const g = golden();
  mutate(g);
  return g;
};

// One input per error kind of core validate. `expected` is the code that must be among the results.
const FORBIDDEN_SAMPLES: [string, string][] = [
  ['braces', 'text {{x}}'],
  ['line_break', 'one\ntwo'],
  ['backtick', 'a `b`'],
  ['heading_marker', '# heading'],
  ['ignore_pattern', 'please Ignore Previous notes'],
  ['disregard', 'disregard it'],
  ['auto_send_pattern', 'send replies automatically'],
];

describe('every error kind of core validate has a stable code (no unknown_*)', () => {
  const cases: [string, ReturnType<typeof loadTemplate>, unknown, string][] = [
    ['missing slot', base(), with_((g) => delete g.slots.tools), 'missing_slot.tools'],
    ['null slot', base(), with_((g) => (g.slots.tools = null)), 'missing_slot.tools'],
    ['slot not a string', base(), with_((g) => (g.slots.tools = 5)), 'slot_not_string.tools'],
    ['empty required slot', base(), with_((g) => (g.slots.role_line = '  ')), 'empty_required_slot.role_line'],
    ['slot too long', base(), with_((g) => (g.slots.role_line = 'x'.repeat(5000))), 'slot_too_long.role_line'],
    [
      'inline optional without space',
      base(),
      with_((g) => (g.slots.waiting_parties = 'no leading space')),
      'inline_optional_space.waiting_parties',
    ],
    ['unresolved marker', base(), with_((g) => (g.slots.tools = 'a {{b}}')), 'unresolved_marker'],
    [
      'instructions too long',
      withLimits({ instructions_max_chars: 500, instructions_target_chars: 400 }),
      golden(),
      'instructions_too_long',
    ],
    [
      'guardrail missing',
      templateCopy((dir) => {
        const f = join(dir, 'template.en.md');
        writeFileSync(f, readFileSync(f, 'utf8').replace('You only read and draft.', 'You read.'));
      }),
      golden(),
      'guardrail_missing.g3',
    ],
    [
      'section missing',
      templateCopy((dir) => {
        const f = join(dir, 'template.en.md');
        writeFileSync(f, readFileSync(f, 'utf8').replace('# WORKFLOW\n', '# FLOW\n'));
      }),
      golden(),
      'section_missing.h4',
    ],
    [
      'placeholder not declared',
      base(),
      with_((g) => {
        g.slots.tools = 'the [Undeclared Thing]';
        g.placeholders_left = [];
      }),
      'placeholder_not_declared',
    ],
    ['description too long', base(), with_((g) => (g.description = 'x'.repeat(5000))), 'description_too_long'],
    ['starters count', base(), with_((g) => (g.conversation_starters = ['only one'])), 'starters_count'],
    [
      'starter too long',
      base(),
      with_((g) => (g.conversation_starters[0] = 'x'.repeat(500))),
      'starter_too_long',
    ],
    ['agent name too long', withLimits({ name_max_chars: 3 }), golden(), 'name_too_long'],
    ...FORBIDDEN_SAMPLES.map(
      ([kind, text]): [string, ReturnType<typeof loadTemplate>, unknown, string] => [
        `forbidden ${kind}`,
        base(),
        with_((g) => (g.slots.discretion_rule = text)),
        `forbidden_content.discretion_rule.${kind}`,
      ],
    ),
  ];

  it.each(cases)('%s', (_name, template, output, expected) => {
    const codes = run(template, output);
    expect(codes).toContain(expected);
    expect(codes.filter((c) => c.startsWith('unknown'))).toEqual([]);
  });

  it('the golden output has no error code at all', () => {
    expect(run(base(), golden())).toEqual([]);
  });
});

describe('maps stay in step with core', () => {
  it('every core forbidden pattern has a kind ID, and the IDs are distinct', () => {
    const kinds = FORBIDDEN_IN_SLOTS.map((r) => FORBIDDEN_KINDS.get(r.source));
    expect(kinds.every((k) => typeof k === 'string')).toBe(true);
    expect(new Set(kinds).size).toBe(FORBIDDEN_IN_SLOTS.length);
    expect(FORBIDDEN_KINDS.size).toBe(FORBIDDEN_IN_SLOTS.length);
  });
  it('every guardrail line and heading maps to its own code', () => {
    const g = GUARDRAIL_LINES.map((l) => errorCode(`guardrail missing: ${l}`));
    const h = REQUIRED_HEADINGS.map((l) => errorCode(`section missing: ${l}`));
    expect(new Set(g).size).toBe(GUARDRAIL_LINES.length);
    expect(new Set(h).size).toBe(REQUIRED_HEADINGS.length);
    expect([...g, ...h].filter((c) => c.startsWith('unknown'))).toEqual([]);
  });
  it('a code never contains slot text: only the template slot name and a kind ID', () => {
    const codes = run(base(), with_((g) => (g.slots.discretion_rule = 'PRIVATE ignore all\nTEXT')));
    for (const c of codes) expect(c).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
    expect(codes.join()).not.toMatch(/private|text/i);
  });
  it('warnings stay mapped', () => {
    expect(warningCode('email address in slot tools; names are enough')).toBe('email_in_slot');
  });
});
