import { describe, expect, test } from "vitest";
import {
  type TExportColumnGroup,
  excludedForRequest,
  groupState,
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
    const off = toggleGroup(groups, [], "tags", false);
    expect(off).toEqual(["tags"]);
    expect(toggleGroup(groups, off, "tags", true)).toEqual([]);
    expect(toggleGroup(groups, off, "tags", false)).toEqual(["tags"]);
  });

  test("the request leaves out ids the current list does not have", () => {
    expect(excludedForRequest(groups, ["tags", "q:gone"])).toEqual(["tags"]);
  });
});

describe("Include columns with options", () => {
  const withOptions: TExportColumnGroup[] = [
    { id: "no", label: "no." },
    { id: "q:m", label: "q2 · Which fruit?" },
    { id: "c:q2_1", label: "q2_1 · Apple", parentId: "q:m" },
    { id: "c:q2_2", label: "q2_2 · Pear", parentId: "q:m" },
  ];

  test("a question with options is on, a dash or off by what is under it", () => {
    const question = withOptions[1];
    expect(groupState(withOptions, [], question)).toBe(true);
    expect(groupState(withOptions, ["c:q2_1"], question)).toBe("indeterminate");
    expect(groupState(withOptions, ["c:q2_1", "c:q2_2"], question)).toBe(false);
    expect(groupState(withOptions, ["q:m"], question)).toBe(false);
    expect(groupState(withOptions, ["q:m"], withOptions[2])).toBe(false);
  });

  test("the question itself is not a column: Select all and the empty check count the options", () => {
    expect(selectedGroups(withOptions, []).map((group) => group.id)).toEqual(["no", "c:q2_1", "c:q2_2"]);
    expect(selectAllState(withOptions, ["c:q2_1"])).toBe("indeterminate");
    expect(hasNoColumnSelected(withOptions, ["no", "c:q2_1", "c:q2_2"])).toBe(true);
    expect(hasNoColumnSelected(withOptions, ["no", "q:m"])).toBe(true);
  });

  test("switching the question off takes its options with it, and on clears them", () => {
    expect(toggleGroup(withOptions, ["c:q2_1"], "q:m", false)).toEqual(["q:m"]);
    expect(toggleGroup(withOptions, ["c:q2_1"], "q:m", true)).toEqual([]);
  });

  test("an option ticked under a question that is off brings the question back with only that option", () => {
    expect(toggleGroup(withOptions, ["q:m"], "c:q2_2", true)).toEqual(["c:q2_1"]);
    expect(toggleGroup(withOptions, [], "c:q2_2", false)).toEqual(["c:q2_2"]);
    expect(toggleGroup(withOptions, ["c:q2_2"], "c:q2_2", true)).toEqual([]);
  });
});
