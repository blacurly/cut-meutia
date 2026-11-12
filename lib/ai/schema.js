// Minimal JSON Schema (draft-07) validator for the keywords used by the AI
// contract (lib/ai/contract-v1.json): type, properties, required,
// additionalProperties, items, enum, const, anyOf, minLength, maxLength,
// minimum, maximum, minItems, maxItems, pattern, format (uuid, date-time,
// date). Returns a list of { path, message }; an empty list means valid.
// Unknown keywords are rejected by a test so the contract cannot silently
// outgrow this validator.

export const SUPPORTED_KEYWORDS = new Set([
  "$schema", "type", "properties", "required", "additionalProperties", "items", "enum", "const", "anyOf",
  "minLength", "maxLength", "minimum", "maximum", "minItems", "maxItems", "pattern", "format",
]);

const FORMATS = {
  uuid: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  "date-time": value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)),
  date: value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
};

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

const matchesType = (value, type) => {
  const actual = typeOf(value);
  return actual === type || (type === "number" && actual === "integer");
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validate(schema, value, path = "$") {
  const errors = [];
  const fail = message => errors.push({ path, message });
  if (!schema || typeof schema !== "object") return errors;

  if (schema.anyOf) {
    const ok = schema.anyOf.some(option => validate(option, value, path).length === 0);
    if (!ok) fail("tidak cocok dengan pilihan skema mana pun");
    return errors;
  }
  if ("const" in schema && !same(schema.const, value)) fail(`harus ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(option => same(option, value))) fail(`harus salah satu dari ${schema.enum.join(", ")}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => matchesType(value, type))) {
      fail(`harus bertipe ${types.join("|")}`);
      return errors;
    }
  }

  if (typeof value === "string") {
    if (schema.minLength != null && [...value].length < schema.minLength) fail(`minimal ${schema.minLength} karakter`);
    if (schema.maxLength != null && [...value].length > schema.maxLength) fail(`maksimal ${schema.maxLength} karakter`);
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) fail("format tidak sesuai");
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format](value)) fail(`format ${schema.format} tidak valid`);
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) fail(`minimal ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) fail(`maksimal ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) fail(`minimal ${schema.minItems} item`);
    if (schema.maxItems != null && value.length > schema.maxItems) fail(`maksimal ${schema.maxItems} item`);
    if (schema.items) value.forEach((item, index) => errors.push(...validate(schema.items, item, `${path}[${index}]`)));
  }
  if (typeOf(value) === "object") {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push({ path: `${path}.${key}`, message: "wajib ada" });
    }
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) errors.push(...validate(properties[key], item, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push({ path: `${path}.${key}`, message: "properti tidak dikenal" });
    }
  }
  return errors;
}

// Every keyword used anywhere in a schema, for the contract coverage test.
export function keywordsOf(schema, found = new Set()) {
  if (Array.isArray(schema)) schema.forEach(item => keywordsOf(item, found));
  else if (schema && typeof schema === "object") {
    for (const [key, value] of Object.entries(schema)) {
      found.add(key);
      if (key === "properties") Object.values(value).forEach(item => keywordsOf(item, found));
      else if (key !== "enum" && key !== "const" && key !== "required") keywordsOf(value, found);
    }
  }
  return found;
}
