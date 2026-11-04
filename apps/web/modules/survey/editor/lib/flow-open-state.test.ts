import { describe, expect, test } from "vitest";
import { getBlockToggle, toggleBlock } from "./flow-open-state";

const blocks = [{ id: "b1" }, { id: "b2" }];

describe("which blocks of the Flow tab are open", () => {
  test("nothing open yet: every block starts collapsed, and the toggle expands", () => {
    expect(getBlockToggle(blocks, new Set())).toBe("expand");
  });

  test("the toggle expands while any block is collapsed", () => {
    expect(getBlockToggle(blocks, new Set(["b1"]))).toBe("expand");
  });

  test("the toggle collapses once every block is open", () => {
    expect(getBlockToggle(blocks, new Set(["b1", "b2"]))).toBe("collapse");
  });

  test("a deleted block left in the open set doesn't count as an open block", () => {
    expect(getBlockToggle(blocks, new Set(["b1", "gone"]))).toBe("expand");
  });

  test("a block added later starts collapsed", () => {
    expect(getBlockToggle([...blocks, { id: "b3" }], new Set(["b1", "b2"]))).toBe("expand");
  });

  test("toggling a block opens it, and toggling it again closes it, leaving its input alone", () => {
    const none = new Set<string>();
    const opened = toggleBlock(none, "b1");
    expect([...opened]).toEqual(["b1"]);
    expect(none.size).toBe(0);
    expect([...toggleBlock(opened, "b1")]).toEqual([]);
  });
});
