import { describe, expect, test } from "vitest";
import { initialCardStack, moveCardStack } from "./card-stack";

describe("moveCardStack: the stacked cards as the survey moves", () => {
  test("forward, the current card goes behind and onto the visited stack", () => {
    expect(moveCardStack(initialCardStack(0), 2)).toEqual({
      prevBlockIdx: 0,
      currentBlockIdx: 2,
      nextBlockIdx: 3,
      visitedBlocks: [0],
    });
  });

  test("back, the card behind is the block visited before the one returned to", () => {
    // Visited 0, 2, then 5; Back from 7 lands on 5.
    const at7 = { prevBlockIdx: 5, currentBlockIdx: 7, nextBlockIdx: 8, visitedBlocks: [0, 2, 5] };
    expect(moveCardStack(at7, 5)).toEqual({
      prevBlockIdx: 2,
      currentBlockIdx: 5,
      nextBlockIdx: 7,
      visitedBlocks: [0, 2],
    });
  });

  test("back on the first block, the slot behind is the one before it, not the first block again", () => {
    // Clamped to 0 it equalled the current card, and two cards rendered with the key 0.
    const stack = moveCardStack(moveCardStack(initialCardStack(0), 1), 0);
    expect(stack).toEqual(initialCardStack(0));
    expect(new Set([stack.prevBlockIdx, stack.currentBlockIdx, stack.nextBlockIdx]).size).toBe(3);
  });

  test("back on the welcome card (-1), the slot behind does not collide with the next card (0)", () => {
    const stack = moveCardStack(moveCardStack(initialCardStack(-1), 0), -1);
    expect(stack).toEqual(initialCardStack(-1));
    expect(stack.prevBlockIdx).toBe(-2);
  });

  test("a reset that jumps back several blocks leaves only earlier blocks behind", () => {
    // Visit 0, 1 and 2, then change the card arrangement: the survey resets to block 0. Popping only the
    // top (1) left 0 as both the card behind and the current card, two cards with the key 0.
    const at2 = moveCardStack(moveCardStack(initialCardStack(0), 1), 2);
    expect(moveCardStack(at2, 0)).toEqual({
      prevBlockIdx: -1,
      currentBlockIdx: 0,
      nextBlockIdx: 2,
      visitedBlocks: [],
    });
  });

  test("back to a block never visited keeps every earlier visited block, the last one behind", () => {
    // Visited 0 and 2, now on 7; a jump back to 3 (never visited) keeps both.
    const at7 = { prevBlockIdx: 2, currentBlockIdx: 7, nextBlockIdx: 8, visitedBlocks: [0, 2] };
    expect(moveCardStack(at7, 3)).toEqual({
      prevBlockIdx: 2,
      currentBlockIdx: 3,
      nextBlockIdx: 7,
      visitedBlocks: [0, 2],
    });
  });

  test("the same block leaves the stack as it is, and keeps it, so nothing re-renders", () => {
    const stack = initialCardStack(3);
    const moved = moveCardStack(stack, 3);
    expect(moved).toEqual({ prevBlockIdx: 2, currentBlockIdx: 3, nextBlockIdx: 4, visitedBlocks: [] });
    expect(moved).toBe(stack);
  });
});
