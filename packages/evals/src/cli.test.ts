// CLI: build-input, check, summary. Exit codes: 0 ok, 1 failed cases, 2 usage or file errors,
// 3 a flow-weaker result (release blocking).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main } from './cli';
import { goldenCase, injectionCase, injectionCodes, runWith } from './fixtures';
import { repoRoot } from './testkit';

function run(args: string[]) {
  let out = '';
  let err = '';
  const code = main(args, { out: (s) => (out += s), err: (s) => (err += s) }, repoRoot);
  return { code, out, err };
}
const profile = join(repoRoot, 'examples/cio-insurance/profile.json');
const rejectFlow = { valid: false, errorCodes: injectionCodes, warningCodes: [], chars: 0 };
const weakFlow = { valid: true, errorCodes: [], warningCodes: [], chars: 0 };

describe('build-input', () => {
  it('prints one-line profile_json for a profile', () => {
    const r = run(['build-input', '--profile', profile]);
    expect(r.code).toBe(0);
    expect(r.out.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(r.out).template_id).toBe('email-triage');
  });

  it('applies a preset by id and can write to a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-in-'));
    const raw = join(dir, 'p.json');
    const out = join(dir, 'out.json');
    writeFileSync(
      raw,
      JSON.stringify({
        schema_version: '1.0',
        template_id: 'email-triage',
        user: { job_title: 'Team Lead' },
        role: { description: 'Leads a small team in a fictional test company.' },
        languages: { working: ['en'], overview: 'en' },
      }),
    );
    const r = run(['build-input', '--profile', raw, '--preset', 'sales', '--out', out]);
    expect(r.code).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8')).user.has_team).toBe(true);
  });

  it('exits 2 on an invalid profile and prints only paths and codes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-in-'));
    const raw = join(dir, 'bad.json');
    writeFileSync(raw, JSON.stringify({ schema_version: '1.0', user: { job_title: 'SECRET-X' } }));
    const r = run(['build-input', '--profile', raw]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/invalid/i);
    expect(r.out + r.err).not.toContain('SECRET-X');
  });

  it('exits 2 for an unknown preset, a missing profile argument and a missing file', () => {
    expect(run(['build-input', '--profile', profile, '--preset', 'nope']).code).toBe(2);
    expect(run(['build-input']).code).toBe(2);
    expect(run(['build-input', '--profile', '/nonexistent.json']).code).toBe(2);
  });
});

describe('check', () => {
  it('exits 0 when all cases are fine', () => {
    const r = run(['check', runWith([goldenCase()])]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('G-01');
  });
  it('exits 1 when an output is invalid and not expected to be', () => {
    expect(run(['check', runWith([injectionCase(rejectFlow, { expectReject: undefined })])]).code).toBe(1);
  });
  it('exits 3 on flow-weaker and says release blocking', () => {
    const r = run(['check', runWith([injectionCase(weakFlow)])]);
    expect(r.code).toBe(3);
    expect(r.out + r.err).toMatch(/release.blocking/i);
  });
  it('exits 2 for a missing file or a bad run file', () => {
    expect(run(['check', '/nonexistent/run.json']).code).toBe(2);
    const bad = runWith([goldenCase()], { environment: 'x' });
    expect(run(['check', bad]).code).toBe(2);
  });
});

describe('summary', () => {
  it('writes summary.json and report.md next to the run file and exits 0 on pass', () => {
    const file = runWith([goldenCase()]);
    const r = run(['summary', file]);
    expect(r.code).toBe(0);
    const dir = dirname(file);
    expect(existsSync(join(dir, 'summary.json'))).toBe(true);
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toContain('G-01');
    expect(JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')).allPass).toBe(true);
  });
  it('exits 1 when a case fails and 3 when flow-weaker', () => {
    const low = goldenCase({ scores: { 'product-owner': { role_fit: 3, faithfulness: 3, stakeholder_order: 3, language: 3, placeholders: 3, questions: 3 }, 'domain-user-1': { role_fit: 3, faithfulness: 3, stakeholder_order: 3, language: 3, placeholders: 3, questions: 3 } } });
    expect(run(['summary', runWith([low])]).code).toBe(1);
    expect(run(['summary', runWith([injectionCase(weakFlow)])]).code).toBe(3);
  });
  it('--out-dir chooses the output folder', () => {
    const out = mkdtempSync(join(tmpdir(), 'evals-out-'));
    expect(run(['summary', runWith([goldenCase()]), '--out-dir', out]).code).toBe(0);
    expect(existsSync(join(out, 'summary.json'))).toBe(true);
  });
});

describe('usage', () => {
  it.each([[[]], [['frobnicate']], [['--help']]])('%j prints usage', (args) => {
    const r = run(args as string[]);
    expect(r.out + r.err).toMatch(/build-input/);
    expect(r.out + r.err).toMatch(/summary/);
  });
  it('unknown subcommand exits 2', () => {
    expect(run(['frobnicate']).code).toBe(2);
  });
});

describe('real process', () => {
  it('pnpm cli build-input works through tsx and exits with the right code', () => {
    const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
    const out = execFileSync('pnpm', ['run', '--silent', 'cli', 'build-input', '--profile', profile], {
      cwd: pkg,
      encoding: 'utf8',
    });
    expect(JSON.parse(out).template_id).toBe('email-triage');
    const bad = spawnSync('pnpm', ['run', '--silent', 'cli', 'check', '/nonexistent/run.json'], { cwd: pkg });
    expect(bad.status).toBe(2);
  });
});
