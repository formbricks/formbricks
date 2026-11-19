import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  getRunFilterProperties,
  isShowingTestRuns,
  setHideTestRuns,
  toRunListFilters,
} from "./run-table-filters";

const t = ((key: string) => key) as unknown as TFunction;

describe("runs table filters", () => {
  test("only the workspace list filters by trigger, and test runs are a hidden gear setting", () => {
    expect(getRunFilterProperties(t, { withTrigger: false }).map((property) => property.id)).toEqual([
      "status",
      "testRuns",
    ]);
    expect(getRunFilterProperties(t, { withTrigger: true }).map((property) => property.id)).toEqual([
      "status",
      "triggerType",
      "testRuns",
    ]);
  });

  test("hides test runs until the gear switches Hide test runs off", () => {
    expect(toRunListFilters([], { workflowId: "wf_1" })).toEqual({ workflowId: "wf_1", isDryRun: false });

    const shown = setHideTestRuns([], false);
    expect(isShowingTestRuns(shown)).toBe(true);
    expect(toRunListFilters(shown, { workflowId: "wf_1" })).toEqual({ workflowId: "wf_1" });
    expect(setHideTestRuns(shown, true)).toEqual([]);
  });

  test("Status and Trigger filters become the API's statusIn and triggerTypeIn", () => {
    expect(
      toRunListFilters([
        { property: "status", operator: "in", values: ["failed"] },
        { property: "triggerType", operator: "in", values: ["webhook"] },
      ])
    ).toEqual({ statusIn: ["failed"], triggerTypeIn: ["webhook"], isDryRun: false });
  });

  test("filters that exclude every status can match nothing", () => {
    expect(
      toRunListFilters([
        { property: "status", operator: "in", values: ["failed"] },
        { property: "status", operator: "in", values: ["completed"] },
      ])
    ).toBeNull();
  });
});
