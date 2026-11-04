import { describe, expect, test } from "vitest";
import { expandBlock, getBlockToggle, getRuleToReveal, toggleBlock } from "./flow-open-state";

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

describe("which flagged rule a save opens on the Flow tab", () => {
  const ruleIds = ["start-rule", "block1-rule", "block2-rule"];

  test("the rule the toast names: the first one this pass flagged, not the first in outline order", () => {
    // The menu bar lists this pass's flags first, in the order of the schema's issues.
    expect(getRuleToReveal(["block1-rule", "start-rule"], null, ruleIds)).toBe("block1-rule");
  });

  test("flags that aren't rules (a question, an ending) are passed over", () => {
    expect(getRuleToReveal(["question-1", "block2-rule"], null, ruleIds)).toBe("block2-rule");
  });

  test("nothing flagged, or no rule among the flags: nothing opens", () => {
    expect(getRuleToReveal(null, null, ruleIds)).toBeUndefined();
    expect(getRuleToReveal([], ["block1-rule"], ruleIds)).toBeUndefined();
    expect(getRuleToReveal(["question-1"], null, ruleIds)).toBeUndefined();
  });

  test("the same pass seen again (the tab mounting again) doesn't move the open row", () => {
    const pass = ["block1-rule"];
    expect(getRuleToReveal(pass, pass, ruleIds)).toBeUndefined();
  });

  test("a fixed rule cleared from the flags doesn't move the open row elsewhere", () => {
    expect(getRuleToReveal(["block2-rule"], ["block1-rule", "block2-rule"], ruleIds)).toBeUndefined();
  });

  test("saving again with the same rule still flagged opens it again", () => {
    expect(getRuleToReveal(["block1-rule"], ["block1-rule"], ruleIds)).toBe("block1-rule");
  });
});

describe("opening a block", () => {
  test("adds it to the open blocks, and keeps the same set when it is open already", () => {
    const open = new Set(["b1"]);
    expect(expandBlock(open, "b1")).toBe(open);
    expect([...expandBlock(open, "b2")]).toEqual(["b1", "b2"]);
  });
});
