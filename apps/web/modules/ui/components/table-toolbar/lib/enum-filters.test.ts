import { describe, expect, test } from "vitest";
import { resolveEnumFilter } from "./enum-filters";
import type { TTableFilter } from "./types";

describe("resolveEnumFilter", () => {
  test("an equals rule narrows to its one value", () => {
    const filters: TTableFilter[] = [{ property: "status", operator: "equals", values: ["b"] }];
    expect(resolveEnumFilter(filters, "status", ["a", "b", "c"])).toEqual(["b"]);
  });

  test("ignores operators that do not constrain an enum", () => {
    const filters: TTableFilter[] = [{ property: "status", operator: "isSet", values: [] }];
    expect(resolveEnumFilter(filters, "status", ["a", "b"])).toEqual(["a", "b"]);
  });
});
