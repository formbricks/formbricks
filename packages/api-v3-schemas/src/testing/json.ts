/**
 * Minimal JSON / OpenAPI document typing shared by the generator scripts and the contract tests.
 *
 * Deliberately structural rather than a full OpenAPI type: everything that reads these values walks
 * them generically and validates the shapes it relies on, so a precise schema type would only move the
 * `unknown` narrowing somewhere less visible.
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Plain-data deep copy that shares nothing with its input.
 *
 * Not `structuredClone`: that preserves aliasing — two references to one object stay one object in
 * the copy — and severing it is the point, because the normalizer copies property subtrees into several
 * schemas and hey-api mutates its input in place.
 */
export const cloneJson = <T extends JsonValue>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (!isJsonObject(value)) return value;
  const copy: JsonObject = {};
  for (const [key, child] of Object.entries(value)) copy[key] = cloneJson(child);
  return copy as T;
};

/**
 * Code-unit order, the same on every machine. `localeCompare` would make the generated output and the
 * contract-test fact rows depend on the ICU data of whoever runs them.
 */
export const compareCodeUnits = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/** Resolve a local JSON pointer (`#/components/schemas/Foo`) against a document. */
export const resolvePointer = (document: JsonObject, pointer: string): JsonValue | undefined => {
  if (!pointer.startsWith("#/")) throw new Error(`Only local JSON pointers are supported, got "${pointer}"`);
  let node: JsonValue | undefined = document;
  for (const raw of pointer.slice(2).split("/")) {
    const key = decodeURIComponent(raw).replaceAll("~1", "/").replaceAll("~0", "~");
    node = isJsonObject(node) ? node[key] : undefined;
    if (node === undefined) return undefined;
  }
  return node;
};

export const SCHEMA_REF_PREFIX = "#/components/schemas/";

export const schemaNameFromRef = (ref: string): string | undefined =>
  ref.startsWith(SCHEMA_REF_PREFIX) ? ref.slice(SCHEMA_REF_PREFIX.length) : undefined;
