import { z } from 'zod';
import { agentProfileSchema } from './schema';

export type WarningKind =
  | 'control_chars_removed'
  | 'braces_removed'
  | 'backticks_removed'
  | 'empty_items_removed'
  | 'duplicates_removed'
  | 'common_stakeholders_truncated';

/** Carries only a path and a kind, never input values. */
export interface NormalizationWarning {
  path: string;
  kind: WarningKind;
}

/** Deepest nesting the walk accepts. Real profiles reach depth 3. */
export const MAX_DEPTH = 8;

/** Thrown inside the walk when the input nests too deep; carries a masked path only. */
export class TooDeepError extends Error {
  constructor(readonly path: string) {
    super('too_deep');
  }
}

type Collect = (path: string, kind: WarningKind) => void;

// Control characters, line/paragraph separators, bidi controls, zero width space, BOM.
// U+200C and U+200D stay (emoji and some scripts need them).
const INVISIBLE = /[\p{Cc}\p{Zl}\p{Zp}\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/gu;

function cleanString(s: string, path: string, warn: Collect): string {
  let out = s;
  // Removals can build new sequences (`{`{x}`}` -> `{{x}}`), so repeat until stable.
  for (;;) {
    const before = out;
    const step = (next: string, kind: WarningKind) => {
      if (next !== out) warn(path, kind);
      out = next;
    };
    step(out.replace(INVISIBLE, ''), 'control_chars_removed');
    step(out.replace(/\{\{|\}\}/g, ''), 'braces_removed');
    step(out.replace(/`/g, ''), 'backticks_removed');
    if (out === before) break;
  }
  return out.trim();
}

/** Schema node at a position, or undefined for positions the schema does not know. */
function unwrap(node: z.ZodType | undefined): z.ZodType | undefined {
  let n = node;
  while (n instanceof z.ZodOptional || n instanceof z.ZodDefault) n = n.unwrap() as z.ZodType;
  return n;
}

function walk(
  value: unknown,
  path: string,
  node: z.ZodType | undefined,
  depth: number,
  warn: Collect,
): unknown {
  if (typeof value === 'string') return cleanString(value, path, warn);
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= MAX_DEPTH) throw new TooDeepError(path === '' ? '*' : path);
  const join = (seg: string) => (path ? `${path}.${seg}` : seg);
  const inner = unwrap(node);
  if (Array.isArray(value)) {
    const element = inner instanceof z.ZodArray ? (inner.element as z.ZodType) : undefined;
    const items = value.map((v, i) => walk(v, join(String(i)), element, depth + 1, warn));
    if (!items.every((v) => typeof v === 'string')) return items;
    const nonEmpty = (items as string[]).filter((s) => s !== '');
    if (nonEmpty.length !== items.length) warn(path, 'empty_items_removed');
    const unique = [...new Set(nonEmpty)];
    if (unique.length !== nonEmpty.length) warn(path, 'duplicates_removed');
    return unique;
  }
  const shape: Record<string, z.ZodType> | undefined =
    inner instanceof z.ZodObject ? (inner.shape as Record<string, z.ZodType>) : undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const known = shape !== undefined && Object.hasOwn(shape, k);
    Object.defineProperty(out, k, {
      value: walk(v, join(known ? k : '*'), known ? shape[k] : undefined, depth + 1, warn),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/**
 * Returns a sanitized deep copy of the input; the input is not mutated.
 * Warning paths contain only schema keys, array indices and `*`.
 * Throws TooDeepError when the input nests deeper than MAX_DEPTH.
 */
export function sanitizeInput(input: unknown): {
  value: unknown;
  warnings: NormalizationWarning[];
} {
  const seen = new Set<string>();
  const warnings: NormalizationWarning[] = [];
  const value = walk(input, '', agentProfileSchema, 0, (path, kind) => {
    const key = `${path}\u0000${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ path, kind });
  });
  return { value, warnings };
}
