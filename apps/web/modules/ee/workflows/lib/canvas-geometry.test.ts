import { describe, expect, test } from "vitest";
import { getAppendedStepPosition, getBranchLegOffsets } from "./canvas-geometry";

describe("getBranchLegOffsets", () => {
  test("spreads empty legs one column apart, centred under the step", () => {
    expect(getBranchLegOffsets([null, null])).toEqual([-180, 180]);
    expect(getBranchLegOffsets([null, null, null])).toEqual([-360, 0, 360]);
  });

  test("puts a leg with a step right above that step, wherever it was placed", () => {
    // The demo's If/else, whose steps sit further out than one column: no sideways jog.
    expect(getBranchLegOffsets([-460, 440])).toEqual([-460, 440]);
  });

  test("keeps an empty leg one column beside its neighbour, in branch order", () => {
    // Then holds a nested If/else two columns wide; Else is empty.
    expect(getBranchLegOffsets([-360, null])).toEqual([-360, 0]);
    // Then is empty; Else holds a step.
    expect(getBranchLegOffsets([null, 180])).toEqual([-180, 180]);
    // A Switch: Gold and Default hold steps, Silver is empty between them.
    expect(getBranchLegOffsets([-360, null, 360])).toEqual([-360, 0, 360]);
    expect(getBranchLegOffsets([null, null, 0])).toEqual([-720, -360, 0]);
  });
});

describe("getAppendedStepPosition", () => {
  test("puts a step appended to a chain one row below its source", () => {
    expect(getAppendedStepPosition({ x: 220, y: 80 })).toEqual({ x: 220, y: 200 });
  });

  test("puts a branch's first step under its leg, one branch row below the fork's step", () => {
    expect(getAppendedStepPosition({ x: 220, y: 200 }, 180)).toEqual({ x: 400, y: 400 });
    expect(getAppendedStepPosition({ x: 220, y: 200 }, -360)).toEqual({ x: -140, y: 400 });
  });
});
