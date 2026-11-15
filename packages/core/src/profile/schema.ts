import { z } from 'zod';

const lang = z.enum(['en', 'sk', 'cs', 'de']);
const strings = (maxItems: number, maxLength: number) =>
  z.array(z.string().max(maxLength)).max(maxItems);

const user = z.strictObject({
  display_name: z.string().max(60).optional(),
  job_title: z.string().min(2).max(120),
  department: z.string().max(120).optional(),
  organization_name: z.string().max(120).optional(),
  organization_type: z.string().max(120).optional(),
  industry: z
    .enum([
      'financial_services',
      'insurance',
      'banking',
      'public_sector',
      'manufacturing',
      'retail',
      'it_services',
      'healthcare',
      'energy',
      'professional_services',
      'other',
    ])
    .optional(),
  seniority: z.enum(['executive', 'manager', 'specialist', 'other']).optional(),
  has_team: z.boolean().default(false),
  delegation_roles: strings(8, 60).optional(),
});

const role = z.strictObject({
  description: z.string().min(20).max(2000),
  responsibilities: strings(12, 160).optional(),
  ongoing_topics: strings(8, 120).optional(),
  tools: strings(10, 40).optional(),
  regulations: strings(8, 40).optional(),
});

const stakeholder = z.strictObject({
  name: z.string().max(60).optional(),
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
  priority: z.enum(['highest', 'high']).default('high'),
});

const priorities = z.strictObject({
  high_impact_areas: strings(8, 80).optional(),
  extra_urgency_signals: strings(6, 80).optional(),
  low_priority: strings(10, 80).optional(),
  confidential_topics: strings(6, 60).optional(),
});

const languages = z.strictObject({
  working: z
    .array(lang)
    .min(1)
    .max(4)
    .refine((items) => new Set(items).size === items.length, { message: 'items must be unique' }),
  overview: lang,
  instructions: z.literal('en').default('en'),
});

const style = z.strictObject({
  draft_tone: strings(5, 30).optional(),
  signature: z.string().max(60).optional(),
});

const agent = z.strictObject({
  name: z.string().max(30).default('Inbox Triage'),
  time_window_days: z.int().min(1).max(30).default(7),
  top_n: z.int().min(3).max(20).default(10),
});

const orgContext = z.strictObject({
  organization_description: z.string().max(300).optional(),
  common_stakeholders: strings(10, 80).optional(),
  mandatory_rule: z.string().max(300).optional(),
});

/** Mirrors schemas/agent-profile.schema.json. Single source of the profile type. */
export const agentProfileSchema = z.strictObject({
  schema_version: z.literal('1.0'),
  template_id: z.enum(['email-triage']),
  user,
  role,
  stakeholders: z.array(stakeholder).max(20).optional(),
  priorities: priorities.optional(),
  languages,
  style: style.optional(),
  agent: agent.optional(),
  org_context: orgContext.optional(),
});

export type AgentProfile = z.output<typeof agentProfileSchema>;
