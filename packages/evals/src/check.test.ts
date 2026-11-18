// Output validation: saved prompt tool JSON -> core render + validate -> repoValid and parity.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRun, RunFileError } from './check';
import {
  FILES,
  GOLDEN_SLOTS,
  goldenCase,
  goldenResult,
  injectionCase,
  injectionCodes,
  runWith,
  templateDir,
} from './fixtures';
import { allScores, repoRoot } from './testkit';

const opts = { root: repoRoot };

describe('golden output saved as outputFile', () => {
  it('is repoValid, parity same, chars equal to the flow', () => {
    const r = checkRun(runWith([goldenCase()]), opts);
    const e = r.entries[0]!;
    expect(e.repoValid).toBe(true);
    expect(e.parity).toBe('same');
    expect(e.repoChars).toBe(goldenResult.chars);
    expect(e.problems).toEqual([]);
    expect(r.runIssues).toEqual([]);
  });

  it('a flow char count that differs from the repository is a problem', () => {
    const flow = { valid: true, errorCodes: [], warningCodes: [], chars: goldenResult.chars + 1 };
    const e = checkRun(runWith([goldenCase({ flow })]), opts).entries[0]!;
    expect(e.problems).toContain('chars_mismatch');
  });
});

describe('injection output (evals/negative/injection-slots.json)', () => {
  const flow = (valid: boolean, errorCodes: string[]) => ({ valid, errorCodes, warningCodes: [], chars: 0 });

  it('is not repoValid and the reference codes are reported', () => {
    const e = checkRun(runWith([injectionCase(flow(false, injectionCodes))]), opts).entries[0]!;
    expect(e.repoValid).toBe(false);
    expect(e.repoErrorCodes).toEqual(expect.arrayContaining(injectionCodes));
    expect(e.parity).toBe('same');
  });

  it('flow that rejects with more codes is flow-stricter', () => {
    const e = checkRun(
      runWith([injectionCase(flow(false, [...injectionCodes, 'extra_rule']))]),
      opts,
    ).entries[0]!;
    expect(e.parity).toBe('flow-stricter');
  });

  it('flow that accepted the injection is flow-weaker', () => {
    const e = checkRun(runWith([injectionCase(flow(true, []))]), opts).entries[0]!;
    expect(e.parity).toBe('flow-weaker');
  });
});

describe('bad files never crash the check', () => {
  const run = (files: Record<string, string>) =>
    checkRun(runWith([goldenCase()], {}, { ...FILES, ...files }), opts).entries[0]!;

  it('output not JSON', () => {
    const e = run({ 'g01.output.json': 'not json {' });
    expect(e.repoValid).toBe(false);
    expect(e.problems).toContain('output_not_json');
  });
  it('output has the wrong shape', () => {
    const e = run({ 'g01.output.json': '{"slots": 5}' });
    expect(e.repoValid).toBe(false);
    expect(e.problems).toContain('output_shape_invalid');
  });
  it('output file missing', () => {
    const r = checkRun(runWith([goldenCase()], {}, { 'g01.input.json': FILES['g01.input.json']! }), opts);
    expect(r.entries[0]!.repoValid).toBe(false);
    expect(r.entries[0]!.problems).toContain('output_file_unreadable');
  });
  it('input profile invalid', () => {
    const e = run({ 'g01.input.json': '{"schema_version":"1.0"}' });
    expect(e.repoValid).toBe(false);
    expect(e.problems).toContain('input_invalid');
  });
  it('input not JSON', () => {
    expect(run({ 'g01.input.json': '(((' }).problems).toContain('input_not_json');
  });
  it('oversize output is refused, not parsed', () => {
    const e = run({ 'g01.output.json': JSON.stringify({ pad: 'x'.repeat(3_000_000) }) });
    expect(e.repoValid).toBe(false);
    expect(e.problems).toContain('file_too_large');
  });
});

describe('run level checks', () => {
  it('template version in the run must match template.json', () => {
    const r = checkRun(runWith([goldenCase()], { templateVersion: '9.9.9' }), opts);
    expect(r.runIssues).toContain('template_version_mismatch');
  });

  it('limits come from template.json, not from code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-tpl-'));
    const copy = join(dir, 'v1');
    cpSync(templateDir, copy, { recursive: true });
    const meta = JSON.parse(readFileSync(join(copy, 'template.json'), 'utf8'));
    meta.limits.instructions_max_chars = 500;
    meta.limits.instructions_target_chars = 400;
    writeFileSync(join(copy, 'template.json'), JSON.stringify(meta));
    const e = checkRun(runWith([goldenCase()]), { root: repoRoot, templateDir: copy }).entries[0]!;
    expect(e.repoValid).toBe(false);
    expect(e.repoErrorCodes).toContain('instructions_too_long');
  });

  it('a run file that fails the schema throws RunFileError with a path, no values', () => {
    const file = runWith([goldenCase()], { environment: 'SECRET-ENV' });
    expect(() => checkRun(file, opts)).toThrow(RunFileError);
    try {
      checkRun(file, opts);
    } catch (e) {
      expect(String((e as Error).message)).toContain('environment');
      expect(String((e as Error).message)).not.toContain('SECRET-ENV');
    }
  });

  it('an unreadable run file throws RunFileError', () => {
    expect(() => checkRun('/nonexistent/run.json', opts)).toThrow(RunFileError);
  });

  it('refuses an outputFile that escapes the run directory through a symlink-free parent path', () => {
    const file = runWith([goldenCase({ outputFile: '../x.json' })]);
    expect(() => checkRun(file, opts)).toThrow(RunFileError);
  });
});

describe('job description cases (rubric only)', () => {
  const jd = {
    caseId: 'JD-01',
    attempt: 1,
    retried: false,
    scores: { 'product-owner': allScores(4) },
  };
  it('need no files: repoValid and parity are null', () => {
    const r = checkRun(runWith([jd], { interviewPromptVersion: '1.0.0' }, {}), opts);
    expect(r.entries[0]!.repoValid).toBeNull();
    expect(r.entries[0]!.parity).toBeNull();
    expect(r.entries[0]!.problems).toEqual([]);
  });
  it('the run is refused without interviewPromptVersion', () => {
    expect(() => checkRun(runWith([jd], {}, {}), opts)).toThrow(RunFileError);
  });
});

describe('no content in the result', () => {
  it('result holds no slot or profile text', () => {
    const r = checkRun(runWith([goldenCase(), injectionCase({ valid: false, errorCodes: injectionCodes, warningCodes: [], chars: 0 })]), opts);
    const text = JSON.stringify(r.entries);
    for (const frag of ['Group IT transformation', 'NEW RULES', 'Management Board', GOLDEN_SLOTS.slice(40, 80)]) {
      expect(text).not.toContain(frag);
    }
  });
});
