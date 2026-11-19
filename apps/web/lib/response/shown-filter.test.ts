import { describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { buildShownFilterClauses } from "./shown-filter";

// A draft or migrated block can be stored without `elements` (ENG-2497).
const survey = {
  blocks: [
    { id: "legacy", name: "Legacy block" },
    { id: "blk", name: "Block", elements: [{ id: "q1", type: "openText", headline: { default: "Q" } }] },
  ],
} as unknown as TSurvey;

describe("buildShownFilterClauses with a block that has no elements array", () => {
  test("still builds the clause for an element of another block", () => {
    const spend = vi.fn();
    const clauses = buildShownFilterClauses(
      survey,
      [{ target: "element", elementId: "q1", op: "notShown" }],
      spend
    );

    expect(clauses).toHaveLength(1);
    expect(spend).toHaveBeenCalledTimes(1);
  });

  test("ignores a block target on the elements-less block, as for a target the survey does not hold", () => {
    const spend = vi.fn();
    const clauses = buildShownFilterClauses(
      survey,
      [{ target: "block", blockId: "legacy", op: "shown" }],
      spend
    );

    expect(clauses).toEqual([]);
    expect(spend).not.toHaveBeenCalled();
  });
});
