import { describe, expect, test } from "vitest";
import { getArrangementResetBlockId } from "./card-arrangement-reset";

const survey = (welcomeEnabled: boolean) => ({
  welcomeCard: { enabled: welcomeEnabled },
  blocks: [{ id: "block-1" }, { id: "block-2" }],
});

describe("getArrangementResetBlockId: where the stacked cards restart the survey", () => {
  test("nothing on the first render: the survey opens where its start (and its start logic) put it", () => {
    expect(getArrangementResetBlockId(undefined, "straight", survey(false))).toBeNull();
    expect(getArrangementResetBlockId(undefined, "simple", survey(true))).toBeNull();
  });

  test("nothing while the arrangement stays the same", () => {
    expect(getArrangementResetBlockId("straight", "straight", survey(false))).toBeNull();
  });

  test("back to the welcome card, or the first block, when the arrangement changes", () => {
    expect(getArrangementResetBlockId("straight", "casual", survey(true))).toBe("start");
    expect(getArrangementResetBlockId("straight", "casual", survey(false))).toBe("block-1");
  });
});
