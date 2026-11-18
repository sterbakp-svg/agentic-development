// Contract of the manual evals: ADR-001 section 8, plus the JD extension (rubric-only cases).
import { z } from 'zod';

export const RUBRIC_CRITERIA = [
  'role_fit',
  'faithfulness',
  'stakeholder_order',
  'language',
  'placeholders',
  'questions',
] as const;

export const rubricCriterionSchema = z.enum(RUBRIC_CRITERIA);
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export const scoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type Score = z.infer<typeof scoreSchema>;

const scorerScoresSchema = z.strictObject({
  role_fit: scoreSchema,
  faithfulness: scoreSchema,
  stakeholder_order: scoreSchema,
  language: scoreSchema,
  placeholders: scoreSchema,
  questions: scoreSchema,
});

/** Relative path inside the run folder. No absolute path, no `..`, no backslash. */
export const RELATIVE_PATH_PATTERN = '^(?!/)(?!.*(^|/)\\.\\.(/|$))[A-Za-z0-9._/-]+$';
const relativePathSchema = z.string().min(1).max(200).regex(new RegExp(RELATIVE_PATH_PATTERN));

/** Dot-separated IDs: `forbidden_content.tools.line_break`. See codes.ts. */
export const CODE_PATTERN = '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$';
const codeSchema = z.string().max(100).regex(new RegExp(CODE_PATTERN));
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export const flowResultSchema = z
  .strictObject({
    valid: z.boolean(),
    errorCodes: z.array(codeSchema),
    warningCodes: z.array(codeSchema),
    chars: z.number().int().min(0),
  })
  .refine((f) => f.valid === (f.errorCodes.length === 0), {
    message: 'flow.valid must be true exactly when errorCodes is empty',
    path: ['valid'],
  });

export const isJdCase = (caseId: string): boolean => caseId.startsWith('JD-');

export const manualEvalCaseSchema = z
  .strictObject({
    caseId: z.string().regex(/^[A-Z]{1,3}-\d{2}$/),
    attempt: z.number().int().min(1),
    /** profile_json that was pasted. Not used by JD cases (their input is a job description). */
    inputFile: relativePathSchema.optional(),
    /** Raw prompt tool JSON. JD cases have none. */
    outputFile: relativePathSchema.optional(),
    retried: z.boolean(),
    flow: flowResultSchema.optional(),
    scores: z.record(z.string().min(1), scorerScoresSchema).optional(),
    note: z.string().max(500).optional(),
    /** Negative case (for example S-03): the output must be rejected by the validator and the flow. */
    expectReject: z.boolean().optional(),
  })
  .superRefine((c, ctx) => {
    const jd = isJdCase(c.caseId);
    const need = (name: 'inputFile' | 'outputFile' | 'flow') => {
      if (c[name] === undefined) {
        ctx.addIssue({ code: 'custom', path: [name], message: `${name} is required` });
      }
    };
    const forbid = (name: 'inputFile' | 'outputFile' | 'flow') => {
      if (c[name] !== undefined) {
        ctx.addIssue({ code: 'custom', path: [name], message: `${name} is not used by JD cases` });
      }
    };
    for (const n of ['inputFile', 'outputFile', 'flow'] as const) (jd ? forbid : need)(n);
    if (jd && c.expectReject !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['expectReject'], message: 'not used by JD cases' });
    }
  });
export type ManualEvalCase = z.infer<typeof manualEvalCaseSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'not a real date');

export const manualEvalRunSchema = z
  .strictObject({
    runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
    date: isoDate,
    environment: z.literal('company-test'),
    solutionVersion: z.string().min(1).max(50),
    templateVersion: z.string().regex(SEMVER),
    promptVersion: z.string().min(1).max(50),
    /** Version of prompts/mvp-interview-agent.instructions.md. Required when a JD case is present. */
    interviewPromptVersion: z.string().regex(SEMVER).optional(),
    promptOption: z.enum(['A', 'B']),
    model: z.string().min(1).max(100),
    /** Role labels, not names: "product-owner", "domain-user-1". */
    scorers: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).min(1),
    cases: z.array(manualEvalCaseSchema).min(1),
  })
  .superRefine((run, ctx) => {
    if (run.interviewPromptVersion === undefined && run.cases.some((c) => isJdCase(c.caseId))) {
      ctx.addIssue({
        code: 'custom',
        path: ['interviewPromptVersion'],
        message: 'required when a JD case is present',
      });
    }
    if (new Set(run.scorers).size !== run.scorers.length) {
      ctx.addIssue({ code: 'custom', path: ['scorers'], message: 'scorers must be unique' });
    }
    const seen = new Set<string>();
    run.cases.forEach((c, i) => {
      const key = `${c.caseId}#${c.attempt}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['cases', i], message: 'duplicate caseId and attempt' });
      }
      seen.add(key);
      for (const scorer of Object.keys(c.scores ?? {})) {
        if (!run.scorers.includes(scorer)) {
          ctx.addIssue({
            code: 'custom',
            path: ['cases', i, 'scores'],
            message: 'scorer is not listed in scorers',
          });
        }
      }
    });
  });
export type ManualEvalRun = z.infer<typeof manualEvalRunSchema>;

export const parityValues = ['same', 'flow-stricter', 'flow-weaker'] as const;
export const paritySchema = z.enum(parityValues);
export type Parity = z.infer<typeof paritySchema>;

/** ADR-001 section 8. `repoValid` and `parity` are null for JD cases (no render check). */
export const manualEvalCaseSummarySchema = z.strictObject({
  caseId: z.string(),
  repoValid: z.boolean().nullable(),
  parity: paritySchema.nullable(),
  meanScore: z.number().nullable(),
  minCriterion: z.number().nullable(),
  threshold: z.union([z.literal(4.0), z.literal(4.5)]),
  pass: z.boolean(),
});
export type ManualEvalCaseSummary = z.infer<typeof manualEvalCaseSummarySchema>;
