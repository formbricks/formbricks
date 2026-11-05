import { describe, expect, test } from "vitest";
import { resolveEnumFilter } from "./enum-filters";
import type { TTableFilter } from "./types";

describe("resolveEnumFilter", () => {
  test("an equals rule narrows to its one value", () => {
    const filters: TTableFilter[] = [{ property: "status", operator: "equals", values: ["b"] }];
    expect(resolveEnumFilter(filters, "status", ["a", "b", "c"])).toEqual(["b"]);
  });

  test("is with several values narrows to them, is not to every value but its own", () => {
    const anyOf: TTableFilter[] = [{ property: "status", operator: "equals", values: ["a", "c"] }];
    expect(resolveEnumFilter(anyOf, "status", ["a", "b", "c"])).toEqual(["a", "c"]);
    const noneOf: TTableFilter[] = [{ property: "status", operator: "notEquals", values: ["a", "c"] }];
    expect(resolveEnumFilter(noneOf, "status", ["a", "b", "c"])).toEqual(["b"]);
  });

  test("ignores operators that do not constrain an enum", () => {
    const filters: TTableFilter[] = [{ property: "status", operator: "isSet", values: [] }];
    expect(resolveEnumFilter(filters, "status", ["a", "b"])).toEqual(["a", "b"]);
  });
});
