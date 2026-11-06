import { describe, expect, test } from "vitest";
import { cutText } from "./cut-text";

describe("cutText", () => {
  test("leaves text within the limit as it is", () => {
    expect(cutText("abc", 3, "…")).toBe("abc");
  });

  test("cuts to the limit, the suffix included", () => {
    expect(cutText("abcdef", 4, "…")).toBe("abc…");
    expect(cutText("abcdef", 4)).toBe("abcd");
  });

  test("drops an emoji whole rather than splitting its surrogate pair", () => {
    // "ab😀" is four units; a cut at three would end on the emoji's first half.
    expect(cutText("ab😀cd", 3)).toBe("ab");
    expect(cutText("ab😀cd", 4, "…")).toBe("ab…");
  });
});
