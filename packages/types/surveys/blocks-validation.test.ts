import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "./blocks";
import { findBlocksWithCyclicLogic } from "./blocks-validation";

const block = (id: string, jumps: string[] = [], logicFallback?: string): TSurveyBlock =>
  ({
    id,
    name: id,
    elements: [],
    logic: jumps.map((target, index) => ({
      id: `${id}-rule-${String(index)}`,
      conditions: { id: `${id}-group-${String(index)}`, connector: "and", conditions: [] },
      actions: [{ id: `${id}-action-${String(index)}`, objective: "jumpToBlock", target }],
    })),
    logicFallback,
  }) as unknown as TSurveyBlock;

describe("findBlocksWithCyclicLogic", () => {
  test("finds no cycle in blocks that only move forward or end", () => {
    expect(findBlocksWithCyclicLogic([block("a", ["c"]), block("b"), block("c", ["ending"])])).toEqual([]);
  });

  test("finds the blocks on a jump back", () => {
    expect(findBlocksWithCyclicLogic([block("a"), block("b"), block("c", ["a"])])).toEqual(["c", "b", "a"]);
  });

  test("finds the blocks on a fallback back", () => {
    expect(findBlocksWithCyclicLogic([block("a"), block("b", [], "a")])).toEqual(["b", "a"]);
  });

  test("skips a jump or fallback to an ending card", () => {
    expect(findBlocksWithCyclicLogic([block("a", ["ending"], "ending"), block("b")])).toEqual([]);
  });

  test("finds a block that jumps to itself", () => {
    expect(findBlocksWithCyclicLogic([block("a", ["a"]), block("b")])).toEqual(["a"]);
  });
});
