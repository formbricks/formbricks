import { describe, expect, test } from "vitest";
import {
  LINK_SURVEY_SYSTEM_PARAMS,
  RESERVED_DECLARED_FIELD_NAMES,
  TValidateIdErrorCode,
  validateId,
} from "./validation";

describe("validateId", () => {
  const noExistingIds: [string[], string[], string[], string[]] = [[], [], [], []];

  describe("lenient mode (element and question ids)", () => {
    test("accepts legacy caps and hyphen names", () => {
      expect(validateId("Legacy-Field", ...noExistingIds)).toBeNull();
      expect(validateId("Q1", ...noExistingIds)).toBeNull();
      expect(validateId("UserID", ...noExistingIds)).toBeNull();
      expect(validateId("_legacy", ...noExistingIds)).toBeNull();
      expect(validateId("1foo", ...noExistingIds)).toBeNull();
    });

    test("accepts safe identifiers too", () => {
      expect(validateId("user_name", ...noExistingIds)).toBeNull();
    });
  });

  describe("strict mode (new declared field names)", () => {
    const strict = { requireSafeIdentifier: true };

    test("rejects legacy caps and hyphen names", () => {
      expect(validateId("Legacy-Field", ...noExistingIds, strict)).toEqual({
        code: TValidateIdErrorCode.NotSafeIdentifier,
        field: "Legacy-Field",
      });
      expect(validateId("Q1", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.NotSafeIdentifier);
      // Deliberately not `UserID`: that lowercases onto a reserved name, so it is reported as
      // Reserved instead. See the reserved-name block below.
      expect(validateId("CustomerRef", ...noExistingIds, strict)?.code).toBe(
        TValidateIdErrorCode.NotSafeIdentifier
      );
    });

    test("rejects names that do not start with a lowercase letter", () => {
      expect(validateId("_legacy", ...noExistingIds, strict)?.code).toBe(
        TValidateIdErrorCode.NotSafeIdentifier
      );
      expect(validateId("1foo", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.NotSafeIdentifier);
    });

    test("accepts safe identifiers", () => {
      expect(validateId("user_name", ...noExistingIds, strict)).toBeNull();
      expect(validateId("attr123", ...noExistingIds, strict)).toBeNull();
    });

    test("reports the more specific error first for characters the lenient rule also rejects", () => {
      expect(validateId("user:name", ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.InvalidChars);
    });
  });

  /**
   * A new declared field name must be refused whenever `getHiddenFieldsFromSearchParams` would refuse
   * to capture it, otherwise the editor accepts a field that can never receive a value. Both ends read
   * `RESERVED_DECLARED_FIELD_NAMES`, so these cases pin the two together.
   */
  describe("reserved names in strict mode", () => {
    const strict = { requireSafeIdentifier: true };

    test("rejects every reserved name in any casing", () => {
      for (const reserved of RESERVED_DECLARED_FIELD_NAMES) {
        for (const candidate of [reserved, reserved.toUpperCase()]) {
          expect(validateId(candidate, ...noExistingIds, strict)).toEqual({
            code: TValidateIdErrorCode.Reserved,
            field: candidate,
          });
        }
      }
    });

    test("rejects the link-survey system params the old rule let through", () => {
      for (const systemParam of LINK_SURVEY_SYSTEM_PARAMS) {
        expect(validateId(systemParam, ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("rejects the FORBIDDEN_IDS casings the old rule let through", () => {
      // Each of these passed `isSafeIdentifier` and missed the case-sensitive `FORBIDDEN_IDS` check,
      // so the editor used to accept them.
      for (const name of ["userid", "verifiedemail", "multilanguage", "welcomecard"]) {
        expect(validateId(name, ...noExistingIds, strict)?.code).toBe(TValidateIdErrorCode.Reserved);
      }
    });

    test("still accepts names that merely contain a reserved word", () => {
      expect(validateId("user_id_ref", ...noExistingIds, strict)).toBeNull();
      expect(validateId("language", ...noExistingIds, strict)).toBeNull();
      expect(validateId("verified", ...noExistingIds, strict)).toBeNull();
      expect(validateId("started_at", ...noExistingIds, strict)).toBeNull();
    });

    test("leaves the lenient path alone so element and question ids keep parsing", () => {
      // Element/question id renames must not start failing: only the exact-case FORBIDDEN_IDS entry
      // is reserved there, exactly as before this change.
      expect(validateId("userid", ...noExistingIds)).toBeNull();
      expect(validateId("lang", ...noExistingIds)).toBeNull();
      expect(validateId("startat", ...noExistingIds)).toBeNull();
      expect(validateId("WelcomeCard", ...noExistingIds)).toBeNull();
      expect(validateId("userId", ...noExistingIds)?.code).toBe(TValidateIdErrorCode.Reserved);
    });
  });

  describe("shared checks are unchanged by the mode", () => {
    for (const [label, options] of [
      ["lenient", undefined],
      ["strict", { requireSafeIdentifier: true }],
    ] as const) {
      test(`empty input is rejected (${label})`, () => {
        expect(validateId("", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.Empty,
          field: "",
        });
        expect(validateId("   ", ...noExistingIds, options)?.code).toBe(TValidateIdErrorCode.Empty);
      });

      test(`duplicates across elements, hidden fields, endings and variables are rejected (${label})`, () => {
        expect(validateId("field", ["field"], [], [], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], ["field"], [], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], [], ["field"], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
        expect(validateId("field", [], [], [], ["field"], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
      });

      test(`duplicate detection stays case-insensitive (${label})`, () => {
        expect(validateId("field", [], [], ["FIELD"], [], options)?.code).toBe(
          TValidateIdErrorCode.Duplicate
        );
      });

      test(`reserved keywords are rejected (${label})`, () => {
        expect(validateId("userId", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.Reserved,
          field: "userId",
        });
        expect(validateId("verifiedEmail", ...noExistingIds, options)?.code).toBe(
          TValidateIdErrorCode.Reserved
        );
      });

      test(`spaces are rejected before the character rule (${label})`, () => {
        expect(validateId("my field", ...noExistingIds, options)).toEqual({
          code: TValidateIdErrorCode.HasSpaces,
          field: "my field",
        });
      });

      test(`disallowed characters are rejected (${label})`, () => {
        expect(validateId("field!", ...noExistingIds, options)?.code).toBe(TValidateIdErrorCode.InvalidChars);
        expect(validateId("email@domain", ...noExistingIds, options)?.code).toBe(
          TValidateIdErrorCode.InvalidChars
        );
      });
    }
  });
});
