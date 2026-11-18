import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { templateMetaSchema, type TemplateMeta } from './schema';

export interface LoadedTemplate {
  id: string;
  version: string;
  meta: TemplateMeta;
  body: string;
}

/** Loads and validates one template folder (`template.json` plus its body file). */
export function loadTemplate(dir: string): LoadedTemplate {
  const root = resolve(dir);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(root, 'template.json'), 'utf8'));
  } catch {
    throw new Error('template.json cannot be read or is not valid JSON');
  }
  const parsed = templateMetaSchema.safeParse(raw);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.join('.') || '(root)').join(', ');
    throw new Error(`template.json is invalid at: ${paths}`);
  }
  const meta = parsed.data;
  const bodyPath = resolve(root, meta.body_file);
  const rel = relative(root, bodyPath);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('body_file must stay inside the template folder');
  }
  let body: string;
  try {
    body = readFileSync(bodyPath, 'utf8');
  } catch {
    throw new Error('body_file cannot be read');
  }
  return { id: meta.id, version: meta.version, meta, body };
}
