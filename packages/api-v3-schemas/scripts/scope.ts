import { type JsonObject, type JsonValue, isJsonObject, resolvePointer } from "../src/testing/json";

const HTTP_METHODS = new Set(["get", "put", "post", "patch", "delete", "head", "options", "trace"]);
const COMPONENT_REF = /^#\/components\/([^/]+)\/([^/]+)$/;

/** Example payloads and vendor extensions are data; a `$ref` key inside one is not a reference. */
const isDataKey = (key: string): boolean => key === "example" || key === "examples" || key.startsWith("x-");

const addMappingTargets = (discriminator: JsonValue, into: Set<string>): void => {
  // Discriminator mappings name their targets by pointer too, without a `$ref` key.
  if (!isJsonObject(discriminator) || !isJsonObject(discriminator.mapping)) return;
  for (const target of Object.values(discriminator.mapping)) {
    if (typeof target === "string") into.add(target);
  }
};

const collectComponentRefs = (value: JsonValue, into: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectComponentRefs(item, into);
    return;
  }
  if (!isJsonObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") into.add(child);
    else if (key === "discriminator") addMappingTargets(child, into);
    else if (!isDataKey(key)) collectComponentRefs(child, into);
  }
};

const adoptedTagOf = (operation: JsonObject, found: ReadonlyMap<string, Set<string>>): string | undefined => {
  const tags = Array.isArray(operation.tags) ? operation.tags : [];
  return tags.find((tag): tag is string => typeof tag === "string" && found.has(tag));
};

/** The operations of one path item that belong to an adopted tag, recording their operationIds. */
const keepAdoptedOperations = (
  path: string,
  item: JsonObject,
  found: ReadonlyMap<string, Set<string>>
): JsonObject => {
  const kept: JsonObject = {};
  for (const [method, operation] of Object.entries(item)) {
    if (!HTTP_METHODS.has(method) || !isJsonObject(operation)) continue;
    const tag = adoptedTagOf(operation, found);
    if (!tag) continue;
    if (typeof operation.operationId !== "string") {
      throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
    }
    found.get(tag)?.add(operation.operationId);
    kept[method] = operation;
  }
  if (Object.keys(kept).length && "parameters" in item) kept.parameters = item.parameters;
  return kept;
};

const assertOperationsMatch = (
  adopted: Readonly<Record<string, readonly string[]>>,
  found: ReadonlyMap<string, Set<string>>
): void => {
  const mismatches = Object.entries(adopted).flatMap(([tag, expected]) => {
    const actual = found.get(tag) ?? new Set<string>();
    const missing = expected.filter((id) => !actual.has(id));
    const unexpected = [...actual].filter((id) => !expected.includes(id));
    if (!missing.length && !unexpected.length) return [];
    return [`"${tag}": missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`];
  });
  if (mismatches.length) {
    throw new Error(
      `Adopted tags no longer match the spec's operations — update scripts/adopted.ts deliberately:\n  ${mismatches.join("\n  ")}`
    );
  }
};

/** Every component reachable from `refs`, transitively. Only local component pointers are allowed. */
const closeOverReferences = (document: JsonObject, refs: Set<string>): void => {
  const pending = [...refs];
  for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) {
    if (!COMPONENT_REF.test(ref))
      throw new Error(`Only local component references are supported, got ${ref}`);
    const target = resolvePointer(document, ref);
    if (target === undefined) throw new Error(`Unresolvable reference ${ref}`);
    const reached = new Set<string>();
    collectComponentRefs(target, reached);
    for (const next of reached) {
      if (refs.has(next)) continue;
      refs.add(next);
      pending.push(next);
    }
  }
};

const pickComponents = (document: JsonObject, refs: ReadonlySet<string>): JsonObject => {
  const components: JsonObject = {};
  const source = isJsonObject(document.components) ? document.components : {};
  for (const [section, entries] of Object.entries(source)) {
    if (!isJsonObject(entries)) continue;
    // Security schemes are document-level metadata, not something an operation `$ref`s.
    const keep =
      section === "securitySchemes"
        ? entries
        : Object.fromEntries(
            Object.entries(entries).filter(([name]) => refs.has(`#/components/${section}/${name}`))
          );
    if (Object.keys(keep).length) components[section] = keep;
  }
  return components;
};

/**
 * Reduce the bundle to the operations of the adopted tags and every component they reach.
 *
 * Throws when a tag's operations differ from the expected list, so a renamed tag or operationId fails
 * the pipeline instead of quietly generating less. Key order follows the bundle, which keeps the output
 * stable across runs.
 */
export const scopeToTags = (
  document: JsonObject,
  adopted: Readonly<Record<string, readonly string[]>>
): JsonObject => {
  if (!isJsonObject(document.paths)) throw new Error("OpenAPI document has no `paths` object");

  const found = new Map<string, Set<string>>(Object.keys(adopted).map((tag) => [tag, new Set()]));
  const paths: JsonObject = {};
  const refs = new Set<string>();
  for (const [path, item] of Object.entries(document.paths)) {
    if (!isJsonObject(item)) continue;
    const kept = keepAdoptedOperations(path, item, found);
    if (!Object.keys(kept).length) continue;
    paths[path] = kept;
    collectComponentRefs(kept, refs);
  }

  assertOperationsMatch(adopted, found);
  closeOverReferences(document, refs);

  return {
    openapi: document.openapi ?? "3.1.1",
    info: document.info ?? { title: "Formbricks API v3", version: "0" },
    paths,
    components: pickComponents(document, refs),
  };
};
