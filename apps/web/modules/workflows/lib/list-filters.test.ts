import { describe, expect, test } from "vitest";
import { ZWorkflowStatus } from "@formbricks/workflows";
import { computeStatusIn } from "./list-filters";

describe("computeStatusIn", () => {
  test("filter empty + toggle OFF -> undefined (API default excludes archived)", () => {
    expect(computeStatusIn([], false)).toBeUndefined();
  });

  test("filter empty + toggle ON -> all four statuses including archived", () => {
    expect(computeStatusIn([], true)).toEqual([...ZWorkflowStatus.options]);
    expect(computeStatusIn([], true)).toContain("archived");
  });

  test("filter non-empty + toggle OFF -> the selected statuses only", () => {
    expect(computeStatusIn(["draft", "disabled"], false)).toEqual(["draft", "disabled"]);
  });

  test("filter non-empty + toggle ON -> selected statuses plus archived", () => {
    expect(computeStatusIn(["enabled"], true)).toEqual(["enabled", "archived"]);
  });
});
