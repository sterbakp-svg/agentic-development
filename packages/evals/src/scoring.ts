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

/** All attempts of one case, folded (ADR-001 section 8: one summary per caseId). */
export interface CaseGroupInput {
  caseId: string;
  /** Per attempt: repository result and parity. null for JD cases. */
  attempts: { repoValid: boolean | null; parity: Parity | null }[];
  /** Scores of the judged attempts only, one entry per judged attempt. */
  judged: Scores[];
  expectReject?: boolean | undefined;
}

export interface CaseGroupResult extends CaseEvalResult {
  /** repoValid over all attempts: true only when every attempt is valid. null for JD cases. */
  repoValid: boolean | null;
  /** Worst parity over the attempts: flow-weaker, then flow-stricter, then same. */
  parity: Parity | null;
  judgedAttempts: number;
}

/** G-01 and G-02 need 4.5, every other case 4.0 (evals/cases.md). */
export function thresholdFor(caseId: string): 4.0 | 4.5 {
  return caseId === 'G-01' || caseId === 'G-02' ? 4.5 : 4.0;
}

/** P-11: G-01 and G-02 are scored by two scorers. */
export const minScorersFor = (caseId: string): number =>
  caseId === 'G-01' || caseId === 'G-02' ? 2 : 1;

const round2 = (n: number): number => Math.round(n * 100) / 100;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

interface Judgement {
  caseId: string;
  repoValid: boolean | null;
  /** For a negative case: some attempt was accepted by the repository. */
  anyAccepted: boolean;
  parity: Parity | null;
  judged: Scores[];
  expectReject: boolean;
  /** Fail when nothing was judged (see evaluateCase and evaluateCaseGroup). */
  requireScores: boolean;
}

function judge(j: Judgement): CaseEvalResult {
  const { caseId, repoValid, parity, expectReject } = j;
  const threshold = thresholdFor(caseId);
  const reasons: string[] = [];
  const perScorer = new Map<string, number[]>();
  let bestScorerCount = 0;
  for (const scores of j.judged) {
    const entries = Object.entries(scores);
    bestScorerCount = Math.max(bestScorerCount, entries.length);
    for (const [name, s] of entries) {
      perScorer.set(name, [...(perScorer.get(name) ?? []), ...Object.values(s)]);
    }
  }
  const all = [...perScorer.values()].flat();
  const scored = all.length > 0;

  const meanExact = scored ? mean(all) : null;
  const minCriterion = scored ? Math.min(...all) : null;
  const scorerMeans = Object.fromEntries([...perScorer].map(([n, v]) => [n, round2(mean(v))]));

  if (repoValid !== null) {
    if (expectReject) {
      if (j.anyAccepted) reasons.push('accepted_bad_output');
    } else if (!repoValid) {
      reasons.push('repo_invalid');
    }
    if (parity === 'flow-weaker') reasons.push('flow_weaker');
  }

  if (!expectReject) {
    if (scored) {
      if (minCriterion !== null && minCriterion < 3) reasons.push('criterion_below_3');
      if (meanExact !== null && meanExact < threshold) reasons.push('below_threshold');
      if (bestScorerCount < minScorersFor(caseId)) reasons.push('needs_two_scorers');
    } else if (j.requireScores) {
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

/**
 * Pass rule for one attempt (detail row). Scores of all scorers are pooled: meanScore is the mean
 * over all criteria and all scorers (ADR-001 section 8), minCriterion is the lowest single score of
 * any scorer. A case passes when the pooled mean reaches the threshold, no single score is below 3,
 * the repository accepts the output (or rejects it, for a negative case), the flow is not weaker
 * than the repository, and the minimum number of scorers judged it (two for G-01 and G-02).
 * An attempt without scores passes on the deterministic checks alone; a JD attempt (no render
 * check) cannot. The per-case rule that every case must be judged is in `evaluateCaseGroup`.
 */
export function evaluateCase(input: CaseEvalInput): CaseEvalResult {
  return judge({
    caseId: input.caseId,
    repoValid: input.repoValid,
    anyAccepted: input.repoValid === true,
    parity: input.parity,
    judged: input.scores && Object.keys(input.scores).length > 0 ? [input.scores] : [],
    expectReject: input.expectReject === true,
    requireScores: input.repoValid === null,
  });
}

const PARITY_RANK: Record<Parity, number> = { same: 0, 'flow-stricter': 1, 'flow-weaker': 2 };

/**
 * Pass rule for one case over all its attempts (ADR-001 section 8: this decides `pass`).
 * - repoValid: every attempt valid. For a negative case (`expectReject`) one accepted attempt fails.
 * - parity: the worst of the attempts.
 * - scores: pooled over the judged attempts. A case that is not a negative case needs at least one
 *   judged attempt (`not_scored`); G-01 and G-02 need a judged attempt with two scorers.
 */
export function evaluateCaseGroup(input: CaseGroupInput): CaseGroupResult {
  const { attempts } = input;
  const known = attempts.filter((a) => a.repoValid !== null);
  const repoValid = known.length === 0 ? null : known.every((a) => a.repoValid === true);
  const parities = attempts.flatMap((a) => (a.parity === null ? [] : [a.parity]));
  const parity = parities.length === 0 ? null : parities.reduce((w, p) => (PARITY_RANK[p] > PARITY_RANK[w] ? p : w));
  const result = judge({
    caseId: input.caseId,
    repoValid,
    anyAccepted: known.some((a) => a.repoValid === true),
    parity,
    judged: input.judged,
    expectReject: input.expectReject === true,
    requireScores: true,
  });
  return { ...result, repoValid, parity, judgedAttempts: input.judged.length };
}
