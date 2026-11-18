// ADR-001 section 8: one summary per caseId. The per-case rows decide pass, allPass and the exit
// code; the per-attempt rows are detail (review B2).
import { describe, expect, it } from 'vitest';
import { main } from './cli';
import {
  FILES,
  GOLDEN_SLOTS,
  goldenCase,
  injectionCase,
  injectionCodes,
  INJECTION_SLOTS,
  runWith,
} from './fixtures';
import { manualEvalCaseSummarySchema } from './schema';
import { renderMarkdown, summarizeRun } from './summary';
import { allScores, repoRoot } from './testkit';

const opts = { root: repoRoot };
const files = { ...FILES, 'g01b.output.json': INJECTION_SLOTS, 'g01c.output.json': GOLDEN_SLOTS };
const rejectFlow = { valid: false, errorCodes: injectionCodes, warningCodes: [], chars: 0 };
const acceptFlow = { valid: true, errorCodes: [], warningCodes: [], chars: 0 };
const noScores = { scores: undefined };
const two = (n: number) => ({ 'product-owner': allScores(n), 'domain-user-1': allScores(n) });
const summarize = (cases: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  summarizeRun(runWith(cases, extra, files), opts);

describe('one row per caseId', () => {
  it('folds the attempts of a case into one row with the ADR fields', () => {
    const r = summarize([goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01c.output.json' })]);
    expect(r.cases).toHaveLength(1);
    expect(r.entries).toHaveLength(2);
    const { caseId, repoValid, parity, meanScore, minCriterion, threshold, pass } = r.cases[0]!;
    expect({ caseId, repoValid, parity, meanScore, minCriterion, threshold, pass }).toEqual({
      caseId: 'G-01',
      repoValid: true,
      parity: 'same',
      meanScore: 5,
      minCriterion: 5,
      threshold: 4.5,
      pass: true,
    });
    expect(r.cases[0]).toMatchObject({ attempts: 2, judgedAttempts: 2 });
    expect(manualEvalCaseSummarySchema.safeParse({ caseId, repoValid, parity, meanScore, minCriterion, threshold, pass }).success).toBe(true);
  });

  it('repoValid is false when any attempt is invalid, and the case fails with repo_invalid', () => {
    const r = summarize([
      goldenCase(),
      goldenCase({ attempt: 2, outputFile: 'g01b.output.json', flow: rejectFlow }),
    ]);
    expect(r.cases[0]).toMatchObject({ repoValid: false, pass: false });
    expect(r.cases[0]!.reasons).toContain('repo_invalid');
    expect(r.allPass).toBe(false);
  });

  it('parity is the worst of the attempts, and flow-weaker blocks the release', () => {
    const r = summarize([
      goldenCase(),
      goldenCase({ attempt: 2, outputFile: 'g01b.output.json', flow: acceptFlow }),
      goldenCase({ attempt: 3, outputFile: 'g01c.output.json', flow: { ...acceptFlow, chars: 0 } }),
    ]);
    expect(r.cases[0]!.parity).toBe('flow-weaker');
    expect(r.cases[0]!.reasons).toContain('flow_weaker');
    expect(r.releaseBlocking).toBe(true);
  });

  it('flow-stricter on one attempt and same on the others gives flow-stricter', () => {
    const stricter = { ...acceptFlow, valid: false, errorCodes: ['extra_rule'] };
    const r = summarize([goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01c.output.json', flow: stricter })]);
    expect(r.cases[0]!.parity).toBe('flow-stricter');
  });

  it('scores are pooled over the judged attempts only', () => {
    const r = summarize([
      goldenCase({ scores: two(5) }),
      goldenCase({ attempt: 2, outputFile: 'g01c.output.json', scores: two(4) }),
      goldenCase({ attempt: 3, outputFile: 'g01c.output.json', ...noScores }),
    ]);
    expect(r.cases[0]).toMatchObject({ meanScore: 4.5, minCriterion: 4, judgedAttempts: 2, attempts: 3, pass: true });
    expect(r.cases[0]!.scorerMeans).toEqual({ 'product-owner': 4.5, 'domain-user-1': 4.5 });
  });

  it('pooled mean below the threshold fails the case although attempt 1 alone would pass', () => {
    const r = summarize([
      goldenCase({ scores: two(5) }),
      goldenCase({ attempt: 2, outputFile: 'g01c.output.json', scores: two(3) }),
    ]);
    expect(r.entries[0]!.pass).toBe(true);
    expect(r.cases[0]!.reasons).toContain('below_threshold');
    expect(r.cases[0]!.pass).toBe(false);
    expect(r.allPass).toBe(false);
  });
});

describe('not scored (review B2)', () => {
  it('a case that is not a negative case and has no judged attempt fails with not_scored', () => {
    const r = summarize([goldenCase(noScores), goldenCase({ attempt: 2, ...noScores })]);
    expect(r.cases[0]!.reasons).toContain('not_scored');
    expect(r.cases[0]).toMatchObject({ pass: false, meanScore: null, judgedAttempts: 0 });
    expect(r.counts).toMatchObject({ total: 1, passed: 0, failed: 1, unscored: 1 });
    expect(r.allPass).toBe(false);
  });

  it('a negative case needs no scores', () => {
    const r = summarize([injectionCase(rejectFlow)]);
    expect(r.cases[0]).toMatchObject({ pass: true, notScored: true, repoValid: false, parity: 'same' });
    expect(r.counts.unscored).toBe(0);
    expect(r.allPass).toBe(true);
  });

  it('a negative case fails when one of its attempts is accepted by the repository', () => {
    const r = summarize([
      injectionCase(rejectFlow),
      injectionCase(acceptFlow, { attempt: 2, outputFile: 'g01c.output.json', inputFile: 'g01.input.json' }),
    ]);
    expect(r.cases[0]!.reasons).toContain('accepted_bad_output');
    expect(r.cases[0]!.pass).toBe(false);
  });

  it('G-01 fails when no judged attempt has two scorers, even if two attempts have one each', () => {
    const r = summarize([
      goldenCase({ scores: { 'product-owner': allScores(5) } }),
      goldenCase({ attempt: 2, outputFile: 'g01c.output.json', scores: { 'domain-user-1': allScores(5) } }),
    ]);
    expect(r.cases[0]!.reasons).toContain('needs_two_scorers');
    expect(r.cases[0]!.pass).toBe(false);
  });

  it('G-01 passes when one judged attempt has two scorers and another has one', () => {
    const r = summarize([
      goldenCase(),
      goldenCase({ attempt: 2, outputFile: 'g01c.output.json', scores: { 'product-owner': allScores(5) } }),
    ]);
    expect(r.cases[0]).toMatchObject({ pass: true, reasons: [] });
  });

  it('G-02 follows the same two-scorer rule', () => {
    const g02 = { caseId: 'G-02', scores: { 'product-owner': allScores(5) } };
    const r = summarize([goldenCase(g02)]);
    expect(r.cases[0]!.reasons).toContain('needs_two_scorers');
  });

  it('a JD case without a judged attempt fails with not_scored', () => {
    const jd = { caseId: 'JD-01', attempt: 1, retried: false };
    const r = summarizeRun(runWith([jd], { interviewPromptVersion: '1.0.0' }, {}), opts);
    expect(r.cases[0]).toMatchObject({ repoValid: null, parity: null, pass: false });
    expect(r.cases[0]!.reasons).toContain('not_scored');
  });
});

describe('allPass and the exit code come from the per-case rows', () => {
  const run = (cases: Record<string, unknown>[]) => {
    const file = runWith(cases, {}, files);
    const out: string[] = [];
    const code = main(['summary', file], { out: (t) => out.push(t), err: (t) => out.push(t) }, repoRoot);
    return { code, text: out.join('') };
  };

  it('an unjudged retry next to a judged attempt does not fail the run', () => {
    const r = summarize([goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01c.output.json', ...noScores })]);
    expect(r.allPass).toBe(true);
    expect(run([goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01c.output.json', ...noScores })]).code).toBe(0);
  });

  it('an unscored case gives exit code 1', () => {
    expect(run([goldenCase(noScores)]).code).toBe(1);
  });

  it('flow-weaker gives exit code 3', () => {
    const weak = [goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01b.output.json', flow: acceptFlow })];
    expect(run(weak).code).toBe(3);
  });

  it('the Markdown report has a case table and an attempt table, without content', () => {
    const md = renderMarkdown(summarize([goldenCase(), goldenCase({ attempt: 2, outputFile: 'g01c.output.json' })]));
    expect(md).toMatch(/\| G-01 \| 2 \| 2 \|/);
    expect(md).toContain('Attempts (detail)');
    expect(md).not.toContain(GOLDEN_SLOTS.slice(60, 120));
  });
});
