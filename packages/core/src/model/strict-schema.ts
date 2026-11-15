type Json = Record<string, unknown>;

/** Keywords that strict structured output rejects. The validator enforces them instead. */
const REMOVED = new Set([
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
]);

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function allowNull(schema: Json): Json {
  const type = schema.type;
  if (typeof type === 'string') {
    return type === 'null' ? schema : { ...schema, type: [type, 'null'] };
  }
  if (Array.isArray(type)) {
    return type.includes('null') ? schema : { ...schema, type: [...type, 'null'] };
  }
  return { anyOf: [schema, { type: 'null' }] };
}

function convert(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(convert);
  if (!isObject(node)) return node;

  const out: Json = {};
  for (const [key, value] of Object.entries(node)) {
    if (REMOVED.has(key)) continue;
    if (key === 'properties' && isObject(value)) {
      // Property names are data, not keywords: keep them all.
      out[key] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)]));
    } else if (key === 'enum' || key === 'const' || key === 'required') {
      out[key] = structuredClone(value);
    } else {
      out[key] = convert(value);
    }
  }

  if (isObject(out.properties)) {
    const props = out.properties;
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    for (const name of Object.keys(props)) {
      if (!required.has(name)) props[name] = allowNull(props[name] as Json);
    }
    out.required = Object.keys(props);
    out.additionalProperties = false;
  } else if (out.type === 'object') {
    out.required = [];
    out.additionalProperties = false;
  }
  return out;
}

/**
 * Turns a JSON schema into one that Azure OpenAI strict mode accepts:
 * removes unsupported keywords, closes every object and lists every property
 * as required (optional ones become nullable). Does not change its input.
 */
export function toStrictJsonSchema(schema: unknown): unknown {
  return convert(schema);
}
