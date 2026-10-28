import { describe, expect, test } from "vitest";
import { getPasswordRules, isPasswordAcceptable } from "./password-rules";

describe("getPasswordRules", () => {
  test("reports every rule as open for an empty password", () => {
    expect(getPasswordRules("")).toEqual({ length: false, uppercase: false, number: false });
  });

  test("tracks the length, uppercase and number rules independently", () => {
    expect(getPasswordRules("abcdefgh")).toEqual({ length: true, uppercase: false, number: false });
    expect(getPasswordRules("Ab1")).toEqual({ length: false, uppercase: true, number: true });
  });

  test("treats 128 characters as the longest accepted password", () => {
    expect(getPasswordRules("A1".repeat(64)).length).toBe(true);
    expect(getPasswordRules(`${"A1".repeat(64)}x`).length).toBe(false);
  });

  test("agrees with ZUserPassword on whether a password is acceptable", () => {
    for (const password of [
      "",
      "abcdefgh",
      "Abcdefgh",
      "abcdefg1",
      "Abcdefg1",
      "ABCDEFG1",
      "A1".repeat(65),
    ]) {
      const rules = getPasswordRules(password);
      expect(Object.values(rules).every(Boolean)).toBe(isPasswordAcceptable(password));
    }
  });
});
