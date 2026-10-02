import {
  type JsonObject,
  type JsonValue,
  cloneJson,
  isJsonObject,
  resolvePointer,
} from "../src/testing/json";
import { forEachDocumentSchema, mapDocumentSchemas } from "./schema-walk";

/**
 * Rewrites the scoped spec into the subset of JSON Schema the generator reproduces faithfully.
 *
 * The committed contract stays idiomatic OpenAPI 3.1; this runs in memory on the way into the generator
 * and never touches the bundle. Each rule exists because hey-api 0.99 mis-generates the original form —
 * see `docs/development/technical-handbook/api-v3-schema-generation.mdx` for the evidence. Anything the
 * rules do not recognise throws rather than passing through, because a construct the generator
 * silently drops is a validation hole, not a cosmetic difference.
 */

export type TNormalizationReport = {
  /** `allOf` + `unevaluatedProperties: false` rewritten into one closed object. */
  flattened: string[];
  /** `allOf` branches carrying only keywords the generator ignores, removed in favour of the base. */
  collapsed: string[];
  /** Many-to-one discriminators dropped after proving the members' own enums carry the same mapping. */
  droppedDiscriminators: string[];
};

/** Keywords that describe rather than constrain; harmless next to a `$ref` or an `allOf`. */
const ANNOTATIONS = new Set([
  "description",
  "title",
  "examples",
  "example",
  "deprecated",
  "readOnly",
  "writeOnly",
]);

/** Constraints the generator drops or mishandles. Reaching the generator with one of these is a bug. */
const UNSUPPORTED = [
  "allOf",
  "unevaluatedProperties",
  "unevaluatedItems",
  "if",
  "then",
  "else",
  "not",
  "patternProperties",
  "dependentRequired",
  "dependentSchemas",
  "prefixItems",
  "contains",
  "$defs",
] as const;

/** Keywords an `allOf` member may carry and still be merged into one object. */
const MERGEABLE_MEMBER_KEYS = new Set(["type", "properties", "required", ...ANNOTATIONS]);

/**
 * Keywords an `allOf` branch may carry and still be collapsed away: every one is a constraint the
 * generator cannot express, and every one is owned by the consumer refinement layer, which the
 * `EXPECTED_UNENFORCED` registry and its coverage test hold to account.
 */
const COLLAPSIBLE_BRANCH_KEYS = new Set([
  "type",
  "minProperties",
  "maxProperties",
  "additionalProperties",
  ...ANNOTATIONS,
]);
const CONDITIONAL_KEYS = new Set(["if", "then", "else", "description"]);

const fail = (path: string, message: string): never => {
  throw new Error(`normalize: ${path}: ${message}`);
};

/** Follow `$ref`s to a component schema. A `$ref` may only carry annotations beside it. */
const deref = (document: JsonObject, node: JsonValue, path: string): JsonObject => {
  let current = node;
  for (let hops = 0; hops < 32; hops++) {
    if (!isJsonObject(current)) return fail(path, "expected a schema object");
    const ref = current.$ref;
    if (typeof ref !== "string") return current;
    const siblings = Object.keys(current).filter((key) => key !== "$ref" && !ANNOTATIONS.has(key));
    if (siblings.length)
      fail(path, `$ref with constraint siblings (${siblings.join(", ")}) is not supported`);
    const target = resolvePointer(document, ref);
    if (target === undefined) fail(path, `unresolvable ${ref}`);
    current = target as JsonValue;
  }
  return fail(path, "$ref chain too deep (cycle?)");
};

const enumValues = (schema: JsonObject): JsonValue[] | undefined => {
  if (Array.isArray(schema.enum)) return schema.enum;
  if ("const" in schema) return [schema.const];
  return undefined;
};

/**
 * Merge an overlapping property. Only narrowing is accepted — the shape every closed `allOf` in the
 * contract uses, a base `type`/`elementType` enum restricted by the variant — because last-wins is
 * only correct when the later branch is a subset of the earlier one.
 */
const mergeProperty = (
  document: JsonObject,
  base: JsonValue,
  narrower: JsonValue,
  path: string
): JsonValue => {
  const baseValues = enumValues(deref(document, base, path));
  const narrowValues = enumValues(deref(document, narrower, path));
  if (!baseValues || !narrowValues) return fail(path, "overlapping properties must both be enums or consts");
  const allowed = new Set(baseValues.map((value) => JSON.stringify(value)));
  const outside = narrowValues.filter((value) => !allowed.has(JSON.stringify(value)));
  if (outside.length) fail(path, `overlap widens the base enum with ${JSON.stringify(outside)}`);
  return narrower;
};

const collectClosedMembers = (
  document: JsonObject,
  members: JsonValue,
  path: string,
  into: { properties: JsonObject; required: string[] }
): void => {
  if (!Array.isArray(members)) return fail(path, "allOf must be an array");
  members.forEach((member, index) => {
    const memberPath = `${path}.allOf[${index}]`;
    const schema = deref(document, member, memberPath);
    const keys = Object.keys(schema);
    if ("allOf" in schema) {
      const rest = keys.filter(
        (key) => key !== "allOf" && key !== "unevaluatedProperties" && !ANNOTATIONS.has(key)
      );
      if (rest.length) fail(memberPath, `nested allOf with sibling constraints (${rest.join(", ")})`);
      collectClosedMembers(document, schema.allOf, memberPath, into);
      return;
    }
    const unsupported = keys.filter((key) => !MERGEABLE_MEMBER_KEYS.has(key));
    if (unsupported.length)
      fail(memberPath, `allOf member keyword(s) ${unsupported.join(", ")} cannot be merged`);
    if ("type" in schema && schema.type !== "object") fail(memberPath, "allOf member is not an object");
    if ("properties" in schema && !isJsonObject(schema.properties))
      fail(memberPath, "properties must be an object");
    for (const [name, property] of Object.entries(isJsonObject(schema.properties) ? schema.properties : {})) {
      into.properties[name] =
        name in into.properties
          ? mergeProperty(document, into.properties[name], property, `${memberPath}.properties.${name}`)
          : property;
    }
    for (const name of Array.isArray(schema.required) ? schema.required : []) {
      if (typeof name !== "string") fail(memberPath, "required must list strings");
      else if (!into.required.includes(name)) into.required.push(name);
    }
  });
};

const flattenClosedAllOf = (document: JsonObject, node: JsonObject, path: string): JsonObject => {
  const siblings = Object.keys(node).filter(
    (key) => key !== "allOf" && key !== "unevaluatedProperties" && key !== "type" && !ANNOTATIONS.has(key)
  );
  if (siblings.length) fail(path, `closed allOf with sibling constraints (${siblings.join(", ")})`);
  const merged = { properties: {} as JsonObject, required: [] as string[] };
  collectClosedMembers(document, node.allOf, path, merged);
  const missing = merged.required.filter((name) => !(name in merged.properties));
  if (missing.length) fail(path, `required names no merged property: ${missing.join(", ")}`);

  const annotations = Object.fromEntries(Object.entries(node).filter(([key]) => ANNOTATIONS.has(key)));
  return {
    ...annotations,
    type: "object",
    properties: merged.properties,
    ...(merged.required.length ? { required: merged.required } : {}),
    additionalProperties: false,
  };
};

const isCollapsibleBranch = (branch: JsonValue): boolean => {
  if (!isJsonObject(branch) || "$ref" in branch) return false;
  if ("type" in branch && branch.type !== "object") return false;
  if (!Object.keys(branch).every((key) => COLLAPSIBLE_BRANCH_KEYS.has(key))) return false;
  if (!("additionalProperties" in branch)) return true;
  const additional = branch.additionalProperties;
  return isJsonObject(additional) && Object.keys(additional).every((key) => CONDITIONAL_KEYS.has(key));
};

const collapseKeywordOnlyAllOf = (node: JsonObject, path: string): JsonObject => {
  const members = Array.isArray(node.allOf) ? node.allOf : fail(path, "allOf must be an array");
  const refs = members.filter((member) => isJsonObject(member) && typeof member.$ref === "string");
  const rest = members.filter((member) => !refs.includes(member));
  if (refs.length !== 1 || !rest.every(isCollapsibleBranch)) {
    return fail(path, "open allOf is only supported as one $ref plus keyword-only branches");
  }
  const siblings = Object.keys(node).filter((key) => key !== "allOf" && !ANNOTATIONS.has(key));
  if (siblings.length) fail(path, `allOf with sibling constraints (${siblings.join(", ")})`);
  const annotations = Object.fromEntries(Object.entries(node).filter(([key]) => ANNOTATIONS.has(key)));
  return { ...annotations, ...(refs[0] as JsonObject) };
};

/**
 * hey-api emits one union option per mapping key, so a many-to-one mapping (seventeen element types onto
 * nine answer shapes) becomes seventeen `.extend({ elementType: z.literal(...) })` copies. That nearly
 * doubles the published JSON Schema the MCP server advertises on every `tools/list`. When each member's
 * own discriminator enum carries exactly the keys that map to it, the mapping restates the members and
 * the union is equivalent without it; the consumer layer rebuilds `z.discriminatedUnion` from the
 * generated members. Any other shape throws.
 */
const dropRedundantDiscriminator = (document: JsonObject, node: JsonObject, path: string): JsonObject => {
  const discriminator = node.discriminator;
  if (!isJsonObject(discriminator)) return node;
  const property = discriminator.propertyName;
  const mapping = discriminator.mapping;
  const members = node.oneOf;
  if (typeof property !== "string" || !isJsonObject(mapping) || !Array.isArray(members)) {
    return fail(path, "discriminator needs propertyName, mapping and oneOf");
  }
  const keysByTarget = new Map<string, string[]>();
  for (const [key, target] of Object.entries(mapping)) {
    if (typeof target !== "string") return fail(path, `mapping.${key} is not a reference`);
    keysByTarget.set(target, [...(keysByTarget.get(target) ?? []), key]);
  }
  const memberRefs = members.map((member, index) =>
    isJsonObject(member) && typeof member.$ref === "string"
      ? member.$ref
      : fail(`${path}.oneOf[${index}]`, "discriminated members must be $refs")
  );
  const unmapped = memberRefs.filter((ref) => !keysByTarget.has(ref));
  const stray = [...keysByTarget.keys()].filter((ref) => !memberRefs.includes(ref));
  if (unmapped.length || stray.length) {
    fail(
      path,
      `oneOf and mapping disagree (unmapped: ${unmapped.join(", ")}; not in oneOf: ${stray.join(", ")})`
    );
  }
  const manyToOne = [...keysByTarget.values()].some((keys) => keys.length > 1);
  if (!manyToOne) return node;

  for (const ref of memberRefs) {
    const member = deref(document, { $ref: ref }, `${path}(${ref})`);
    const properties = isJsonObject(member.properties) ? member.properties : {};
    const required = Array.isArray(member.required) ? member.required : [];
    const values =
      property in properties
        ? enumValues(deref(document, properties[property], `${ref}.${property}`))
        : undefined;
    if (!values || !required.includes(property)) {
      fail(path, `${ref} must require "${property}" as an enum to drop the mapping`);
    }
    const expected = [...(keysByTarget.get(ref) ?? [])].sort();
    const actual = (values ?? []).map(String).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fail(
        path,
        `${ref}.${property} enum ${JSON.stringify(actual)} differs from its mapping keys ${JSON.stringify(expected)}`
      );
    }
  }
  const { discriminator: _dropped, ...rest } = node;
  return rest;
};

const stripAccessModifiers = (node: JsonObject): JsonObject => {
  const out = { ...node };
  if (typeof out.readOnly === "boolean") delete out.readOnly;
  if (typeof out.writeOnly === "boolean") delete out.writeOnly;
  return out;
};

export const normalizeForGeneration = (
  scoped: JsonObject
): { document: JsonObject; report: TNormalizationReport } => {
  const original = cloneJson(scoped);
  const report: TNormalizationReport = { flattened: [], collapsed: [], droppedDiscriminators: [] };

  // Pass 1: allOf. Members resolve against the original document, so a base is read as authored no
  // matter which order the walk reaches it in.
  const pass1 = mapDocumentSchemas(original, (node, path) => {
    if (!("allOf" in node)) return node;
    if (node.unevaluatedProperties === false) {
      report.flattened.push(path);
      return flattenClosedAllOf(original, node, path);
    }
    report.collapsed.push(path);
    return collapseKeywordOnlyAllOf(node, path);
  });

  // Pass 2: discriminators, read against the flattened members.
  const pass2 = mapDocumentSchemas(pass1, (node, path) => {
    if (!("discriminator" in node)) return node;
    const next = dropRedundantDiscriminator(pass1, node, path);
    if (next !== node) report.droppedDiscriminators.push(path);
    return next;
  });

  // Pass 3: access modifiers. `readOnly` becomes `.readonly()` (frozen parse output) and `*Writable`
  // twins in hey-api; the bundle keeps it for documentation.
  const pass3 = mapDocumentSchemas(pass2, stripAccessModifiers);

  forEachDocumentSchema(pass3, (node, path) => {
    for (const keyword of UNSUPPORTED) {
      if (keyword in node) fail(path, `"${keyword}" reached the generator; extend normalize.ts deliberately`);
    }
    if (typeof node.$ref === "string") deref(pass3, node, path);
    // hey-api drops a typed `additionalProperties` whenever `properties` exist; z.object().catchall()
    // would need its internal walker. No adopted schema uses the shape, so it is refused, not lost.
    if (
      isJsonObject(node.properties) &&
      Object.keys(node.properties).length &&
      isJsonObject(node.additionalProperties)
    ) {
      fail(path, "properties together with a typed additionalProperties is not supported");
    }
    if ("propertyNames" in node) {
      const names = node.propertyNames;
      if (
        !isJsonObject(names) ||
        !Object.keys(names).every((key) => key === "type" || ANNOTATIONS.has(key))
      ) {
        fail(path, "only `propertyNames: { type: string }` is supported");
      }
    }
  });

  // A JSON round-trip: the walk shares subtrees between flattened schemas, and hey-api mutates its input.
  return { document: cloneJson(pass3), report };
};
