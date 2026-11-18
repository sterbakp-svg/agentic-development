// Score summary: per case meanScore, minCriterion, threshold, pass; JSON and Markdown report.
import { describe, expect, it } from 'vitest';
import { manualEvalCaseSummarySchema } from './schema';
import { renderMarkdown, summarizeRun } from './summary';
import { goldenCase, injectionCase, injectionCodes, runWith, GOLDEN_SLOTS } from './fixtures';
import { allScores, repoRoot } from './testkit';

const opts = { root: repoRoot };
const rejectFlow = { valid: false, errorCodes: injectionCodes, warningCodes: [], chars: 0 };

describe('summarizeRun', () => {
  it('G-01 golden output with two scorers at 5 passes with threshold 4.5', () => {
    const r = summarizeRun(runWith([goldenCase()]), opts);
    expect(r.entries[0]).toMatchObject({
      caseId: 'G-01',
      repoValid: true,
      parity: 'same',
      meanScore: 5,
      minCriterion: 5,
      threshold: 4.5,
      pass: true,
    });
    expect(r.allPass).toBe(true);
    expect(r.releaseBlocking).toBe(false);
  });

  it('entries contain the ADR summary fields and validate against its schema', () => {
    const r = summarizeRun(runWith([goldenCase(), injectionCase(rejectFlow)]), opts);
    for (const e of r.entries) {
      const { caseId, repoValid, parity, meanScore, minCriterion, threshold, pass } = e;
      expect(
        manualEvalCaseSummarySchema.safeParse({ caseId, repoValid, parity, meanScore, minCriterion, threshold, pass })
          .success,
      ).toBe(true);
    }
  });

  it('injection output with expectReject passes: both sides reject', () => {
    const r = summarizeRun(runWith([injectionCase(rejectFlow)]), opts);
    expect(r.entries[0]).toMatchObject({ repoValid: false, parity: 'same', pass: true });
  });

  it('injection output without expectReject fails', () => {
    const r = summarizeRun(runWith([injectionCase(rejectFlow, { expectReject: undefined })]), opts);
    expect(r.entries[0]!.pass).toBe(false);
    expect(r.entries[0]!.reasons).toContain('repo_invalid');
    expect(r.allPass).toBe(false);
  });

  it('flow-weaker is release blocking', () => {
    const weak = { valid: true, errorCodes: [], warningCodes: [], chars: 0 };
    const r = summarizeRun(runWith([injectionCase(weak)]), opts);
    expect(r.entries[0]!.parity).toBe('flow-weaker');
    expect(r.entries[0]!.pass).toBe(false);
    expect(r.releaseBlocking).toBe(true);
  });

  it('a problem such as chars_mismatch fails the case', () => {
    const flow = { valid: true, errorCodes: [], warningCodes: [], chars: 1 };
    const r = summarizeRun(runWith([goldenCase({ flow })]), opts);
    expect(r.entries[0]!.pass).toBe(false);
    expect(r.entries[0]!.reasons).toContain('chars_mismatch');
  });

  it('G-01 with one scorer fails: two scorers needed (P-11)', () => {
    const r = summarizeRun(
      runWith([goldenCase({ scores: { 'product-owner': allScores(5) } })]),
      opts,
    );
    expect(r.entries[0]!.reasons).toContain('needs_two_scorers');
    expect(r.entries[0]!.pass).toBe(false);
  });

  it('counts passes, fails and unscored attempts', () => {
    const r = summarizeRun(
      runWith([goldenCase(), goldenCase({ attempt: 2, scores: undefined })]),
      opts,
    );
    expect(r.counts).toEqual({ total: 2, passed: 2, failed: 0, unscored: 1 });
  });

  it('keeps one entry per case attempt', () => {
    const r = summarizeRun(runWith([goldenCase(), goldenCase({ attempt: 2 })]), opts);
    expect(r.entries.map((e) => [e.caseId, e.attempt])).toEqual([
      ['G-01', 1],
      ['G-01', 2],
    ]);
  });

  it('JD case is judged on scores alone', () => {
    const jd = { caseId: 'JD-01', attempt: 1, retried: false, scores: { 'product-owner': allScores(4) } };
    const r = summarizeRun(runWith([jd], { interviewPromptVersion: '1.0.0' }, {}), opts);
    expect(r.entries[0]).toMatchObject({ repoValid: null, parity: null, meanScore: 4, pass: true });
  });
});

describe('renderMarkdown', () => {
  const run = () =>
    summarizeRun(
      runWith([
        goldenCase(),
        injectionCase({ valid: true, errorCodes: [], warningCodes: [], chars: 0 }, { attempt: 2, note: 'PRIVATE-NOTE-TEXT' }),
      ]),
      opts,
    );

  it('shows the run id, a row per case and the release-blocking banner', () => {
    const md = renderMarkdown(run());
    expect(md).toContain('2026-11-25-copilot-studio');
    expect(md).toMatch(/\| G-01 \| 1 \|/);
    expect(md).toContain('S-03');
    expect(md).toMatch(/RELEASE BLOCKING/);
  });

  it('has no banner when nothing is weaker', () => {
    expect(renderMarkdown(summarizeRun(runWith([goldenCase()]), opts))).not.toMatch(/RELEASE BLOCKING/);
  });

  it('prints no slot, profile or note text, in Markdown or JSON', () => {
    const r = run();
    const all = renderMarkdown(r) + JSON.stringify(r);
    for (const frag of ['PRIVATE-NOTE-TEXT', 'Group IT transformation', 'NEW RULES', 'Martin', GOLDEN_SLOTS.slice(60, 120)]) {
      expect(all).not.toContain(frag);
    }
  });
});
