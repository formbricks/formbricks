import { describe, expect, test } from "vitest";
import { getStackAfterBack } from "./stacked-cards-back";

describe("getStackAfterBack: the card behind the current one after Back", () => {
  test("the block visited before the one Back returns to", () => {
    // Visited 0, 2, then 5; Back from 7 lands on 5.
    expect(getStackAfterBack([0, 2, 5], 5)).toEqual({ visitedBlocks: [0, 2], prevBlockIdx: 2 });
  });

  test("back on the first block, the previous slot is the one before it, not the first block again", () => {
    // Clamped to 0 it equalled the current card, and two cards rendered with the key 0.
    expect(getStackAfterBack([0], 0)).toEqual({ visitedBlocks: [], prevBlockIdx: -1 });
  });

  test("back on the welcome card (-1), the previous slot does not collide with the next one (0)", () => {
    expect(getStackAfterBack([], -1)).toEqual({ visitedBlocks: [], prevBlockIdx: -2 });
  });
});
