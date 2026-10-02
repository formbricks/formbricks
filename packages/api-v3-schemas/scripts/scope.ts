import { type JsonObject, type JsonValue, isJsonObject, resolvePointer } from "../src/testing/json";

const HTTP_METHODS = new Set(["get", "put", "post", "patch", "delete", "head", "options", "trace"]);
const COMPONENT_REF = /^#\/components\/([^/]+)\/([^/]+)$/;

const collectComponentRefs = (value: JsonValue, into: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectComponentRefs(item, into);
    return;
  }
  if (!isJsonObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") into.add(child);
    // Discriminator mappings name their targets by pointer too, without a `$ref` key.
    else if (key === "mapping" && isJsonObject(child)) {
      for (const target of Object.values(child)) if (typeof target === "string") into.add(target);
    } else collectComponentRefs(child, into);
  }
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
    const kept: JsonObject = {};
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method) || !isJsonObject(operation)) continue;
      const tags = Array.isArray(operation.tags) ? operation.tags : [];
      const adoptedTag = tags.find((tag): tag is string => typeof tag === "string" && found.has(tag));
      if (!adoptedTag) continue;
      if (typeof operation.operationId !== "string")
        throw new Error(`${method.toUpperCase()} ${path} has no operationId`);
      found.get(adoptedTag)?.add(operation.operationId);
      kept[method] = operation;
    }
    if (Object.keys(kept).length === 0) continue;
    if ("parameters" in item) kept.parameters = item.parameters;
    paths[path] = kept;
    collectComponentRefs(kept, refs);
  }

  const mismatches = Object.entries(adopted).flatMap(([tag, expected]) => {
    const actual = found.get(tag) ?? new Set<string>();
    const missing = expected.filter((id) => !actual.has(id));
    const unexpected = [...actual].filter((id) => !expected.includes(id));
    return missing.length || unexpected.length
      ? [`"${tag}": missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`]
      : [];
  });
  if (mismatches.length) {
    throw new Error(
      `Adopted tags no longer match the spec's operations — update scripts/adopted.ts deliberately:\n  ${mismatches.join("\n  ")}`
    );
  }

  // Close over the components the kept operations reach, transitively.
  const pending = [...refs];
  while (pending.length) {
    const ref = pending.pop();
    if (ref === undefined) break;
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

  const components: JsonObject = {};
  const sourceComponents = isJsonObject(document.components) ? document.components : {};
  for (const [section, entries] of Object.entries(sourceComponents)) {
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

  for (const ref of refs) {
    if (!COMPONENT_REF.test(ref))
      throw new Error(`Only local component references are supported, got ${ref}`);
  }

  return {
    openapi: document.openapi ?? "3.1.1",
    info: document.info ?? { title: "Formbricks API v3", version: "0" },
    paths,
    components,
  };
};
