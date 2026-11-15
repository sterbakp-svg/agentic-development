import { agentProfileSchema, type AgentProfile } from './schema';
import { sanitizeInput, TooDeepError, type NormalizationWarning } from './sanitize';

/** Carries only a path and an issue code, never input values. */
export interface ProfileIssue {
  path: string;
  code: string;
}

export type PrepareResult =
  | { ok: true; profile: AgentProfile; issues: []; warnings: NormalizationWarning[] }
  | { ok: false; profile?: undefined; issues: ProfileIssue[]; warnings: NormalizationWarning[] };

/** Same as the maxItems of `stakeholders` in the profile schema. */
const MAX_STAKEHOLDERS = 20;

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

function mergeCommonStakeholders(
  profile: AgentProfile,
  warnings: NormalizationWarning[],
): AgentProfile {
  const common = profile.org_context?.common_stakeholders ?? [];
  if (common.length === 0) return profile;
  const stakeholders = [...(profile.stakeholders ?? [])];
  let truncated = false;
  for (const group of common) {
    const key = norm(group);
    if (stakeholders.some((s) => norm(s.role_or_group) === key || norm(s.name) === key)) continue;
    if (stakeholders.length >= MAX_STAKEHOLDERS) {
      truncated = true;
      continue;
    }
    stakeholders.push({ role_or_group: group, relation: 'internal_function', priority: 'high' });
  }
  if (truncated) {
    warnings.push({
      path: 'org_context.common_stakeholders',
      kind: 'common_stakeholders_truncated',
    });
  }
  return { ...profile, stakeholders };
}

/**
 * Turns raw input into a valid AgentProfile. Steps, in order:
 * 1. sanitize every string: remove control, invisible and bidi characters, `{{`, `}}` and
 *    backticks (repeated until stable), then trim; input nested deeper than 8 levels is
 *    rejected with `too_deep` without being walked further;
 * 2. drop empty items and exact duplicates in string arrays;
 * 3. parse with zod and apply defaults inside present objects;
 * 4. merge org_context.common_stakeholders into stakeholders, capped at 20 entries (own
 *    entries first); leftovers give the warning `common_stakeholders_truncated`.
 * Never throws and never mutates the input. Issues and warnings carry paths and codes only;
 * unknown keys appear as `*`.
 */
export function prepareProfile(raw: unknown): PrepareResult {
  try {
    const { value, warnings } = sanitizeInput(raw);
    const parsed = agentProfileSchema.safeParse(value);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.map(String).join('.'),
        code: i.code,
      }));
      return { ok: false, issues, warnings };
    }
    return {
      ok: true,
      profile: mergeCommonStakeholders(parsed.data, warnings),
      issues: [],
      warnings,
    };
  } catch (e) {
    const issue =
      e instanceof TooDeepError
        ? { path: e.path, code: 'too_deep' }
        : { path: '*', code: 'unreadable_input' };
    return { ok: false, issues: [issue], warnings: [] };
  }
}
