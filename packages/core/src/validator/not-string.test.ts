import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { loadTemplate, validate } from '../index';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const template = loadTemplate(join(root, 'templates/email-triage/v1'));
const dir = join(root, 'examples/cio-insurance');
const read = (f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));
type Gen = { slots: Record<string, unknown> };

it.each([[5], [['a']], [{ a: 1 }]])('non-string slot value %j is an error', (value) => {
  const gen = read('slots.json') as Gen;
  gen.slots.role_line = value;
  const r = validate(template, read('profile.json'), gen);
  expect(r.errors[0]).toBe('slot is not a string: role_line');
  expect(r.ok).toBe(false);
});

it('null counts as missing, as in the reference', () => {
  const gen = read('slots.json') as Gen;
  gen.slots.role_line = null;
  expect(validate(template, read('profile.json'), gen).errors[0]).toBe('missing slot: role_line');
});
