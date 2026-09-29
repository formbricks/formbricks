import { describe, expect, test } from "vitest";
import { normalizeHex } from "./colors";

describe("normalizeHex", () => {
  test.each([
    ["#aabbcc", "#aabbcc"],
    ["#AABBCC", "#aabbcc"],
    ["aabbcc", "#aabbcc"],
    ["#abc", "#aabbcc"],
    ["#abcd", "#aabbcc"],
    ["#aabbccdd", "#aabbcc"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHex(input)).toBe(expected);
  });

  test.each([
    ["an empty string", ""],
    ["a five-digit hex", "#abcde"],
    ["a non-hex digit", "#gggggg"],
    ["an attribute injection", '#000" opacity="0'],
    ["a mangled query string", "#58d7a5&name=Survey"],
  ])("rejects %s", (_label, input) => {
    expect(normalizeHex(input)).toBeUndefined();
  });
});
