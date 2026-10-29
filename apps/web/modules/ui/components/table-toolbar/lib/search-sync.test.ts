import { describe, expect, test } from "vitest";
import { isSameSearch } from "./search-sync";

describe("isSameSearch", () => {
  test("a trailing space the URL trimmed away is not an outside change", () => {
    expect(isSameSearch("user1 ", "user1")).toBe(true);
    expect(isSameSearch("  user1", "user1")).toBe(true);
  });

  test("a different value is an outside change", () => {
    expect(isSameSearch("user1 ", "")).toBe(false);
    expect(isSameSearch("user1", "user2")).toBe(false);
  });
});
