import {
  type JsonObject,
  type JsonValue,
  SCHEMA_REF_PREFIX,
  cloneJson,
  compareCodeUnits,
  isJsonObject,
  resolvePointer,
} from "../src/testing/json";
import { forEachDocumentSchema, mapDocumentSchemas, mapSchema } from "./schema-walk";

/**
 * Rewrites the scoped spec into the subset of JSON Schema the generator reproduces faithfully.
 *
 * The committed contract stays idiomatic OpenAPI 3.1; this runs in memory on the way into the generator
 * and never touches the bundle. Each rule exists because hey-api 0.99 mis-generates the original form —
 * see `docs/development/technical-handbook/api-v3-schema-generation.mdx` for the evidence.
 *
 * What may reach the generator is an allowlist (`GENERATABLE`): a keyword outside it throws, so a
 * construct nobody has checked the generator against fails here rather than being dropped. Within the
 * allowlist, `src/generated.contract.test.ts` is what proves the output faithful.
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

/**
 * Every keyword a schema may carry when it reaches hey-api. Each one either generates faithfully or is
 * one the fidelity test reports (and `EXPECTED_UNENFORCED` pins) when it does not — `uniqueItems`,
 * `minProperties` and `maxProperties` are in the second group. `x-` extensions are annotations too.
 */
const GENERATABLE = new Set([
  ...ANNOTATIONS,
  "$ref",
  "type",
  "enum",
  "const",
  "default",
  "format",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "properties",
  "required",
  "additionalProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "oneOf",
  "anyOf",
  "discriminator",
]);

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

const annotationsOf = (node: JsonObject): JsonObject =>
  Object.fromEntries(Object.entries(node).filter(([key]) => ANNOTATIONS.has(key)));

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
  return fail(path, "$ref chain too deep");
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

type TMerged = {
  properties: JsonObject;
  required: string[];
  closedMembers: { path: string; names: Set<string> }[];
};

const mergeObjectMember = (
  document: JsonObject,
  schema: JsonObject,
  memberPath: string,
  into: TMerged
): void => {
  const unsupported = Object.keys(schema).filter((key) => !MERGEABLE_MEMBER_KEYS.has(key));
  if (unsupported.length)
    fail(memberPath, `allOf member keyword(s) ${unsupported.join(", ")} cannot be merged`);
  if ("type" in schema && schema.type !== "object") fail(memberPath, "allOf member is not an object");
  if ("properties" in schema && !isJsonObject(schema.properties))
    fail(memberPath, "properties must be an object");
  const properties = isJsonObject(schema.properties) ? schema.properties : {};
  for (const [name, property] of Object.entries(properties)) {
    into.properties[name] =
      name in into.properties
        ? mergeProperty(document, into.properties[name], property, `${memberPath}.properties.${name}`)
        : property;
  }
  for (const name of Array.isArray(schema.required) ? schema.required : []) {
    if (typeof name !== "string") fail(memberPath, "required must list strings");
    else if (!into.required.includes(name)) into.required.push(name);
  }
};

function collectClosedMembers(document: JsonObject, members: JsonValue, path: string, into: TMerged): void {
  if (!Array.isArray(members)) return fail(path, "allOf must be an array");
  members.forEach((member, index) => {
    const memberPath = `${path}.allOf[${index}]`;
    const schema = deref(document, member, memberPath);
    if (!("allOf" in schema)) {
      mergeObjectMember(document, schema, memberPath, into);
      return;
    }
    const rest = Object.keys(schema).filter(
      (key) => key !== "allOf" && key !== "unevaluatedProperties" && !ANNOTATIONS.has(key)
    );
    if (rest.length) fail(memberPath, `nested allOf with sibling constraints (${rest.join(", ")})`);
    const nested: TMerged = { properties: {}, required: [], closedMembers: [] };
    collectClosedMembers(document, schema.allOf, memberPath, nested);
    // A member that closes itself rejects every property it does not declare — the other branches'
    // included — so it can only be extended with what it already has.
    if (schema.unevaluatedProperties === false) {
      nested.closedMembers.push({ path: memberPath, names: new Set(Object.keys(nested.properties)) });
    }
    mergeObjectMember(
      document,
      { properties: nested.properties, required: nested.required },
      memberPath,
      into
    );
    into.closedMembers.push(...nested.closedMembers);
  });
}

const flattenClosedAllOf = (document: JsonObject, node: JsonObject, path: string): JsonObject => {
  const siblings = Object.keys(node).filter(
    (key) => key !== "allOf" && key !== "unevaluatedProperties" && key !== "type" && !ANNOTATIONS.has(key)
  );
  if (siblings.length) fail(path, `closed allOf with sibling constraints (${siblings.join(", ")})`);
  if ("type" in node && node.type !== "object") fail(path, "a closed allOf must have type object");
  const merged: TMerged = { properties: {}, required: [], closedMembers: [] };
  collectClosedMembers(document, node.allOf, path, merged);
  const missing = merged.required.filter((name) => !(name in merged.properties));
  if (missing.length) fail(path, `required names no merged property: ${missing.join(", ")}`);
  for (const closed of merged.closedMembers) {
    const extra = Object.keys(merged.properties).filter((name) => !closed.names.has(name));
    if (extra.length) {
      fail(
        path,
        `${closed.path} is closed, so it rejects the properties other members add (${extra.join(", ")})`
      );
    }
  }
  return {
    ...annotationsOf(node),
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
  return { ...annotationsOf(node), ...(refs[0] as JsonObject) };
};

/** Mapping keys grouped by the member they point at, after checking oneOf and mapping agree. */
const mappingKeysByMember = (
  discriminator: JsonObject,
  members: JsonValue,
  path: string
): { property: string; keysByTarget: Map<string, string[]> } => {
  const mapping = discriminator.mapping;
  const property = discriminator.propertyName;
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
  return { property, keysByTarget };
};

const assertMemberCarriesItsKeys = (
  document: JsonObject,
  ref: string,
  property: string,
  keys: readonly string[],
  path: string
): void => {
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
  const expected = [...keys].sort(compareCodeUnits);
  const actual = (values ?? []).map(String).sort(compareCodeUnits);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(
      path,
      `${ref}.${property} enum ${JSON.stringify(actual)} differs from its mapping keys ${JSON.stringify(expected)}`
    );
  }
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
  const { property, keysByTarget } = mappingKeysByMember(discriminator, node.oneOf, path);
  if (![...keysByTarget.values()].some((keys) => keys.length > 1)) return node;
  for (const [ref, keys] of keysByTarget) assertMemberCarriesItsKeys(document, ref, property, keys, path);
  const { discriminator: _dropped, ...rest } = node;
  return rest;
};

const stripAccessModifiers = (node: JsonObject): JsonObject => {
  const out = { ...node };
  if (typeof out.readOnly === "boolean") delete out.readOnly;
  if (typeof out.writeOnly === "boolean") delete out.writeOnly;
  return out;
};

/**
 * Recursive schemas are refused until the pipeline and the fidelity differ both support them: hey-api
 * would emit `z.lazy`, and the differ cannot yet compare a recursion on one side with one on the other.
 */
const assertNoRecursion = (document: JsonObject): void => {
  const schemas =
    isJsonObject(document.components) && isJsonObject(document.components.schemas)
      ? document.components.schemas
      : {};
  const edges = new Map<string, Set<string>>();
  for (const [name, schema] of Object.entries(schemas)) {
    const targets = new Set<string>();
    const collect = (node: JsonObject): JsonValue => {
      if (typeof node.$ref === "string" && node.$ref.startsWith(SCHEMA_REF_PREFIX)) {
        targets.add(node.$ref.slice(SCHEMA_REF_PREFIX.length));
      }
      return node;
    };
    mapSchema(schema, name, collect);
    edges.set(name, targets);
  }
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string, trail: string[]): void => {
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting")
      fail(`$.components.schemas.${name}`, `recursive schema (${[...trail, name].join(" → ")})`);
    state.set(name, "visiting");
    for (const next of edges.get(name) ?? []) visit(next, [...trail, name]);
    state.set(name, "done");
  };
  for (const name of edges.keys()) visit(name, []);
};

const assertGeneratable = (document: JsonObject): void => {
  forEachDocumentSchema(document, (node, path) => {
    const unknown = Object.keys(node).filter((key) => !GENERATABLE.has(key) && !key.startsWith("x-"));
    if (unknown.length) {
      fail(
        path,
        `${unknown.map((key) => `"${key}"`).join(", ")} would reach the generator; extend normalize.ts deliberately`
      );
    }
    if (typeof node.$ref === "string") deref(document, node, path);
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
};

export const normalizeForGeneration = (
  scoped: JsonObject
): { document: JsonObject; report: TNormalizationReport } => {
  const original = cloneJson(scoped);
  const report: TNormalizationReport = { flattened: [], collapsed: [], droppedDiscriminators: [] };
  assertNoRecursion(original);

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
  assertGeneratable(pass3);

  // Copied without aliasing: the walk shares subtrees between flattened schemas, and hey-api mutates
  // its input.
  return { document: cloneJson(pass3), report };
};
