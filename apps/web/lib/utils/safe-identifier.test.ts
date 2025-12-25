import { describe, expect, test } from "vitest";
import { isSafeIdentifier, toSafeIdentifier } from "./safe-identifier";

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

  describe("toSafeIdentifier", () => {
    test("converts valid strings to safe identifiers", () => {
      expect(toSafeIdentifier("email")).toBe("email");
      expect(toSafeIdentifier("user_name")).toBe("user_name");
    });

    test("converts spaces to underscores", () => {
      expect(toSafeIdentifier("email address")).toBe("email_address");
      expect(toSafeIdentifier("user name")).toBe("user_name");
    });

    test("converts special characters to underscores", () => {
      expect(toSafeIdentifier("user:name")).toBe("user_name");
      expect(toSafeIdentifier("user-name")).toBe("user_name");
      expect(toSafeIdentifier("user(name)")).toBe("user_name");
    });

    test("handles strings starting with numbers", () => {
      expect(toSafeIdentifier("123attr")).toBe("attr_123attr");
      expect(toSafeIdentifier("01region")).toBe("attr_01region");
    });

    test("removes accents and normalizes", () => {
      expect(toSafeIdentifier("café")).toBe("cafe");
      expect(toSafeIdentifier("naïve")).toBe("naive");
      expect(toSafeIdentifier("résumé")).toBe("resume");
    });

    test("collapses multiple underscores", () => {
      expect(toSafeIdentifier("user__name")).toBe("user_name");
      expect(toSafeIdentifier("email___address")).toBe("email_address");
    });

    test("removes leading and trailing underscores", () => {
      expect(toSafeIdentifier("_email_")).toBe("email");
      expect(toSafeIdentifier("__user__")).toBe("user");
    });

    test("handles empty string", () => {
      expect(toSafeIdentifier("")).toBe("");
    });

    test("handles strings that become empty after sanitization", () => {
      expect(toSafeIdentifier("!!!")).toBe("attr_key");
      expect(toSafeIdentifier("---")).toBe("attr_key");
    });

    test("converts to lowercase", () => {
      expect(toSafeIdentifier("Email")).toBe("email");
      expect(toSafeIdentifier("USER_NAME")).toBe("user_name");
      expect(toSafeIdentifier("TestKey123")).toBe("testkey123");
    });
  });
});

