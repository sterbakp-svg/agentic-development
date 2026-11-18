import { z } from 'zod';

const nonEmpty = z.string().min(1);

const slotSchema = z
  .object({
    name: nonEmpty,
    source: z.enum(['llm', 'computed']),
    kind: z.enum(['required', 'line_optional', 'inline_optional']),
    max_chars: z.number().int().positive().optional(),
  })
  .passthrough();

const limitsSchema = z
  .object({
    instructions_max_chars: z.number().int().positive(),
    instructions_target_chars: z.number().int().positive(),
    name_max_chars: z.number().int().positive(),
    description_max_chars: z.number().int().positive(),
    conversation_starters_count: z.number().int().positive(),
    conversation_starter_max_chars: z.number().int().positive(),
  })
  .passthrough();

const labelsSchema = z
  .object({
    table_headers: z.array(z.string()),
    further_attention: z.string(),
    ignore_or_handoff: z.string(),
    ignore_or_handoff_delegate: z.string(),
    followup_examples: z.array(z.string()),
    placeholder_word: z.string(),
  })
  .passthrough();

const keywordPackSchema = z
  .object({
    deadline: z.array(z.string()),
    urgency: z.array(z.string()),
    reminder: z.array(z.string()),
  })
  .passthrough();

/** Shape of `template.json`. Unknown extra keys are kept. */
export const templateMetaSchema = z
  .object({
    id: nonEmpty,
    version: nonEmpty,
    body_file: nonEmpty,
    slots: z.array(slotSchema),
    limits: limitsSchema,
    labels: z.record(z.string(), labelsSchema),
    keyword_packs: z.record(z.string(), keywordPackSchema),
    language_names: z.record(z.string(), z.string()),
  })
  .passthrough();

export type TemplateMeta = z.infer<typeof templateMetaSchema>;
