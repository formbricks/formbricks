import { describe, expect, test } from "vitest";
import { isSafeIdentifier } from "./safe-identifier";

describe("safe-identifier", () => {
  describe("isSafeIdentifier", () => {
    test("returns true for valid identifiers starting with lowercase letter", () => {
      expect(isSafeIdentifier("email")).toBe(true);
      expect(isSafeIdentifier("user_name")).toBe(true);
      expect(isSafeIdentifier("attr123")).toBe(true);
      expect(isSafeIdentifier("test_key_123")).toBe(true);
    });

    test("returns false for identifiers starting with uppercase letter", () => {
      expect(isSafeIdentifier("Email")).toBe(false);
      expect(isSafeIdentifier("User_Name")).toBe(false);
    });

    test("returns false for identifiers starting with number", () => {
      expect(isSafeIdentifier("123attr")).toBe(false);
      expect(isSafeIdentifier("01region")).toBe(false);
    });

    test("returns false for identifiers with invalid characters", () => {
      expect(isSafeIdentifier("email-address")).toBe(false);
      expect(isSafeIdentifier("user:name")).toBe(false);
      expect(isSafeIdentifier("user name")).toBe(false);
      expect(isSafeIdentifier("user(name)")).toBe(false);
      expect(isSafeIdentifier("email@domain")).toBe(false);
    });

    test("returns false for empty string", () => {
      expect(isSafeIdentifier("")).toBe(false);
    });
  });
});
