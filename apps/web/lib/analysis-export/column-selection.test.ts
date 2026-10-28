import { describe, expect, test } from "vitest";
import {
  type TExportColumnGroup,
  excludedForRequest,
  hasNoColumnSelected,
  selectAllState,
  selectedGroups,
  toggleGroup,
  toggleSelectAll,
} from "./column-selection";

const groups: TExportColumnGroup[] = [
  { id: "no", label: "no." },
  { id: "tags", label: "tags" },
  { id: "q:a", label: "q1 · How?" },
];

describe("Include columns", () => {
  test("everything is on until the person switches something off", () => {
    expect(selectedGroups(groups, [])).toEqual(groups);
    expect(selectAllState(groups, [])).toBe(true);
    expect(excludedForRequest(groups, [])).toEqual([]);
  });

  test("Select all shows a dash when only some are on, and clicking it turns all on", () => {
    expect(selectAllState(groups, ["tags"])).toBe("indeterminate");
    expect(toggleSelectAll(groups, ["tags"])).toEqual([]);
  });

  test("Select all turns everything off when everything is on, and the list reads as empty", () => {
    const off = toggleSelectAll(groups, []);
    expect(off).toEqual(["no", "tags", "q:a"]);
    expect(selectAllState(groups, off)).toBe(false);
    expect(hasNoColumnSelected(groups, off)).toBe(true);
    expect(toggleSelectAll(groups, off)).toEqual([]);
  });

  test("a list that has not loaded is not an empty selection", () => {
    expect(hasNoColumnSelected([], [])).toBe(false);
  });

  test("toggling one group in and out", () => {
    const off = toggleGroup([], "tags", false);
    expect(off).toEqual(["tags"]);
    expect(toggleGroup(off, "tags", true)).toEqual([]);
    expect(toggleGroup(off, "tags", false)).toEqual(["tags"]);
  });

  test("the request leaves out ids the current list does not have", () => {
    expect(excludedForRequest(groups, ["tags", "q:gone"])).toEqual(["tags"]);
  });
});
