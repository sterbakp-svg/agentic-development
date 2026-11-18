// Score summary and report. Prints IDs, codes, lengths, flags and scores only (golden rule 7).
import { checkRun, type CheckOptions } from './check';
import { evaluateCase } from './scoring';
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
  entries: ReportEntry[];
  runIssues: string[];
  counts: { total: number; passed: number; failed: number; unscored: number };
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
  const passed = entries.filter((e) => e.pass).length;
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
    entries,
    runIssues: check.runIssues,
    counts: {
      total: entries.length,
      passed,
      failed: entries.length - passed,
      unscored: entries.filter((e) => e.notScored).length,
    },
    allPass: passed === entries.length && check.runIssues.length === 0,
    releaseBlocking: entries.some((e) => e.parity === 'flow-weaker'),
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
    `- Result: ${r.counts.passed} of ${r.counts.total} passed, ${r.counts.failed} failed, ${r.counts.unscored} not scored`,
    '',
  );
  if (r.runIssues.length > 0) lines.push(`Run issues: ${r.runIssues.join(', ')}`, '');
  lines.push(
    '| Case | Attempt | Repo valid | Parity | Mean | Min | Threshold | Result | Reasons |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const e of r.entries) {
    lines.push(
      `| ${e.caseId} | ${e.attempt} | ${cell(e.repoValid)} | ${parityText(e.parity)} | ${cell(e.meanScore)} | ${cell(e.minCriterion)} | ${e.threshold} | ${e.pass ? 'pass' : 'FAIL'} | ${e.reasons.join(', ') || '-'} |`,
    );
  }
  lines.push(
    '',
    'Pass rule: mean at or above the threshold, no score below 3, repository validator accepts the output, flow not weaker than the repository. G-01 and G-02 need two scorers.',
    '',
  );
  return lines.join('\n');
}
