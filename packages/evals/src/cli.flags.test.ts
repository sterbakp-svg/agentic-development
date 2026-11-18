// Each command accepts only its own flags (review, small points).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from './cli';
import { goldenCase, runWith } from './fixtures';
import { repoRoot } from './testkit';

function run(args: string[]) {
  let out = '';
  let err = '';
  const code = main(args, { out: (s) => (out += s), err: (s) => (err += s) }, repoRoot);
  return { code, out, err };
}
const profile = join(repoRoot, 'examples/cio-insurance/profile.json');

describe('per-command flag lists', () => {
  const runFile = () => runWith([goldenCase()]);

  it.each(['check', 'summary'])('%s refuses --profile', (cmd) => {
    const r = run([cmd, runFile(), '--profile', profile]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('unknown option: --profile');
  });

  it.each(['check', 'summary'])('%s refuses --out and --preset', (cmd) => {
    const dir = mkdtempSync(join(tmpdir(), 'evals-flags-'));
    for (const flag of ['--out', '--preset']) {
      const r = run([cmd, runFile(), flag, join(dir, 'x')]);
      expect(r.code).toBe(2);
      expect(r.err).toContain(`unknown option: ${flag}`);
    }
  });

  it('check refuses --out-dir, which belongs to summary', () => {
    expect(run(['check', runFile(), '--out-dir', tmpdir()]).code).toBe(2);
  });

  it('build-input refuses --out-dir', () => {
    const r = run(['build-input', '--profile', profile, '--out-dir', tmpdir()]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('unknown option: --out-dir');
  });

  it('every command still accepts --root', () => {
    expect(run(['check', runFile(), '--root', repoRoot]).code).toBe(0);
    expect(run(['build-input', '--profile', profile, '--root', repoRoot]).code).toBe(0);
  });
});
