import { describe, expect, test } from "vitest";
import { isDeepEqual, isDeepEqualIgnoringUndefined } from "./object";

describe("isDeepEqual", () => {
  test("compares dates by time, arrays in order and objects key by key", () => {
    expect(
      isDeepEqual({ at: new Date(0), list: [1, { a: "x" }] }, { list: [1, { a: "x" }], at: new Date(0) })
    ).toBe(true);
    expect(isDeepEqual({ at: new Date(0) }, { at: new Date(1) })).toBe(false);
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false);
  });

  test("tells a key that holds undefined from a missing one", () => {
    expect(isDeepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(false);
  });

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

describe("isDeepEqualIgnoringUndefined", () => {
  test("reads a key that holds undefined as missing, at any depth, on either side", () => {
    expect(isDeepEqualIgnoringUndefined({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(isDeepEqualIgnoringUndefined({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(isDeepEqualIgnoringUndefined({ list: [{ a: 1, b: undefined }] }, { list: [{ a: 1 }] })).toBe(true);
  });

  test("still tells undefined from null and from a value", () => {
    expect(isDeepEqualIgnoringUndefined({ a: undefined }, { a: null })).toBe(false);
    expect(isDeepEqualIgnoringUndefined({ a: undefined }, { a: 0 })).toBe(false);
    expect(isDeepEqualIgnoringUndefined({ a: 1 }, { a: 2 })).toBe(false);
  });
});
