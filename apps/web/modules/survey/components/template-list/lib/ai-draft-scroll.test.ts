import { describe, expect, test } from "vitest";
import {
  PIN_THRESHOLD_PX,
  getGenerationScrollAction,
  isPinnedToBottom,
  shouldFollowNewQuestions,
} from "./ai-draft-scroll";

describe("getGenerationScrollAction", () => {
  test("a new generation re-pins the list", () => {
    expect(getGenerationScrollAction(false, true)).toBe("repin");
  });

  test("a finished generation goes back to the first question", () => {
    expect(getGenerationScrollAction(true, false)).toBe("scroll_to_top");
  });

  test("no change in state asks for nothing", () => {
    expect(getGenerationScrollAction(true, true)).toBeNull();
    expect(getGenerationScrollAction(false, false)).toBeNull();
  });
});

describe("shouldFollowNewQuestions", () => {
  test("follows only while generating and pinned", () => {
    expect(shouldFollowNewQuestions(true, true)).toBe(true);
    expect(shouldFollowNewQuestions(true, false)).toBe(false);
    // A draft that lands all at once is not pulled to its end.
    expect(shouldFollowNewQuestions(false, true)).toBe(false);
  });
});

describe("isPinnedToBottom", () => {
  test("at the end counts as pinned", () => {
    expect(isPinnedToBottom({ scrollHeight: 1000, scrollTop: 800, clientHeight: 200 })).toBe(true);
  });

  test("just inside the threshold counts as pinned, at it does not", () => {
    const base = { scrollHeight: 1000, clientHeight: 200 };
    expect(isPinnedToBottom({ ...base, scrollTop: 800 - PIN_THRESHOLD_PX + 1 })).toBe(true);
    expect(isPinnedToBottom({ ...base, scrollTop: 800 - PIN_THRESHOLD_PX })).toBe(false);
  });

  test("scrolled to the top is not pinned", () => {
    expect(isPinnedToBottom({ scrollHeight: 1000, scrollTop: 0, clientHeight: 200 })).toBe(false);
  });
});
