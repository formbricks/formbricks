import { describe, expect, test } from "vitest";
import type { TSettingsTableColumn } from "../types";
import {
  getBodyCellClassName,
  getFrameClassName,
  getHeaderCellClassName,
  getRowActivatorColumnId,
  isRowActivatable,
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
  // The settings header type lives here rather than on the shared `TableHead`: a class on the `th` beats
  // the colour a `<thead>` passes down, so putting it in the primitive would lighten every bare
  // `TableHead` in the app — including contacts, attributes and survey responses.
  test("sets the settings header type itself instead of relying on the shared primitive", () => {
    expect(getHeaderCellClassName(column())).toBe("font-medium text-slate-500");
  });

  test("merges headerClassName, which is where a column's width belongs", () => {
    expect(getHeaderCellClassName(column({ headerClassName: "w-[22%]" }))).toBe(
      "font-medium text-slate-500 w-[22%]"
    );
  });

  test("merges headerClassName last, so a column can override the alignment it asked for", () => {
    expect(getHeaderCellClassName(column({ align: "center", headerClassName: "text-right" }))).toBe(
      "font-medium text-slate-500 text-right"
    );
  });

  test.each([
    ["left", "text-left"],
    ["center", "text-center"],
    ["right", "text-right"],
  ] as const)("maps align %s", (align, expected) => {
    expect(getHeaderCellClassName(column({ align }))).toBe(`font-medium text-slate-500 ${expected}`);
  });

  test.each([
    ["sm", "hidden sm:table-cell"],
    ["md", "hidden md:table-cell"],
    ["lg", "hidden lg:table-cell"],
  ] as const)("hides below %s with table-cell, not block, so the column layout survives", (bp, expected) => {
    expect(getHeaderCellClassName(column({ hideBelow: bp }))).toBe(`font-medium text-slate-500 ${expected}`);
  });

  test("ignores cellClassName — that is for body cells only", () => {
    expect(getHeaderCellClassName(column({ cellClassName: "font-medium text-slate-900" }))).toBe(
      "font-medium text-slate-500"
    );
  });
});

describe("getBodyCellClassName", () => {
  test("ignores headerClassName — a width there must not leak onto every cell", () => {
    expect(getBodyCellClassName(column({ headerClassName: "w-[22%]" }))).toBe("");
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

describe("isRowActivatable", () => {
  test("activates a row that has a handler and is not disabled", () => {
    expect(isRowActivatable({ isDisabled: false, hasRowClick: true })).toBe(true);
  });

  // The regression this guards: `pointer-events-none` on a disabled row stops the mouse but leaves the
  // activator button focusable, so Enter or Space would still fire the row's handler.
  test("refuses a disabled row, so it gets neither a handler nor a focusable activator", () => {
    expect(isRowActivatable({ isDisabled: true, hasRowClick: true })).toBe(false);
  });

  test("still refuses a disabled row that the consumer calls clickable", () => {
    expect(isRowActivatable({ isDisabled: true, hasRowClick: true, isRowClickable: true })).toBe(false);
  });

  test("refuses when no handler was supplied", () => {
    expect(isRowActivatable({ isDisabled: false, hasRowClick: false })).toBe(false);
  });

  test("honours a per-row opt-out", () => {
    expect(isRowActivatable({ isDisabled: false, hasRowClick: true, isRowClickable: false })).toBe(false);
  });

  test("treats an absent per-row predicate as clickable, so the common case needs no opt-in", () => {
    expect(isRowActivatable({ isDisabled: false, hasRowClick: true, isRowClickable: undefined })).toBe(true);
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
