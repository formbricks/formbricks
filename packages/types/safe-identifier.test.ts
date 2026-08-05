import { describe, expect, test } from "vitest";
import {
  formatSnakeCaseToTitleCase,
  isLegacyFieldIdentifier,
  isLegacyVariableName,
  isSafeIdentifier,
  matchDeclaredFieldName,
  toSafeIdentifier,
} from "./safe-identifier";

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

  describe("formatSnakeCaseToTitleCase", () => {
    test("capitalizes each underscore-separated word", () => {
      expect(formatSnakeCaseToTitleCase("job_description")).toBe("Job Description");
      expect(formatSnakeCaseToTitleCase("api_key")).toBe("Api Key");
      expect(formatSnakeCaseToTitleCase("signup_date")).toBe("Signup Date");
    });

    test("leaves single words and already capitalized input readable", () => {
      expect(formatSnakeCaseToTitleCase("email")).toBe("Email");
      expect(formatSnakeCaseToTitleCase("userId")).toBe("UserId");
    });

    test("returns an empty string for empty input", () => {
      expect(formatSnakeCaseToTitleCase("")).toBe("");
    });

    // `isSafeIdentifier` accepts repeated and trailing underscores, so `a__b` is a contact attribute
    // key the create-attribute modal will happily accept. Leading underscores only arrive from the
    // unvalidated upsert paths. Either way the derived label must not carry the gaps.
    test("does not render stray spaces for repeated, leading or trailing underscores", () => {
      expect(formatSnakeCaseToTitleCase("a__b")).toBe("A B");
      expect(formatSnakeCaseToTitleCase("job___description")).toBe("Job Description");
      expect(formatSnakeCaseToTitleCase("api_key_")).toBe("Api Key");
      expect(formatSnakeCaseToTitleCase("_legacy")).toBe("Legacy");
      expect(formatSnakeCaseToTitleCase("_")).toBe("");
    });
  });

  describe("isLegacyFieldIdentifier", () => {
    test("accepts the legacy caps and hyphen names already stored on surveys", () => {
      expect(isLegacyFieldIdentifier("Legacy-Field_1")).toBe(true);
      expect(isLegacyFieldIdentifier("UserID")).toBe(true);
      expect(isLegacyFieldIdentifier("email")).toBe(true);
      expect(isLegacyFieldIdentifier("123")).toBe(true);
    });

    test("rejects spaces, empty strings and other punctuation", () => {
      expect(isLegacyFieldIdentifier("user name")).toBe(false);
      expect(isLegacyFieldIdentifier("")).toBe(false);
      expect(isLegacyFieldIdentifier("user:name")).toBe(false);
      expect(isLegacyFieldIdentifier("email@domain")).toBe(false);
    });
  });

  describe("isLegacyVariableName", () => {
    test("accepts legacy names that isSafeIdentifier rejects", () => {
      expect(isLegacyVariableName("_foo")).toBe(true);
      expect(isLegacyVariableName("1foo")).toBe(true);
      expect(isSafeIdentifier("_foo")).toBe(false);
      expect(isSafeIdentifier("1foo")).toBe(false);
    });

    test("accepts plain lowercase names", () => {
      expect(isLegacyVariableName("score")).toBe(true);
      expect(isLegacyVariableName("total_price_2")).toBe(true);
    });

    test("rejects uppercase letters and hyphens", () => {
      expect(isLegacyVariableName("Score")).toBe(false);
      expect(isLegacyVariableName("total_Price")).toBe(false);
      expect(isLegacyVariableName("total-price")).toBe(false);
      expect(isLegacyVariableName("")).toBe(false);
    });
  });

  describe("matchDeclaredFieldName", () => {
    test("prefers an exact match over a case-insensitive one", () => {
      expect(matchDeclaredFieldName(["UserID", "userid"], "userid")).toBe("userid");
      expect(matchDeclaredFieldName(["userid", "UserID"], "UserID")).toBe("UserID");
    });

    test("falls back to a case-insensitive match and returns the declared spelling", () => {
      expect(matchDeclaredFieldName(["UserID"], "userid")).toBe("UserID");
      expect(matchDeclaredFieldName(["Legacy-Field_1"], "legacy-field_1")).toBe("Legacy-Field_1");
      expect(matchDeclaredFieldName(["email"], "EMAIL")).toBe("email");
    });

    test("breaks case-insensitive ties by declared order", () => {
      expect(matchDeclaredFieldName(["UserId", "USERID"], "userid")).toBe("UserId");
      expect(matchDeclaredFieldName(["USERID", "UserId"], "userid")).toBe("USERID");
    });

    test("returns undefined when nothing matches", () => {
      expect(matchDeclaredFieldName(["email", "UserID"], "phone")).toBeUndefined();
      expect(matchDeclaredFieldName([], "email")).toBeUndefined();
    });
  });
});
