import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadTemplate, type LoadedTemplate } from './loader';

export interface TemplateRegistry {
  get(id: string, version: string): LoadedTemplate;
  list(): { id: string; version: string }[];
}

function safeSegment(s: string, what: string): void {
  if (s === '' || s === '.' || s.includes('..') || /[/\\\0]/.test(s)) {
    throw new Error(`invalid template ${what}: ${JSON.stringify(s)}`);
  }
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/** Registry over `<root>/<id>/<folder>/template.json`; versions are matched by `meta.version`. */
export function createTemplateRegistry(root: string): TemplateRegistry {
  const candidates = (id: string): string[] => subdirs(join(root, id)).map((f) => join(root, id, f));
  return {
    get(id, version) {
      safeSegment(id, 'id');
      safeSegment(version, 'version');
      const dirs = candidates(id);
      if (dirs.length === 0) throw new Error(`unknown template id: ${id}`);
      for (const d of dirs) {
        let t: LoadedTemplate;
        try {
          t = loadTemplate(d);
        } catch {
          continue;
        }
        if (t.id === id && t.version === version) return t;
      }
      throw new Error(`unknown version ${version} of template ${id}`);
    },
    list() {
      const out: { id: string; version: string }[] = [];
      for (const id of subdirs(root)) {
        for (const d of candidates(id)) {
          try {
            const t = loadTemplate(d);
            if (t.id === id) out.push({ id: t.id, version: t.version });
          } catch {
            // broken templates are not listed
          }
        }
      }
      return out;
    },
  };
}
