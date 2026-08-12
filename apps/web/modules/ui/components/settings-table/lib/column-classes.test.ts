import { describe, expect, test } from "vitest";
import type { TSettingsTableColumn } from "../types";
import {
  getBodyCellClassName,
  getFrameClassName,
  getHeaderCellClassName,
  getRowActivatorColumnId,
} from "./column-classes";

const column = (overrides: Partial<TSettingsTableColumn<unknown>> = {}): TSettingsTableColumn<unknown> => ({
  id: "name",
  header: "Name",
  cell: () => null,
  ...overrides,
});

describe("getFrameClassName", () => {
  test("draws nothing for a frameless table, so a settings card can own the border", () => {
    expect(getFrameClassName("none")).toBe("");
  });

  test("clips on the same element that rounds, so row fills do not square off the corners", () => {
    const frame = getFrameClassName("card");

    expect(frame).toContain("overflow-hidden");
    expect(frame).toContain("rounded-xl");
    expect(frame).toContain("border-slate-200");
  });
});

describe("getHeaderCellClassName", () => {
  test("carries the width, because the header cell is what sizes the whole column", () => {
    expect(getHeaderCellClassName(column({ width: "w-[22%]" }))).toBe("w-[22%]");
  });

  test("is empty when the column asks for nothing, leaving the primitive's defaults intact", () => {
    expect(getHeaderCellClassName(column())).toBe("");
  });

  test.each([
    ["left", "text-left"],
    ["center", "text-center"],
    ["right", "text-right"],
  ] as const)("maps align %s", (align, expected) => {
    expect(getHeaderCellClassName(column({ align }))).toBe(expected);
  });

  test.each([
    ["sm", "hidden sm:table-cell"],
    ["md", "hidden md:table-cell"],
    ["lg", "hidden lg:table-cell"],
  ] as const)("hides below %s with table-cell, not block, so the column layout survives", (bp, expected) => {
    expect(getHeaderCellClassName(column({ hideBelow: bp }))).toBe(expected);
  });

  test("ignores cellClassName — that is for body cells only", () => {
    expect(getHeaderCellClassName(column({ cellClassName: "font-medium text-slate-900" }))).toBe("");
  });
});

describe("getBodyCellClassName", () => {
  test("omits the width, so only the header sizes the column", () => {
    expect(getBodyCellClassName(column({ width: "w-[22%]" }))).toBe("");
  });

  test("repeats align and hideBelow, which have to match the header cell to stay aligned", () => {
    expect(getBodyCellClassName(column({ align: "right", hideBelow: "sm" }))).toBe(
      "text-right hidden sm:table-cell"
    );
  });

  test("appends cellClassName last so a column can override the alignment it just set", () => {
    // twMerge drops the losing `text-center` and keeps the input order of what survives.
    expect(getBodyCellClassName(column({ align: "center", cellClassName: "text-left font-medium" }))).toBe(
      "text-left font-medium"
    );
  });
});

describe("getRowActivatorColumnId", () => {
  test("picks the first column, which is where a row's identifying content lives", () => {
    expect(getRowActivatorColumnId([column({ id: "name" }), column({ id: "role" })])).toBe("name");
  });

  test("skips a leading stopRowClick column, so a checkbox never becomes the row's activator", () => {
    expect(
      getRowActivatorColumnId([column({ id: "select", stopRowClick: true }), column({ id: "name" })])
    ).toBe("name");
  });

  test("returns undefined when every column opts out, leaving the row without an activator", () => {
    expect(getRowActivatorColumnId([column({ id: "actions", stopRowClick: true })])).toBeUndefined();
  });

  test("returns undefined for no columns rather than throwing", () => {
    expect(getRowActivatorColumnId([])).toBeUndefined();
  });
});
