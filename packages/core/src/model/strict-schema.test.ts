import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toStrictJsonSchema } from '../index';

// Tests walk arbitrary JSON, so a loose type is the honest one here.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const generatorSchema: Json = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../schemas/generator-output.schema.json', import.meta.url)),
    'utf8',
  ),
);

const FORBIDDEN = [
  'maxLength',
  'minLength',
  'maxItems',
  'minItems',
  'pattern',
  'format',
  'default',
  '$schema',
  '$id',
  'title',
];

function walk(node: unknown, visit: (n: Json) => void): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') {
    visit(node as Json);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

describe('toStrictJsonSchema: keyword removal', () => {
  it.each(FORBIDDEN)('removes %s at top level, in properties and in items', (kw) => {
    const input = {
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string', [kw]: 'x' },
        b: { type: 'array', items: { type: 'string', [kw]: 'x' }, [kw]: 'x' },
      },
      [kw]: 'x',
    };
    const out = toStrictJsonSchema(input) as Json;
    expect(Object.keys(out)).not.toContain(kw);
    expect(Object.keys(out.properties.a)).not.toContain(kw);
    expect(Object.keys(out.properties.b)).not.toContain(kw);
    expect(Object.keys(out.properties.b.items)).not.toContain(kw);
  });

  it('keeps description', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      description: 'top',
      required: ['a'],
      properties: { a: { type: 'string', description: 'field' } },
    }) as Json;
    expect(out.description).toBe('top');
    expect(out.properties.a.description).toBe('field');
  });

  it('keeps a property that is named like a removed keyword', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['title', 'format'],
      properties: { title: { type: 'string' }, format: { type: 'string' } },
    }) as Json;
    expect(Object.keys(out.properties)).toEqual(['title', 'format']);
    expect([...out.required].sort()).toEqual(['format', 'title']);
  });

  it('keeps enum and array structure', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['s', 'l'],
      properties: {
        s: { enum: ['x', 'y'] },
        l: { type: 'array', minItems: 4, items: { type: 'string', maxLength: 10 } },
      },
    }) as Json;
    expect(out.properties.s.enum).toEqual(['x', 'y']);
    expect(out.properties.l.type).toBe('array');
    expect(out.properties.l.items).toEqual({ type: 'string' });
  });
});

describe('toStrictJsonSchema: objects', () => {
  it('sets additionalProperties false on every object, also when missing or true', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['a', 'l'],
      additionalProperties: true,
      properties: {
        a: { type: 'object', required: [], properties: {} },
        l: {
          type: 'array',
          items: { type: 'object', required: ['x'], properties: { x: { type: 'string' } } },
        },
      },
    }) as Json;
    expect(out.additionalProperties).toBe(false);
    expect(out.properties.a.additionalProperties).toBe(false);
    expect(out.properties.l.items.additionalProperties).toBe(false);
  });

  it('puts every property into required', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['b'],
      properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
    }) as Json;
    expect([...out.required].sort()).toEqual(['a', 'b', 'c']);
  });

  it('makes a previously optional property nullable and leaves required ones alone', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['a'],
      properties: { a: { type: 'string' }, b: { type: 'integer' } },
    }) as Json;
    expect(out.properties.a.type).toBe('string');
    expect(out.properties.b.type).toEqual(['integer', 'null']);
    expect(out.required).toContain('b');
  });

  it('makes optional properties nullable in nested objects too', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: ['n'],
      properties: { n: { type: 'object', required: [], properties: { opt: { type: 'string' } } } },
    }) as Json;
    expect(out.properties.n.properties.opt.type).toEqual(['string', 'null']);
    expect(out.properties.n.required).toEqual(['opt']);
  });

  it('does not double-wrap a type that already allows null', () => {
    const out = toStrictJsonSchema({
      type: 'object',
      required: [],
      properties: { a: { type: ['string', 'null'] } },
    }) as Json;
    expect(out.properties.a.type).toEqual(['string', 'null']);
  });
});

describe('toStrictJsonSchema: input safety', () => {
  it('does not mutate its input', () => {
    const input = JSON.parse(JSON.stringify(generatorSchema));
    const snapshot = JSON.stringify(input);
    toStrictJsonSchema(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('returns a new object', () => {
    const input = { type: 'object', required: [], properties: {} };
    expect(toStrictJsonSchema(input)).not.toBe(input);
  });
});

describe('toStrictJsonSchema: schemas/generator-output.schema.json', () => {
  const out = toStrictJsonSchema(generatorSchema) as Json;

  it('contains none of the rejected keywords', () => {
    walk(out, (n) => {
      for (const kw of FORBIDDEN) expect(Object.keys(n)).not.toContain(kw);
    });
  });

  it('has additionalProperties false on every object', () => {
    walk(out, (n) => {
      if (n.type === 'object') expect(n.additionalProperties).toBe(false);
    });
  });

  it('lists every property in required on every object', () => {
    walk(out, (n) => {
      if (n.type === 'object' && n.properties) {
        expect([...n.required].sort()).toEqual(Object.keys(n.properties).sort());
      }
    });
  });

  it('keeps all 7 top-level properties and all 19 slots', () => {
    expect(Object.keys(out.properties)).toHaveLength(7);
    expect(Object.keys(out.properties.slots.properties)).toHaveLength(19);
  });

  it('keeps the status enum', () => {
    expect(out.properties.status.enum).toEqual(['ready', 'needs_input']);
  });

  it('keeps array item types for conversation_starters', () => {
    expect(out.properties.conversation_starters.type).toBe('array');
    expect(out.properties.conversation_starters.items.type).toBe('string');
  });
});
