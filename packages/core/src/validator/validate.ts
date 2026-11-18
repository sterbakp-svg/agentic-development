import { z } from 'zod';
import { computeSlots } from '../renderer/computed-slots';
import { pyStrip } from '../renderer/py-strip';
import { render } from '../renderer/render';
import type { LoadedTemplate } from '../templates/loader';
import { EMAIL_RE, FORBIDDEN_IN_SLOTS, PLACEHOLDER_RE } from './forbidden';
import { GUARDRAIL_LINES, REQUIRED_HEADINGS } from './guardrails';

export interface ValidationResult {
  ok: boolean;
  /** Code points of the rendered text without trailing newlines. */
  chars: number;
  errors: string[];
  warnings: string[];
}

const generatorOutputSchema = z
  .object({
    slots: z.record(z.string(), z.unknown()),
    description: z.string().optional(),
    conversation_starters: z.array(z.string()).optional(),
    placeholders_left: z.array(z.string()).optional(),
  })
  .passthrough();

const len = (s: string): number => [...s].length; // Python len(): code points

function cmpCodePoints(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = (x[i] as string).codePointAt(0)! - (y[i] as string).codePointAt(0)!;
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

/**
 * Port of `validate` in reference/composer_ref.py. Same `ok`, `chars`, error and warning
 * strings in the same order. Limits come from template.json. The profile is not validated here.
 *
 * Python semantics reproduced by hand: re.I folding (forbidden.ts), Unicode \b and \w,
 * Python \s in `^\s*#`, `^` after \n only, len() and sorted() in code points.
 *
 * Differences from the reference (E-1/E-5): a slot value that is neither a string nor null gives
 * `slot is not a string: <name>` (the reference crashes) and renders as empty. null counts as
 * missing, as in the reference. The result may contain slot text; the caller must not log it.
 */
export function validate(
  template: LoadedTemplate,
  profile: unknown,
  generatorOutput: unknown,
): ValidationResult {
  const gen = generatorOutputSchema.parse(generatorOutput);
  const { meta } = template;
  const { limits } = meta;
  const errors: string[] = [];
  const warnings: string[] = [];
  const slots = gen.slots;

  for (const def of meta.slots) {
    if (def.source !== 'llm') continue;
    const name = def.name;
    const v = Object.hasOwn(slots, name) ? slots[name] : undefined;
    if (v === undefined || v === null) {
      errors.push(`missing slot: ${name}`);
      continue;
    }
    if (typeof v !== 'string') {
      errors.push(`slot is not a string: ${name}`);
      continue;
    }
    if (def.kind === 'required' && pyStrip(v) === '') errors.push(`empty required slot: ${name}`);
    if (def.max_chars !== undefined && len(v) > def.max_chars) {
      errors.push(`slot too long: ${name} (${len(v)} > ${def.max_chars})`);
    }
    for (const rule of FORBIDDEN_IN_SLOTS) {
      if (rule.test(v)) errors.push(`forbidden content in slot ${name}: /${rule.source}/`);
    }
    if (EMAIL_RE.test(v)) warnings.push(`email address in slot ${name}; names are enough`);
    if (def.kind === 'inline_optional' && v !== '' && !v.startsWith(' ')) {
      errors.push(`inline optional slot must start with a space: ${name}`);
    }
  }

  const text = render(template, profile, slots).text;
  const n = len(text.replace(/\n+$/, ''));
  if (text.includes('{{') || text.includes('}}')) {
    errors.push('unresolved slot marker in rendered text');
  }
  if (n > limits.instructions_max_chars) {
    errors.push(`instructions too long: ${n} > ${limits.instructions_max_chars}`);
  } else if (n > limits.instructions_target_chars) {
    warnings.push(`instructions above target: ${n} > ${limits.instructions_target_chars}`);
  }
  for (const g of GUARDRAIL_LINES) if (!text.includes(g)) errors.push(`guardrail missing: ${g}`);
  for (const h of REQUIRED_HEADINGS) {
    if (!text.includes(h + '\n')) errors.push(`section missing: ${h}`);
  }

  const joined = Object.values(slots)
    .filter((x): x is string => typeof x === 'string')
    .join('\n');
  const found = [...new Set(joined.match(PLACEHOLDER_RE) ?? [])].sort(cmpCodePoints);
  const declared = new Set(gen.placeholders_left ?? []);
  for (const p of found) {
    if (!declared.has(p)) errors.push(`placeholder not declared in placeholders_left: ${p}`);
  }

  if (len(gen.description ?? '') > limits.description_max_chars) {
    errors.push('description too long');
  }
  const starters = gen.conversation_starters ?? [];
  if (starters.length !== limits.conversation_starters_count) {
    errors.push('need exactly 4 conversation starters');
  }
  for (const s of starters) {
    if (len(s) > limits.conversation_starter_max_chars) errors.push(`starter too long: ${s}`);
  }
  const agentName = computeSlots(template, profile).agent_name ?? '';
  if (len(agentName) > limits.name_max_chars) errors.push('agent name too long');

  return { ok: errors.length === 0, chars: n, errors, warnings };
}
