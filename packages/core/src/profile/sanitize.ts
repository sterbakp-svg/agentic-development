export type WarningKind =
  | 'control_chars_removed'
  | 'braces_removed'
  | 'backticks_removed'
  | 'empty_items_removed'
  | 'duplicates_removed';

/** Carries only a path and a kind, never input values. */
export interface NormalizationWarning {
  path: string;
  kind: WarningKind;
}

type Collect = (path: string, kind: WarningKind) => void;

function cleanString(s: string, path: string, warn: Collect): string {
  let out = s;
  const step = (next: string, kind: WarningKind) => {
    if (next !== out) warn(path, kind);
    out = next;
  };
  step(out.replace(/\p{Cc}/gu, ''), 'control_chars_removed');
  step(out.replace(/\{\{|\}\}/g, ''), 'braces_removed');
  step(out.replace(/`/g, ''), 'backticks_removed');
  return out.trim();
}

function walk(value: unknown, path: string, warn: Collect): unknown {
  if (typeof value === 'string') return cleanString(value, path, warn);
  if (Array.isArray(value)) {
    const items = value.map((v, i) => walk(v, path ? `${path}.${i}` : String(i), warn));
    if (!items.every((v) => typeof v === 'string')) return items;
    const nonEmpty = (items as string[]).filter((s) => s !== '');
    if (nonEmpty.length !== items.length) warn(path, 'empty_items_removed');
    const unique = [...new Set(nonEmpty)];
    if (unique.length !== nonEmpty.length) warn(path, 'duplicates_removed');
    return unique;
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      Object.defineProperty(out, k, {
        value: walk(v, path ? `${path}.${k}` : k, warn),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  return value;
}

/** Returns a sanitized deep copy of the input; the input is not mutated. */
export function sanitizeInput(input: unknown): { value: unknown; warnings: NormalizationWarning[] } {
  const seen = new Set<string>();
  const warnings: NormalizationWarning[] = [];
  const value = walk(input, '', (path, kind) => {
    const key = `${path}\u0000${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ path, kind });
  });
  return { value, warnings };
}
