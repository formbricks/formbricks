import { describe, expect, test } from "vitest";
import { z } from "zod";
import { diffAgainstSpec } from "./fidelity";
import type { JsonObject, JsonValue } from "./json";

/**
 * The differ is the guard behind every fidelity test, so it has to be able to fail. Each case is a Zod
 * schema that disagrees with its spec in exactly one way, and must be reported as exactly that.
 */
const document = (schemas: JsonObject): JsonObject => ({
  openapi: "3.1.1",
  paths: {},
  components: { schemas },
});
const attrs = (spec: JsonValue, schema: z.ZodType, schemas: JsonObject = {}) =>
  diffAgainstSpec(document(schemas), spec, schema).map((diff) => `${diff.path} ${diff.attr}`);

const object: JsonObject = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", format: "cuid2" }, note: { type: ["string", "null"], maxLength: 5 } },
};
const faithful = z.strictObject({ id: z.cuid2(), note: z.string().max(5).nullable().optional() });

describe("diffAgainstSpec", () => {
  test("reports nothing for a faithful schema", () => {
    expect(attrs(object, faithful)).toEqual([]);
  });

  test.each([
    [
      "an open object where the spec is closed",
      z.object({ id: z.cuid2(), note: z.string().max(5).nullable().optional() }),
      "$ closed",
    ],
    ["an optional field the spec requires", faithful.extend({ id: z.cuid2().optional() }), "$ required"],
    ["a lost nullability", faithful.extend({ note: z.string().max(5).optional() }), "$.note nullable"],
    ["a lost bound", faithful.extend({ note: z.string().nullable().optional() }), "$.note maxLength"],
    ["a lost format", faithful.extend({ id: z.string() }), "$.id format"],
    ["an extra property", faithful.extend({ extra: z.string().optional() }), "$ props"],
  ])("reports %s", (_name, schema, expected) => {
    expect(attrs(object, schema)).toContain(expected);
  });

  test("follows $refs and allOf on the spec side", () => {
    const schemas: JsonObject = {
      Base: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    };
    const composed: JsonObject = {
      allOf: [{ $ref: "#/components/schemas/Base" }, { properties: { n: { type: "number" } } }],
      unevaluatedProperties: false,
    };
    expect(attrs(composed, z.strictObject({ id: z.string(), n: z.number().optional() }), schemas)).toEqual(
      []
    );
    expect(attrs(composed, z.object({ id: z.string(), n: z.number().optional() }), schemas)).toEqual([
      "$ closed",
    ]);
  });

  test("keys union members by their discriminating values and compares each member", () => {
    const schemas: JsonObject = {
      A: {
        type: "object",
        required: ["k"],
        additionalProperties: false,
        properties: { k: { type: "string", enum: ["x", "y"] }, a: { type: "string" } },
      },
      B: {
        type: "object",
        required: ["k"],
        additionalProperties: false,
        properties: { k: { type: "string", enum: ["z"] } },
      },
    };
    const spec = { oneOf: [{ $ref: "#/components/schemas/A" }, { $ref: "#/components/schemas/B" }] };
    const a = z.strictObject({ k: z.enum(["x", "y"]), a: z.string().optional() });
    const b = z.strictObject({ k: z.enum(["z"]) });
    expect(attrs(spec, z.union([a, b]), schemas)).toEqual([]);
    expect(attrs(spec, z.union([a, z.object({ k: z.enum(["z"]) })]), schemas)).toEqual(["$|k=z closed"]);
    expect(attrs(spec, z.union([a]), schemas)).toContain("$|k=z missing-in-zod");
  });

  test("reports the keywords a generator drops", () => {
    expect(
      attrs({ type: "array", items: { type: "string" }, uniqueItems: true }, z.array(z.string()))
    ).toEqual(["$ uniqueItems"]);
    expect(
      attrs(
        { type: "object", maxProperties: 2, additionalProperties: { type: "string" } },
        z.record(z.string(), z.string())
      )
    ).toEqual(["$ maxProperties"]);
  });
});
