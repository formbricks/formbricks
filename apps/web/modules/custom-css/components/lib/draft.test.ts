import { describe, expect, test } from "vitest";
import { type TCustomCssStored } from "@formbricks/types/custom-css";
import {
  applyCustomCssDraftToStored,
  getCompiledByteSize,
  getCustomCssByteSize,
  getCustomCssChangeKind,
  getCustomCssSource,
  getUtf8ByteLength,
  isOverCustomCssByteLimit,
  isSameCustomCss,
  normalizeCustomCssInput,
  toComparableStoredCustomCss,
  toCustomCssDraft,
} from "./draft";

const saved: TCustomCssStored = {
  light: { source: "#fbjs { color: red; }", compiled: "@layer fb-survey{...}" },
  dark: null,
  processorVersion: 3,
};

describe("normalizeCustomCssInput", () => {
  test("treats empty and whitespace-only fields as no CSS, and both empty as null", () => {
    expect(normalizeCustomCssInput({ light: "  \n", dark: "" })).toBeNull();
    expect(normalizeCustomCssInput({ light: null, dark: null })).toBeNull();
    expect(normalizeCustomCssInput(null)).toBeNull();
  });

  test("keeps non-empty source verbatim, surrounding whitespace included", () => {
    expect(normalizeCustomCssInput({ light: " a{} ", dark: " " })).toEqual({ light: " a{} ", dark: null });
  });
});

describe("source and draft conversion", () => {
  test("reads only source from a stored value", () => {
    expect(getCustomCssSource(saved)).toEqual({ light: "#fbjs { color: red; }", dark: null });
    expect(getCustomCssSource(null)).toBeNull();
  });

  test("turns missing fields into empty textareas", () => {
    expect(toCustomCssDraft(null)).toEqual({ light: "", dark: "" });
    expect(toCustomCssDraft({ light: "a{}", dark: null })).toEqual({ light: "a{}", dark: "" });
  });
});

describe("getUtf8ByteLength", () => {
  test.each([
    ["", 0],
    ["abc", 3],
    ["é", 2],
    ["€", 3],
    ["😀", 4],
    ["a😀é", 7],
    ["\uD800", 3],
    ["\uD800a", 4],
    ["\uDC00", 3],
    ["\uDE00\uD83D", 6],
    ["\uD83D\uD83D\uDE00", 7],
  ])("%j is %i bytes, like TextEncoder and the server's Buffer.byteLength", (value, bytes) => {
    expect(getUtf8ByteLength(value)).toBe(bytes);
    expect(getUtf8ByteLength(value)).toBe(new TextEncoder().encode(value).length);
    expect(getUtf8ByteLength(value)).toBe(Buffer.byteLength(value, "utf8"));
  });
});

describe("byte budget", () => {
  test("counts light and dark together and ignores whitespace-only fields", () => {
    expect(getCustomCssByteSize({ light: "ab", dark: "€" })).toBe(5);
    expect(getCustomCssByteSize({ light: "ab", dark: "   " })).toBe(2);
  });

  test("allows exactly the scope budget and rejects one byte more", () => {
    expect(isOverCustomCssByteLimit("survey", { light: "a".repeat(20_000), dark: "" })).toBe(false);
    expect(isOverCustomCssByteLimit("survey", { light: "a".repeat(19_999), dark: "é" })).toBe(true);
    expect(
      isOverCustomCssByteLimit("workspace", { light: "a".repeat(60_000), dark: "a".repeat(40_000) })
    ).toBe(false);
  });
});

describe("getCustomCssChangeKind", () => {
  test("is unchanged when only whitespace-only fields differ", () => {
    expect(getCustomCssChangeKind({ light: "a{}", dark: null }, { light: "a{}", dark: "  " })).toBe(
      "unchanged"
    );
  });

  test("is a removal when a field is cleared and nothing is added or edited", () => {
    expect(getCustomCssChangeKind({ light: "a{}", dark: "b{}" }, { light: "a{}", dark: "" })).toBe("removal");
    expect(getCustomCssChangeKind({ light: "a{}", dark: "b{}" }, null)).toBe("removal");
  });

  test("is an edit when a field is added or changed, even alongside a removal", () => {
    expect(getCustomCssChangeKind(null, { light: "a{}", dark: "" })).toBe("edit");
    expect(getCustomCssChangeKind({ light: "a{}", dark: null }, { light: "a{ }", dark: null })).toBe("edit");
    expect(getCustomCssChangeKind({ light: "a{}", dark: "b{}" }, { light: "", dark: "c{}" })).toBe("edit");
  });
});

describe("isSameCustomCss", () => {
  test("compares normalized source", () => {
    expect(isSameCustomCss(null, { light: " ", dark: "" })).toBe(true);
    expect(isSameCustomCss({ light: "a", dark: null }, { light: "a", dark: "" })).toBe(true);
    expect(isSameCustomCss({ light: "a", dark: null }, { light: "b", dark: null })).toBe(false);
  });
});

describe("applyCustomCssDraftToStored", () => {
  test("returns the saved value itself when the draft matches it", () => {
    expect(applyCustomCssDraftToStored(saved, { light: "#fbjs { color: red; }", dark: "" })).toBe(saved);
  });

  test("sends a changed field with empty compiled output and keeps unchanged entries", () => {
    expect(applyCustomCssDraftToStored(saved, { light: "#fbjs { color: red; }", dark: "a{}" })).toEqual({
      light: saved.light,
      dark: { source: "a{}", compiled: "" },
      processorVersion: 3,
    });
  });

  test("never carries compiled output of a changed field", () => {
    const result = applyCustomCssDraftToStored(saved, { light: "b{}", dark: "" });
    expect(result?.light).toEqual({ source: "b{}", compiled: "" });
  });

  test("clears to null when both fields are empty", () => {
    expect(applyCustomCssDraftToStored(saved, { light: "", dark: "" })).toBeNull();
    expect(applyCustomCssDraftToStored(null, { light: "", dark: "" })).toBeNull();
  });

  test("starts a new value from nothing", () => {
    expect(applyCustomCssDraftToStored(null, { light: "", dark: "a{}" })).toEqual({
      light: null,
      dark: { source: "a{}", compiled: "" },
      processorVersion: 0,
    });
  });
});

describe("toComparableStoredCustomCss", () => {
  test("makes a draft and the saved value equal when only server-owned parts differ", () => {
    const draft = applyCustomCssDraftToStored(null, { light: "#fbjs { color: red; }", dark: " " });
    expect(toComparableStoredCustomCss(draft)).toEqual(toComparableStoredCustomCss(saved));
  });

  test("still tells different sources apart", () => {
    const draft = applyCustomCssDraftToStored(saved, { light: "#fbjs { color: blue; }", dark: "" });
    expect(toComparableStoredCustomCss(draft)).not.toEqual(toComparableStoredCustomCss(saved));
  });

  test("reduces no CSS to null", () => {
    expect(toComparableStoredCustomCss(null)).toBeNull();
    expect(toComparableStoredCustomCss(undefined)).toBeNull();
  });
});

describe("getCompiledByteSize", () => {
  test("counts base and dark together in UTF-8 bytes, as the output limit does", () => {
    expect(getCompiledByteSize({ light: "@layer fb-survey{#fbjs a{color:red!important}}" })).toBe(46);
    expect(getCompiledByteSize({ light: "é", dark: "abc" })).toBe(5);
    expect(getCompiledByteSize({ dark: "abc" })).toBe(3);
    expect(getCompiledByteSize(null)).toBe(0);
  });
});
