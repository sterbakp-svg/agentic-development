// Role presets: format (schemas/preset.schema.json) and the merge rule of docs/03-input-model.md.
import { z } from 'zod';
import { agentProfileSchema } from '../profile';

const profileShape = agentProfileSchema.shape;
const userShape = profileShape.user.shape;
const roleShape = profileShape.role.shape;

const presetUser = z.strictObject({
  seniority: userShape.seniority,
  // No default here: a preset must not turn "not answered" into `false`.
  has_team: z.boolean().optional(),
  delegation_roles: userShape.delegation_roles,
});

const presetRole = z.strictObject({
  responsibilities: z.array(z.string().max(160)).max(8).optional(),
  tools: roleShape.tools,
  regulations: roleShape.regulations,
});

const presetStakeholder = z.strictObject({
  role_or_group: z.string().max(80),
  relation: z.enum([
    'manager',
    'executive',
    'board',
    'peer',
    'direct_report',
    'team',
    'internal_function',
    'group_or_headquarters',
    'regulator',
    'auditor',
    'vendor',
    'client',
    'other',
  ]),
  priority: z.enum(['highest', 'high']),
});

const presetStyle = z.strictObject({ draft_tone: profileShape.style.unwrap().shape.draft_tone });

/** Mirrors schemas/preset.schema.json. Unknown fields and identity fields are rejected. */
export const presetSchema = z.strictObject({
  id: z
    .string()
    .max(40)
    .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/),
  label_key: z.string().regex(/^presets\.[a-z][a-z0-9-]*\.label$/),
  description_key: z.string().regex(/^presets\.[a-z][a-z0-9-]*\.description$/),
  version: z.int().min(1),
  profile: z.strictObject({
    user: presetUser.optional(),
    role: presetRole.optional(),
    stakeholders: z.array(presetStakeholder).max(12).optional(),
    priorities: profileShape.priorities,
    style: presetStyle.optional(),
  }),
});
export type Preset = z.output<typeof presetSchema>;

/** Missing means not answered: undefined, null, '', [] or {}. An explicit `false` is an answer. */
const isMissing = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && Object.keys(v).length === 0);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Keys that must never be written by the merge (prototype pollution). */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const own = (o: Record<string, unknown>, k: string): unknown =>
  Object.hasOwn(o, k) ? o[k] : undefined;

/**
 * Merge rule of docs/03-input-model.md, "Role presets":
 * (1) apply the preset once, to the raw input, before prepareProfile adds defaults;
 * (2) the preset fills only missing fields, user values win (also an explicit `has_team: false`),
 *     lists are taken whole, never concatenated;
 * (3) `user.delegation_roles` is filled only when the merged `has_team` is true.
 * The input is not changed. Keys such as `__proto__` are never written.
 */
export function applyPreset(raw: Record<string, unknown>, preset: Preset): Record<string, unknown> {
  const out: Record<string, unknown> = structuredClone(raw);
  const entries: [string, unknown][] = Object.entries(preset.profile);
  for (const [group, value] of entries) {
    if (UNSAFE_KEYS.has(group)) continue;
    if (Array.isArray(value)) {
      if (isMissing(own(out, group))) out[group] = structuredClone(value);
      continue;
    }
    if (!isPlainObject(value)) continue;
    const existing = own(out, group);
    const target: Record<string, unknown> = isPlainObject(existing) ? existing : {};
    for (const [key, v] of Object.entries(value)) {
      if (UNSAFE_KEYS.has(key)) continue;
      if (group === 'user' && key === 'delegation_roles') continue;
      if (isMissing(own(target, key))) target[key] = structuredClone(v);
    }
    if (
      group === 'user' &&
      target.has_team === true &&
      isMissing(own(target, 'delegation_roles'))
    ) {
      const roles = value.delegation_roles;
      if (roles !== undefined) target.delegation_roles = structuredClone(roles);
    }
    out[group] = target;
  }
  return out;
}
