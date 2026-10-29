import { createElement } from "react";
import { describe, expect, test } from "vitest";
import { isEmptyCellContent, isEmptyResponseValue } from "./empty-cell";

describe("isEmptyResponseValue", () => {
  test("treats a missing, blank or all-empty answer as empty", () => {
    for (const value of [undefined, null, "", "  ", [], [""], {}, { city: "" }]) {
      expect(isEmptyResponseValue(value)).toBe(true);
    }
  });

  test("keeps any real answer, including zero and false", () => {
    for (const value of ["yes", 0, false, ["a"], { city: "Berlin" }]) {
      expect(isEmptyResponseValue(value)).toBe(false);
    }
  });
});

describe("isEmptyCellContent", () => {
  test("is empty for nothing, blank text and elements wrapping nothing", () => {
    expect(isEmptyCellContent(null)).toBe(true);
    expect(isEmptyCellContent(undefined)).toBe(true);
    expect(isEmptyCellContent("")).toBe(true);
    expect(isEmptyCellContent(createElement("p", null, undefined))).toBe(true);
    expect(isEmptyCellContent(createElement("div", null, createElement("span", null, "")))).toBe(true);
    expect(isEmptyCellContent(createElement("ul", { items: [] }))).toBe(true);
  });

  test("is not empty when anything visible renders", () => {
    expect(isEmptyCellContent("Anonymous")).toBe(false);
    expect(isEmptyCellContent(0 as unknown as string)).toBe(false);
    expect(isEmptyCellContent(createElement("p", null, "Weekly"))).toBe(false);
    expect(isEmptyCellContent(createElement("ul", { items: [{ value: "vip" }] }))).toBe(false);
    expect(isEmptyCellContent(createElement("img", { src: "x" }))).toBe(false);
  });
});
