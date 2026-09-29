import { describe, expect, test } from "vitest";
import {
  END_BLOCK_ID,
  START_BLOCK_ID,
  getForwardTargetFromOffBlockId,
  getPreviousBlockId,
  getRestorableHistory,
  isFinishedBlockId,
} from "./survey-navigation";

const survey = {
  blocks: [{ id: "block-1" }, { id: "block-2" }, { id: "block-3" }],
  endings: [{ id: "ending-1" }, { id: "ending-2" }],
};

const surveyWithoutEndings = { blocks: [{ id: "block-1" }], endings: [] };

describe("isFinishedBlockId", () => {
  test("treats every ending card as a finished position", () => {
    expect(isFinishedBlockId(survey, "ending-1")).toBe(true);
    expect(isFinishedBlockId(survey, "ending-2")).toBe(true);
  });

  test("treats the 'end' sentinel as finished, for a survey that defines no endings", () => {
    expect(isFinishedBlockId(surveyWithoutEndings, END_BLOCK_ID)).toBe(true);
  });

  test("a block, the welcome card, and a stale id are not finished positions", () => {
    expect(isFinishedBlockId(survey, "block-1")).toBe(false);
    expect(isFinishedBlockId(survey, START_BLOCK_ID)).toBe(false);
    expect(isFinishedBlockId(survey, "deleted-block")).toBe(false);
  });
});

describe("getForwardTargetFromOffBlockId", () => {
  test("keeps the ending already on screen, so the persisted endingId matches it", () => {
    expect(getForwardTargetFromOffBlockId(survey, "ending-2")).toBe("ending-2");
  });

  test("returns no target for the 'end' sentinel, so the caller finishes on the first ending", () => {
    expect(getForwardTargetFromOffBlockId(survey, END_BLOCK_ID)).toBeUndefined();
  });

  test("returns no target for a block deleted since progress was saved", () => {
    expect(getForwardTargetFromOffBlockId(survey, "deleted-block")).toBeUndefined();
  });
});

describe("getPreviousBlockId", () => {
  test("returns the last visited card, which branching logic makes authoritative over array order", () => {
    // From block-3 the array order would say block-2; history says the respondent jumped from block-1.
    expect(getPreviousBlockId(survey, "block-3", ["block-1"])).toBe("block-1");
  });

  test("returns the welcome card when that is what the respondent came from", () => {
    expect(getPreviousBlockId(survey, "block-1", [START_BLOCK_ID])).toBe(START_BLOCK_ID);
  });

  test("returns the previous block by array order when there is no history", () => {
    expect(getPreviousBlockId(survey, "block-2", [])).toBe("block-1");
  });

  test("returns nothing from the first block, which has nothing before it", () => {
    expect(getPreviousBlockId(survey, "block-1", [])).toBeUndefined();
  });

  test.each([
    ["an ending card", "ending-1"],
    ["the 'end' sentinel", END_BLOCK_ID],
    ["the welcome card", START_BLOCK_ID],
    ["a block deleted since progress was saved", "deleted-block"],
  ])("returns nothing from %s with no history, rather than reading blocks[-2]", (_label, blockId) => {
    expect(getPreviousBlockId(survey, blockId, [])).toBeUndefined();
  });
});

describe("getRestorableHistory", () => {
  test("drops a block deleted since progress was saved, so Back cannot land on a blank card", () => {
    expect(getRestorableHistory(survey, [START_BLOCK_ID, "deleted-block", "block-1"])).toEqual([
      START_BLOCK_ID,
      "block-1",
    ]);
  });

  test("drops ending ids and the 'end' sentinel, which are not places to go back to", () => {
    expect(getRestorableHistory(survey, ["block-1", "ending-1", END_BLOCK_ID])).toEqual(["block-1"]);
  });
});
