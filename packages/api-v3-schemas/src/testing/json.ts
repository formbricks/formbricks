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

/** Plain-data deep copy. Also severs shared references, which `structuredClone` would keep. */
export const cloneJson = <T extends JsonValue>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

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
