import type { LoadedTemplate } from '../templates/loader';
import { pyStrip } from './py-strip';

type Dict = Record<string, unknown>;

function dict(v: unknown): Dict {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Dict) : {};
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function numberText(v: unknown, fallback: number): string {
  return typeof v === 'number' || typeof v === 'string' ? String(v) : String(fallback);
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

const quoted = (terms: string[]): string => terms.map((t) => `"${t}"`).join(', ');

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0] as string;
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/** Port of `computed_slots` in reference/composer_ref.py. Reads the raw profile defensively. */
export function computeSlots(template: LoadedTemplate, profileInput: unknown): Record<string, string> {
  const { meta } = template;
  const profile = dict(profileInput);
  const user = dict(profile.user);
  const agent = dict(profile.agent);
  const langs = dict(profile.languages);
  const overview = text(langs.overview);
  const working = strings(langs.working);
  const labels = meta.labels[overview];
  if (!labels) throw new Error('profile.languages.overview has no labels in the template');
  const nameOf = (l: string): string => {
    const n = meta.language_names[l];
    if (n === undefined) throw new Error('unknown language in profile');
    return n;
  };

  const pack = (kind: 'deadline' | 'urgency' | 'reminder'): string => {
    const seen: string[] = [];
    for (const lang of working) {
      const p = meta.keyword_packs[lang];
      if (!p) throw new Error('unknown language in profile');
      for (const term of p[kind]) if (!seen.includes(term)) seen.push(term);
    }
    return quoted(seen);
  };

  const display = pyStrip(text(user.display_name)) || '[Name]';
  const agentName = text(agent.name);

  return {
    agent_name: agentName ? pyStrip(agentName) : 'Inbox Triage',
    user_name: display,
    time_window_days: numberText(agent.time_window_days, 7),
    top_n: numberText(agent.top_n, 10),
    signature: pyStrip(text(dict(profile.style).signature)) || display,
    languages: joinNames(working.map(nameOf)),
    overview_language_name: nameOf(overview),
    deadline_terms: pack('deadline'),
    urgency_terms: pack('urgency'),
    reminder_terms: pack('reminder'),
    table_headers: labels.table_headers.join(' | '),
    label_further: labels.further_attention,
    label_handoff: user.has_team ? labels.ignore_or_handoff_delegate : labels.ignore_or_handoff,
    followup_examples: quoted(labels.followup_examples),
    placeholder_word: labels.placeholder_word,
    org_rule: pyStrip(text(dict(profile.org_context).mandatory_rule)),
  };
}
