// Helpers shared by the tests. Synthetic data only. Not part of the public API.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '../../..');
export const readJson = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

export const CRITERIA = [
  'role_fit',
  'faithfulness',
  'stakeholder_order',
  'language',
  'placeholders',
  'questions',
] as const;

export function allScores(n: number): Record<(typeof CRITERIA)[number], number> {
  return Object.fromEntries(CRITERIA.map((c) => [c, n])) as Record<
    (typeof CRITERIA)[number],
    number
  >;
}

/** A valid run object. Files named in `cases` are written by `writeRun`. */
export function baseRun(): Record<string, unknown> {
  return {
    runId: '2026-11-25-copilot-studio',
    date: '2026-11-25',
    environment: 'company-test',
    solutionVersion: '1.0.0.1',
    templateVersion: '1.0.0',
    promptVersion: '1.0.0',
    promptOption: 'A',
    model: 'fictional-model-1',
    scorers: ['product-owner', 'domain-user-1'],
    cases: [
      {
        caseId: 'G-01',
        attempt: 1,
        inputFile: 'g01.input.json',
        outputFile: 'g01.output.json',
        retried: false,
        flow: { valid: true, errorCodes: [], warningCodes: [], chars: 100 },
        scores: {
          'product-owner': allScores(5),
          'domain-user-1': allScores(5),
        },
      },
    ],
  };
}

/** Writes run.json and extra files into a new temp dir; returns the run file path. */
export function writeRun(run: unknown, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'evals-run-'));
  for (const [name, text] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  }
  const file = join(dir, 'run.json');
  writeFileSync(file, JSON.stringify(run, null, 2));
  return file;
}
