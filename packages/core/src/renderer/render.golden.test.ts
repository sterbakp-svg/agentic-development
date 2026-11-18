// T-004 golden and differential render tests.
// Expected output comes from examples/*/expected-instructions.md and from
// test-fixtures/render/*/expected.md, which only reference/composer_ref.py writes
// (see scripts/reference-fixtures.mjs). Never edit those files by hand.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTemplate, render } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const templateDir = join(repoRoot, 'templates/email-triage/v1');
const fixturesDir = join(here, '../../test-fixtures/render');

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

function bytesEqual(text: string, file: string): boolean {
  return Buffer.from(text, 'utf8').equals(readFileSync(file));
}

describe('golden examples render byte-identical to expected-instructions.md', () => {
  const template = loadTemplate(templateDir);
  for (const ex of ['cio-insurance', 'tprm-analyst']) {
    it(`${ex}`, () => {
      const dir = join(repoRoot, 'examples', ex);
      const profile = readJson(join(dir, 'profile.json'));
      const gen = readJson(join(dir, 'slots.json')) as { slots: Record<string, unknown> };
      const { text } = render(template, profile, gen.slots);
      const expectedFile = join(dir, 'expected-instructions.md');
      expect(text).toBe(readFileSync(expectedFile, 'utf8'));
      expect(bytesEqual(text, expectedFile)).toBe(true);
    });
  }
});

describe('differential corpus: TypeScript render equals the Python reference', () => {
  const template = loadTemplate(templateDir);
  const cases = readdirSync(fixturesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  it('the corpus has at least 25 cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(25);
  });

  it('every case has profile.json, slots.json and expected.md', () => {
    for (const c of cases) {
      for (const f of ['profile.json', 'slots.json', 'expected.md']) {
        expect(existsSync(join(fixturesDir, c, f)), `${c}/${f}`).toBe(true);
      }
    }
  });

  for (const c of cases) {
    it(`case ${c}`, () => {
      const dir = join(fixturesDir, c);
      const profile = readJson(join(dir, 'profile.json'));
      const gen = readJson(join(dir, 'slots.json')) as { slots: Record<string, unknown> };
      const { text } = render(template, profile, gen.slots);
      expect(text).toBe(readFileSync(join(dir, 'expected.md'), 'utf8'));
      expect(bytesEqual(text, join(dir, 'expected.md'))).toBe(true);
    });
  }
});
