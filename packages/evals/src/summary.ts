// Score summary and report. Prints IDs, codes, lengths, flags and scores only (golden rule 7).
import { checkRun, type CheckOptions } from './check';
import { evaluateCase, evaluateCaseGroup } from './scoring';
import type { ManualEvalCaseSummary, Parity } from './schema';

export interface ReportEntry extends ManualEvalCaseSummary {
  attempt: number;
  retried: boolean;
  expectReject: boolean;
  scorerMeans: Record<string, number>;
  notScored: boolean;
  repoErrorCodes: string[];
  repoWarningCodes: string[];
  repoChars: number | null;
  flowValid: boolean | null;
  flowChars: number | null;
  /** Failure reasons (codes). Empty when the case passes. */
  reasons: string[];
}

/** One row per caseId (ADR-001 section 8 summary, plus detail fields). Decides pass and fail. */
export interface CaseReport extends ManualEvalCaseSummary {
  expectReject: boolean;
  attempts: number;
  /** Attempts that have scores. */
  judgedAttempts: number;
  /** Mean per scorer over the judged attempts. */
  scorerMeans: Record<string, number>;
  /** False for a negative case, and for a case that no scorer judged: true only if judged. */
  notScored: boolean;
  /** Failure reasons (codes), including the problems of the attempts. Empty when the case passes. */
  reasons: string[];
}

export interface RunReport {
  runId: string;
  date: string;
  templateVersion: string;
  promptVersion: string;
  interviewPromptVersion: string | null;
  promptOption: 'A' | 'B';
  model: string;
  solutionVersion: string;
  scorers: string[];
  /** One row per caseId. `allPass`, the counts and the exit code come from these rows. */
  cases: CaseReport[];
  /** Detail: one row per attempt. */
  entries: ReportEntry[];
  runIssues: string[];
  /** Over cases. `unscored`: cases that are not negative cases and have no judged attempt. */
  counts: { total: number; passed: number; failed: number; unscored: number; attempts: number };
  /** Every case passed and the run has no run-level issue. */
  allPass: boolean;
  /** At least one flow-weaker result (Q-13). */
  releaseBlocking: boolean;
}

export function summarizeRun(runFile: string, opts: CheckOptions): RunReport {
  const check = checkRun(runFile, opts);
  const { run } = check;
  const entries: ReportEntry[] = check.entries.map((e, i) => {
    const source = run.cases[i]!;
    const ev = evaluateCase({
      caseId: e.caseId,
      repoValid: e.repoValid,
      parity: e.parity,
      scores: source.scores,
      expectReject: e.expectReject || undefined,
    });
    const reasons = [...ev.reasons, ...e.problems];
    return {
      caseId: e.caseId,
      repoValid: e.repoValid,
      parity: e.parity,
      meanScore: ev.meanScore,
      minCriterion: ev.minCriterion,
      threshold: ev.threshold,
      pass: reasons.length === 0,
      attempt: e.attempt,
      retried: e.retried,
      expectReject: e.expectReject,
      scorerMeans: ev.scorerMeans,
      notScored: ev.notScored,
      repoErrorCodes: e.repoErrorCodes,
      repoWarningCodes: e.repoWarningCodes,
      repoChars: e.repoChars,
      flowValid: e.flowValid,
      flowChars: e.flowChars,
      reasons,
    };
  });
  const cases: CaseReport[] = [];
  for (const caseId of [...new Set(entries.map((e) => e.caseId))]) {
    const rows = entries.filter((e) => e.caseId === caseId);
    const sources = check.entries
      .map((e, i) => ({ e, c: run.cases[i]! }))
      .filter(({ e }) => e.caseId === caseId);
    const judged = sources.flatMap(({ c }) =>
      c.scores && Object.keys(c.scores).length > 0 ? [c.scores] : [],
    );
    const expectReject = rows.some((r) => r.expectReject);
    const g = evaluateCaseGroup({
      caseId,
      attempts: rows.map((r) => ({ repoValid: r.repoValid, parity: r.parity })),
      judged,
      expectReject: expectReject || undefined,
    });
    const problems = [...new Set(sources.flatMap(({ e }) => e.problems))];
    const reasons = [...g.reasons, ...problems];
    cases.push({
      caseId,
      repoValid: g.repoValid,
      parity: g.parity,
      meanScore: g.meanScore,
      minCriterion: g.minCriterion,
      threshold: g.threshold,
      pass: reasons.length === 0,
      expectReject,
      attempts: rows.length,
      judgedAttempts: g.judgedAttempts,
      scorerMeans: g.scorerMeans,
      notScored: g.notScored,
      reasons,
    });
  }
  const passed = cases.filter((c) => c.pass).length;
  return {
    runId: run.runId,
    date: run.date,
    templateVersion: run.templateVersion,
    promptVersion: run.promptVersion,
    interviewPromptVersion: run.interviewPromptVersion ?? null,
    promptOption: run.promptOption,
    model: run.model,
    solutionVersion: run.solutionVersion,
    scorers: run.scorers,
    cases,
    entries,
    runIssues: check.runIssues,
    counts: {
      total: cases.length,
      passed,
      failed: cases.length - passed,
      unscored: cases.filter((c) => c.notScored && !c.expectReject).length,
      attempts: entries.length,
    },
    allPass: passed === cases.length && check.runIssues.length === 0,
    releaseBlocking: cases.some((c) => c.parity === 'flow-weaker'),
  };
}

const cell = (v: unknown): string => (v === null || v === undefined ? 'n/a' : String(v));
const parityText = (p: Parity | null): string => (p === null ? 'n/a' : p);

export function renderMarkdown(r: RunReport): string {
  const lines: string[] = [`# Manual eval report: ${r.runId}`, ''];
  if (r.releaseBlocking) {
    lines.push(
      '**RELEASE BLOCKING: the flow is weaker than the repository validator in at least one case (Q-13). Fix the flow and run again.**',
      '',
    );
  }
  lines.push(
    `- Date: ${r.date}`,
    `- Solution version: ${r.solutionVersion}`,
    `- Template version: ${r.templateVersion}`,
    `- Prompt version: ${r.promptVersion}, option ${r.promptOption}`,
  );
  if (r.interviewPromptVersion) lines.push(`- Interview prompt version: ${r.interviewPromptVersion}`);
  lines.push(
    `- Model: ${r.model}`,
    `- Scorers: ${r.scorers.join(', ')}`,
    `- Result: ${r.counts.passed} of ${r.counts.total} cases passed, ${r.counts.failed} failed, ${r.counts.unscored} not scored (${r.counts.attempts} attempts)`,
    '',
  );
  if (r.runIssues.length > 0) lines.push(`Run issues: ${r.runIssues.join(', ')}`, '');
  lines.push(
    '## Cases',
    '',
    '| Case | Attempts | Judged | Repo valid | Parity | Mean | Min | Threshold | Result | Reasons |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const c of r.cases) {
    lines.push(
      `| ${c.caseId} | ${c.attempts} | ${c.judgedAttempts} | ${cell(c.repoValid)} | ${parityText(c.parity)} | ${cell(c.meanScore)} | ${cell(c.minCriterion)} | ${c.threshold} | ${c.pass ? 'pass' : 'FAIL'} | ${c.reasons.join(', ') || '-'} |`,
    );
  }
  lines.push(
    '',
    '## Attempts (detail)',
    '',
    '| Case | Attempt | Repo valid | Parity | Mean | Min | Reasons |',
    '|---|---|---|---|---|---|---|',
  );
  for (const e of r.entries) {
    lines.push(
      `| ${e.caseId} | ${e.attempt} | ${cell(e.repoValid)} | ${parityText(e.parity)} | ${cell(e.meanScore)} | ${cell(e.minCriterion)} | ${e.reasons.join(', ') || '-'} |`,
    );
  }
  lines.push(
    '',
    'Pass rule, per case over all attempts: every attempt accepted by the repository validator (a negative case: rejected), worst parity not flow-weaker, at least one judged attempt, pooled mean at or above the threshold, no score below 3. G-01 and G-02 need a judged attempt with two scorers.',
    '',
  );
  return lines.join('\n');
}
