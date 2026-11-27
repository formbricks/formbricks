import { describe, expect, test } from "vitest";
import { ZStoredText } from "./stored-text";

describe("ZStoredText", () => {
  test("takes text up to the cap", () => {
    expect(ZStoredText(5).safeParse("hello").success).toBe(true);
  });

  test("refuses text over the cap", () => {
    expect(ZStoredText(5).safeParse("hello!").success).toBe(false);
  });

  test("refuses a NUL character Postgres can't store, wherever it is", () => {
    const result = ZStoredText(50).safeParse("before\u0000after");

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Must not contain NUL characters");
  });
});
