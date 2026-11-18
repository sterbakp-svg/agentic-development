import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { prepareProfile } from '../index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const readJson = (rel: string): unknown => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

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

type Group = Record<string, unknown>;
interface Preset {
  id: string;
  label_key: string;
  description_key: string;
  version: number;
  profile: Record<string, Group | Group[]>;
}

const presetFiles = readdirSync(join(ROOT, 'presets'))
  .filter((f) => f.endsWith('.json'))
  .sort();
const presets: Preset[] = presetFiles.map((f) => readJson(`presets/${f}`) as Preset);

/** Fictional minimal profile: the interview minimum (job title, one sentence, languages). */
function minimalProfile(): Record<string, unknown> {
  return {
    schema_version: '1.0',
    template_id: 'email-triage',
    user: { job_title: 'Team Lead' },
    role: { description: 'Leads a small team in a fictional test company.' },
    languages: { working: ['sk', 'en'], overview: 'sk' },
  };
}

const isEmpty = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && Object.keys(v).length === 0);

/** Merge rule of schemas/preset.schema.json: the preset fills only missing or empty fields. */
function applyPreset(base: Record<string, unknown>, preset: Preset): Record<string, unknown> {
  const out = structuredClone(base);
  for (const [group, value] of Object.entries(preset.profile)) {
    if (Array.isArray(value)) {
      if (isEmpty(out[group])) out[group] = structuredClone(value);
      continue;
    }
    const target = (out[group] ?? {}) as Group;
    for (const [key, v] of Object.entries(value)) {
      if (isEmpty(target[key])) target[key] = structuredClone(v);
    }
    out[group] = target;
  }
  return out;
}

/** Every string value of a preset's profile part. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

function lookup(messages: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, seg) => (node as Record<string, unknown> | undefined)?.[seg], messages);
}

describe('preset library', () => {
  it('has exactly the 8 roles of FR-12, one file per id', () => {
    expect(presets.map((p) => p.id).sort()).toEqual(ROLES);
    expect(presetFiles).toEqual(presets.map((p) => `${p.id}.json`));
  });
});

describe('preset schema (ajv)', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  ajv.addSchema(readJson('schemas/agent-profile.schema.json') as object);
  const presetSchema = readJson('schemas/preset.schema.json') as { $schema: string };
  const validate = ajv.compile(presetSchema);

  it('uses draft 2020-12', () => {
    expect(presetSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  });

  for (const preset of presets) {
    it(`${preset.id} validates`, () => {
      expect(validate(preset), JSON.stringify(validate.errors)).toBe(true);
    });
  }

  it('rejects a named stakeholder, a field the profile does not know and an identity field', () => {
    const base = structuredClone(presets[0]!);
    const named = structuredClone(base);
    (named.profile.stakeholders as Group[])[0]!.name = 'Person';
    const unknown = structuredClone(base);
    unknown.profile.priorities = { ...(unknown.profile.priorities as Group), search_signals: [] };
    const identity = structuredClone(base);
    identity.profile.user = { ...(identity.profile.user as Group), job_title: 'CEO' };
    for (const bad of [named, unknown, identity]) expect(validate(bad)).toBe(false);
  });

  it('keeps the limits of the profile schema (maxLength through $ref)', () => {
    const long = structuredClone(presets[0]!);
    (long.profile.priorities as Group).confidential_topics = ['x'.repeat(61)];
    expect(validate(long)).toBe(false);
  });
});

describe('presets merged into a minimal profile', () => {
  for (const preset of presets) {
    it(`${preset.id}: prepareProfile gives ok: true and zero warnings, values unchanged`, () => {
      const merged = applyPreset(minimalProfile(), preset);
      const r = prepareProfile(merged);
      expect(r.issues).toEqual([]);
      expect(r.ok).toBe(true);
      expect(r.warnings).toEqual([]);
      expect(r.profile).toMatchObject(merged);
    });
  }

  it('values the user already set win over the preset', () => {
    const base = minimalProfile();
    base.user = { job_title: 'Team Lead', has_team: false, seniority: 'other' };
    base.stakeholders = [{ role_or_group: 'own group', relation: 'peer' }];
    const merged = applyPreset(
      base,
      presets.find((p) => p.id === 'executive')!,
    );
    expect(merged.user).toMatchObject({ has_team: false, seniority: 'other' });
    expect(merged.stakeholders).toEqual(base.stakeholders);
  });
});

describe('preset content', () => {
  // Words that would push a read-only agent towards acting on mail or dropping rules.
  const FORBIDDEN =
    /\b(send|sends|sending|forward|forwards|forwarding|delete|deletes|deleting|move|moves|moving|ignore|ignores|ignoring|auto-?reply)\b/i;

  for (const preset of presets) {
    it(`${preset.id}: no guardrail-weakening words, markers, addresses or links`, () => {
      for (const s of strings(preset.profile)) {
        expect(s, s).not.toMatch(FORBIDDEN);
        expect(s, s).not.toMatch(/[{}`@]|https?:|www\./);
        expect(s, s).toBe(s.trim());
      }
    });
  }

  it('version is set and stakeholders are groups (no name field)', () => {
    for (const preset of presets) {
      expect(preset.version).toBeGreaterThanOrEqual(1);
      for (const s of (preset.profile.stakeholders ?? []) as Group[])
        expect(s).not.toHaveProperty('name');
    }
  });
});

describe('preset values fit their slots verbatim (limits from template.json)', () => {
  const template = readJson('templates/email-triage/v1/template.json') as {
    slots: Array<{ name: string; max_chars?: number }>;
  };
  const max = (name: string) => {
    const n = template.slots.find((s) => s.name === name)?.max_chars;
    if (n === undefined) throw new Error(`slot ${name} has no max_chars`);
    return n;
  };

  for (const preset of presets) {
    it(`${preset.id}`, () => {
      const role = (preset.profile.role ?? {}) as { responsibilities?: string[] };
      const prio = (preset.profile.priorities ?? {}) as Record<string, string[] | undefined>;
      const groups = ((preset.profile.stakeholders ?? []) as Array<{ role_or_group: string }>).map(
        (s) => s.role_or_group,
      );
      expect((role.responsibilities ?? []).join('; ').length).toBeLessThanOrEqual(
        max('responsibilities'),
      );
      expect((prio.high_impact_areas ?? []).join(', ').length).toBeLessThanOrEqual(
        max('impact_areas'),
      );
      expect(
        [...(prio.extra_urgency_signals ?? []), 'sender waiting more than 3 days'].join(', ')
          .length,
      ).toBeLessThanOrEqual(max('urgency_signals'));
      expect(
        `Handle ${(prio.confidential_topics ?? []).join(', ')} discreetly: summarize only what [Name] needs to act.`
          .length,
      ).toBeLessThanOrEqual(max('discretion_rule'));
      expect(groups.join(', ').length).toBeLessThanOrEqual(max('stakeholders'));
    });
  }
});

describe('UI labels', () => {
  const messages = {
    en: readJson('apps/web/messages/en.json'),
    sk: readJson('apps/web/messages/sk.json'),
  };

  for (const [lang, file] of Object.entries(messages)) {
    it(`${lang}: every label_key and description_key exists, and only preset keys`, () => {
      for (const p of presets) {
        expect(p.label_key).toBe(`presets.${p.id}.label`);
        expect(p.description_key).toBe(`presets.${p.id}.description`);
        for (const key of [p.label_key, p.description_key]) {
          const text = lookup(file, key);
          expect(typeof text === 'string' && text.length > 0, key).toBe(true);
        }
      }
      const tree = file as { presets: Record<string, object> };
      expect(Object.keys(tree)).toEqual(['presets']);
      expect(Object.keys(tree.presets).sort()).toEqual(ROLES);
      for (const entry of Object.values(tree.presets)) {
        expect(Object.keys(entry).sort()).toEqual(['description', 'label']);
      }
    });
  }
});

describe('eval inputs PR-01 to PR-08', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile(readJson('schemas/agent-profile.schema.json') as object);
  const cases = readFileSync(join(ROOT, 'evals/cases.md'), 'utf8');

  it('has one profile per preset', () => {
    const files = readdirSync(join(ROOT, 'evals/profiles')).filter((f) => f.startsWith('preset-'));
    expect(files.sort()).toEqual(ROLES.map((id) => `preset-${id}.json`));
  });

  for (const preset of presets) {
    it(`preset-${preset.id}.json is valid, contains the preset and is listed in cases.md`, () => {
      const rel = `evals/profiles/preset-${preset.id}.json`;
      const profile = readJson(rel);
      expect(validate(profile), JSON.stringify(validate.errors)).toBe(true);
      const r = prepareProfile(profile);
      expect(r.ok).toBe(true);
      expect(r.warnings).toEqual([]);
      expect(profile).toMatchObject(preset.profile);
      expect(applyPreset(profile as Record<string, unknown>, preset)).toEqual(profile);
      expect(cases).toContain(`\`${rel}\``);
    });
  }
});
