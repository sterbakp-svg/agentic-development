import type { Parity } from './schema';

type Scores = Record<string, Record<string, number>>;

export interface CaseEvalInput {
  caseId: string;
  /** Core validator on the saved output. null for JD cases (no render check). */
  repoValid: boolean | null;
  parity: Parity | null;
  scores?: Scores | undefined;
  /** Negative case: the output must be rejected. */
  expectReject?: boolean | undefined;
}

export interface CaseEvalResult {
  meanScore: number | null;
  minCriterion: number | null;
  threshold: 4.0 | 4.5;
  pass: boolean;
  /** Failure reasons as codes. Empty when the case passes. */
  reasons: string[];
  /** True when no scorer judged this attempt. */
  notScored: boolean;
  /** Mean per scorer, rounded to 2 decimals. Shows disagreement between scorers. */
  scorerMeans: Record<string, number>;
}

/** G-01 and G-02 need 4.5, every other case 4.0 (evals/cases.md). */
export function thresholdFor(caseId: string): 4.0 | 4.5 {
  return caseId === 'G-01' || caseId === 'G-02' ? 4.5 : 4.0;
}

/** P-11: G-01 and G-02 are scored by two scorers. */
export const minScorersFor = (caseId: string): number =>
  caseId === 'G-01' || caseId === 'G-02' ? 2 : 1;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Pass rule. Scores of all scorers are pooled: meanScore is the mean over all criteria and all
 * scorers (ADR-001 section 8), minCriterion is the lowest single score of any scorer. A case
 * passes when the pooled mean reaches the threshold, no single score is below 3, the repository
 * accepts the output (or rejects it, for a negative case), the flow is not weaker than the
 * repository, and the minimum number of scorers judged it (two for G-01 and G-02).
 * Without scores a case with a render check passes on the deterministic checks alone; a JD case
 * (no render check) cannot pass without scores.
 */
export function evaluateCase(input: CaseEvalInput): CaseEvalResult {
  const { caseId, repoValid, parity, expectReject } = input;
  const threshold = thresholdFor(caseId);
  const reasons: string[] = [];
  const scorerEntries = Object.entries(input.scores ?? {});
  const all = scorerEntries.flatMap(([, s]) => Object.values(s));
  const scored = all.length > 0;
  const jd = repoValid === null;

  const meanExact = scored ? all.reduce((a, b) => a + b, 0) / all.length : null;
  const minCriterion = scored ? Math.min(...all) : null;
  const scorerMeans = Object.fromEntries(
    scorerEntries.map(([name, s]) => {
      const v = Object.values(s);
      return [name, round2(v.reduce((a, b) => a + b, 0) / v.length)];
    }),
  );

  if (!jd) {
    if (expectReject) {
      if (repoValid) reasons.push('accepted_bad_output');
    } else if (!repoValid) {
      reasons.push('repo_invalid');
    }
    if (parity === 'flow-weaker') reasons.push('flow_weaker');
  }

  if (!expectReject) {
    if (scored) {
      if (minCriterion !== null && minCriterion < 3) reasons.push('criterion_below_3');
      if (meanExact !== null && meanExact < threshold) reasons.push('below_threshold');
      if (scorerEntries.length < minScorersFor(caseId)) reasons.push('needs_two_scorers');
    } else if (jd) {
      reasons.push('not_scored');
    }
  }

  return {
    meanScore: meanExact === null ? null : round2(meanExact),
    minCriterion,
    threshold,
    pass: reasons.length === 0,
    reasons,
    notScored: !scored,
    scorerMeans,
  };
}
