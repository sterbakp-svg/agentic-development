import { agentProfileSchema, type AgentProfile } from './schema';
import { sanitizeInput, type NormalizationWarning } from './sanitize';

/** Carries only a path and a zod issue code, never input values. */
export interface ProfileIssue {
  path: string;
  code: string;
}

export type PrepareResult =
  | { ok: true; profile: AgentProfile; issues: []; warnings: NormalizationWarning[] }
  | { ok: false; profile?: undefined; issues: ProfileIssue[]; warnings: NormalizationWarning[] };

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

function mergeCommonStakeholders(profile: AgentProfile): AgentProfile {
  const common = profile.org_context?.common_stakeholders ?? [];
  if (common.length === 0) return profile;
  const stakeholders = [...(profile.stakeholders ?? [])];
  for (const group of common) {
    const key = norm(group);
    if (stakeholders.some((s) => norm(s.role_or_group) === key || norm(s.name) === key)) continue;
    stakeholders.push({ role_or_group: group, relation: 'internal_function', priority: 'high' });
  }
  return { ...profile, stakeholders };
}

/**
 * Turns raw input into a valid AgentProfile. Steps, in order:
 * 1. sanitize every string (remove control characters, `{{`, `}}`, backticks; trim);
 * 2. drop empty items and exact duplicates in string arrays;
 * 3. parse with zod and apply defaults;
 * 4. merge org_context.common_stakeholders into stakeholders.
 * Never throws and never mutates the input.
 */
export function prepareProfile(raw: unknown): PrepareResult {
  const { value, warnings } = sanitizeInput(raw);
  const parsed = agentProfileSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.map(String).join('.'),
      code: i.code,
    }));
    return { ok: false, issues, warnings };
  }
  return { ok: true, profile: mergeCommonStakeholders(parsed.data), issues: [], warnings };
}
