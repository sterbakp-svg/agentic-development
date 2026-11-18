import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GUARDRAIL_LINES, REQUIRED_HEADINGS } from './guardrails';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const ref = readFileSync(join(root, 'reference/composer_ref.py'), 'utf8');
const outputs = ['cio-insurance', 'tprm-analyst'].map((e) =>
  readFileSync(join(root, 'examples', e, 'expected-instructions.md'), 'utf8'),
);

describe('guardrail lines and headings', () => {
  it.each([...GUARDRAIL_LINES, ...REQUIRED_HEADINGS])('%s is in the reference', (line) => {
    expect(ref).toContain(line);
  });
  it.each([...GUARDRAIL_LINES])('guardrail %s is in both golden outputs', (line) => {
    for (const o of outputs) expect(o).toContain(line);
  });
  it.each([...REQUIRED_HEADINGS])('heading %s is in both golden outputs', (h) => {
    for (const o of outputs) expect(o).toContain(h + '\n');
  });
});
