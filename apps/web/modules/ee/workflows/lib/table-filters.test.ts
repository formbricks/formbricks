import { describe, expect, test } from "vitest";
import { setShowArchived, toWorkflowStatusIn } from "./table-filters";

describe("toWorkflowStatusIn", () => {
  test("no filter keeps the API default (archived hidden)", () => {
    expect(toWorkflowStatusIn([])).toBeUndefined();
  });

  test("passes picked statuses and narrows them with rules", () => {
    expect(
      toWorkflowStatusIn([
        { property: "status", operator: "in", values: ["draft", "enabled"] },
        { property: "status", operator: "notEquals", values: ["enabled"] },
      ])
    ).toEqual(["draft"]);
  });

  test("is null when the filters exclude every status", () => {
    expect(
      toWorkflowStatusIn([
        { property: "status", operator: "equals", values: ["draft"] },
        { property: "status", operator: "equals", values: ["enabled"] },
      ])
    ).toBeNull();
  });

  test("Show archived adds archived to the picked or to every live status", () => {
    expect(toWorkflowStatusIn(setShowArchived([], true))).toEqual([
      "draft",
      "enabled",
      "disabled",
      "archived",
    ]);
    expect(
      toWorkflowStatusIn([
        ...setShowArchived([], true),
        { property: "status", operator: "in", values: ["disabled"] },
      ])
    ).toEqual(["disabled", "archived"]);
  });
});
