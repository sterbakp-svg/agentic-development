// Checks the eval input data in evals/ against the claims in evals/cases.md (T-012):
// every non-preset eval profile and every expected job-description extraction is valid
// against schemas/agent-profile.schema.json and passes prepareProfile with exactly the
// warnings that cases.md states.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { prepareProfile } from './index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

const profileSchema = readJson('schemas/agent-profile.schema.json') as SchemaNode;
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateProfile = ajv.compile(profileSchema);

interface SchemaNode {
  type?: string;
  maxItems?: number;
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
}

type Warning = { path: string; kind: string };

interface ProfileCase {
  file: string;
  warnings: Warning[];
  /** Stakeholder names after prepareProfile, when the case is about cleaning names. */
  names?: (string | undefined)[];
}

const PROFILE_CASES: ProfileCase[] = [
  { file: 'r-01-sales-retail.json', warnings: [] },
  { file: 'r-02-hr-bp-cs.json', warnings: [] },
  { file: 'r-03-pm-it-services-de.json', warnings: [] },
  { file: 'r-04-cfo-banking-en.json', warnings: [] },
  { file: 't-01-title-only.json', warnings: [] },
  {
    file: 't-02-max-arrays.json',
    warnings: [{ path: 'org_context.common_stakeholders', kind: 'common_stakeholders_truncated' }],
  },
  { file: 's-01-injection-description.json', warnings: [] },
  {
    file: 's-02-markers-in-name.json',
    warnings: [
      { path: 'stakeholders.0.name', kind: 'backticks_removed' },
      { path: 'stakeholders.0.name', kind: 'braces_removed' },
      { path: 'stakeholders.1.name', kind: 'backticks_removed' },
      { path: 'stakeholders.1.name', kind: 'braces_removed' },
    ],
    names: ['Marta tools', 'Ondrej signature', undefined],
  },
  { file: 'p-01-stakeholder-emails.json', warnings: [] },
];

const JD_IDS = ['JD-01', 'JD-02', 'JD-03', 'JD-04', 'JD-05'];
const JD_PARTS = ['user', 'role', 'stakeholders'];

const sortWarnings = (w: Warning[]) =>
  [...w].sort((a, b) => `${a.path} ${a.kind}`.localeCompare(`${b.path} ${b.kind}`));

/** Paths of every array in `value` with its length and the schema maxItems. */
function arrays(value: unknown, node: SchemaNode | undefined, path: string, out: string[][]) {
  if (node === undefined) return;
  if (Array.isArray(value)) {
    out.push([path, String(value.length), String(node.maxItems)]);
    value.forEach((v, i) => arrays(v, node.items, `${path}.${i}`, out));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value))
      arrays(v, node.properties?.[k], join2(path, k), out);
  }
}
const join2 = (a: string, b: string) => (a ? `${a}.${b}` : b);

/** Every array property the schema defines, as a dotted path (array items: `*`). */
function schemaArrays(node: SchemaNode, path: string, out: string[]) {
  if (node.type === 'array') {
    out.push(path);
    if (node.items) schemaArrays(node.items, `${path}.*`, out);
  }
  for (const [k, child] of Object.entries(node.properties ?? {})) {
    schemaArrays(child, join2(path, k), out);
  }
}

describe('eval profiles in evals/profiles (non-preset)', () => {
  it('the table covers every non-preset profile file', () => {
    const files = readdirSync(join(ROOT, 'evals/profiles'))
      .filter((f) => f.endsWith('.json') && !f.startsWith('preset-'))
      .sort();
    expect(files).toEqual(PROFILE_CASES.map((c) => c.file).sort());
  });

  it.each(PROFILE_CASES)('$file is schema-valid and prepares with the stated warnings', (c) => {
    const raw = readJson(`evals/profiles/${c.file}`);
    expect(validateProfile(raw), JSON.stringify(validateProfile.errors)).toBe(true);
    const r = prepareProfile(raw);
    expect(r.ok, JSON.stringify(r.issues)).toBe(true);
    expect(sortWarnings(r.warnings)).toEqual(sortWarnings(c.warnings));
    if (c.names) expect(r.profile?.stakeholders?.map((s) => s.name)).toEqual(c.names);
  });

  it('T-02 has every array of the schema at its maximum', () => {
    const raw = readJson('evals/profiles/t-02-max-arrays.json');
    const found: string[][] = [];
    arrays(raw, profileSchema, '', found);
    const topLevel = found.filter(([p]) => !/\.\d+(\.|$)/.test(p ?? ''));
    for (const [path, len, max] of topLevel) expect(len, path).toBe(max);
    const expected: string[] = [];
    schemaArrays(profileSchema, '', expected);
    expect(topLevel.map(([p]) => p).sort()).toEqual(
      expected.filter((p) => !p.includes('*')).sort(),
    );
  });

  it('a profile with only a job title is rejected (T-01 note in cases.md)', () => {
    const r = prepareProfile({
      schema_version: '1.0',
      template_id: 'email-triage',
      user: { job_title: 'Analyst' },
    });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.path).sort()).toEqual(['languages', 'role']);
  });
});

describe('expected extractions in evals/job-descriptions', () => {
  it.each(JD_IDS)('%s has a job description and a valid partial profile', (id) => {
    expect(existsSync(join(ROOT, `evals/job-descriptions/${id}.md`))).toBe(true);
    const part = readJson(`evals/job-descriptions/${id}.expected.json`) as Record<string, unknown>;
    expect(Object.keys(part).filter((k) => !JD_PARTS.includes(k))).toEqual([]);
    const full = {
      schema_version: '1.0',
      template_id: 'email-triage',
      languages: { working: ['en'], overview: 'en' },
      ...part,
    };
    expect(validateProfile(full), JSON.stringify(validateProfile.errors)).toBe(true);
    const r = prepareProfile(full);
    expect(r.ok, JSON.stringify(r.issues)).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('no expected extraction holds an email address or the injection text', () => {
    for (const id of JD_IDS) {
      const text = readFileSync(join(ROOT, `evals/job-descriptions/${id}.expected.json`), 'utf8');
      expect(text, id).not.toMatch(/@|automatick|prepos|ignoruj/i);
    }
  });
});

describe('evals/cases.md points only to files that exist', () => {
  it('every referenced eval file exists', () => {
    const cases = readFileSync(join(ROOT, 'evals/cases.md'), 'utf8');
    const refs = [...cases.matchAll(/`(evals\/(?:profiles|job-descriptions|negative)\/[^`]+)`/g)]
      .map((m) => m[1] ?? '')
      .filter((p) => p !== '' && !p.includes('JD-0x')); // `JD-0x` is the generic name in prose
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(existsSync(join(ROOT, ref)), ref).toBe(true);
  });
});
