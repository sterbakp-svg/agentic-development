// Input builder: profile (+ preset) -> profile_json string for the prompt tool.
import { prepareProfile } from '@agent-composer/core';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { applyPreset, buildProfileJson, loadPreset } from './input';
import { readJson, repoRoot } from './testkit';

type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- test fixtures are free-form JSON

const minimal = (): Obj => ({
  schema_version: '1.0',
  template_id: 'email-triage',
  user: { job_title: 'Team Lead' },
  role: { description: 'Leads a small team in a fictional test company.' },
  languages: { working: ['sk', 'en'], overview: 'sk' },
});
const ROLES = [
  'data-analyst',
  'executive',
  'finance',
  'hr',
  'it-manager',
  'project-manager',
  'risk-compliance',
  'sales',
];

describe('buildProfileJson without a preset', () => {
  it('turns a golden profile into one-line JSON equal to the core-prepared profile', () => {
    const raw = readJson(join(repoRoot, 'examples/cio-insurance/profile.json'));
    const r = buildProfileJson(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.json).not.toContain('\n');
    const prepared = prepareProfile(raw);
    expect(prepared.ok).toBe(true);
    expect(JSON.parse(r.json)).toEqual(prepared.profile);
  });

  it('fails clearly on an invalid profile and reports only paths and codes', () => {
    const r = buildProfileJson({ schema_version: '1.0', user: { job_title: 'SECRET-TITLE-X'.repeat(50) } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.length).toBeGreaterThan(0);
    for (const i of r.issues) expect(Object.keys(i).sort()).toEqual(['code', 'path']);
    expect(JSON.stringify(r.issues)).not.toContain('SECRET-TITLE-X');
  });

  it.each([[null], ['text'], [42], [[]]])('rejects non-object input %j', (raw) => {
    expect(buildProfileJson(raw).ok).toBe(false);
  });
});

describe('preset merge rule (docs/03-input-model.md, Role presets)', () => {
  it('loads all eight presets by id', () => {
    for (const id of ROLES) expect(loadPreset(repoRoot, id).id).toBe(id);
  });

  it('rejects an unknown id and path tricks', () => {
    expect(() => loadPreset(repoRoot, 'no-such-role')).toThrow(/preset/i);
    expect(() => loadPreset(repoRoot, '../schemas/agent-profile.schema')).toThrow();
  });

  it('fills missing fields from the preset and takes lists whole', () => {
    const p = loadPreset(repoRoot, 'sales');
    const out = applyPreset(minimal(), p);
    expect(out.role.responsibilities).toEqual(p.profile.role!.responsibilities);
    expect(out.role.description).toBe('Leads a small team in a fictional test company.');
    expect(out.user.job_title).toBe('Team Lead');
  });

  it('user values win, also an explicit has_team false, and then no delegation roles', () => {
    const raw = minimal();
    raw.user.has_team = false;
    raw.role.responsibilities = ['my own item'];
    const out = applyPreset(raw, loadPreset(repoRoot, 'sales'));
    expect(out.user.has_team).toBe(false);
    expect(out.user.delegation_roles).toBeUndefined();
    expect(out.role.responsibilities).toEqual(['my own item']);
  });

  it('applies the preset before defaults: unanswered has_team comes from the preset', () => {
    const p = loadPreset(repoRoot, 'sales');
    expect(p.profile.user!.has_team).toBe(true);
    const out = applyPreset(minimal(), p);
    expect(out.user.has_team).toBe(true);
    expect(out.user.delegation_roles).toEqual(p.profile.user!.delegation_roles);
  });

  it('does not change the input object', () => {
    const raw = minimal();
    const copy = structuredClone(raw);
    applyPreset(raw, loadPreset(repoRoot, 'hr'));
    expect(raw).toEqual(copy);
  });

  it.each(ROLES)('minimal profile + preset %s builds a valid profile_json', (id) => {
    const r = buildProfileJson(minimal(), loadPreset(repoRoot, id));
    expect(r.ok).toBe(true);
  });

  it.each(ROLES)('evals/profiles/preset-%s.json is a fixed point of the merge', (id) => {
    const raw = readJson(join(repoRoot, `evals/profiles/preset-${id}.json`));
    expect(applyPreset(raw as Obj, loadPreset(repoRoot, id))).toEqual(raw);
  });
});
