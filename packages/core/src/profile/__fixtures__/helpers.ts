import schema from '../../../../../schemas/agent-profile.schema.json';
import cio from '../../../../../examples/cio-insurance/profile.json';
import tprm from '../../../../../examples/tprm-analyst/profile.json';

export const schemaJson = schema as { $schema: string };

export const goldenProfiles: Record<string, unknown> = {
  'cio-insurance': cio,
  'tprm-analyst': tprm,
};

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Test helpers edit arbitrary paths of a raw (untyped) input on purpose.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawProfile = Record<string, any>;

/** Smallest profile the schema accepts (synthetic data). */
export function minimalProfile(): RawProfile {
  return {
    schema_version: '1.0',
    template_id: 'email-triage',
    user: { job_title: 'Analyst' },
    role: { description: 'Reviews synthetic reports for the test department.' },
    languages: { working: ['en'], overview: 'en' },
  };
}
