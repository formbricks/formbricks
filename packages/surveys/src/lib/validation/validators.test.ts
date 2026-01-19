import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { validators } from "./validators";

// Mock translation function - just return the key for testing
const mockT = vi.fn((key: string) => {
  return key;
}) as unknown as TFunction;

describe("validators", () => {
  describe("minLength", () => {
    test("should return valid true when string length >= min", () => {
      const result = validators.minLength.check("hello", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when string length < min", () => {
      const result = validators.minLength.check("hi", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty string", () => {
      const result = validators.minLength.check("", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when value is not a string", () => {
      const result = validators.minLength.check(123, { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.minLength.getDefaultMessage({ min: 10 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.min_length");
    });
  });

  describe("maxLength", () => {
    test("should return valid true when string length <= max", () => {
      const result = validators.maxLength.check("hello", { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when string length > max", () => {
      const result = validators.maxLength.check("hello world", { max: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is not a string", () => {
      const result = validators.maxLength.check(123, { max: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.maxLength.getDefaultMessage({ max: 100 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.max_length");
    });
  });

  describe("pattern", () => {
    test("should return valid true when pattern matches", () => {
      const result = validators.pattern.check("Hello", { pattern: "^[A-Z]" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when pattern does not match", () => {
      const result = validators.pattern.check("hello", { pattern: "^[A-Z]" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.pattern.check("", { pattern: "^[A-Z]" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should handle regex flags", () => {
      const result = validators.pattern.check(
        "hello",
        { pattern: "^[A-Z]", flags: "i" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should reject patterns longer than 512 chars", () => {
      const longPattern = "a".repeat(513);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = validators.pattern.check("test", { pattern: longPattern }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should reject values longer than 4096 chars", () => {
      const longValue = "a".repeat(4097);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = validators.pattern.check(longValue, { pattern: ".*" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should handle invalid regex gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = validators.pattern.check("test", { pattern: "[invalid" }, {} as TSurveyElement);
      expect(result.valid).toBe(true); // Returns valid for invalid regex
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test("should return correct error message", () => {
      const message = validators.pattern.getDefaultMessage({ pattern: ".*" }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.invalid_format");
    });
  });

  describe("email", () => {
    test("should return valid true for valid email", () => {
      const result = validators.email.check("test@example.com", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false for invalid email", () => {
      const result = validators.email.check("invalid-email", {}, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.email.check("", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when value is not a string", () => {
      const result = validators.email.check(123, {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.email.getDefaultMessage({}, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.please_enter_a_valid_email_address");
    });
  });

  describe("url", () => {
    test("should return valid true for valid URL", () => {
      const result = validators.url.check("https://example.com", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false for invalid URL", () => {
      const result = validators.url.check("not-a-url", {}, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.url.check("", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.url.getDefaultMessage({}, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.please_enter_a_valid_url");
    });
  });

  describe("phone", () => {
    test("should return valid true for valid phone number", () => {
      const result = validators.phone.check("+1234567890", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true for phone with spaces and dashes", () => {
      const result = validators.phone.check("+1 234-567-890", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false for invalid phone", () => {
      const result = validators.phone.check("abc123", {}, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.phone.check("", {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.phone.getDefaultMessage({}, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.please_enter_a_valid_phone_number");
    });
  });

  describe("minValue", () => {
    test("should return valid true when value >= min", () => {
      const result = validators.minValue.check(10, { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value < min", () => {
      const result = validators.minValue.check(3, { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should handle string numbers", () => {
      const result = validators.minValue.check("10", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.minValue.check("", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true for non-numeric values", () => {
      const result = validators.minValue.check("abc", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.minValue.getDefaultMessage({ min: 10 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.min_value");
    });
  });

  describe("maxValue", () => {
    test("should return valid true when value <= max", () => {
      const result = validators.maxValue.check(5, { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value > max", () => {
      const result = validators.maxValue.check(15, { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should handle string numbers", () => {
      const result = validators.maxValue.check("5", { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.maxValue.check("", { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.maxValue.getDefaultMessage({ max: 100 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.max_value");
    });
  });

  describe("minSelections", () => {
    test("should return valid true when selection count >= min", () => {
      const result = validators.minSelections.check(["opt1", "opt2"], { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when selection count < min", () => {
      const result = validators.minSelections.check(["opt1"], { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid false when value is not an array", () => {
      const result = validators.minSelections.check("not-array", { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should handle 'other' option correctly", () => {
      const result = validators.minSelections.check(["opt1", "", "custom"], { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.minSelections.getDefaultMessage({ min: 2 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.min_selections");
    });
  });

  describe("maxSelections", () => {
    test("should return valid true when selection count <= max", () => {
      const result = validators.maxSelections.check(["opt1", "opt2"], { max: 3 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when selection count > max", () => {
      const result = validators.maxSelections.check(
        ["opt1", "opt2", "opt3", "opt4"],
        { max: 3 },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is not an array", () => {
      const result = validators.maxSelections.check("not-array", { max: 3 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.maxSelections.getDefaultMessage({ max: 5 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.max_selections");
    });
  });

  describe("equals", () => {
    test("should return valid true when value equals", () => {
      const result = validators.equals.check("test", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value does not equal", () => {
      const result = validators.equals.check("test", { value: "other" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.equals.check("", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.equals.getDefaultMessage({ value: "test" }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.value_must_equal");
    });
  });

  describe("doesNotEqual", () => {
    test("should return valid true when value does not equal", () => {
      const result = validators.doesNotEqual.check("test", { value: "other" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value equals", () => {
      const result = validators.doesNotEqual.check("test", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.doesNotEqual.check("", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.doesNotEqual.getDefaultMessage(
        { value: "test" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.value_must_not_equal");
    });
  });

  describe("contains", () => {
    test("should return valid true when value contains substring", () => {
      const result = validators.contains.check("hello world", { value: "world" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value does not contain substring", () => {
      const result = validators.contains.check("hello", { value: "world" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.contains.check("", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.contains.getDefaultMessage({ value: "test" }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.value_must_contain");
    });
  });

  describe("doesNotContain", () => {
    test("should return valid true when value does not contain substring", () => {
      const result = validators.doesNotContain.check("hello", { value: "world" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value contains substring", () => {
      const result = validators.doesNotContain.check("hello world", { value: "world" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.doesNotContain.check("", { value: "test" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.doesNotContain.getDefaultMessage(
        { value: "test" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.value_must_not_contain");
    });
  });

  describe("isGreaterThan", () => {
    test("should return valid true when value > min", () => {
      const result = validators.isGreaterThan.check(10, { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value <= min", () => {
      const result = validators.isGreaterThan.check(5, { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isGreaterThan.check("", { min: 5 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isGreaterThan.getDefaultMessage({ min: 10 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.is_greater_than");
    });
  });

  describe("isLessThan", () => {
    test("should return valid true when value < max", () => {
      const result = validators.isLessThan.check(5, { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when value >= max", () => {
      const result = validators.isLessThan.check(10, { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isLessThan.check("", { max: 10 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isLessThan.getDefaultMessage({ max: 100 }, {} as TSurveyElement, mockT);
      expect(message).toBe("errors.is_less_than");
    });
  });

  describe("isLaterThan", () => {
    test("should return valid true when date is later", () => {
      const result = validators.isLaterThan.check("2024-12-31", { date: "2024-01-01" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when date is not later", () => {
      const result = validators.isLaterThan.check("2024-01-01", { date: "2024-12-31" }, {} as TSurveyElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isLaterThan.check("", { date: "2024-01-01" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isLaterThan.getDefaultMessage(
        { date: "2024-01-01" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.is_later_than");
    });
  });

  describe("isEarlierThan", () => {
    test("should return valid true when date is earlier", () => {
      const result = validators.isEarlierThan.check(
        "2024-01-01",
        { date: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when date is not earlier", () => {
      const result = validators.isEarlierThan.check(
        "2024-12-31",
        { date: "2024-01-01" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isEarlierThan.check("", { date: "2024-01-01" }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isEarlierThan.getDefaultMessage(
        { date: "2024-01-01" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.is_earlier_than");
    });
  });

  describe("isBetween", () => {
    test("should return valid true when date is between", () => {
      const result = validators.isBetween.check(
        "2024-06-15",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when date is not between", () => {
      const result = validators.isBetween.check(
        "2025-01-01",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isBetween.check(
        "",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isBetween.getDefaultMessage(
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.is_between");
    });
  });

  describe("isNotBetween", () => {
    test("should return valid true when date is not between", () => {
      const result = validators.isNotBetween.check(
        "2025-01-01",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when date is between", () => {
      const result = validators.isNotBetween.check(
        "2024-06-15",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.isNotBetween.check(
        "",
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.isNotBetween.getDefaultMessage(
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        {} as TSurveyElement,
        mockT
      );
      expect(message).toBe("errors.is_not_between");
    });
  });

  describe("minRanked", () => {
    const rankingElement: TSurveyElement = {
      id: "rank1",
      type: TSurveyElementTypeEnum.Ranking,
      headline: { default: "Rank these" },
      required: false,
      choices: [
        { id: "opt1", label: { default: "Option 1" } },
        { id: "opt2", label: { default: "Option 2" } },
        { id: "opt3", label: { default: "Option 3" } },
      ],
    } as TSurveyElement;

    test("should return valid true when ranked count >= min", () => {
      const result = validators.minRanked.check(["opt1", "opt2"], { min: 2 }, rankingElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when ranked count < min", () => {
      const result = validators.minRanked.check(["opt1"], { min: 2 }, rankingElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.minRanked.check([], { min: 2 }, rankingElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when element is not ranking", () => {
      const result = validators.minRanked.check(["opt1"], { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.minRanked.getDefaultMessage({ min: 2 }, rankingElement, mockT);
      expect(message).toBe("errors.minimum_options_ranked");
    });
  });

  describe("rankAll", () => {
    const rankingElement: TSurveyElement = {
      id: "rank1",
      type: TSurveyElementTypeEnum.Ranking,
      headline: { default: "Rank these" },
      required: false,
      choices: [
        { id: "opt1", label: { default: "Option 1" } },
        { id: "opt2", label: { default: "Option 2" } },
        { id: "opt3", label: { default: "Option 3" } },
      ],
    } as TSurveyElement;

    test("should return valid true when all options are ranked", () => {
      const result = validators.rankAll.check(["opt1", "opt2", "opt3"], {}, rankingElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid false when not all options are ranked", () => {
      const result = validators.rankAll.check(["opt1", "opt2"], {}, rankingElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.rankAll.check([], {}, rankingElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when element is not ranking", () => {
      const result = validators.rankAll.check(["opt1"], {}, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.rankAll.getDefaultMessage({}, rankingElement, mockT);
      expect(message).toBe("errors.all_options_must_be_ranked");
    });
  });

  describe("minRowsAnswered", () => {
    const matrixElement: TSurveyElement = {
      id: "matrix1",
      type: TSurveyElementTypeEnum.Matrix,
      headline: { default: "Matrix question" },
      required: false,
      shuffleOption: "none",
      rows: [
        { id: "row1", label: { default: "Row 1" } },
        { id: "row2", label: { default: "Row 2" } },
        { id: "row3", label: { default: "Row 3" } },
      ],
      columns: [
        { id: "col1", label: { default: "Col 1" } },
        { id: "col2", label: { default: "Col 2" } },
      ],
    } as TSurveyElement;

    test("should return valid true when answered rows >= min", () => {
      const result = validators.minRowsAnswered.check(
        { row1: "col1", row2: "col2" },
        { min: 2 },
        matrixElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when answered rows < min", () => {
      const result = validators.minRowsAnswered.check({ row1: "col1" }, { min: 2 }, matrixElement);
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      // Empty object has 0 answered rows, which is less than min (2), so it should fail
      // But if we pass undefined, it should skip validation
      const result = validators.minRowsAnswered.check(undefined, { min: 2 }, matrixElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when element is not matrix", () => {
      const result = validators.minRowsAnswered.check({ row1: "col1" }, { min: 2 }, {} as TSurveyElement);
      expect(result.valid).toBe(true);
    });

    test("should filter out empty values", () => {
      const result = validators.minRowsAnswered.check({ row1: "col1", row2: "" }, { min: 1 }, matrixElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.minRowsAnswered.getDefaultMessage({ min: 2 }, matrixElement, mockT);
      expect(message).toBe("errors.minimum_rows_answered");
    });
  });

  describe("fileExtensionIs", () => {
    const fileUploadElement: TSurveyElement = {
      id: "file1",
      type: TSurveyElementTypeEnum.FileUpload,
      headline: { default: "Upload file" },
      required: false,
      allowMultipleFiles: false,
    } as TSurveyElement;

    test("should return valid true when file extension matches", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.pdf"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid true when file extension matches with dot", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.pdf"],
        { extensions: [".pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when file extension does not match", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.pdf"],
        { extensions: ["jpg"] },
        fileUploadElement
      );
      expect(result.valid).toBe(false);
    });

    test("should handle multiple files", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file1.pdf", "https://example.com/file2.pdf"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false if any file does not match", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(false);
    });

    test("should handle URLs with query parameters", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.pdf?token=123"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false for files without extension", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.fileExtensionIs.check([], { extensions: ["pdf"] }, fileUploadElement);
      expect(result.valid).toBe(true);
    });

    test("should return valid true when element is not fileUpload", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.pdf"],
        { extensions: ["pdf"] },
        {} as TSurveyElement
      );
      expect(result.valid).toBe(true);
    });

    test("should handle case-insensitive extensions", () => {
      const result = validators.fileExtensionIs.check(
        ["https://example.com/file.PDF"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.fileExtensionIs.getDefaultMessage(
        { extensions: ["pdf", "jpg"] },
        fileUploadElement,
        mockT
      );
      expect(message).toBe("errors.file_extension_must_be");
    });
  });

  describe("fileExtensionIsNot", () => {
    const fileUploadElement: TSurveyElement = {
      id: "file1",
      type: TSurveyElementTypeEnum.FileUpload,
      headline: { default: "Upload file" },
      required: false,
      allowMultipleFiles: false,
    } as TSurveyElement;

    test("should return valid true when file extension does not match", () => {
      const result = validators.fileExtensionIsNot.check(
        ["https://example.com/file.pdf"],
        { extensions: ["jpg"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false when file extension matches", () => {
      const result = validators.fileExtensionIsNot.check(
        ["https://example.com/file.pdf"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true for files without extension", () => {
      const result = validators.fileExtensionIsNot.check(
        ["https://example.com/file"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should handle multiple files", () => {
      const result = validators.fileExtensionIsNot.check(
        ["https://example.com/file1.jpg", "https://example.com/file2.png"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(true);
    });

    test("should return valid false if any file matches forbidden extension", () => {
      const result = validators.fileExtensionIsNot.check(
        ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        { extensions: ["pdf"] },
        fileUploadElement
      );
      expect(result.valid).toBe(false);
    });

    test("should return valid true when value is empty", () => {
      const result = validators.fileExtensionIsNot.check([], { extensions: ["pdf"] }, fileUploadElement);
      expect(result.valid).toBe(true);
    });

    test("should return correct error message", () => {
      const message = validators.fileExtensionIsNot.getDefaultMessage(
        { extensions: ["exe", "bat"] },
        fileUploadElement,
        mockT
      );
      expect(message).toBe("errors.file_extension_must_not_be");
    });
  });
});
