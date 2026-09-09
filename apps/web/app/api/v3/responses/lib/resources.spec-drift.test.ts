import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { z } from "zod";
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
  if (!node.allOf) return node;

  const parts = await Promise.all(node.allOf.map(effective));
  const merged: SpecSchema = { type: "object", properties: {}, required: [] };
  for (const part of [...parts, node]) {
    Object.assign(merged.properties as object, part.properties ?? {});
    merged.required = [...(merged.required ?? []), ...(part.required ?? [])];
  }
  return merged;
};

type ZodAny = z.ZodType & { shape?: Record<string, z.ZodType> };

/** Peel `optional` / `nullable` / `default` wrappers to reach the underlying type. */
const unwrap = (schema: z.ZodType): ZodAny => {
  let current: unknown = schema;
  for (let i = 0; i < 8; i += 1) {
    const def = (current as { _zod?: { def?: { type?: string; innerType?: unknown } } })._zod?.def;
    if (def && (def.type === "optional" || def.type === "nullable" || def.type === "default")) {
      current = def.innerType;
      continue;
    }
    break;
  }
  return current as ZodAny;
};

const zodKind = (schema: z.ZodType): string | undefined =>
  (schema as { _zod?: { def?: { type?: string } } })._zod?.def?.type;

const arrayElement = (schema: ZodAny): ZodAny | undefined =>
  (schema as unknown as { _zod?: { def?: { element?: unknown } } })._zod?.def?.element as ZodAny | undefined;

/** A Zod field is optional exactly when it accepts `undefined`. */
const acceptsUndefined = (schema: z.ZodType): boolean => schema.safeParse(undefined).success;

const sorted = (values: Iterable<string>): string[] => [...values].sort();

/**
 * Compare one spec node against one Zod object, recursively.
 *
 * Collects differences rather than asserting, so one failure reports every divergence at once instead
 * of stopping at the first — which matters when a schema is edited on one side only.
 */
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

    // Descend only where both sides are shaped the same way. A spec map against a Zod record has no
    // property names to line up, so there is nothing below it to check.
    const specChild = await effective((spec.properties as Record<string, SpecSchema>)[key]);
    const inner = unwrap(field);
    const kind = zodKind(inner);

    if (kind === "object" && specChild.properties) {
      diffs.push(...(await diffObject(specChild, inner, `${path}.${key}`)));
    } else if (kind === "array" && specChild.items) {
      const element = arrayElement(inner);
      const specItem = await effective(specChild.items);
      if (element && zodKind(element) === "object" && specItem.properties) {
        diffs.push(...(await diffObject(specItem, element, `${path}.${key}[]`)));
      }
    }
  }

  return diffs;
};

describe("v3 response contract", () => {
  test("ResponseAnswerBase.elementType lists exactly the element types the survey model defines", async () => {
    const base = await loadSchema("ResponseAnswerBase");

    expect(sorted(base.properties?.elementType?.enum ?? [])).toEqual(sorted(V3_ELEMENT_TYPES));
  });

  test("ResponseAnswer maps every element type to a variant, and only real ones", async () => {
    const answer = await loadSchema("ResponseAnswer");
    const mapping = answer.discriminator?.mapping ?? {};

    // Every element type is routed. A type absent here serializes to no shape at all.
    expect(sorted(Object.keys(mapping))).toEqual(sorted(V3_ELEMENT_TYPES));
    // The nine variant files are the nine members of the Zod union.
    expect(new Set(Object.values(mapping)).size).toBe(ZV3ResponseAnswer.options.length);
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

  test("the two views differ by exactly the five fields the detail read adds", async () => {
    const list = new Set(Object.keys(ZV3ResponseListItem.shape));
    const detail = new Set(Object.keys(ZV3ResponseResource.shape));
    const added = [...detail].filter((key) => !list.has(key));

    expect(sorted(added)).toEqual(["contact", "data", "displayId", "singleUseId", "variables"]);
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
