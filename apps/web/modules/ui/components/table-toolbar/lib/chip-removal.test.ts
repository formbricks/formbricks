import { describe, expect, test } from "vitest";
import { getChipRemoval } from "./chip-removal";

describe("getChipRemoval (ENG-7372)", () => {
  test("a chip locked for the reader never offers ×, whatever handler it is given", () => {
    expect(getChipRemoval({ hasRemoveHandler: true, isLocked: true, lockedFor: "you" })).toBe("none");
  });

  test("a chip locked for everyone keeps its × as an unlock for whoever may unlock it", () => {
    expect(getChipRemoval({ hasRemoveHandler: true, isLocked: true })).toBe("unlock");
    expect(getChipRemoval({ hasRemoveHandler: false, isLocked: true })).toBe("none");
  });

  test("an unlocked chip removes, and one without a handler shows no ×", () => {
    expect(getChipRemoval({ hasRemoveHandler: true, isLocked: false })).toBe("remove");
    expect(getChipRemoval({ hasRemoveHandler: false, isLocked: false })).toBe("none");
  });
});
