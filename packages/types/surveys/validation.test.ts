import { describe, expect, test } from "vitest";
import { TValidateIdErrorCode, validateId } from "./validation";

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
      expect(validateId("UserID", ...noExistingIds, strict)?.code).toBe(
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
