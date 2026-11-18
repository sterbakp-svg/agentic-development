import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeSlots, loadTemplate } from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const template = loadTemplate(join(here, '../../../../templates/email-triage/v1'));

describe('computeSlots edge cases (the reference raises, so core throws a clean Error)', () => {
  it('rejects an empty working language list', () => {
    expect(() => computeSlots(template, { languages: { working: [], overview: 'en' } })).toThrow(
      /working/,
    );
  });

  it.each(['__proto__', 'toString', 'constructor', 'xx'])('rejects the language %j', (lang) => {
    const working = { languages: { working: [lang], overview: 'en' } };
    const overview = { languages: { working: ['en'], overview: lang } };
    expect(() => computeSlots(template, working)).toThrow(/unknown language/);
    expect(() => computeSlots(template, overview)).toThrow(/overview/);
  });
});
