import type { LoadedTemplate } from '../templates/loader';
import { computeSlots } from './computed-slots';
import { pyStrip } from './py-strip';

export interface RenderResult {
  text: string;
  template: { id: string; version: string };
}

// Python Unicode \w: letters, numbers and underscore (JS \w is ASCII even with the u flag).
const MARKER = /\{\{([\p{L}\p{N}_]+)\}\}/gu;

/**
 * Port of `render` in reference/composer_ref.py. Fills the fixed template body with
 * computed slots (which win) and LLM slots. The profile is read as given; this
 * function does not normalize it.
 */
export function render(
  template: LoadedTemplate,
  profile: unknown,
  llmSlots: Record<string, unknown>,
): RenderResult {
  const values = new Map<string, string>();
  for (const [k, v] of Object.entries(llmSlots)) if (typeof v === 'string') values.set(k, v);
  for (const [k, v] of Object.entries(computeSlots(template, profile))) values.set(k, v);
  const kinds = new Map<string, string>(template.meta.slots.map((s) => [s.name, s.kind]));

  const out: string[] = [];
  for (const line of template.body.split('\n')) {
    const found = [...line.matchAll(MARKER)].map((m) => m[1] as string);
    const drop = found.some(
      (n) => kinds.get(n) === 'line_optional' && pyStrip(values.get(n) ?? '') === '',
    );
    if (drop) continue;
    let cur = line;
    for (const n of found) cur = cur.split('{{' + n + '}}').join(values.get(n) ?? '');
    out.push(cur);
  }
  const text = out.join('\n').replace(/\n+$/, '') + '\n';
  return { text, template: { id: template.id, version: template.version } };
}
