// Pass rule per evals/cases.md and ADR-001 section 5 (T-013) and P-11 (two scorers for G-01, G-02).
import { describe, expect, it } from 'vitest';
import { evaluateCase, thresholdFor, type CaseEvalInput } from './scoring';

type Scores = NonNullable<CaseEvalInput['scores']>;
const s = (...c: number[]) => ({
  role_fit: c[0]!,
  faithfulness: c[1]!,
  stakeholder_order: c[2]!,
  language: c[3]!,
  placeholders: c[4]!,
  questions: c[5]!,
});
const one = (x: ReturnType<typeof s>): Scores => ({ 'product-owner': x as Scores[string] });
const two = (a: ReturnType<typeof s>, b: ReturnType<typeof s>): Scores => ({
  'product-owner': a as Scores[string],
  'domain-user-1': b as Scores[string],
});
const good = { repoValid: true, parity: 'same' } as const;

describe('thresholdFor', () => {
  it.each([
    ['G-01', 4.5],
    ['G-02', 4.5],
    ['G-03', 4.0],
    ['R-01', 4.0],
    ['PR-03', 4.0],
    ['JD-02', 4.0],
    ['S-03', 4.0],
  ])('%s -> %s', (id, t) => expect(thresholdFor(id)).toBe(t));
});

describe('evaluateCase pass rule', () => {
  type Row = [string, CaseEvalInput, { pass: boolean; mean?: number | null; min?: number | null; reason?: string }];
  const rows: Row[] = [
    ['R-01 all 4 passes at 4.0', { caseId: 'R-01', ...good, scores: one(s(4, 4, 4, 4, 4, 4)) }, { pass: true, mean: 4, min: 4 }],
    ['R-01 mean 3.83 fails', { caseId: 'R-01', ...good, scores: one(s(4, 4, 4, 4, 4, 3)) }, { pass: false, reason: 'below_threshold' }],
    ['R-01 mean 4.5 but one criterion 2 fails', { caseId: 'R-01', ...good, scores: one(s(5, 5, 5, 5, 5, 2)) }, { pass: false, mean: 4.5, min: 2, reason: 'criterion_below_3' }],
    ['R-01 criterion exactly 3 with mean above 4 passes', { caseId: 'R-01', ...good, scores: one(s(5, 5, 5, 5, 5, 3)) }, { pass: true, min: 3 }],
    ['G-01 one scorer all 5 fails: needs two scorers', { caseId: 'G-01', ...good, scores: one(s(5, 5, 5, 5, 5, 5)) }, { pass: false, reason: 'needs_two_scorers' }],
    ['G-01 two scorers 4 and 5 give exactly 4.5 and pass', { caseId: 'G-01', ...good, scores: two(s(4, 4, 4, 4, 4, 4), s(5, 5, 5, 5, 5, 5)) }, { pass: true, mean: 4.5, min: 4 }],
    ['G-01 two scorers mean 4.42 fails', { caseId: 'G-01', ...good, scores: two(s(4, 4, 4, 4, 4, 4), s(5, 5, 5, 5, 5, 4)) }, { pass: false, reason: 'below_threshold' }],
    ['G-02 one scorer gives a 2: whole case fails', { caseId: 'G-02', ...good, scores: two(s(5, 5, 5, 5, 5, 5), s(5, 5, 5, 5, 5, 2)) }, { pass: false, min: 2, reason: 'criterion_below_3' }],
    ['G-02 two scorers all 5 pass', { caseId: 'G-02', ...good, scores: two(s(5, 5, 5, 5, 5, 5), s(5, 5, 5, 5, 5, 5)) }, { pass: true, mean: 5 }],
    ['repo invalid fails despite scores', { caseId: 'R-01', repoValid: false, parity: 'same', scores: one(s(5, 5, 5, 5, 5, 5)) }, { pass: false, reason: 'repo_invalid' }],
    ['flow-weaker fails despite scores', { caseId: 'R-01', repoValid: true, parity: 'flow-weaker', scores: one(s(5, 5, 5, 5, 5, 5)) }, { pass: false, reason: 'flow_weaker' }],
    ['flow-stricter does not fail by itself', { caseId: 'R-01', repoValid: true, parity: 'flow-stricter', scores: one(s(5, 5, 5, 5, 5, 5)) }, { pass: true }],
    ['unscored case passes on deterministic checks, mean null', { caseId: 'T-01', ...good }, { pass: true, mean: null, min: null }],
    ['unscored case with repo invalid fails', { caseId: 'T-01', repoValid: false, parity: 'same' }, { pass: false, reason: 'repo_invalid' }],
    ['S-03 expected rejection: repo and flow reject, pass', { caseId: 'S-03', repoValid: false, parity: 'same', expectReject: true }, { pass: true }],
    ['S-03 expected rejection but repo accepts, fail', { caseId: 'S-03', repoValid: true, parity: 'same', expectReject: true }, { pass: false, reason: 'accepted_bad_output' }],
    ['S-03 expected rejection but flow accepts is flow-weaker, fail', { caseId: 'S-03', repoValid: false, parity: 'flow-weaker', expectReject: true }, { pass: false, reason: 'flow_weaker' }],
    ['JD case: scores only, passes at 4', { caseId: 'JD-01', repoValid: null, parity: null, scores: one(s(4, 4, 4, 4, 4, 4)) }, { pass: true, mean: 4 }],
    ['JD case below threshold fails', { caseId: 'JD-01', repoValid: null, parity: null, scores: one(s(4, 4, 4, 4, 3, 3)) }, { pass: false, reason: 'below_threshold' }],
    ['JD case without scores fails: not scored', { caseId: 'JD-01', repoValid: null, parity: null }, { pass: false, reason: 'not_scored' }],
  ];

  it.each(rows)('%s', (_n, input, exp) => {
    const r = evaluateCase(input);
    expect(r.pass).toBe(exp.pass);
    if (exp.mean !== undefined) expect(r.meanScore).toBe(exp.mean);
    if (exp.min !== undefined) expect(r.minCriterion).toBe(exp.min);
    if (exp.reason) expect(r.reasons).toContain(exp.reason);
    if (exp.pass) expect(r.reasons).toEqual([]);
    expect(r.threshold).toBe(thresholdFor(input.caseId));
  });

  it('rounds the mean to 2 decimals', () => {
    const r = evaluateCase({ caseId: 'R-01', ...good, scores: one(s(5, 4, 4, 4, 4, 4)) });
    expect(r.meanScore).toBe(4.17);
  });
});
