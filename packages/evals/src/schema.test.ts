// ADR-001 section 8: zod schemas and the JSON Schema file agree.
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { manualEvalRunSchema, manualEvalCaseSummarySchema, RUBRIC_CRITERIA } from './schema';
import { allScores, baseRun, readJson, repoRoot } from './testkit';

type Obj = Record<string, unknown>;
const clone = (o: unknown) => structuredClone(o) as Obj;
const firstCase = (r: Obj) => (r.cases as Obj[])[0] as Obj;
const scoresOf = (r: Obj) => firstCase(r).scores as Obj;
const flowOf = (r: Obj) => firstCase(r).flow as Obj;

function jd(r: Obj): Obj {
  r.interviewPromptVersion = '1.0.0';
  r.cases = [
    { caseId: 'JD-01', attempt: 1, retried: false, scores: { 'product-owner': allScores(4) } },
  ];
  return r;
}
function set(r: Obj, f: (r: Obj) => void): Obj {
  f(r);
  return r;
}

/** [name, mutate, valid in zod, valid in JSON Schema]. The JSON Schema has no cross-field rules. */
const fixtures: [string, (r: Obj) => Obj, boolean, boolean][] = [
  ['valid run', (r) => r, true, true],
  ['valid run without scores', (r) => set(r, () => delete firstCase(r).scores), true, true],
  ['JD case without outputFile and flow, with interviewPromptVersion', jd, true, true],
  [
    'JD case without interviewPromptVersion',
    (r) => set(jd(r), (x) => delete x.interviewPromptVersion),
    false,
    true,
  ],
  [
    'interviewPromptVersion not semver',
    (r) => set(jd(r), (x) => (x.interviewPromptVersion = 'v1')),
    false,
    false,
  ],
  ['non-JD case without outputFile', (r) => set(r, () => delete firstCase(r).outputFile), false, true],
  ['non-JD case without flow', (r) => set(r, () => delete firstCase(r).flow), false, true],
  [
    'JD case with outputFile',
    (r) => set(jd(r), (x) => ((x.cases as Obj[])[0]!.outputFile = 'x.json')),
    false,
    true,
  ],
  ['environment other than company-test', (r) => set(r, () => (r.environment = 'prod')), false, false],
  ['bad date', (r) => set(r, () => (r.date = '25.11.2026')), false, false],
  ['impossible date', (r) => set(r, () => (r.date = '2026-02-31')), false, true],
  ['runId with path separator', (r) => set(r, () => (r.runId = '../x')), false, false],
  ['promptOption C', (r) => set(r, () => (r.promptOption = 'C')), false, false],
  ['empty scorers', (r) => set(r, () => (r.scorers = [])), false, false],
  ['scorer label with spaces (a name)', (r) => set(r, () => (r.scorers = ['Jane Doe'])), false, false],
  ['duplicate scorers', (r) => set(r, () => (r.scorers = ['a-1', 'a-1'])), false, true],
  ['attempt 0', (r) => set(r, () => (firstCase(r).attempt = 0)), false, false],
  ['attempt fractional', (r) => set(r, () => (firstCase(r).attempt = 1.5)), false, false],
  ['absolute inputFile', (r) => set(r, () => (firstCase(r).inputFile = '/etc/x')), false, false],
  ['parent path in outputFile', (r) => set(r, () => (firstCase(r).outputFile = '../a.json')), false, false],
  ['score 6', (r) => set(r, () => (scoresOf(r)['product-owner'] = allScores(6))), false, false],
  ['score 0', (r) => set(r, () => (scoresOf(r)['product-owner'] = allScores(0))), false, false],
  ['score 3.5', (r) => set(r, () => (scoresOf(r)['product-owner'] = allScores(3.5))), false, false],
  [
    'missing criterion',
    (r) => set(r, () => delete (scoresOf(r)['product-owner'] as Obj).questions),
    false,
    false,
  ],
  [
    'unknown criterion',
    (r) => set(r, () => ((scoresOf(r)['product-owner'] as Obj).extra = 3)),
    false,
    false,
  ],
  [
    'scorer not listed in scorers',
    (r) => set(r, () => (scoresOf(r)['stranger'] = allScores(4))),
    false,
    true,
  ],
  [
    'flow valid with error codes',
    (r) => set(r, () => (flowOf(r).errorCodes = ['slot_too_long'])),
    false,
    true,
  ],
  ['flow invalid without error codes', (r) => set(r, () => (flowOf(r).valid = false)), false, true],
  ['flow chars negative', (r) => set(r, () => (flowOf(r).chars = -1)), false, false],
  [
    'flow code not snake_case',
    (r) => set(r, () => (flowOf(r).warningCodes = ['Bad Code'])),
    false,
    false,
  ],
  ['unknown top-level field', (r) => set(r, () => (r.extra = 1)), false, false],
  [
    'duplicate caseId and attempt',
    (r) => set(r, () => (r.cases as Obj[]).push(clone(firstCase(r)))),
    false,
    true,
  ],
  ['no cases', (r) => set(r, () => (r.cases = [])), false, false],
];

describe('ManualEvalRun zod schema (contract per ADR-001 section 8)', () => {
  it.each(fixtures)('%s', (_name, mutate, zodOk) => {
    expect(manualEvalRunSchema.safeParse(mutate(clone(baseRun()))).success).toBe(zodOk);
  });

  it('lists the six rubric criteria of evals/cases.md', () => {
    expect([...RUBRIC_CRITERIA]).toEqual([
      'role_fit',
      'faithfulness',
      'stakeholder_order',
      'language',
      'placeholders',
      'questions',
    ]);
  });

  it('ManualEvalCaseSummary accepts the ADR example and rejects bad values', () => {
    const ex = {
      caseId: 'G-01',
      repoValid: true,
      parity: 'same',
      meanScore: 4.6,
      minCriterion: 4,
      threshold: 4.5,
      pass: true,
    };
    expect(manualEvalCaseSummarySchema.safeParse(ex).success).toBe(true);
    expect(manualEvalCaseSummarySchema.safeParse({ ...ex, threshold: 3 }).success).toBe(false);
    expect(manualEvalCaseSummarySchema.safeParse({ ...ex, parity: 'weaker' }).success).toBe(false);
  });
});

describe('schemas/manual-eval-run.schema.json agrees with zod', () => {
  const schema = readJson(join(repoRoot, 'schemas/manual-eval-run.schema.json'));
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema as object);

  it.each(fixtures)('%s', (_name, mutate, zodOk, jsonOk) => {
    expect(validate(mutate(clone(baseRun())))).toBe(jsonOk);
    // The JSON Schema may be looser than zod, never stricter.
    if (zodOk) expect(jsonOk).toBe(true);
  });

  it('evals/runs/TEMPLATE.json passes both', () => {
    const t = readJson(join(repoRoot, 'evals/runs/TEMPLATE.json'));
    expect(manualEvalRunSchema.safeParse(t).success).toBe(true);
    expect(validate(t)).toBe(true);
  });
});
