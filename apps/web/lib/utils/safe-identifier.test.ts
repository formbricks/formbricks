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
    test("normalizes free-form labels into safe identifiers", () => {
      expect(toSafeIdentifier("Date of Birth")).toBe("date_of_birth");
      expect(toSafeIdentifier("Customer-ID")).toBe("customer_id");
      expect(toSafeIdentifier("  Preferred Language  ")).toBe("preferred_language");
      expect(toSafeIdentifier("city__name")).toBe("city_name");
    });

    test("strips invalid leading characters until first lowercase letter", () => {
      expect(toSafeIdentifier("123 Date")).toBe("date");
      expect(toSafeIdentifier("__name")).toBe("name");
      expect(toSafeIdentifier("99")).toBe("");
    });

    test("keeps already safe identifiers unchanged", () => {
      expect(toSafeIdentifier("country_code")).toBe("country_code");
    });
  });
});
