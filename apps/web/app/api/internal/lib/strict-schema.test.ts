import { describe, expect, test } from "vitest";
import { z } from "zod";
import { strictDeep } from "./strict-schema";

const ZLeaf = z
  .object({ a: z.string().optional(), b: z.string().optional() })
  .refine((leaf) => leaf.a !== undefined || leaf.b !== undefined, { error: "a or b" });

const ZSchema = z.object({
  name: z.string().max(3),
  nested: z.object({ leaf: ZLeaf.nullish() }).optional(),
  list: z.array(z.object({ id: z.string() })).max(2),
  choice: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("x"), x: z.number() }),
      z.object({ kind: z.literal("y"), y: z.object({ deep: z.boolean() }) }),
    ])
    .optional(),
  either: z.union([z.string(), z.object({ value: z.number() })]).optional(),
});

const valid = {
  name: "abc",
  nested: { leaf: { a: "1" } },
  list: [{ id: "1" }],
  choice: { kind: "y", y: { deep: true } },
  either: { value: 1 },
};

describe("strictDeep", () => {
  const strict = strictDeep(ZSchema);

  test("accepts what the original accepts", () => {
    expect(strict.parse(valid)).toEqual(valid);
  });

  test.each([
    ["the top level", { ...valid, extra: 1 }],
    ["a nested object", { ...valid, nested: { leaf: { a: "1" }, extra: 1 } }],
    ["an object behind nullish", { ...valid, nested: { leaf: { a: "1", extra: 1 } } }],
    ["an array entry", { ...valid, list: [{ id: "1", extra: 1 }] }],
    ["a discriminated union option", { ...valid, choice: { kind: "x", x: 1, extra: 1 } }],
    ["an object inside a union option", { ...valid, choice: { kind: "y", y: { deep: true, extra: 1 } } }],
    ["an object option of a plain union", { ...valid, either: { value: 1, extra: 1 } }],
  ])("rejects an unknown key in %s", (_where, input) => {
    expect(ZSchema.safeParse(input).success).toBe(true);
    expect(strict.safeParse(input).success).toBe(false);
  });

  test("keeps every other rule: refinements, string and array bounds", () => {
    expect(strict.safeParse({ ...valid, nested: { leaf: {} } }).success).toBe(false);
    expect(strict.safeParse({ ...valid, name: "abcd" }).success).toBe(false);
    expect(strict.safeParse({ ...valid, list: [{ id: "1" }, { id: "2" }, { id: "3" }] }).success).toBe(false);
  });

  test("leaves the original schema stripping unknown keys", () => {
    expect(ZSchema.parse({ ...valid, extra: 1 })).toEqual(valid);
  });

  test("refuses a schema it cannot make strict, rather than leaving part of it loose", () => {
    expect(() => strictDeep(z.object({ map: z.record(z.string(), z.object({})) }))).toThrow(/record/);
  });

  test("makes an object under a default strict, keeping the default", () => {
    const strict = strictDeep(z.object({ config: z.object({ x: z.string() }).default({ x: "a" }) }));

    expect(strict.parse({})).toEqual({ config: { x: "a" } });
    expect(strict.safeParse({ config: { x: "b", typo: 1 } }).success).toBe(false);
  });

  test("refuses any other wrapper around an inner schema", () => {
    expect(() => strictDeep(z.object({ inner: z.object({ x: z.string() }).readonly() }))).toThrow(/readonly/);
    expect(() => strictDeep(z.object({ inner: z.object({ x: z.string() }).nonoptional() }))).toThrow(
      /nonoptional/
    );
  });
});
