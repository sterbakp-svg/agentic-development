import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createTemplateRegistry } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const v1Dir = join(here, '../../../../templates/email-triage/v1');

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function setup(): string {
  const root = mkdtempSync(join(tmpdir(), 't004-fail-'));
  roots.push(root);
  mkdirSync(join(root, 'email-triage'), { recursive: true });
  cpSync(v1Dir, join(root, 'email-triage', 'v1'), { recursive: true });
  return root;
}

describe('registry load failures', () => {
  it('a broken template folder is reported as a load failure naming id and version', () => {
    const root = setup();
    writeFileSync(join(root, 'email-triage', 'v1', 'template.json'), '{}');
    expect(() => createTemplateRegistry(root).get('email-triage', '1.0.0')).toThrow(
      /email-triage.*1\.0\.0.*failed to load/,
    );
  });

  it('a version that does not exist is still unknown', () => {
    const root = setup();
    expect(() => createTemplateRegistry(root).get('email-triage', '9.9.9')).toThrow(
      /unknown version 9\.9\.9/,
    );
  });

  it('loads each folder once per registry instance', () => {
    const reg = createTemplateRegistry(setup());
    expect(reg.get('email-triage', '1.0.0')).toBe(reg.get('email-triage', '1.0.0'));
  });
});
