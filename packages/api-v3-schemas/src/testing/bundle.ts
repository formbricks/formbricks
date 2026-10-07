import { CORE_SCHEMA, load } from "js-yaml";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type JsonObject, isJsonObject } from "./json";

/** The committed single-file bundle: the input of generation and of every contract test. */
export const BUNDLE_PATH = fileURLToPath(
  new URL("../../../../docs/api-v3-reference/openapi.yml", import.meta.url)
);

/**
 * Parse an OpenAPI YAML document as plain JSON data.
 *
 * `CORE_SCHEMA` rather than js-yaml's default: the default schema turns an unquoted
 * `2026-01-01T00:00:00Z` into a `Date`, which would make an example parse differently here than it does
 * for every HTTP client reading the same bundle.
 */
export const parseOpenApiDocument = (source: string): JsonObject => {
  const document: unknown = load(source, { schema: CORE_SCHEMA });
  if (!isJsonObject(document) || typeof document.openapi !== "string" || !isJsonObject(document.paths)) {
    throw new Error("The v3 bundle is not an OpenAPI document (missing `openapi` or `paths`).");
  }
  return document;
};

export const readBundle = (path: string = BUNDLE_PATH): JsonObject =>
  parseOpenApiDocument(readFileSync(path, "utf8"));
