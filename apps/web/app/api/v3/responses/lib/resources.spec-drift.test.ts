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
 * first contract draft, six more where the spec disagreed with the shipped Embedded Data model. Each
 * was found by a human reading both sides, which does not scale and did not catch them before review.
 *
 * Assertions are exact set equality in **both** directions on purpose. A field in the code and not
 * the spec is an undocumented promise; a field in the spec and not the code is a promise the API does
 * not keep. Neither is a warning.
 *
 * Mirrors `app/api/v3/lib/problem-codes.test.ts` and `packages/workflows/src/contracts/spec-drift.test.ts`.
 */

const SPEC_SRC_URL = new URL("../../../../../../../docs/api-v3-reference/src/", import.meta.url);

type SpecSchema = {
  type?: string;
  enum?: string[];
  required?: string[];
  properties?: Record<string, SpecSchema>;
  allOf?: SpecSchema[];
  oneOf?: SpecSchema[];
  items?: SpecSchema;
  discriminator?: { propertyName: string; mapping: Record<string, string> };
};

const loadSchema = async (name: string): Promise<SpecSchema> => {
  // Dynamic import keeps the YAML parser out of the static block, where prettier's grouping and
  // eslint's import/order disagree about its position relative to `node:` builtins.
  const { parse } = await import("yaml");
  const raw = await readFile(new URL(`components/schemas/${name}.yml`, SPEC_SRC_URL), "utf8");
  return parse(raw) as SpecSchema;
};

/**
 * Property names a spec schema declares, following `allOf` composition one level down.
 *
 * The answer variants are all `allOf: [ResponseAnswerBase, {…}]`, so reading `.properties` alone
 * would silently compare a variant's own fields against base-plus-variant and pass while the base
 * drifted.
 */
const specProperties = (schema: SpecSchema, base?: SpecSchema): Set<string> => {
  const names = new Set<string>();
  for (const part of [...(base ? [base] : []), ...(schema.allOf ?? []), schema]) {
    for (const key of Object.keys(part.properties ?? {})) names.add(key);
  }
  return names;
};

/** Keys a Zod object declares, including optional ones. */
const zodKeys = (schema: z.ZodObject): Set<string> => new Set(Object.keys(schema.shape));

const sorted = (values: Iterable<string>): string[] => [...values].sort();

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
  ])("%s carries exactly the fields the serializer emits", async (schemaName, elementType) => {
    const [schema, base] = await Promise.all([loadSchema(schemaName), loadSchema("ResponseAnswerBase")]);
    const variant = ZV3ResponseAnswer.options.find(
      (option) => (option.shape.elementType as z.ZodType).safeParse(elementType).success
    );

    expect(variant, `no Zod variant accepts elementType "${elementType}"`).toBeDefined();
    expect(sorted(zodKeys(variant as z.ZodObject))).toEqual(sorted(specProperties(schema, base)));
  });

  test.each([
    ["ResponseSelection", ZV3ResponseSelection],
    ["ResponseEmbeddedDatum", ZV3ResponseEmbeddedDatum],
    ["ResponseUnresolvedEntry", ZV3ResponseUnresolvedEntry],
    ["ResponseResolution", ZV3ResponseResolution],
    ["ResponseTag", ZV3ResponseTag],
    ["ResponseContact", ZV3ResponseContact],
  ])("%s carries exactly the fields the serializer emits", async (schemaName, zodSchema) => {
    const schema = await loadSchema(schemaName);

    expect(sorted(zodKeys(zodSchema))).toEqual(sorted(specProperties(schema)));
  });

  test.each([
    ["ResponseListItem", ZV3ResponseListItem],
    ["ResponseResource", ZV3ResponseResource],
  ])("%s carries exactly the fields the serializer emits", async (schemaName, zodSchema) => {
    const [schema, base] = await Promise.all([loadSchema(schemaName), loadSchema("ResponseBase")]);

    expect(sorted(zodKeys(zodSchema))).toEqual(sorted(specProperties(schema, base)));
  });

  test("the two views differ by exactly the five fields the detail read adds", async () => {
    const list = zodKeys(ZV3ResponseListItem);
    const detail = zodKeys(ZV3ResponseResource);
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
