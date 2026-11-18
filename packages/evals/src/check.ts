// Output validation: saved prompt tool JSON -> core prepare + validate -> repoValid and parity.
// Nothing here calls a model. Results hold codes, counts and flags, never slot or profile text.
import { loadTemplate, prepareProfile, validate } from '@agent-composer/core';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { errorCode, warningCode } from './codes';
import { FileTooLargeError, readSmallFile } from './files';
import { computeParity } from './parity';
import { manualEvalRunSchema, type ManualEvalCase, type ManualEvalRun, type Parity } from './schema';

/** Run file cannot be read or does not match the schema. The message holds paths and codes only. */
export class RunFileError extends Error {}

export interface CheckOptions {
  /** Repository root. */
  root: string;
  /** Template folder. Default: templates/email-triage/v1 under root. */
  templateDir?: string;
}

export interface CheckEntry {
  caseId: string;
  attempt: number;
  retried: boolean;
  expectReject: boolean;
  /** null for JD cases (no render check). */
  repoValid: boolean | null;
  parity: Parity | null;
  repoErrorCodes: string[];
  repoWarningCodes: string[];
  repoChars: number | null;
  flowValid: boolean | null;
  flowChars: number | null;
  /** Problems that make the case fail whatever the scores are. */
  problems: string[];
}

export interface RunCheck {
  run: ManualEvalRun;
  runDir: string;
  templateVersion: string;
  entries: CheckEntry[];
  runIssues: string[];
}

export function loadRunFile(runFile: string): ManualEvalRun {
  let json: unknown;
  try {
    json = JSON.parse(readSmallFile(runFile));
  } catch (e) {
    if (e instanceof FileTooLargeError) throw new RunFileError('run file is too large');
    throw new RunFileError('run file cannot be read or is not valid JSON');
  }
  const parsed = manualEvalRunSchema.safeParse(json);
  if (!parsed.success) {
    const lines = parsed.error.issues.slice(0, 20).map((i) => {
      const where = i.path.join('.') || '(root)';
      return i.code === 'custom' ? `${where}: ${i.message}` : `${where}: ${i.code}`;
    });
    throw new RunFileError(`run file does not match the schema:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

type Read = { ok: true; text: string } | { ok: false; problem: string };

function readInRunDir(runDir: string, rel: string, prefix: string): Read {
  try {
    const file = resolve(runDir, rel);
    const real = realpathSync(file);
    const realDir = realpathSync(runDir);
    if (!real.startsWith(realDir + sep)) return { ok: false, problem: `${prefix}_file_unreadable` };
    return { ok: true, text: readSmallFile(real) };
  } catch (e) {
    if (e instanceof FileTooLargeError) return { ok: false, problem: 'file_too_large' };
    return { ok: false, problem: `${prefix}_file_unreadable` };
  }
}

const sorted = (xs: string[]): string[] => [...xs].sort();
const sortedUnique = (xs: string[]): string[] => [...new Set(xs)].sort();

export function checkRun(runFile: string, opts: CheckOptions): RunCheck {
  const run = loadRunFile(runFile);
  const runDir = dirname(resolve(runFile));
  const template = loadTemplate(opts.templateDir ?? join(opts.root, 'templates/email-triage/v1'));
  const runIssues: string[] = [];
  if (run.templateVersion !== template.version) runIssues.push('template_version_mismatch');

  const entries = run.cases.map((c) => checkCase(c, runDir, template));
  return { run, runDir, templateVersion: template.version, entries, runIssues };
}

function checkCase(
  c: ManualEvalCase,
  runDir: string,
  template: ReturnType<typeof loadTemplate>,
): CheckEntry {
  const base: CheckEntry = {
    caseId: c.caseId,
    attempt: c.attempt,
    retried: c.retried,
    expectReject: c.expectReject === true,
    repoValid: null,
    parity: null,
    repoErrorCodes: [],
    repoWarningCodes: [],
    repoChars: null,
    flowValid: c.flow?.valid ?? null,
    flowChars: c.flow?.chars ?? null,
    problems: [],
  };
  // JD cases have no outputFile and no flow (schema); they are judged by scores only.
  if (c.outputFile === undefined || c.inputFile === undefined || c.flow === undefined) return base;

  const fail = (problem: string): CheckEntry => ({
    ...base,
    repoValid: false,
    problems: [problem],
  });

  const input = readInRunDir(runDir, c.inputFile, 'input');
  if (!input.ok) return fail(input.problem);
  let rawProfile: unknown;
  try {
    rawProfile = JSON.parse(input.text);
  } catch {
    return fail('input_not_json');
  }
  const prepared = prepareProfile(rawProfile);
  if (!prepared.ok) return fail('input_invalid');

  const output = readInRunDir(runDir, c.outputFile, 'output');
  if (!output.ok) return fail(output.problem);
  let generated: unknown;
  try {
    generated = JSON.parse(output.text);
  } catch {
    return fail('output_not_json');
  }
  let result;
  try {
    result = validate(template, prepared.profile, generated);
  } catch {
    return fail('output_shape_invalid');
  }

  // Kept with multiplicity: the parity check compares per code and count.
  const repoErrorCodes = sorted(result.errors.map(errorCode));
  const parity = computeParity(
    { valid: result.ok, errorCodes: repoErrorCodes },
    { valid: c.flow.valid, errorCodes: c.flow.errorCodes },
  );
  const problems: string[] = [];
  if (result.ok && c.flow.valid && result.chars !== c.flow.chars) problems.push('chars_mismatch');
  return {
    ...base,
    repoValid: result.ok,
    parity,
    repoErrorCodes,
    repoWarningCodes: sortedUnique(result.warnings.map(warningCode)),
    repoChars: result.chars,
    problems,
  };
}
