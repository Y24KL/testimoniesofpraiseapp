/**
 * Turns model output into a checked value. Praxiom's response_format is accepted by the API, but the docs
 * do not say that a JSON schema is enforced, so every structured answer is parsed and checked here before
 * anything uses it. Unknown keys are refused, and text is bounded.
 */

const MAX_TEXT_CHARS = 20000;

/** Parses a JSON object out of model text. Accepts a bare object, a fenced block, or an object inside prose. */
export function parseModelJson(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_TEXT_CHARS) return { ok: false, reason: 'unreadable' };
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const attempts = [stripped];
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) attempts.push(stripped.slice(start, end + 1));
  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) return { ok: true, value };
    } catch {
      /* try the next form */
    }
  }
  return { ok: false, reason: 'not_json_object' };
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Checks a value against a small schema: string (minLength, maxLength, enum), integer (min, max), boolean,
 * array (items, maxItems), object (properties, required, additionalProperties: false by default).
 * Returns a list of human-readable problems. An empty list means the value is valid.
 */
export function schemaErrors(value, schema, path = '$') {
  const errors = [];
  const fail = (message) => errors.push(`${path}: ${message}`);
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') { fail('expected string'); break; }
      if (schema.minLength != null && value.length < schema.minLength) fail(`shorter than ${schema.minLength}`);
      if (schema.maxLength != null && value.length > schema.maxLength) fail(`longer than ${schema.maxLength}`);
      if (schema.enum && !schema.enum.includes(value)) fail('not an allowed value');
      break;
    case 'integer':
      if (!Number.isInteger(value)) { fail('expected integer'); break; }
      if (schema.min != null && value < schema.min) fail(`below ${schema.min}`);
      if (schema.max != null && value > schema.max) fail(`above ${schema.max}`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') fail('expected boolean');
      break;
    case 'array':
      if (!Array.isArray(value)) { fail('expected array'); break; }
      if (schema.maxItems != null && value.length > schema.maxItems) fail(`more than ${schema.maxItems} items`);
      if (schema.items) value.forEach((item, i) => errors.push(...schemaErrors(item, schema.items, `${path}[${i}]`)));
      break;
    case 'object': {
      if (!isPlainObject(value)) { fail('expected object'); break; }
      const properties = schema.properties || {};
      for (const key of schema.required || []) if (!(key in value)) fail(`missing ${key}`);
      if (schema.additionalProperties !== true) {
        for (const key of Object.keys(value)) if (!(key in properties)) fail(`unexpected ${key}`);
      }
      for (const [key, sub] of Object.entries(properties)) if (key in value) errors.push(...schemaErrors(value[key], sub, `${path}.${key}`));
      break;
    }
    default:
      fail(`unsupported schema type ${schema.type}`);
  }
  return errors;
}

/** Parses model text and checks it against a schema. Returns { ok, value } or { ok: false, errors }. */
export function validateModelOutput(text, schema) {
  const parsed = parseModelJson(text);
  if (!parsed.ok) return { ok: false, errors: [parsed.reason] };
  const errors = schemaErrors(parsed.value, schema);
  return errors.length ? { ok: false, errors } : { ok: true, value: parsed.value };
}
