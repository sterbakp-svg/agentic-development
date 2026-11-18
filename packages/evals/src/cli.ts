// CLI of the manual eval kit: build-input, check, summary. No model is called.
// Exit codes: 0 ok, 1 failed cases, 2 usage or file error, 3 flow-weaker result (release blocking).
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRun, RunFileError, MAX_FILE_BYTES } from './check';
import { buildProfileJson, loadPreset, loadPresetFile } from './input';
import { renderMarkdown, summarizeRun } from './summary';

export interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
}

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, '../../..');

const USAGE = `Manual eval kit (T-013). No model is called.

Usage (from the repository root):
  pnpm --filter @agent-composer/evals cli build-input --profile <file> [--preset <id|file>] [--out <file>]
      Prints the profile_json to paste into the prompt tool.
  pnpm --filter @agent-composer/evals cli check <run.json>
      Validates the saved outputs with the core validator and compares with the flow result.
  pnpm --filter @agent-composer/evals cli summary <run.json> [--out-dir <dir>]
      Check plus scores. Writes summary.json and report.md (default: next to run.json).

Options: --root <dir> repository root (default: this repository).
Exit codes: 0 ok, 1 failed cases, 2 usage or file error, 3 flow weaker than the validator (release blocking).
`;

interface Parsed {
  positional: string[];
  flags: Record<string, string>;
}

function parseArgs(args: string[], allowed: string[]): Parsed | string {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (!allowed.includes(name)) return `unknown option: ${a}`;
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) return `option ${a} needs a value`;
      flags[name] = v;
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function readJsonFile(path: string): unknown {
  if (statSync(path).size > MAX_FILE_BYTES) throw new Error('file is too large');
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function main(argv: string[], io: Io, cwd: string = process.cwd()): number {
  const [cmd, ...rest] = argv;
  if (cmd === '--help' || cmd === '-h') {
    io.out(USAGE);
    return 0;
  }
  if (cmd !== 'build-input' && cmd !== 'check' && cmd !== 'summary') {
    io.err(cmd === undefined ? USAGE : `unknown command: ${cmd}\n\n${USAGE}`);
    return 2;
  }
  const parsed = parseArgs(rest, ['profile', 'preset', 'out', 'out-dir', 'root']);
  if (typeof parsed === 'string') {
    io.err(`${parsed}\n\n${USAGE}`);
    return 2;
  }
  const root = parsed.flags.root ? resolve(cwd, parsed.flags.root) : defaultRoot;
  const path = (p: string) => resolve(cwd, p);

  if (cmd === 'build-input') return buildInput(parsed, root, path, io);

  const runArg = parsed.positional[0];
  if (!runArg) {
    io.err(`${cmd} needs the path of run.json\n`);
    return 2;
  }
  try {
    if (cmd === 'check') return runCheck(path(runArg), root, io);
    return runSummary(path(runArg), root, parsed.flags['out-dir'], path, io);
  } catch (e) {
    io.err(`${e instanceof RunFileError ? e.message : 'cannot run the check: ' + errName(e)}\n`);
    return 2;
  }
}

const errName = (e: unknown): string => (e instanceof Error ? e.message : 'unknown error');

function buildInput(
  parsed: Parsed,
  root: string,
  path: (p: string) => string,
  io: Io,
): number {
  const profileArg = parsed.flags.profile;
  if (!profileArg) {
    io.err('build-input needs --profile <file>\n');
    return 2;
  }
  let raw: unknown;
  try {
    raw = readJsonFile(path(profileArg));
  } catch {
    io.err('profile file cannot be read or is not valid JSON\n');
    return 2;
  }
  let preset;
  const presetArg = parsed.flags.preset;
  try {
    if (presetArg) {
      preset =
        presetArg.includes('/') || presetArg.endsWith('.json')
          ? loadPresetFile(path(presetArg))
          : loadPreset(root, presetArg);
    }
  } catch (e) {
    io.err(`${errName(e)}\n`);
    return 2;
  }
  const result = buildProfileJson(raw, preset);
  if (!result.ok) {
    io.err(
      `profile is invalid:\n${result.issues.map((i) => `  ${i.path}: ${i.code}`).join('\n')}\n`,
    );
    return 2;
  }
  if (result.warnings.length > 0) {
    io.err(
      `normalization warnings: ${result.warnings.map((w) => `${w.path}:${w.kind}`).join(', ')}\n`,
    );
  }
  const outArg = parsed.flags.out;
  if (outArg) {
    try {
      mkdirSync(dirname(path(outArg)), { recursive: true });
      writeFileSync(path(outArg), result.json + '\n');
    } catch {
      io.err('cannot write the output file\n');
      return 2;
    }
    io.err(`profile_json written (${result.json.length} characters)\n`);
  } else {
    io.out(result.json + '\n');
  }
  return 0;
}

function runCheck(runFile: string, root: string, io: Io): number {
  const r = checkRun(runFile, { root });
  let weaker = false;
  let failed = r.runIssues.length > 0;
  io.out(`Run ${r.run.runId}, template ${r.templateVersion}\n`);
  for (const e of r.entries) {
    const deterministicFail =
      e.repoValid !== null &&
      (e.problems.length > 0 || (e.expectReject ? e.repoValid : !e.repoValid));
    if (e.parity === 'flow-weaker') weaker = true;
    if (deterministicFail || e.problems.length > 0) failed = true;
    io.out(
      `${e.caseId} attempt ${e.attempt}: repoValid=${e.repoValid ?? 'n/a'} parity=${e.parity ?? 'n/a'}` +
        ` repoChars=${e.repoChars ?? 'n/a'} flowChars=${e.flowChars ?? 'n/a'}` +
        ` errorCodes=[${e.repoErrorCodes.join(',')}] problems=[${e.problems.join(',')}]` +
        `${deterministicFail ? ' FAIL' : ''}\n`,
    );
  }
  if (r.runIssues.length > 0) io.out(`Run issues: ${r.runIssues.join(', ')}\n`);
  if (weaker) {
    io.out('RELEASE BLOCKING: the flow is weaker than the repository validator (Q-13).\n');
    return 3;
  }
  return failed ? 1 : 0;
}

function runSummary(
  runFile: string,
  root: string,
  outDirArg: string | undefined,
  path: (p: string) => string,
  io: Io,
): number {
  const report = summarizeRun(runFile, { root });
  const outDir = outDirArg ? path(outDirArg) : dirname(runFile);
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
    writeFileSync(join(outDir, 'report.md'), renderMarkdown(report));
  } catch {
    io.err('cannot write summary.json and report.md\n');
    return 2;
  }
  io.out(renderMarkdown(report));
  io.out(`Written: ${join(outDir, 'summary.json')}, ${join(outDir, 'report.md')}\n`);
  if (report.releaseBlocking) return 3;
  return report.allPass ? 0 : 1;
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry || !existsSync(entry)) return false;
  return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
}

if (isEntryPoint()) {
  // pnpm runs scripts inside the package folder; INIT_CWD is where the tester typed the command.
  process.exitCode = main(
    process.argv.slice(2),
    { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) },
    process.env.INIT_CWD ?? process.cwd(),
  );
}
