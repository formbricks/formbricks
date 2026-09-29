import { describe, expect, test } from "vitest";
import {
  ensureSpecialChoicesOrder,
  getShuffleOptionAfterAddingSpecialChoice,
  getShuffleOptionAfterRemovingSpecialChoice,
} from "./special-choices";

const choice = (id: string) => ({ id, label: { default: id } });

describe("ensureSpecialChoicesOrder", () => {
  test("moves Other and None after the regular choices, Other first", () => {
    const ordered = ensureSpecialChoicesOrder([choice("none"), choice("a"), choice("other"), choice("b")]);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b", "other", "none"]);
  });

  test("keeps a new choice inserted after Other ahead of it", () => {
    const ordered = ensureSpecialChoicesOrder([choice("a"), choice("other"), choice("new")]);
    expect(ordered.map((c) => c.id)).toEqual(["a", "new", "other"]);
  });

  test("leaves choices without special ones untouched", () => {
    expect(ensureSpecialChoicesOrder([choice("b"), choice("a")]).map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("getShuffleOptionAfterAddingSpecialChoice", () => {
  test.each([
    ["all", "exceptLast"],
    ["reverseOrderOccasionally", "reverseOrderExceptLast"],
  ] as const)("switches %s to %s", (current, expected) => {
    expect(getShuffleOptionAfterAddingSpecialChoice(current)).toBe(expected);
  });

  test.each(["none", "exceptLast", "reverseOrderExceptLast", undefined] as const)("keeps %s", (current) => {
    expect(getShuffleOptionAfterAddingSpecialChoice(current)).toBeUndefined();
  });
});

describe("getShuffleOptionAfterRemovingSpecialChoice", () => {
  test.each([
    ["exceptLast", "all"],
    ["reverseOrderExceptLast", "reverseOrderOccasionally"],
  ] as const)("switches %s back to %s once no special choice remains", (current, expected) => {
    expect(getShuffleOptionAfterRemovingSpecialChoice(current, [choice("a")])).toBe(expected);
  });

  test("keeps the mode while another special choice remains", () => {
    expect(getShuffleOptionAfterRemovingSpecialChoice("exceptLast", [choice("a"), choice("none")])).toBe(
      undefined
    );
  });

  test("keeps modes that never depended on a special choice", () => {
    expect(getShuffleOptionAfterRemovingSpecialChoice("none", [choice("a")])).toBeUndefined();
  });
});
