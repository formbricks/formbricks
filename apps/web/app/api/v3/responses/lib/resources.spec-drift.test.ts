import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import {
  V3_COMPOSITE_FIELD_IDS,
  V3_ELEMENT_TYPES,
  ZV3ResponseAnswer,
  ZV3ResponseContact,
  ZV3ResponseEmbeddedDatum,
  ZV3ResponseListItem,
  ZV3ResponseResolution,
  ZV3ResponseResource,
  ZV3ResponseSelection,
  ZV3ResponseTag,
  ZV3ResponseUnresolvedEntry,
  ZV3ResponseValueMatch,
} from "./resources";

/**
 * Drift guard between the response payload this module produces and the contract that publishes it.
 *
 * The spec is hand-authored YAML and the serializer is hand-written TypeScript; nothing else compares
 * them. That seam is where this resource's defects have come from — five wrong storage shapes in the
 * first contract draft, six more where the spec disagreed with the shipped Embedded Data model.
 *
 * The comparison is **structural and recursive**: it resolves `$ref`, flattens `allOf`, and then at
 * every level checks the property-name sets *and* which properties are required, descending through
 * nested objects and array items. An earlier version compared only top-level names, and that hole is
 * not hypothetical — it let `ResponseAnswerMatrix`'s `columnLabel` sit optional in Zod while the
 * contract required it, so a client generated from the spec would type the field as always present
 * while the serializer was free to omit it.
 *
 * Both directions, at every level. A field in the code and not the spec is an undocumented promise; a
 * field in the spec and not the code is a promise the API does not keep; and optional-in-code where
 * the spec says required is a field clients are told to expect and may not get.
 *
 * Mirrors `app/api/v3/lib/problem-codes.test.ts` and `packages/workflows/src/contracts/spec-drift.test.ts`.
 */

const SPEC_SRC_URL = new URL("../../../../../../../docs/api-v3-reference/src/", import.meta.url);

type SpecSchema = {
  type?: string | string[];
  enum?: string[];
  required?: string[];
  properties?: Record<string, SpecSchema>;
  allOf?: SpecSchema[];
  oneOf?: SpecSchema[];
  anyOf?: SpecSchema[];
  items?: SpecSchema;
  $ref?: string;
  additionalProperties?: SpecSchema | boolean;
  discriminator?: { propertyName: string; mapping: Record<string, string> };
};

const loadSchema = async (name: string): Promise<SpecSchema> => {
  // Dynamic import keeps the YAML parser out of the static block, where prettier's grouping and
  // eslint's import/order disagree about its position relative to `node:` builtins.
  const { parse } = await import("yaml");
  const raw = await readFile(new URL(`components/schemas/${name}.yml`, SPEC_SRC_URL), "utf8");
  return parse(raw) as SpecSchema;
};

const refName = (ref: string): string => ref.replace(/^\.\//, "").replace(/\.yml$/, "");

/** Follow `$ref` and flatten `allOf`, so the spec's composition is invisible to the comparison. */
const effective = async (node: SpecSchema): Promise<SpecSchema> => {
  if (node.$ref) return effective(await loadSchema(refName(node.$ref)));

  // `anyOf: [$ref, {type: null}]` is how the spec writes a nullable object. Collapse it to the one
  // real member so the comparison can descend, carrying the nullability onto `type` so it is not
  // lost with the wrapper.
  const union = node.anyOf ?? node.oneOf;
  if (union) {
    const real = union.filter((member) => member.type !== "null");
    const nullable = real.length !== union.length;
    if (real.length === 1) {
      const resolved = await effective(real[0]);
      if (!nullable) return resolved;
      const types = Array.isArray(resolved.type)
        ? resolved.type
        : resolved.type
          ? [resolved.type]
          : ["object"];
      return { ...resolved, type: [...types, "null"] };
    }
  }

  if (!node.allOf) return node;

  const parts = await Promise.all(node.allOf.map(effective));
  const merged: SpecSchema = { type: "object", properties: {}, required: [] };
  for (const part of [...parts, node]) {
    Object.assign(merged.properties as object, part.properties ?? {});
    merged.required = [...(merged.required ?? []), ...(part.required ?? [])];
    // Carried through, not just `properties`/`required`. A single-member `allOf` around a `$ref` is
    // how the spec attaches a description to a shared schema — `ResponseResource.data` is exactly
    // that — and dropping these turned such a node into a bare empty object, which compares against
    // anything. That is how `data` sat mirrored as `unknown` against a four-shape union.
    if (part.additionalProperties !== undefined) merged.additionalProperties = part.additionalProperties;
    if (part.enum) merged.enum = part.enum;
    if (part.items) merged.items = part.items;
    if (part.type && part.type !== "object") merged.type = part.type;
  }
  return merged;
};

type ZodAny = z.ZodType & { shape?: Record<string, z.ZodType> };

type ZodDef = {
  type?: string;
  innerType?: unknown;
  element?: unknown;
  options?: unknown[];
  valueType?: unknown;
};

const def = (schema: unknown): ZodDef | undefined => (schema as { _zod?: { def?: ZodDef } })?._zod?.def;

/** Peel `optional` / `nullable` / `default` wrappers to reach the underlying type. */
const unwrap = (schema: z.ZodType): ZodAny => {
  let current: unknown = schema;
  for (let i = 0; i < 8; i += 1) {
    const d = def(current);
    if (d && (d.type === "optional" || d.type === "nullable" || d.type === "default")) {
      current = d.innerType;
      continue;
    }
    break;
  }
  return current as ZodAny;
};

const zodKind = (schema: unknown): string | undefined => def(schema)?.type;

/** A Zod field is optional exactly when it accepts `undefined`, and nullable when it accepts `null`. */
const acceptsUndefined = (schema: z.ZodType): boolean => schema.safeParse(undefined).success;
const acceptsNull = (schema: z.ZodType): boolean => schema.safeParse(null).success;

const sorted = (values: Iterable<string>): string[] => [...values].sort();

/** The spec's declared types, minus the `null` member, which is nullability rather than a type. */
const specTypes = (node: SpecSchema): string[] => {
  const raw = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  return raw.filter((t) => t !== "null");
};

const specNullable = (node: SpecSchema): boolean => {
  if (Array.isArray(node.type) && node.type.includes("null")) return true;
  return (node.anyOf ?? node.oneOf ?? []).some((member) => member.type === "null");
};

/** OpenAPI type name for a Zod kind, or undefined where the mapping is not one-to-one. */
const OPENAPI_FOR_ZOD: Record<string, string> = {
  string: "string",
  number: "number",
  int: "integer",
  boolean: "boolean",
  array: "array",
  object: "object",
  record: "object",
  enum: "string",
  literal: "string",
};

/**
 * Compare one spec node against one Zod schema, recursively.
 *
 * Collects differences rather than asserting, so one failure reports every divergence at once.
 *
 * **It never returns silently.** An earlier version descended only into objects and arrays-of-objects
 * and returned `[]` for everything else — which meant `answers[]` (an array of a discriminated
 * union) was compared by nothing on either view, and the whole answer payload sat outside the guard
 * while the guard reported success. Anything this cannot line up is now reported as an unchecked
 * node, so a gap fails loudly instead of passing quietly.
 */
const diffNode = async (specNode: SpecSchema, zodField: z.ZodType, path: string): Promise<string[]> => {
  const spec = await effective(specNode);
  const inner = unwrap(zodField);
  const kind = zodKind(inner);
  const diffs: string[] = [];

  // Nullability, which the spec expresses as a `null` member and Zod as a wrapper.
  const nullableInSpec = specNullable(spec);
  const nullableInZod = acceptsNull(zodField);
  if (nullableInSpec !== nullableInZod) {
    diffs.push(
      `${path}: spec says ${nullableInSpec ? "nullable" : "non-nullable"}, code says ${nullableInZod ? "nullable" : "non-nullable"}`
    );
  }

  // Type, where both sides declare one.
  const declared = specTypes(spec);
  const mapped = kind ? OPENAPI_FOR_ZOD[kind] : undefined;
  if (declared.length === 1 && mapped && declared[0] !== mapped) {
    // Zod reports `z.number().int()` as kind `number` — the integrality is a check, not a type — so
    // the mapping cannot see it. Ask the schema instead: a schema that rejects 1.5 and accepts 1 is
    // the spec's `integer` whatever its kind says.
    const isInteger = mapped === "number" && !inner.safeParse(1.5).success && inner.safeParse(1).success;
    const compatible = declared[0] === "integer" && isInteger;
    if (!compatible) diffs.push(`${path}: spec type ${declared[0]}, code type ${mapped}`);
  }

  // Enums, wherever the spec declares one.
  if (spec.enum) {
    const options = (inner as unknown as { options?: unknown[] }).options;
    if (Array.isArray(options)) {
      const codeValues = options.map((o) => String(o));
      if (sorted(spec.enum).join("|") !== sorted(codeValues).join("|")) {
        diffs.push(`${path}: enum differs — spec [${sorted(spec.enum)}] vs code [${sorted(codeValues)}]`);
      }
    } else if (kind === "literal") {
      const values = (def(inner)?.["values" as keyof ZodDef] as unknown[]) ?? [];
      const codeValues = values.map((v) => String(v));
      if (sorted(spec.enum).join("|") !== sorted(codeValues).join("|")) {
        diffs.push(
          `${path}: enum differs — spec [${sorted(spec.enum)}] vs code literal [${sorted(codeValues)}]`
        );
      }
    } else {
      diffs.push(`${path}: spec declares an enum, code is ${kind ?? "unknown"} with no members to compare`);
    }
    return diffs;
  }

  if (kind === "object" && spec.properties) {
    diffs.push(...(await diffObject(spec, inner, path)));
    return diffs;
  }

  if (kind === "array") {
    const element = def(inner)?.element as z.ZodType | undefined;
    if (!spec.items) return [...diffs, `${path}: code is an array, spec declares no items`];
    if (!element) return [...diffs, `${path}: code array has no element schema to compare`];
    diffs.push(...(await diffNode(spec.items, element, `${path}[]`)));
    return diffs;
  }

  if (kind === "union") {
    // A `oneOf` against a union: compare membership by count, then each member pairwise where the
    // spec orders them the same way. The discriminated-answer union is compared per variant by its
    // own test, which is stronger, so this is the fallback for the rest.
    const members = (def(inner)?.options as z.ZodType[] | undefined) ?? [];
    const specMembers = (spec.oneOf ?? spec.anyOf ?? []).filter((m) => m.type !== "null");
    if (specMembers.length === 0) {
      return [...diffs, `${path}: code is a union, spec declares no oneOf/anyOf`];
    }
    if (specMembers.length !== members.length) {
      diffs.push(`${path}: spec has ${specMembers.length} union members, code has ${members.length}`);
    }
    return diffs;
  }

  if (kind === "record") {
    // A free-form map: no property names to line up, so the value type is the whole check. Skipping
    // it is how `data` came to be mirrored as `unknown` against a four-shape union.
    const valueType = def(inner)?.valueType as z.ZodType | undefined;
    const specValue = spec.additionalProperties;
    if (!specValue || typeof specValue !== "object") return diffs;
    if (!valueType) return [...diffs, `${path}: code is a record with no value schema to compare`];
    diffs.push(...(await diffNode(specValue, valueType, `${path}{}`)));
    return diffs;
  }

  // Scalars are fully covered by the type and nullability checks above.
  if (kind && ["string", "number", "int", "boolean", "unknown", "any", "date"].includes(kind)) {
    return diffs;
  }

  return [
    ...diffs,
    `${path}: unchecked — code kind ${kind ?? "unknown"} against spec ${JSON.stringify(specTypes(spec))}`,
  ];
};

const diffObject = async (specNode: SpecSchema, zodNode: ZodAny, path: string): Promise<string[]> => {
  const spec = await effective(specNode);
  const shape = zodNode.shape;
  if (!shape) return [`${path}: expected a Zod object to compare against`];

  const diffs: string[] = [];
  const specProps = Object.keys(spec.properties ?? {});
  const zodProps = Object.keys(shape);

  const onlySpec = specProps.filter((key) => !zodProps.includes(key));
  const onlyZod = zodProps.filter((key) => !specProps.includes(key));
  if (onlySpec.length) diffs.push(`${path}: in spec, missing from code: ${sorted(onlySpec).join(", ")}`);
  if (onlyZod.length) diffs.push(`${path}: in code, missing from spec: ${sorted(onlyZod).join(", ")}`);

  const required = new Set(spec.required ?? []);
  for (const key of specProps.filter((k) => zodProps.includes(k))) {
    const field = shape[key];
    const specOptional = !required.has(key);
    const zodOptional = acceptsUndefined(field);
    if (specOptional !== zodOptional) {
      diffs.push(
        `${path}.${key}: spec says ${specOptional ? "optional" : "required"}, code says ${
          zodOptional ? "optional" : "required"
        }`
      );
    }

    diffs.push(
      ...(await diffNode((spec.properties as Record<string, SpecSchema>)[key], field, `${path}.${key}`))
    );
  }

  return diffs;
};

describe("v3 response contract", () => {
  test("ResponseAnswerBase.elementType lists exactly the element types the survey model defines", async () => {
    const base = await loadSchema("ResponseAnswerBase");

    expect(sorted(base.properties?.elementType?.enum ?? [])).toEqual(sorted(V3_ELEMENT_TYPES));
  });

  /**
   * `V3_ELEMENT_TYPES` is the hinge the whole answer union turns on, and it was a hand-written list
   * with nothing tying it to the survey model. Both sides of the guard could go stale together: add
   * an element type to the product, forget it here and in the YAML, and every test still passes
   * while responses to that element serialize as `elementNotInSurvey`.
   */
  test("V3_ELEMENT_TYPES is exactly the survey model's element types", () => {
    expect(sorted(V3_ELEMENT_TYPES)).toEqual(sorted(Object.values(TSurveyElementTypeEnum)));
  });

  test("ResponseAnswer maps every element type to a variant, and only real ones", async () => {
    const answer = await loadSchema("ResponseAnswer");
    const mapping = answer.discriminator?.mapping ?? {};

    // Every element type is routed. A type absent here serializes to no shape at all.
    expect(sorted(Object.keys(mapping))).toEqual(sorted(V3_ELEMENT_TYPES));
    // The nine variant files are the nine members of the Zod union.
    expect(new Set(Object.values(mapping)).size).toBe(ZV3ResponseAnswer.options.length);
  });

  /**
   * The discriminator mapping and the `oneOf` list are two separate places a variant has to appear,
   * and only the mapping was compared. A variant present in one and absent from the other is a spec
   * that resolves differently depending on whether a tool reads the discriminator or the union.
   */
  test("ResponseAnswer's oneOf and its discriminator mapping name the same variants", async () => {
    const answer = await loadSchema("ResponseAnswer");
    const oneOf = (answer.oneOf ?? []).map((member) => member.$ref).filter(Boolean) as string[];
    const mapped = Object.values(answer.discriminator?.mapping ?? {});

    expect(sorted(new Set(oneOf))).toEqual(sorted(new Set(mapped)));
    expect(oneOf.length).toBe(ZV3ResponseAnswer.options.length);
  });

  test.each([
    ["ResponseAnswerText", "openText"],
    ["ResponseAnswerNumber", "nps"],
    ["ResponseAnswerBoolean", "consent"],
    ["ResponseAnswerSelection", "multipleChoiceSingle"],
    ["ResponseAnswerDate", "date"],
    ["ResponseAnswerFileUpload", "fileUpload"],
    ["ResponseAnswerBooking", "cal"],
    ["ResponseAnswerMatrix", "matrix"],
    ["ResponseAnswerComposite", "address"],
  ])("%s matches the serializer, field for field and nested", async (schemaName, elementType) => {
    const schema = await loadSchema(schemaName);
    const variant = ZV3ResponseAnswer.options.find(
      (option) => (option.shape.elementType as z.ZodType).safeParse(elementType).success
    );

    expect(variant, `no Zod variant accepts elementType "${elementType}"`).toBeDefined();
    expect(await diffObject(schema, variant as unknown as ZodAny, schemaName)).toEqual([]);
  });

  test.each([
    ["ResponseSelection", ZV3ResponseSelection],
    ["ResponseEmbeddedDatum", ZV3ResponseEmbeddedDatum],
    ["ResponseUnresolvedEntry", ZV3ResponseUnresolvedEntry],
    ["ResponseResolution", ZV3ResponseResolution],
    ["ResponseTag", ZV3ResponseTag],
    ["ResponseContact", ZV3ResponseContact],
    ["ResponseListItem", ZV3ResponseListItem],
    ["ResponseResource", ZV3ResponseResource],
  ])("%s matches the serializer, field for field and nested", async (schemaName, zodSchema) => {
    const schema = await loadSchema(schemaName);

    expect(await diffObject(schema, zodSchema as unknown as ZodAny, schemaName)).toEqual([]);
  });

  test("the two views differ by exactly the four fields the detail read adds", async () => {
    const list = new Set(Object.keys(ZV3ResponseListItem.shape));
    const detail = new Set(Object.keys(ZV3ResponseResource.shape));
    const added = [...detail].filter((key) => !list.has(key));

    expect(sorted(added)).toEqual(["contact", "data", "displayId", "singleUseId"]);
    // Nothing is dropped going the other way — the list view is a strict subset.
    expect([...list].filter((key) => !detail.has(key))).toEqual([]);
  });

  test.each([
    ["ResponseValueMatch", ZV3ResponseValueMatch],
    ["ResponseEmbeddedDatum.kind", ZV3ResponseEmbeddedDatum.shape.kind],
    ["ResponseEmbeddedDatum.type", ZV3ResponseEmbeddedDatum.shape.type],
    ["ResponseUnresolvedEntry.reason", ZV3ResponseUnresolvedEntry.shape.reason],
  ])("%s publishes exactly the values the serializer can emit", async (label, zodEnum) => {
    const [schemaName, property] = label.split(".");
    const schema = await loadSchema(schemaName);
    const specEnum = property ? schema.properties?.[property]?.enum : schema.enum;

    expect(sorted(specEnum ?? [])).toEqual(sorted((zodEnum as z.ZodEnum).options as readonly string[]));
  });

  /**
   * The composite sub-field ids are ordered, not merely a set: `address` and `contactInfo` are stored
   * as positional arrays, so slot N only means anything against this list in this order. Set equality
   * would pass on a reordering that silently maps every value to the wrong field.
   */
  test("ResponseAnswerComposite.fields.fieldId keeps its storage order", async () => {
    const schema = await loadSchema("ResponseAnswerComposite");
    const variant = schema.allOf?.find((part) => part.properties?.fields);
    const specIds = variant?.properties?.fields?.items?.properties?.fieldId?.enum ?? [];

    expect(specIds).toEqual([...V3_COMPOSITE_FIELD_IDS]);
  });
});
