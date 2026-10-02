import { describe, expect, test } from "vitest";
import type { JsonObject, JsonValue } from "../src/testing/json";
import { normalizeForGeneration } from "./normalize";

const withSchemas = (schemas: JsonObject): JsonObject => ({
  openapi: "3.1.1",
  info: { title: "t", version: "1" },
  paths: {},
  components: { schemas },
});
const schemasOf = (document: JsonObject): Record<string, JsonValue> =>
  (document.components as JsonObject).schemas as Record<string, JsonValue>;

const base: JsonObject = {
  type: "object",
  required: ["kind", "id"],
  properties: { kind: { type: "string", enum: ["a", "b", "c"] }, id: { type: "string" } },
};

describe("closed allOf", () => {
  test("flattens into one closed object, the narrower overlapping enum winning", () => {
    const { document, report } = normalizeForGeneration(
      withSchemas({
        Base: base,
        Variant: {
          description: "kept",
          allOf: [
            { $ref: "#/components/schemas/Base" },
            {
              type: "object",
              required: ["value"],
              properties: { kind: { type: "string", enum: ["a"] }, value: { type: "number" } },
            },
          ],
          unevaluatedProperties: false,
        },
      })
    );
    expect(schemasOf(document).Variant).toEqual({
      description: "kept",
      type: "object",
      properties: {
        kind: { type: "string", enum: ["a"] },
        id: { type: "string" },
        value: { type: "number" },
      },
      required: ["kind", "id", "value"],
      additionalProperties: false,
    });
    expect(report.flattened).toEqual(["$.components.schemas.Variant"]);
  });

  test("reads a member that is itself a closed allOf", () => {
    const { document } = normalizeForGeneration(
      withSchemas({
        Inner: {
          allOf: [{ type: "object", properties: { a: { type: "string" } } }],
          unevaluatedProperties: false,
        },
        Outer: {
          allOf: [{ $ref: "#/components/schemas/Inner" }, { properties: { b: { type: "string" } } }],
          unevaluatedProperties: false,
        },
      })
    );
    expect(Object.keys((schemasOf(document).Outer as JsonObject).properties as JsonObject)).toEqual([
      "a",
      "b",
    ]);
  });

  test.each([
    [
      "an overlap that widens the base enum",
      { kind: { type: "string", enum: ["a", "z"] } },
      /widens the base enum/,
    ],
    [
      "an overlap that is not an enum on both sides",
      { id: { type: "string", minLength: 3 } },
      /must both be enums/,
    ],
  ])("throws on %s", (_name, properties, message) => {
    const spec = withSchemas({
      Base: base,
      Variant: {
        allOf: [{ $ref: "#/components/schemas/Base" }, { properties }],
        unevaluatedProperties: false,
      },
    });
    expect(() => normalizeForGeneration(spec)).toThrow(message);
  });

  test.each([
    [
      "a member keyword it cannot merge",
      { allOf: [{ type: "object", maxProperties: 3 }], unevaluatedProperties: false },
      /maxProperties cannot be merged/,
    ],
    [
      "a constraint beside the allOf",
      { allOf: [{ type: "object" }], unevaluatedProperties: false, minProperties: 1 },
      /sibling constraints \(minProperties\)/,
    ],
    [
      "a $ref member with constraint siblings",
      { allOf: [{ $ref: "#/components/schemas/Base", maxProperties: 2 }], unevaluatedProperties: false },
      /constraint siblings \(maxProperties\)/,
    ],
    [
      "a required name no member defines",
      { allOf: [{ type: "object", required: ["ghost"] }], unevaluatedProperties: false },
      /ghost/,
    ],
  ])("throws on %s", (_name, schema, message) => {
    expect(() => normalizeForGeneration(withSchemas({ Base: base, Bad: schema }))).toThrow(message);
  });
});

describe("open allOf", () => {
  test("collapses keyword-only branches onto the base, keeping annotations", () => {
    const { document, report } = normalizeForGeneration(
      withSchemas({
        Map: { type: "object", additionalProperties: { type: "string" } },
        BoundedMap: {
          description: "bounded",
          allOf: [
            { $ref: "#/components/schemas/Map" },
            {
              type: "object",
              maxProperties: 5,
              additionalProperties: { if: { type: "array" }, then: { maxItems: 2 } },
            },
          ],
        },
      })
    );
    expect(schemasOf(document).BoundedMap).toEqual({
      description: "bounded",
      $ref: "#/components/schemas/Map",
    });
    expect(report.collapsed).toEqual(["$.components.schemas.BoundedMap"]);
  });

  test("throws on any other open allOf, so a branch that adds properties is never dropped", () => {
    const spec = withSchemas({
      Base: base,
      Extended: {
        allOf: [{ $ref: "#/components/schemas/Base" }, { properties: { extra: { type: "string" } } }],
      },
    });
    expect(() => normalizeForGeneration(spec)).toThrow(/open allOf is only supported/);
  });
});

describe("discriminators", () => {
  const member = (values: string[]): JsonObject => ({
    type: "object",
    required: ["k"],
    properties: { k: { type: "string", enum: values } },
    additionalProperties: false,
  });
  const union = (mapping: JsonObject): JsonObject => ({
    oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }],
    discriminator: { propertyName: "k", mapping },
  });

  test("drops a many-to-one mapping the members' own enums already carry", () => {
    const { document, report } = normalizeForGeneration(
      withSchemas({
        A: member(["x", "y"]),
        B: member(["z"]),
        U: union({ x: "#/components/schemas/A", y: "#/components/schemas/A", z: "#/components/schemas/B" }),
      })
    );
    expect(schemasOf(document).U).toEqual({
      oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }],
    });
    expect(report.droppedDiscriminators).toEqual(["$.components.schemas.U"]);
  });

  test("keeps a one-to-one mapping, which the generator turns into a discriminated union", () => {
    const { document } = normalizeForGeneration(
      withSchemas({
        A: member(["x"]),
        B: member(["z"]),
        U: union({ x: "#/components/schemas/A", z: "#/components/schemas/B" }),
      })
    );
    expect((schemasOf(document).U as JsonObject).discriminator).toBeDefined();
  });

  test("throws when a member's enum disagrees with its mapping keys", () => {
    const spec = withSchemas({
      A: member(["x"]),
      B: member(["z"]),
      U: union({ x: "#/components/schemas/A", y: "#/components/schemas/A", z: "#/components/schemas/B" }),
    });
    expect(() => normalizeForGeneration(spec)).toThrow(/differs from its mapping keys/);
  });

  test("throws when the mapping names a schema outside oneOf", () => {
    const spec = withSchemas({
      A: member(["x", "y"]),
      B: member(["z"]),
      C: member(["w"]),
      U: union({
        x: "#/components/schemas/A",
        y: "#/components/schemas/A",
        z: "#/components/schemas/B",
        w: "#/components/schemas/C",
      }),
    });
    expect(() => normalizeForGeneration(spec)).toThrow(/not in oneOf: #\/components\/schemas\/C/);
  });
});

describe("access modifiers and leftovers", () => {
  test("strips readOnly and writeOnly from schemas but never from example data", () => {
    const { document } = normalizeForGeneration({
      ...withSchemas({
        Res: {
          type: "object",
          properties: { id: { type: "string", readOnly: true }, secret: { type: "string", writeOnly: true } },
        },
      }),
      paths: {
        "/x": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Res" },
                  example: { readOnly: true, allOf: 1 },
                },
              },
            },
          },
        },
      },
    });
    expect(schemasOf(document).Res).toEqual({
      type: "object",
      properties: { id: { type: "string" }, secret: { type: "string" } },
    });
    const media = (
      ((((document.paths as JsonObject)["/x"] as JsonObject).post as JsonObject).requestBody as JsonObject)
        .content as JsonObject
    )["application/json"] as JsonObject;
    expect(media.example).toEqual({ readOnly: true, allOf: 1 });
  });

  test("a property named after a keyword is a property, not a keyword", () => {
    const { document } = normalizeForGeneration(
      withSchemas({
        Odd: { type: "object", properties: { default: { type: "string" }, not: { type: "boolean" } } },
      })
    );
    expect(schemasOf(document).Odd).toEqual({
      type: "object",
      properties: { default: { type: "string" }, not: { type: "boolean" } },
    });
  });

  test("throws on properties beside a typed additionalProperties, which the generator would drop", () => {
    const spec = withSchemas({
      Bad: {
        type: "object",
        properties: { a: { type: "string" } },
        additionalProperties: { type: "number" },
      },
    });
    expect(() => normalizeForGeneration(spec)).toThrow(/typed additionalProperties is not supported/);
  });

  test.each(["not", "if", "patternProperties", "prefixItems"])(
    "throws when %s would reach the generator",
    (keyword) => {
      const spec = withSchemas({ Bad: { type: "object", [keyword]: { type: "string" } } });
      expect(() => normalizeForGeneration(spec)).toThrow(new RegExp(`"${keyword}" reached the generator`));
    }
  );

  test("leaves the input untouched and shares no subtrees between outputs", () => {
    const spec = withSchemas({
      Base: base,
      V1: { allOf: [{ $ref: "#/components/schemas/Base" }], unevaluatedProperties: false },
      V2: { allOf: [{ $ref: "#/components/schemas/Base" }], unevaluatedProperties: false },
    });
    const before = JSON.stringify(spec);
    const { document } = normalizeForGeneration(spec);
    expect(JSON.stringify(spec)).toBe(before);
    const schemas = schemasOf(document) as Record<string, JsonObject>;
    expect((schemas.V1.properties as JsonObject).id).not.toBe((schemas.V2.properties as JsonObject).id);
  });
});
