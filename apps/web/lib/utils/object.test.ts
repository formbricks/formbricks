import { describe, expect, test } from "vitest";
import { isDeepEqual } from "./object";

describe("isDeepEqual", () => {
  test("compares nested objects and arrays by value", () => {
    expect(isDeepEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] })).toBe(true);
    expect(isDeepEqual({ a: [1, { b: "x" }] }, { a: [1, { b: "y" }] })).toBe(false);
  });

  test("treats objects with different key sets as unequal", () => {
    expect(isDeepEqual({ a: 1 }, { b: 1 })).toBe(false);
  });

  // `toString` exists on every object through its prototype; only an own key on the right counts, so
  // a left key the right object merely inherits does not make them equal.
  test("does not count a key the right object only inherits", () => {
    expect(isDeepEqual({ toString: Object.prototype.toString }, { other: 1 })).toBe(false);
  });
});
