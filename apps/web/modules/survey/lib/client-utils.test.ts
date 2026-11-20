import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { getElementsFromBlocks } from "./client-utils";

describe("getElementsFromBlocks", () => {
  test("returns no elements for a survey without blocks", () => {
    expect(getElementsFromBlocks(undefined)).toEqual([]);
  });

  // A draft saved through `updateSurveyDraftAction`, or a block written by the raw-SQL questions →
  // blocks migration, can lack `elements`: neither path validates a block's shape (ENG-2497).
  test("skips a block with no elements array instead of returning undefined entries", () => {
    const element = { id: "q1", type: "openText" } as unknown as TSurveyElement;
    const blocks = [
      { id: "b1", name: "Block 1" },
      { id: "b2", name: "Block 2", elements: [element] },
    ] as unknown as TSurveyBlock[];

    expect(getElementsFromBlocks(blocks)).toEqual([element]);
  });
});
