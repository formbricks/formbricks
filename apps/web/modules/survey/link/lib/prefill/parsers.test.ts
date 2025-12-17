import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { parseCommaSeparated, parseNumber } from "./parsers";

describe("parseCommaSeparated", () => {
  test("parses simple comma-separated values", () => {
    expect(parseCommaSeparated("a,b,c")).toEqual(["a", "b", "c"]);
  });

  test("trims whitespace from values", () => {
    expect(parseCommaSeparated("a , b , c")).toEqual(["a", "b", "c"]);
    expect(parseCommaSeparated(" a, b, c ")).toEqual(["a", "b", "c"]);
  });

  test("filters out empty values", () => {
    expect(parseCommaSeparated("a,,b")).toEqual(["a", "b"]);
    expect(parseCommaSeparated("a,b,")).toEqual(["a", "b"]);
    expect(parseCommaSeparated(",a,b")).toEqual(["a", "b"]);
  });

  test("handles empty string", () => {
    expect(parseCommaSeparated("")).toEqual([]);
  });

  test("handles single value", () => {
    expect(parseCommaSeparated("single")).toEqual(["single"]);
  });

  test("handles values with spaces", () => {
    expect(parseCommaSeparated("First Choice,Second Choice")).toEqual(["First Choice", "Second Choice"]);
  });
});

describe("parseNumber", () => {
  test("parses valid integers", () => {
    expect(parseNumber("5")).toBe(5);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("10")).toBe(10);
  });

  test("parses valid floats", () => {
    expect(parseNumber("5.5")).toBe(5.5);
    expect(parseNumber("0.1")).toBe(0.1);
  });

  test("parses negative numbers", () => {
    expect(parseNumber("-5")).toBe(-5);
    expect(parseNumber("-5.5")).toBe(-5.5);
  });

  test("handles ampersand replacement", () => {
    expect(parseNumber("5&5")).toBe(null); // Invalid after replacement
  });

  test("returns null for invalid strings", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("5a")).toBeNull();
  });

  test("returns null for NaN result", () => {
    expect(parseNumber("NaN")).toBeNull();
  });
});
