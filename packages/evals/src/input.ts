// Input builder: the profile_json string that the tester pastes into the prompt tool.
// The preset merge itself lives in packages/core (applyPreset); this module loads and calls it.
import {
  applyPreset,
  prepareProfile,
  presetSchema,
  type NormalizationWarning,
  type Preset,
  type ProfileIssue,
} from '@agent-composer/core';
import { join } from 'node:path';
import { readSmallFile } from './files';

export type { Preset };

const PRESET_ID = /^[a-z0-9-]+$/;

export function loadPresetFile(file: string): Preset {
  let json: unknown;
  try {
    json = JSON.parse(readSmallFile(file));
  } catch {
    throw new Error('preset file cannot be read or is not valid JSON');
  }
  const parsed = presetSchema.safeParse(json);
  if (!parsed.success) throw new Error('preset file does not have the preset format');
  return parsed.data;
}

/** Loads `presets/<id>.json` from the repository root. */
export function loadPreset(root: string, id: string): Preset {
  if (!PRESET_ID.test(id)) throw new Error('preset id may contain only a-z, 0-9 and "-"');
  try {
    return loadPresetFile(join(root, 'presets', `${id}.json`));
  } catch {
    throw new Error(`preset "${id}" not found or not valid`);
  }
}

export type BuildResult =
  | { ok: true; json: string; warnings: NormalizationWarning[] }
  | { ok: false; issues: ProfileIssue[] };

/** Preset (optional), then core `prepareProfile`; returns compact one-line JSON. */
export function buildProfileJson(raw: unknown, preset?: Preset): BuildResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: [{ path: '*', code: 'not_an_object' }] };
  }
  const merged = preset ? applyPreset(raw as Record<string, unknown>, preset) : raw;
  const result = prepareProfile(merged);
  if (!result.ok) {
    return { ok: false, issues: result.issues.map(({ path, code }) => ({ path, code })) };
  }
  return { ok: true, json: JSON.stringify(result.profile), warnings: result.warnings };
}
