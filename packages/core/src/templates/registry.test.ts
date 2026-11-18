/* eslint-disable @typescript-eslint/no-explicit-any -- fixture JSON is free-form and read only by tests */
// T-004 template loading and registry tests.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTemplateRegistry, loadTemplate } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const templatesRoot = join(repoRoot, 'templates');
const v1Dir = join(templatesRoot, 'email-triage/v1');
const rawMeta = JSON.parse(readFileSync(join(v1Dir, 'template.json'), 'utf8'));

/** Asserts a real error from the implementation, so a missing export (TypeError) cannot pass as "rejects". */
function rejects(fn: () => unknown, message?: RegExp): void {
  let err: unknown;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).message).not.toMatch(/is not a function|is not defined|is not a constructor/);
  if (message) expect((err as Error).message).toMatch(message);
}

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 't004-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Copy v1 into a fresh folder and let the caller change template.json (as a parsed object) or the raw text. */
function variant(name: string, edit?: (meta: any) => unknown | void, raw?: string): string {
  const dir = join(tmp, name);
  cpSync(v1Dir, dir, { recursive: true });
  const file = join(dir, 'template.json');
  if (raw !== undefined) {
    writeFileSync(file, raw);
  } else if (edit) {
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    const out = edit(meta);
    writeFileSync(file, JSON.stringify(out === undefined ? meta : out));
  }
  return dir;
}

describe('loadTemplate', () => {
  it('reads template.json and the body file', () => {
    const t = loadTemplate(v1Dir);
    expect(t.id).toBe(rawMeta.id);
    expect(t.version).toBe(rawMeta.version);
    expect(t.meta.id).toBe(rawMeta.id);
    expect(t.body).toBe(readFileSync(join(v1Dir, rawMeta.body_file), 'utf8'));
  });

  it('keeps the limits, rendering rules and slots from template.json', () => {
    const t = loadTemplate(v1Dir);
    expect(t.meta.limits.instructions_max_chars).toBe(rawMeta.limits.instructions_max_chars);
    expect(t.meta.slots.map((s) => s.name)).toEqual(rawMeta.slots.map((s: { name: string }) => s.name));
  });

  it('rejects a template.json that is not valid JSON', () => {
    rejects(() => loadTemplate(variant('bad-json', undefined, '{ not json')));
  });

  it('rejects a template.json that is not an object', () => {
    rejects(() => loadTemplate(variant('bad-array', undefined, '[]')));
  });

  it.each(['id', 'version', 'body_file', 'slots', 'limits', 'labels', 'keyword_packs', 'language_names'])(
    'rejects a template.json without %s',
    (key) => {
      const dir = variant(`missing-${key}`, (m) => {
        delete m[key];
      });
      rejects(() => loadTemplate(dir));
    },
  );

  it('rejects a slot with an unknown kind', () => {
    const dir = variant('bad-kind', (m) => {
      m.slots[0].kind = 'sometimes';
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects a slot with an unknown source', () => {
    const dir = variant('bad-source', (m) => {
      m.slots[0].source = 'user';
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects limits with a wrong type', () => {
    const dir = variant('bad-limit', (m) => {
      m.limits.instructions_max_chars = '8000';
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects a version that is not a string', () => {
    const dir = variant('bad-version', (m) => {
      m.version = 1;
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects a missing body file', () => {
    const dir = variant('no-body', (m) => {
      m.body_file = 'does-not-exist.md';
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects a body_file that leaves the template folder', () => {
    const dir = variant('body-escape', (m) => {
      m.body_file = '../../../../package.json';
    });
    rejects(() => loadTemplate(dir));
  });

  it('rejects a folder that does not exist', () => {
    rejects(() => loadTemplate(join(tmp, 'nope')));
  });
});

describe('createTemplateRegistry', () => {
  it('get returns the template by id and version from template.json', () => {
    const t = createTemplateRegistry(templatesRoot).get(rawMeta.id, rawMeta.version);
    expect(t.id).toBe('email-triage');
    expect(t.version).toBe('1.0.0');
    expect(t.body).toBe(readFileSync(join(v1Dir, rawMeta.body_file), 'utf8'));
  });

  it('list contains email-triage 1.0.0', () => {
    expect(createTemplateRegistry(templatesRoot).list()).toContainEqual({ id: 'email-triage', version: '1.0.0' });
  });

  it('list returns only id and version', () => {
    for (const e of createTemplateRegistry(templatesRoot).list()) {
      expect(Object.keys(e).sort()).toEqual(['id', 'version']);
    }
  });

  it('get throws an error that names an unknown id', () => {
    rejects(() => createTemplateRegistry(templatesRoot).get('no-such-template', '1.0.0'), /no-such-template/);
  });

  it('get throws an error that names an unknown version', () => {
    rejects(() => createTemplateRegistry(templatesRoot).get('email-triage', '9.9.9'), /9\.9\.9/);
  });

  it('get matches meta.version, not the folder name', () => {
    rejects(() => createTemplateRegistry(templatesRoot).get('email-triage', 'v1'), /v1/);
  });

  it.each(['../email-triage', 'email-triage/../email-triage', '/etc', '', '..'])('get does not accept the id %j', (id) => {
    rejects(() => createTemplateRegistry(templatesRoot).get(id, '1.0.0'));
  });

  it.each(['../v1', 'v1/../v1', '..', ''])('get does not accept the version %j', (version) => {
    rejects(() => createTemplateRegistry(templatesRoot).get('email-triage', version));
  });

  it('finds several versions of one template by meta.version', () => {
    const root = join(tmp, 'multi');
    mkdirSync(join(root, 'email-triage'), { recursive: true });
    cpSync(v1Dir, join(root, 'email-triage', 'v1'), { recursive: true });
    cpSync(v1Dir, join(root, 'email-triage', 'v2-draft'), { recursive: true });
    const f = join(root, 'email-triage', 'v2-draft', 'template.json');
    writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, 'utf8')), version: '2.0.0' }));
    const reg = createTemplateRegistry(root);
    expect(reg.get('email-triage', '2.0.0').version).toBe('2.0.0');
    expect(reg.get('email-triage', '1.0.0').version).toBe('1.0.0');
    expect(reg.list()).toEqual(expect.arrayContaining([{ id: 'email-triage', version: '1.0.0' }, { id: 'email-triage', version: '2.0.0' }]));
  });

  it('get does not return a template whose template.json is broken', () => {
    const root = join(tmp, 'broken-root');
    mkdirSync(join(root, 'email-triage'), { recursive: true });
    cpSync(v1Dir, join(root, 'email-triage', 'v1'), { recursive: true });
    writeFileSync(join(root, 'email-triage', 'v1', 'template.json'), '{}');
    const reg = createTemplateRegistry(root);
    rejects(() => reg.get('email-triage', '1.0.0'));
  });
});
