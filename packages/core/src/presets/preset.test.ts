// Zod preset schema and the prototype-pollution regression of the merge. Synthetic data only.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyPreset, prepareProfile, presetSchema, type Preset } from '../index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const sales = presetSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'presets/sales.json'), 'utf8')),
);
const base = () => structuredClone(sales) as unknown as { profile: Record<string, unknown> };

describe('presetSchema (zod) rejects what schemas/preset.schema.json rejects', () => {
  it('an identity field, an unknown group and a named stakeholder', () => {
    const identity = base();
    identity.profile.user = { job_title: 'CEO' };
    const group = base();
    group.profile.org_context = {};
    const named = base();
    named.profile.stakeholders = [
      { name: 'Person', role_or_group: 'x', relation: 'peer', priority: 'high' },
    ];
    for (const bad of [identity, group, named]) {
      expect(presetSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('more than 12 stakeholders and more than 8 responsibilities', () => {
    const many = base();
    many.profile.stakeholders = Array.from({ length: 13 }, () => ({
      role_or_group: 'Team',
      relation: 'team',
      priority: 'high',
    }));
    const resp = base();
    resp.profile.role = { responsibilities: Array.from({ length: 9 }, () => 'x') };
    for (const bad of [many, resp]) expect(presetSchema.safeParse(bad).success).toBe(false);
  });
});

describe('__proto__ regression (applyPreset)', () => {
  it('a raw profile with an own __proto__ key does not pollute and is not copied through', () => {
    const raw = JSON.parse(
      '{"__proto__": {"polluted": "yes"}, "user": {"job_title": "Team Lead"}}',
    ) as Record<string, unknown>;
    const out = applyPreset(raw, sales);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out.polluted).toBeUndefined();
  });

  it('prepareProfile refuses a profile with an own __proto__ key after the merge', () => {
    const raw = JSON.parse(
      '{"__proto__": {"polluted": "yes"}, "schema_version": "1.0", "template_id": "email-triage",' +
        '"user": {"job_title": "Team Lead"}, "role": {"description": "Leads a small team in a fictional company."},' +
        '"languages": {"working": ["en"], "overview": "en"}}',
    ) as Record<string, unknown>;
    expect(prepareProfile(applyPreset(raw, sales)).ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('a preset with __proto__ groups or keys is refused by the schema and ignored by the merge', () => {
    const evil: unknown = JSON.parse(
      '{"id":"evil","label_key":"presets.evil.label","description_key":"presets.evil.description","version":1,' +
        '"profile":{"__proto__":{"polluted":"yes"},"user":{"__proto__":{"polluted":"yes"},"has_team":true}}}',
    );
    expect(presetSchema.safeParse(evil).success).toBe(false);
    // A caller that skips the schema still cannot pollute through the merge.
    const out = applyPreset({ user: { job_title: 'Team Lead' } }, evil as Preset);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(out.user)).toBe(Object.prototype);
    expect((out.user as Record<string, unknown>).has_team).toBe(true);
  });
});
