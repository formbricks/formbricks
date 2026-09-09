import { describe, expect, test } from "vitest";
import { isJsonTooDeep, measureJsonTextDepth, measureJsonValueDepth, parseJsonBounded } from "./json-depth";

describe("json depth guard", () => {
  test("measures nesting and ignores brackets inside strings", () => {
    expect(measureJsonTextDepth('{"a":[1,{"b":"[[[[\\"]]"}]}')).toBe(3);
    expect(measureJsonValueDepth({ a: [1, { b: "x" }] })).toBe(3);
    expect(measureJsonValueDepth("flat")).toBe(0);
  });

  test("stops early past the limit so a 2 MB file costs one scan", () => {
    const deep = "[".repeat(300_000) + "]".repeat(300_000);
    expect(isJsonTooDeep(deep)).toBe(true);
    expect(parseJsonBounded(deep)).toBeNull();
    expect(measureJsonTextDepth(deep, 10)).toBe(11);
  });

  test("parses normal documents and rejects broken ones", () => {
    expect(parseJsonBounded('{"name":"x"}')).toEqual({ value: { name: "x" } });
    expect(parseJsonBounded("{ nope")).toBeNull();
    let value: unknown = "leaf";
    for (let index = 0; index < 100; index += 1) value = [value];
    expect(isJsonTooDeep(value)).toBe(true);
    expect(isJsonTooDeep({ blocks: [{ elements: [{ choices: [{ label: { "en-US": "x" } }] }] }] })).toBe(
      false
    );
  });
});
