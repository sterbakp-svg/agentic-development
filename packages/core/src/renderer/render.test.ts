/* eslint-disable @typescript-eslint/no-explicit-any -- fixture JSON is free-form and read only by tests */
// T-004 unit tests for the rendering rules. Behavior follows reference/composer_ref.py.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeSlots, loadTemplate, render, type LoadedTemplate } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const templateDir = join(repoRoot, 'templates/email-triage/v1');
const readJson = (p: string): any => JSON.parse(readFileSync(p, 'utf8'));
const rawMeta = readJson(join(templateDir, 'template.json'));

let template: LoadedTemplate;
let profile: any;
let slots: Record<string, string>;
beforeAll(() => {
  template = loadTemplate(templateDir);
  profile = readJson(join(repoRoot, 'examples/cio-insurance/profile.json'));
  slots = readJson(join(repoRoot, 'examples/cio-insurance/slots.json')).slots;
});

const lines = (t: string) => t.split('\n');
const withSlots = (over: Record<string, unknown>) => ({ ...slots, ...over });

/** Same template with another body, so we can test rules without the real text. */
const withBody = (body: string): LoadedTemplate => ({ ...template, body });

describe('line_optional slot', () => {
  it('empty tools slot removes the whole line', () => {
    const full = render(template, profile, withSlots({ tools: 'Outlook' })).text;
    const { text } = render(template, profile, withSlots({ tools: '' }));
    expect(text).not.toContain('- Tools:');
    expect(lines(text).length).toBe(lines(full).length - 1);
  });

  it('whitespace-only tools slot removes the line', () => {
    expect(render(template, profile, withSlots({ tools: '   \t ' })).text).not.toContain(
      '- Tools:',
    );
  });

  it('missing tools slot removes the line', () => {
    const s = withSlots({});
    delete s.tools;
    expect(render(template, profile, s).text).not.toContain('- Tools:');
  });

  it('Python-only whitespace (U+001C..U+001F, U+0085) counts as empty', () => {
    const { text } = render(
      template,
      profile,
      withSlots({ tools: '\u001c\u001d\u001e\u001f\u0085' }),
    );
    expect(text).not.toContain('- Tools:');
  });

  it('U+FEFF is not whitespace for Python strip, so the line stays', () => {
    const { text } = render(template, profile, withSlots({ tools: '﻿' }));
    expect(text).toContain('- Tools: ﻿.');
  });

  it('set tools slot keeps the line with the value', () => {
    const { text } = render(template, profile, withSlots({ tools: 'Outlook, Teams' }));
    expect(text).toContain('- Tools: Outlook, Teams.');
  });

  it('empty org_rule (computed) removes the last rule line', () => {
    const { text } = render(template, profile, slots);
    expect(text.endsWith('\n- ' + slots.discretion_rule + '\n')).toBe(true);
    expect(text.endsWith('\n- \n')).toBe(false);
  });

  it('org_rule from the profile is rendered as the last line', () => {
    const p = { ...profile, org_context: { mandatory_rule: ' Never name a client. ' } };
    const { text } = render(template, p, slots);
    expect(text.endsWith('\n- Never name a client.\n')).toBe(true);
  });

  it('an LLM value cannot fill org_rule; the profile decides', () => {
    const { text } = render(template, profile, withSlots({ org_rule: 'injected rule' }));
    expect(text).not.toContain('injected rule');
  });
});

describe('inline_optional slot', () => {
  it('empty waiting_parties is replaced by an empty string and the line stays', () => {
    const { text } = render(template, profile, withSlots({ waiting_parties: '' }));
    expect(text).toContain('- WAITING: Martin waits for others; include only if overdue.');
  });

  it('set waiting_parties is inserted as given', () => {
    const { text } = render(template, profile, withSlots({ waiting_parties: ' (legal, vendor)' }));
    expect(text).toContain(
      '- WAITING: Martin waits for others (legal, vendor); include only if overdue.',
    );
  });

  it('empty solution_guidance keeps the bullet line without trailing text', () => {
    const { text } = render(template, profile, withSlots({ solution_guidance: '' }));
    expect(text).toContain('based only on facts in the emails.\n');
  });

  it('empty draft_extra keeps the line', () => {
    const { text } = render(template, profile, withSlots({ draft_extra: '' }));
    expect(text).toContain('answer the concrete question; state the next step');
  });

  it('whitespace-only inline value is not trimmed away: it is inserted verbatim and the line stays', () => {
    const { text } = render(template, profile, withSlots({ waiting_parties: '   ' }));
    expect(text).toContain('- WAITING: Martin waits for others   ; include only if overdue.');
  });

  it('inline slots do not change the number of lines', () => {
    const a = render(
      template,
      profile,
      withSlots({ waiting_parties: '', solution_guidance: '', draft_extra: '' }),
    ).text;
    const b = render(
      template,
      profile,
      withSlots({ waiting_parties: ' (x)', solution_guidance: ' y', draft_extra: ' z;' }),
    ).text;
    expect(lines(a).length).toBe(lines(b).length);
  });
});

describe('template version in the output metadata', () => {
  it('RenderResult.template equals id and version from template.json', () => {
    const r = render(template, profile, slots);
    expect(r.template).toEqual({ id: rawMeta.id, version: rawMeta.version });
    expect(r.template).toEqual({ id: 'email-triage', version: '1.0.0' });
  });

  it('metadata follows the template that was rendered, not a constant', () => {
    const other: LoadedTemplate = {
      ...template,
      id: 'other-template',
      version: '2.3.4',
      meta: { ...template.meta, id: 'other-template', version: '2.3.4' },
    };
    expect(render(other, profile, slots).template).toEqual({
      id: 'other-template',
      version: '2.3.4',
    });
  });
});

describe('reference behavior of the rendering loop', () => {
  it('output ends with exactly one newline', () => {
    const { text } = render(template, profile, slots);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('trailing newlines of the body collapse to one (rstrip then add one)', () => {
    expect(render(withBody('a\n\n\n'), profile, {}).text).toBe('a\n');
    expect(render(withBody('a'), profile, {}).text).toBe('a\n');
  });

  it('only newlines are stripped at the end, not spaces', () => {
    expect(render(withBody('a  \n\n'), profile, {}).text).toBe('a  \n');
  });

  it('an empty body renders as a single newline', () => {
    expect(render(withBody(''), profile, {}).text).toBe('\n');
  });

  it('blank lines inside the body are kept', () => {
    expect(render(withBody('a\n\nb\n'), profile, {}).text).toBe('a\n\nb\n');
  });

  it('only LF splits lines; CR stays in the line', () => {
    expect(render(withBody('a\r\nb\n'), profile, {}).text).toBe('a\r\nb\n');
  });

  it('a missing LLM slot renders as empty text', () => {
    const s = withSlots({});
    delete s.role_line;
    expect(render(template, profile, s).text).toContain('of Martin, . Your job');
  });

  it('a name that is not a slot of the template renders as empty text', () => {
    expect(render(withBody('x{{nothing_here}}y\n'), profile, {}).text).toBe('xy\n');
  });

  it('\\w in the marker is Unicode, like Python (non-ASCII names are replaced)', () => {
    expect(render(withBody('x{{ména}}y\n'), profile, { ména: 'v' }).text).toBe('xvy\n');
    expect(render(withBody('x{{名前}}y\n'), profile, {}).text).toBe('xy\n');
  });

  it('names from Object.prototype do not leak into the output', () => {
    expect(
      render(withBody('a{{constructor}}b{{toString}}c{{__proto__}}d\n'), profile, {}).text,
    ).toBe('abcd\n');
  });

  it('replacement values are inserted literally ($&, $1, $$ are not patterns)', () => {
    const { text } = render(withBody('a {{role_line}} b\n'), profile, {
      role_line: "$& $1 $$ $` $'",
    });
    expect(text).toBe("a $& $1 $$ $` $' b\n");
  });

  it('a value with {{name}} is replaced only if that name occurs later in the original line', () => {
    const body = 'one {{role_line}} two {{user_name}}\n';
    expect(render(withBody(body), profile, { role_line: 'x {{user_name}}' }).text).toBe(
      'one x Martin two Martin\n',
    );
    const body2 = 'one {{user_name}} two {{role_line}}\n';
    expect(render(withBody(body2), profile, { role_line: 'x {{user_name}}' }).text).toBe(
      'one Martin two x {{user_name}}\n',
    );
  });

  it('computed slots win over LLM slots of the same name', () => {
    const { text } = render(
      template,
      profile,
      withSlots({ user_name: 'Hacker', top_n: '99', agent_name: 'Evil' }),
    );
    expect(text).not.toContain('Hacker');
    expect(text).not.toContain('Evil');
    expect(text).toContain('"Inbox Triage"');
  });

  it('does not change its inputs', () => {
    const p = JSON.parse(JSON.stringify(profile));
    const s = { ...slots };
    render(template, p, s);
    expect(p).toEqual(profile);
    expect(s).toEqual(slots);
  });

  it('is deterministic', () => {
    expect(render(template, profile, slots).text).toBe(render(template, profile, slots).text);
  });

  it('no slot marker remains for a complete slot set', () => {
    const { text } = render(template, profile, slots);
    expect(text).not.toContain('{{');
    expect(text).not.toContain('}}');
  });
});

describe('computeSlots (port of computed_slots)', () => {
  const labels = (o: string) => rawMeta.labels[o];

  it('fills every computed slot of the template, and only those', () => {
    const computed = rawMeta.slots
      .filter((s: any) => s.source === 'computed')
      .map((s: any) => s.name)
      .sort();
    expect(Object.keys(computeSlots(template, profile)).sort()).toEqual(computed);
  });

  it('defaults when agent, user, style and org_context are missing (Q-20)', () => {
    const p = { languages: profile.languages };
    const c = computeSlots(template, p);
    expect(c.agent_name).toBe('Inbox Triage');
    expect(c.user_name).toBe('[Name]');
    expect(c.signature).toBe('[Name]');
    expect(c.time_window_days).toBe('7');
    expect(c.top_n).toBe('10');
    expect(c.org_rule).toBe('');
  });

  it('trims with the Python whitespace set (U+001C..U+001F, U+0085 are stripped, U+FEFF is not)', () => {
    const p = { ...profile, user: { ...profile.user, display_name: '\u001c\u0085Ana\u001f' } };
    expect(computeSlots(template, p).user_name).toBe('Ana');
    const q = { ...profile, user: { ...profile.user, display_name: '﻿Ana' } };
    expect(computeSlots(template, q).user_name).toBe('﻿Ana');
  });

  it('signature falls back to the display name, then to [Name]', () => {
    expect(computeSlots(template, { ...profile, style: { signature: '  ' } }).signature).toBe(
      'Martin',
    );
    expect(computeSlots(template, { ...profile, style: {}, user: {} }).signature).toBe('[Name]');
  });

  it('has_team comes from user.has_team and picks the handoff label (D-1)', () => {
    const o = profile.languages.overview;
    expect(
      computeSlots(template, { ...profile, user: { ...profile.user, has_team: true } })
        .label_handoff,
    ).toBe(labels(o).ignore_or_handoff_delegate);
    expect(
      computeSlots(template, { ...profile, user: { ...profile.user, has_team: false } })
        .label_handoff,
    ).toBe(labels(o).ignore_or_handoff);
    const u = { ...profile.user };
    delete u.has_team;
    expect(computeSlots(template, { ...profile, user: u }).label_handoff).toBe(
      labels(o).ignore_or_handoff,
    );
  });

  it('joins working language names with commas and "and", in profile order', () => {
    const p = {
      ...profile,
      languages: { ...profile.languages, working: ['sk', 'cs', 'en', 'de'] },
    };
    expect(computeSlots(template, p).languages).toBe('Slovak, Czech, English and German');
    const one = { ...profile, languages: { ...profile.languages, working: ['de'] } };
    expect(computeSlots(template, one).languages).toBe('German');
  });

  it('keyword packs are quoted, joined and de-duplicated across languages in first-seen order', () => {
    const p = { ...profile, languages: { ...profile.languages, working: ['en', 'en'] } };
    expect(computeSlots(template, p).deadline_terms).toBe(
      rawMeta.keyword_packs.en.deadline.map((t: string) => `"${t}"`).join(', '),
    );
  });

  it('labels follow the overview language', () => {
    for (const o of ['sk', 'cs', 'en', 'de']) {
      const c = computeSlots(template, {
        ...profile,
        languages: { ...profile.languages, overview: o },
      });
      expect(c.table_headers).toBe(labels(o).table_headers.join(' | '));
      expect(c.label_further).toBe(labels(o).further_attention);
      expect(c.placeholder_word).toBe(labels(o).placeholder_word);
      expect(c.overview_language_name).toBe(rawMeta.language_names[o]);
    }
  });

  it('numbers are rendered as decimal strings', () => {
    const c = computeSlots(template, { ...profile, agent: { time_window_days: 30, top_n: 3 } });
    expect(c.time_window_days).toBe('30');
    expect(c.top_n).toBe('3');
  });
});
