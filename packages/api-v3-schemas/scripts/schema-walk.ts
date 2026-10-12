import { type JsonObject, type JsonValue, isJsonObject } from "../src/testing/json";

/**
 * Visits only the positions where OpenAPI 3.1 places a JSON Schema, children before parents.
 *
 * Walking the document generically would also rewrite `example`, `default` and `const` values — which
 * are data and may legitimately contain keys like `allOf` or `readOnly` — and would trip over property
 * names that happen to be keywords. Knowing the schema positions avoids both.
 */
export type TSchemaMapper = (schema: JsonObject, path: string) => JsonValue;

const SCHEMA_CHILDREN = [
  "additionalProperties",
  "items",
  "not",
  "if",
  "then",
  "else",
  "propertyNames",
  "contains",
  "unevaluatedProperties",
  "unevaluatedItems",
] as const;
const SCHEMA_LISTS = ["allOf", "anyOf", "oneOf", "prefixItems"] as const;
const SCHEMA_MAPS = ["properties", "patternProperties", "$defs", "dependentSchemas"] as const;
const HTTP_METHODS = ["get", "put", "post", "patch", "delete", "head", "options", "trace"] as const;

export const mapSchema = (schema: JsonValue, path: string, fn: TSchemaMapper): JsonValue => {
  if (!isJsonObject(schema)) return schema; // boolean schemas, or a malformed value left for validation
  const out: JsonObject = { ...schema };
  for (const key of SCHEMA_CHILDREN) {
    if (key in out) out[key] = mapSchema(out[key], `${path}.${key}`, fn);
  }
  for (const key of SCHEMA_LISTS) {
    const list = out[key];
    if (Array.isArray(list))
      out[key] = list.map((item, index) => mapSchema(item, `${path}.${key}[${index}]`, fn));
  }
  for (const key of SCHEMA_MAPS) {
    const map = out[key];
    if (isJsonObject(map)) {
      out[key] = Object.fromEntries(
        Object.entries(map).map(([name, child]) => [name, mapSchema(child, `${path}.${key}.${name}`, fn)])
      );
    }
  }
  return fn(out, path);
};

const mapMediaTypes = (content: JsonValue, path: string, fn: TSchemaMapper): JsonValue => {
  if (!isJsonObject(content)) return content;
  return Object.fromEntries(
    Object.entries(content).map(([mediaType, media]) => [
      mediaType,
      isJsonObject(media) && "schema" in media
        ? { ...media, schema: mapSchema(media.schema, `${path}.${mediaType}.schema`, fn) }
        : media,
    ])
  );
};

const mapWithSchemaAndContent = (holder: JsonValue, path: string, fn: TSchemaMapper): JsonValue => {
  if (!isJsonObject(holder)) return holder;
  const out: JsonObject = { ...holder };
  if ("schema" in out) out.schema = mapSchema(out.schema, `${path}.schema`, fn);
  if ("content" in out) out.content = mapMediaTypes(out.content, `${path}.content`, fn);
  if (isJsonObject(out.headers)) {
    out.headers = Object.fromEntries(
      Object.entries(out.headers).map(([name, header]) => [
        name,
        mapWithSchemaAndContent(header, `${path}.headers.${name}`, fn),
      ])
    );
  }
  return out;
};

const mapNamed = (
  map: JsonValue,
  path: string,
  each: (value: JsonValue, path: string) => JsonValue
): JsonValue =>
  isJsonObject(map)
    ? Object.fromEntries(Object.entries(map).map(([name, value]) => [name, each(value, `${path}.${name}`)]))
    : map;

const mapList = (
  list: JsonValue,
  path: string,
  each: (value: JsonValue, path: string) => JsonValue
): JsonValue => (Array.isArray(list) ? list.map((value, index) => each(value, `${path}[${index}]`)) : list);

const mapOperation = (operation: JsonValue, path: string, fn: TSchemaMapper): JsonValue => {
  if (!isJsonObject(operation)) return operation;
  const out: JsonObject = { ...operation };
  if ("parameters" in out)
    out.parameters = mapList(out.parameters, `${path}.parameters`, (p, at) =>
      mapWithSchemaAndContent(p, at, fn)
    );
  if ("requestBody" in out)
    out.requestBody = mapWithSchemaAndContent(out.requestBody, `${path}.requestBody`, fn);
  if ("responses" in out)
    out.responses = mapNamed(out.responses, `${path}.responses`, (r, at) =>
      mapWithSchemaAndContent(r, at, fn)
    );
  return out;
};

/** Apply `fn` to every schema in the document, returning a new document. */
export const mapDocumentSchemas = (document: JsonObject, fn: TSchemaMapper): JsonObject => {
  const out: JsonObject = { ...document };
  if (isJsonObject(out.paths)) {
    out.paths = mapNamed(out.paths, "$.paths", (item, at) => {
      if (!isJsonObject(item)) return item;
      const next: JsonObject = { ...item };
      if ("parameters" in next)
        next.parameters = mapList(next.parameters, `${at}.parameters`, (p, pat) =>
          mapWithSchemaAndContent(p, pat, fn)
        );
      for (const method of HTTP_METHODS) {
        if (method in next) next[method] = mapOperation(next[method], `${at}.${method}`, fn);
      }
      return next;
    });
  }
  if (isJsonObject(out.components)) {
    const components: JsonObject = { ...out.components };
    if ("schemas" in components)
      components.schemas = mapNamed(components.schemas, "$.components.schemas", (s, at) =>
        mapSchema(s, at, fn)
      );
    for (const section of ["parameters", "responses", "requestBodies", "headers"] as const) {
      if (section in components) {
        components[section] = mapNamed(components[section], `$.components.${section}`, (v, at) =>
          mapWithSchemaAndContent(v, at, fn)
        );
      }
    }
    out.components = components;
  }
  return out;
};

/** Visit every schema without changing it. */
export const forEachDocumentSchema = (
  document: JsonObject,
  visit: (schema: JsonObject, path: string) => void
): void => {
  mapDocumentSchemas(document, (schema, path) => {
    visit(schema, path);
    return schema;
  });
};
