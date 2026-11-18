// Input builder: the profile_json string that the tester pastes into the prompt tool.
import { prepareProfile, type NormalizationWarning, type ProfileIssue } from '@agent-composer/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Free-form JSON object. The profile is validated by core, not here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw user JSON before core validates it
export type RawProfile = Record<string, any>;

const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label_key: z.string(),
  description_key: z.string(),
  version: z.number().int().min(1),
  profile: z.record(z.string(), z.unknown()),
});
export interface Preset {
  id: string;
  label_key: string;
  description_key: string;
  version: number;
  profile: Record<string, Record<string, unknown>>;
}

const MAX_FILE_BYTES = 1_000_000;

function readSmall(file: string): string {
  const text = readFileSync(file, 'utf8');
  if (Buffer.byteLength(text) > MAX_FILE_BYTES) throw new Error('file is too large');
  return text;
}

export function loadPresetFile(file: string): Preset {
  let json: unknown;
  try {
    json = JSON.parse(readSmall(file));
  } catch {
    throw new Error('preset file cannot be read or is not valid JSON');
  }
  const parsed = presetSchema.safeParse(json);
  if (!parsed.success) throw new Error('preset file does not have the preset format');
  return parsed.data as Preset;
}

/** Loads `presets/<id>.json` from the repository root. */
export function loadPreset(root: string, id: string): Preset {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('preset id may contain only a-z, 0-9 and "-"');
  try {
    return loadPresetFile(join(root, 'presets', `${id}.json`));
  } catch {
    throw new Error(`preset "${id}" not found or not valid`);
  }
}

/** Missing means not answered: undefined, null, '', [] or {}. An explicit `false` is an answer. */
const isMissing = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && Object.keys(v).length === 0);

/**
 * Merge rule of docs/03-input-model.md, "Role presets":
 * (1) apply the preset once, to the raw input, before prepareProfile adds defaults;
 * (2) the preset fills only missing fields, user values win (also an explicit `has_team: false`),
 *     lists are taken whole;
 * (3) `user.delegation_roles` is filled only when the merged `has_team` is true.
 */
export function applyPreset(raw: RawProfile, preset: Preset): RawProfile {
  const out: RawProfile = structuredClone(raw);
  for (const [group, value] of Object.entries(preset.profile)) {
    if (Array.isArray(value)) {
      if (isMissing(out[group])) out[group] = structuredClone(value);
      continue;
    }
    const existing: unknown = out[group];
    const target: RawProfile =
      typeof existing === 'object' && existing !== null && !Array.isArray(existing)
        ? (existing as RawProfile)
        : {};
    for (const [key, v] of Object.entries(value)) {
      if (group === 'user' && key === 'delegation_roles') continue;
      if (isMissing(target[key])) target[key] = structuredClone(v);
    }
    if (group === 'user' && target.has_team === true && isMissing(target.delegation_roles)) {
      const roles = value.delegation_roles;
      if (roles !== undefined) target.delegation_roles = structuredClone(roles);
    }
    out[group] = target;
  }
  return out;
}

export type BuildResult =
  | { ok: true; json: string; warnings: NormalizationWarning[] }
  | { ok: false; issues: ProfileIssue[] };

/** Preset (optional), then core `prepareProfile`; returns compact one-line JSON. */
export function buildProfileJson(raw: unknown, preset?: Preset): BuildResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: '*', code: 'not_an_object' }] };
  }
  const merged = preset ? applyPreset(raw as RawProfile, preset) : raw;
  const result = prepareProfile(merged);
  if (!result.ok) {
    return { ok: false, issues: result.issues.map(({ path, code }) => ({ path, code })) };
  }
  return { ok: true, json: JSON.stringify(result.profile), warnings: result.warnings };
}
