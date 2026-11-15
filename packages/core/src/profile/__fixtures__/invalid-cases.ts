import { minimalProfile, type RawProfile } from './helpers';

export type InvalidCase = {
  name: string;
  mutate: (p: RawProfile) => void;
  /** `path` is dot-joined; `code` is the zod 4 issue code. */
  expected: { path: string; code: string };
};

const long = (n: number) => 'x'.repeat(n);
const items = (n: number) => Array.from({ length: n }, (_, i) => `item ${i}`);
const groups = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ role_or_group: `Group ${i}`, relation: 'peer' }));

export const invalidCases: InvalidCase[] = [
  // too long
  {
    name: 'user.display_name over 60',
    mutate: (p) => (p.user.display_name = long(61)),
    expected: { path: 'user.display_name', code: 'too_big' },
  },
  {
    name: 'user.job_title over 120',
    mutate: (p) => (p.user.job_title = long(121)),
    expected: { path: 'user.job_title', code: 'too_big' },
  },
  {
    name: 'role.description over 2000',
    mutate: (p) => (p.role.description = long(2001)),
    expected: { path: 'role.description', code: 'too_big' },
  },
  {
    name: 'style.signature over 60',
    mutate: (p) => (p.style = { signature: long(61) }),
    expected: { path: 'style.signature', code: 'too_big' },
  },
  {
    name: 'agent.name over 30',
    mutate: (p) => (p.agent = { name: long(31) }),
    expected: { path: 'agent.name', code: 'too_big' },
  },
  {
    name: 'org_context.mandatory_rule over 300',
    mutate: (p) => (p.org_context = { mandatory_rule: long(301) }),
    expected: { path: 'org_context.mandatory_rule', code: 'too_big' },
  },
  {
    name: 'array item too long (role.tools.1 over 40)',
    mutate: (p) => (p.role.tools = ['ok', long(41)]),
    expected: { path: 'role.tools.1', code: 'too_big' },
  },
  {
    name: 'stakeholder name over 60',
    mutate: (p) =>
      (p.stakeholders = [{ name: long(61), role_or_group: 'Legal', relation: 'peer' }]),
    expected: { path: 'stakeholders.0.name', code: 'too_big' },
  },
  // too short
  {
    name: 'user.job_title under 2',
    mutate: (p) => (p.user.job_title = 'A'),
    expected: { path: 'user.job_title', code: 'too_small' },
  },
  {
    name: 'role.description under 20',
    mutate: (p) => (p.role.description = 'too short'),
    expected: { path: 'role.description', code: 'too_small' },
  },
  {
    name: 'languages.working empty',
    mutate: (p) => (p.languages.working = []),
    expected: { path: 'languages.working', code: 'too_small' },
  },
  // wrong enum
  {
    name: 'template_id unknown',
    mutate: (p) => (p.template_id = 'other'),
    expected: { path: 'template_id', code: 'invalid_value' },
  },
  {
    name: 'schema_version not 1.0',
    mutate: (p) => (p.schema_version = '2.0'),
    expected: { path: 'schema_version', code: 'invalid_value' },
  },
  {
    name: 'user.industry unknown',
    mutate: (p) => (p.user.industry = 'space_mining'),
    expected: { path: 'user.industry', code: 'invalid_value' },
  },
  {
    name: 'user.seniority unknown',
    mutate: (p) => (p.user.seniority = 'intern'),
    expected: { path: 'user.seniority', code: 'invalid_value' },
  },
  {
    name: 'stakeholder relation unknown',
    mutate: (p) => (p.stakeholders = [{ role_or_group: 'Legal', relation: 'friend' }]),
    expected: { path: 'stakeholders.0.relation', code: 'invalid_value' },
  },
  {
    name: 'stakeholder priority unknown',
    mutate: (p) =>
      (p.stakeholders = [{ role_or_group: 'Legal', relation: 'peer', priority: 'low' }]),
    expected: { path: 'stakeholders.0.priority', code: 'invalid_value' },
  },
  {
    name: 'languages.overview unknown',
    mutate: (p) => (p.languages.overview = 'fr'),
    expected: { path: 'languages.overview', code: 'invalid_value' },
  },
  {
    name: 'languages.working item unknown',
    mutate: (p) => (p.languages.working = ['en', 'fr']),
    expected: { path: 'languages.working.1', code: 'invalid_value' },
  },
  {
    name: 'languages.instructions not en',
    mutate: (p) => (p.languages.instructions = 'sk'),
    expected: { path: 'languages.instructions', code: 'invalid_value' },
  },
  // wrong type
  {
    name: 'user.has_team is a string',
    mutate: (p) => (p.user.has_team = 'yes'),
    expected: { path: 'user.has_team', code: 'invalid_type' },
  },
  {
    name: 'role.tools is a string',
    mutate: (p) => (p.role.tools = 'git'),
    expected: { path: 'role.tools', code: 'invalid_type' },
  },
  {
    name: 'agent.top_n is a string',
    mutate: (p) => (p.agent = { top_n: '10' }),
    expected: { path: 'agent.top_n', code: 'invalid_type' },
  },
  {
    name: 'agent.top_n is not an integer',
    mutate: (p) => (p.agent = { top_n: 5.5 }),
    expected: { path: 'agent.top_n', code: 'invalid_type' },
  },
  {
    name: 'user.display_name is a number',
    mutate: (p) => (p.user.display_name = 42),
    expected: { path: 'user.display_name', code: 'invalid_type' },
  },
  {
    name: 'array item is not a string',
    mutate: (p) => (p.role.regulations = ['DORA', 7]),
    expected: { path: 'role.regulations.1', code: 'invalid_type' },
  },
  // numeric range
  {
    name: 'agent.time_window_days 0',
    mutate: (p) => (p.agent = { time_window_days: 0 }),
    expected: { path: 'agent.time_window_days', code: 'too_small' },
  },
  {
    name: 'agent.time_window_days 31',
    mutate: (p) => (p.agent = { time_window_days: 31 }),
    expected: { path: 'agent.time_window_days', code: 'too_big' },
  },
  {
    name: 'agent.top_n 2',
    mutate: (p) => (p.agent = { top_n: 2 }),
    expected: { path: 'agent.top_n', code: 'too_small' },
  },
  {
    name: 'agent.top_n 21',
    mutate: (p) => (p.agent = { top_n: 21 }),
    expected: { path: 'agent.top_n', code: 'too_big' },
  },
  // missing required
  {
    name: 'missing schema_version',
    mutate: (p) => delete p.schema_version,
    expected: { path: 'schema_version', code: 'invalid_value' },
  },
  {
    name: 'missing user',
    mutate: (p) => delete p.user,
    expected: { path: 'user', code: 'invalid_type' },
  },
  {
    name: 'missing user.job_title',
    mutate: (p) => delete p.user.job_title,
    expected: { path: 'user.job_title', code: 'invalid_type' },
  },
  {
    name: 'missing role.description',
    mutate: (p) => delete p.role.description,
    expected: { path: 'role.description', code: 'invalid_type' },
  },
  {
    name: 'missing languages.overview',
    mutate: (p) => delete p.languages.overview,
    expected: { path: 'languages.overview', code: 'invalid_value' },
  },
  {
    name: 'missing stakeholder relation',
    mutate: (p) => (p.stakeholders = [{ role_or_group: 'Legal' }]),
    expected: { path: 'stakeholders.0.relation', code: 'invalid_type' },
  },
  // unknown keys (additionalProperties: false)
  {
    name: 'unknown key in user',
    mutate: (p) => (p.user.mailbox = 'all'),
    expected: { path: 'user', code: 'unrecognized_keys' },
  },
  {
    name: 'unknown key in agent',
    mutate: (p) => (p.agent = { mode: 'send' }),
    expected: { path: 'agent', code: 'unrecognized_keys' },
  },
  {
    name: 'unknown key in stakeholder',
    mutate: (p) =>
      (p.stakeholders = [{ role_or_group: 'Legal', relation: 'peer', email: 'a@example.test' }]),
    expected: { path: 'stakeholders.0', code: 'unrecognized_keys' },
  },
  // too many items
  {
    name: 'role.responsibilities 13 items',
    mutate: (p) => (p.role.responsibilities = items(13)),
    expected: { path: 'role.responsibilities', code: 'too_big' },
  },
  {
    name: 'role.tools 11 items',
    mutate: (p) => (p.role.tools = items(11)),
    expected: { path: 'role.tools', code: 'too_big' },
  },
  {
    name: 'user.delegation_roles 9 items',
    mutate: (p) => (p.user.delegation_roles = items(9)),
    expected: { path: 'user.delegation_roles', code: 'too_big' },
  },
  {
    name: 'stakeholders 21 items',
    mutate: (p) => (p.stakeholders = groups(21)),
    expected: { path: 'stakeholders', code: 'too_big' },
  },
  {
    name: 'priorities.extra_urgency_signals 7 items',
    mutate: (p) => (p.priorities = { extra_urgency_signals: items(7) }),
    expected: { path: 'priorities.extra_urgency_signals', code: 'too_big' },
  },
  {
    name: 'style.draft_tone 6 items',
    mutate: (p) => (p.style = { draft_tone: items(6) }),
    expected: { path: 'style.draft_tone', code: 'too_big' },
  },
  {
    name: 'languages.working 5 items',
    mutate: (p) => (p.languages.working = ['en', 'sk', 'cs', 'de', 'en']),
    expected: { path: 'languages.working', code: 'too_big' },
  },
  {
    name: 'org_context.common_stakeholders 11 items',
    mutate: (p) => (p.org_context = { common_stakeholders: items(11) }),
    expected: { path: 'org_context.common_stakeholders', code: 'too_big' },
  },
];

export function buildInvalid(c: InvalidCase): RawProfile {
  const p = minimalProfile();
  c.mutate(p);
  return p;
}
