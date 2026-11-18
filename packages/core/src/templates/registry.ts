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
  // One load per folder and registry instance. null marks a folder that failed to load.
  const cache = new Map<string, LoadedTemplate | null>();
  const load = (dir: string): LoadedTemplate | null => {
    if (!cache.has(dir)) {
      try {
        cache.set(dir, loadTemplate(dir));
      } catch {
        cache.set(dir, null);
      }
    }
    return cache.get(dir) ?? null;
  };
  const candidates = (id: string): string[] => subdirs(join(root, id)).map((f) => join(root, id, f));
  return {
    get(id, version) {
      safeSegment(id, 'id');
      safeSegment(version, 'version');
      const dirs = candidates(id);
      if (dirs.length === 0) throw new Error(`unknown template id: ${id}`);
      let failed = false;
      for (const d of dirs) {
        const t = load(d);
        if (t === null) failed = true;
        else if (t.id === id && t.version === version) return t;
      }
      if (failed) throw new Error(`template ${id} ${version}: failed to load`);
      throw new Error(`unknown version ${version} of template ${id}`);
    },
    list() {
      const out: { id: string; version: string }[] = [];
      for (const id of subdirs(root)) {
        for (const d of candidates(id)) {
          const t = load(d);
          if (t !== null && t.id === id) out.push({ id: t.id, version: t.version });
        }
      }
      return out;
    },
  };
}
