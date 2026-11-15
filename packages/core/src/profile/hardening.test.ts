import { describe, expect, it } from 'vitest';
import { agentProfileSchema, prepareProfile } from '../index';
import { minimalProfile } from './__fixtures__/helpers';

describe('rebuilt sequences', () => {
  it.each(['{`{signature}`}', '{}}{x', 'a}{{}b', '{{`{`{`{a}`}`}`}}'])('%s leaves nothing', (s) => {
    const p = minimalProfile();
    p.user.display_name = s;
    const r = prepareProfile(p);
    if (!r.ok) throw new Error('expected ok');
    const out = r.profile.user.display_name ?? '';
    expect(out).not.toMatch(/\{\{|\}\}|`/);
  });

  it('reports both kinds when backtick removal rebuilds braces', () => {
    const p = minimalProfile();
    p.user.display_name = 'Ja{`{signature}`}';
    const r = prepareProfile(p);
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.user.display_name).toBe('Jasignature');
    expect(r.warnings.map((w) => w.kind).sort()).toEqual(['backticks_removed', 'braces_removed']);
  });
});

describe('warning paths hold no input keys', () => {
  it('masks unknown keys, also when parsing fails', () => {
    const p = minimalProfile();
    p.user['SECRET KEY TEXT'] = 'a`b';
    p['TOP SECRET'] = { 'INNER SECRET': 'x{{' };
    const r = prepareProfile(p);
    expect(r.ok).toBe(false);
    expect(r.warnings).toContainEqual({ path: 'user.*', kind: 'backticks_removed' });
    expect(r.warnings).toContainEqual({ path: '*.*', kind: 'braces_removed' });
    expect(JSON.stringify(r)).not.toContain('SECRET');
  });

  it('keeps schema keys and array indices', () => {
    const p = minimalProfile();
    p.stakeholders = [{ role_or_group: 'a`b', relation: 'peer' }];
    const r = prepareProfile(p);
    expect(r.warnings).toEqual([
      { path: 'stakeholders.0.role_or_group', kind: 'backticks_removed' },
    ]);
  });
});

describe('merge cap', () => {
  const make = (own: number, common: string[]) => {
    const p = minimalProfile();
    p.stakeholders = Array.from({ length: own }, (_, i) => ({
      role_or_group: `Group ${i}`,
      relation: 'peer',
    }));
    p.org_context = { common_stakeholders: common };
    return p;
  };

  it('never exceeds 20 and warns', () => {
    const r = prepareProfile(make(20, ['Legal', 'Finance']));
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.stakeholders).toHaveLength(20);
    expect(r.warnings).toEqual([
      { path: 'org_context.common_stakeholders', kind: 'common_stakeholders_truncated' },
    ]);
    expect(agentProfileSchema.safeParse(r.profile).success).toBe(true);
    const again = prepareProfile(r.profile);
    if (!again.ok) throw new Error('expected ok');
    expect(again.profile).toEqual(r.profile);
  });

  it('fills up to 20 with common ones in order', () => {
    const r = prepareProfile(make(19, ['Legal', 'Finance']));
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.stakeholders?.[19]?.role_or_group).toBe('Legal');
    expect(r.warnings.map((w) => w.kind)).toEqual(['common_stakeholders_truncated']);
  });

  it('no warning when all fit', () => {
    const r = prepareProfile(make(18, ['Legal', 'Finance']));
    expect(r.warnings).toEqual([]);
  });
});

describe('prepareProfile never throws', () => {
  const nest = (n: number): unknown => {
    let v: unknown = 'x';
    for (let i = 0; i < n; i++) v = [v];
    return v;
  };

  it('deep input returns too_deep', () => {
    const r = prepareProfile(nest(200_000));
    expect(r.ok).toBe(false);
    expect(r.issues).toEqual([{ path: expect.any(String), code: 'too_deep' }]);
  });

  it('deep input inside a field returns too_deep', () => {
    const p = minimalProfile();
    p.role.tools = nest(50);
    const r = prepareProfile(p);
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.code).toBe('too_deep');
  });

  it('normal profiles are within the depth limit', () => {
    expect(prepareProfile(minimalProfile()).ok).toBe(true);
  });

  it('hostile inputs do not throw', () => {
    const throwing = {
      get user(): never {
        throw new Error('boom');
      },
    };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const inputs: unknown[] = [
      nest(200_000),
      new Array(1_000_000).fill('a'),
      throwing,
      cyclic,
      Object.create(null),
      () => 1,
      Symbol('s'),
      10n,
    ];
    for (const i of inputs) expect(() => prepareProfile(i)).not.toThrow();
  });
});

describe('invisible characters', () => {
  const removed = [
    ['line separator', '\u2028'],
    ['paragraph separator', '\u2029'],
    ['bidi embedding', '\u202A\u202B\u202C\u202D\u202E'],
    ['bidi isolates', '\u2066\u2067\u2068\u2069'],
    ['zero width space', '\u200B'],
    ['BOM', '\uFEFF'],
  ] as const;

  it.each(removed)('%s is removed with control_chars_removed', (_n, ch) => {
    const p = minimalProfile();
    p.user.display_name = `Ja${ch}na`;
    const r = prepareProfile(p);
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.user.display_name).toBe('Jana');
    expect(r.warnings).toEqual([{ path: 'user.display_name', kind: 'control_chars_removed' }]);
  });

  it('keeps ZWJ and ZWNJ', () => {
    const p = minimalProfile();
    p.user.display_name = 'a\u200Db\u200Cc';
    const r = prepareProfile(p);
    if (!r.ok) throw new Error('expected ok');
    expect(r.profile.user.display_name).toBe('a\u200Db\u200Cc');
    expect(r.warnings).toEqual([]);
  });
});
