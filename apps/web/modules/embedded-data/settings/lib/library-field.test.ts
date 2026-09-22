import { describe, expect, test } from "vitest";
import {
  formatDefaultValueDraft,
  getAuthorableSources,
  getDataTypesForSource,
  getUsageLabel,
  isLockableSource,
  narrowDataTypeToSource,
  parseDefaultValueDraft,
} from "./library-field";

describe("getAuthorableSources", () => {
  test("offers the passed-in case first", () => {
    expect(getAuthorableSources()).toEqual(["ingested", "computed"]);
  });

  test("never offers reserved, because the schema refuses it as a stored row", () => {
    expect(getAuthorableSources()).not.toContain("reserved");
  });
});

describe("getDataTypesForSource", () => {
  test("a passed-in field takes every data type", () => {
    expect(getDataTypesForSource("ingested")).toEqual(["string", "number", "boolean", "date"]);
  });

  test("a calculated field is narrowed to what survey logic can calculate", () => {
    expect(getDataTypesForSource("computed")).toEqual(["string", "number"]);
  });
});

describe("isLockableSource", () => {
  test("only a passed-in field can be locked — there is nothing to ignore on a calculated one", () => {
    expect(isLockableSource("ingested")).toBe(true);
    expect(isLockableSource("computed")).toBe(false);
  });
});

describe("narrowDataTypeToSource", () => {
  test("keeps a type the source still allows, so switching source and back does not retype", () => {
    expect(narrowDataTypeToSource("number", "computed")).toBe("number");
    expect(narrowDataTypeToSource("date", "ingested")).toBe("date");
  });

  test("falls back to the first allowed type when the current one is no longer offered", () => {
    expect(narrowDataTypeToSource("date", "computed")).toBe("string");
    expect(narrowDataTypeToSource("boolean", "computed")).toBe("string");
  });
});

describe("parseDefaultValueDraft", () => {
  test("a blank draft is no default rather than an empty value", () => {
    expect(parseDefaultValueDraft("", "string")).toBeNull();
    expect(parseDefaultValueDraft("   ", "number")).toBeNull();
    expect(parseDefaultValueDraft("", "boolean")).toBeNull();
    expect(parseDefaultValueDraft("", "date")).toBeNull();
  });

  test("reads a number draft as a number", () => {
    expect(parseDefaultValueDraft("42", "number")).toBe(42);
    expect(parseDefaultValueDraft("-1.5", "number")).toBe(-1.5);
  });

  test("forwards a number draft that is not a number, so the schema names the problem", () => {
    expect(parseDefaultValueDraft("twelve", "number")).toBe("twelve");
    expect(parseDefaultValueDraft("Infinity", "number")).toBe("Infinity");
  });

  test("reads the true/false select as a boolean", () => {
    expect(parseDefaultValueDraft("true", "boolean")).toBe(true);
    expect(parseDefaultValueDraft("false", "boolean")).toBe(false);
  });

  test("forwards anything else on a boolean field rather than guessing", () => {
    expect(parseDefaultValueDraft("yes", "boolean")).toBe("yes");
  });

  test("passes text and ISO dates through untouched", () => {
    expect(parseDefaultValueDraft(" free  ", "string")).toBe(" free  ");
    expect(parseDefaultValueDraft("2026-04-21", "date")).toBe("2026-04-21");
  });
});

describe("formatDefaultValueDraft", () => {
  test("shows nothing for a field with no default", () => {
    expect(formatDefaultValueDraft(null)).toBe("");
  });

  test("round-trips every stored default back into its control", () => {
    expect(formatDefaultValueDraft("free")).toBe("free");
    expect(formatDefaultValueDraft(42)).toBe("42");
    expect(formatDefaultValueDraft(true)).toBe("true");
    expect(formatDefaultValueDraft(false)).toBe("false");
  });
});

describe("getUsageLabel", () => {
  test("separates unused from used, and forwards the count for the plural to resolve", () => {
    // One `used` branch on purpose: the plural category is ICU's to pick per locale, not this
    // function's. A `single` branch here would have hard-coded English's rule into every language.
    expect(getUsageLabel(0)).toEqual({ kind: "unused" });
    expect(getUsageLabel(1)).toEqual({ kind: "used", count: 1 });
    expect(getUsageLabel(3)).toEqual({ kind: "used", count: 3 });
  });

  test("treats a negative count as unused rather than rendering it", () => {
    expect(getUsageLabel(-1)).toEqual({ kind: "unused" });
  });
});
