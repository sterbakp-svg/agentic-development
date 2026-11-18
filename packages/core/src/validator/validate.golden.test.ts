// T-005 golden and differential validator tests.
// Expected output comes from reference/composer_ref.py: examples/* must pass,
// evals/negative/injection-slots.json must fail with the 4 reference errors, and every case in
// test-fixtures/validate/*/expected.json (written only by scripts/reference-fixtures.mjs) must
// deep-equal the TypeScript result: same ok, chars, error and warning strings in the same order.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTemplate, validate } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const templateDir = join(repoRoot, 'templates/email-triage/v1');
const fixturesDir = join(here, '../../test-fixtures/validate');

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

describe('golden examples pass the validator', () => {
  const template = loadTemplate(templateDir);
  for (const ex of ['cio-insurance', 'tprm-analyst']) {
    it(`${ex} is ok with no errors and no warnings`, () => {
      const dir = join(repoRoot, 'examples', ex);
      const result = validate(
        template,
        readJson(join(dir, 'profile.json')),
        readJson(join(dir, 'slots.json')),
      );
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.ok).toBe(true);
    });
  }
});

describe('evals/negative/injection-slots.json fails with the same 4 errors as the reference', () => {
  const template = loadTemplate(templateDir);
  const injection = readJson(join(repoRoot, 'evals/negative/injection-slots.json'));
  for (const ex of ['cio-insurance', 'tprm-analyst']) {
    it(`with the ${ex} profile`, () => {
      const profile = readJson(join(repoRoot, 'examples', ex, 'profile.json'));
      const result = validate(template, profile, injection);
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual([
        String.raw`forbidden content in slot tools: /[\r\n]/`,
        String.raw`forbidden content in slot tools: /^\s*#/`,
        String.raw`forbidden content in slot discretion_rule: /ignore (all|any|the|previous|above)/`,
        String.raw`forbidden content in slot discretion_rule: /\b(send|forward|delete|move)\b[^.;]*\b(automatically|without (asking|review))/`,
      ]);
      expect(result.warnings).toEqual([]);
    });
  }
});

describe('differential corpus: TypeScript validate equals the Python reference', () => {
  const template = loadTemplate(templateDir);
  const cases = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  it('the corpus has at least 40 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
  });

  it('every case has profile.json, generator-output.json and expected.json', () => {
    for (const c of cases) {
      for (const f of ['profile.json', 'generator-output.json', 'expected.json']) {
        expect(existsSync(join(fixturesDir, c, f)), `${c}/${f}`).toBe(true);
      }
    }
  });

  it('the corpus holds both passing and failing cases', () => {
    const oks = cases.map(
      (c) => (readJson(join(fixturesDir, c, 'expected.json')) as { ok: boolean }).ok,
    );
    expect(oks).toContain(true);
    expect(oks).toContain(false);
  });

  for (const c of cases) {
    it(`case ${c}`, () => {
      const dir = join(fixturesDir, c);
      const result = validate(
        template,
        readJson(join(dir, 'profile.json')),
        readJson(join(dir, 'generator-output.json')),
      );
      expect(result).toEqual(readJson(join(dir, 'expected.json')));
    });
  }
});
