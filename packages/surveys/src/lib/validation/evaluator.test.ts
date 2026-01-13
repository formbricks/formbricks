import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import type { TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TSurveyAddressElement,
  TSurveyContactInfoElement,
  TSurveyElement,
  TSurveyMatrixElement,
  TSurveyOpenTextElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { getFirstErrorMessage, validateBlockResponses, validateElementResponse } from "./evaluator";

// Mock translation function
const mockT = vi.fn((key: string) => {
  return key;
}) as unknown as TFunction;

// Mock getLocalizedValue
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (localizedString: Record<string, string> | undefined, languageCode: string): string => {
    if (!localizedString) return "";
    return localizedString[languageCode] || localizedString.default || "";
  },
}));

describe("validateElementResponse", () => {
  describe("required field validation", () => {
    test("should return error when required field is empty", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: true,
        inputType: "text",
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe("required");
    });

    test("should return valid when required field has value", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: true,
        inputType: "text",
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "test value", "en", mockT);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should return valid when field is not required", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "", "en", mockT);
      expect(result.valid).toBe(true);
    });

    test("should handle required ranking element - at least one ranked", () => {
      const element: TSurveyElement = {
        id: "rank1",
        type: TSurveyElementTypeEnum.Ranking,
        headline: { default: "Rank these" },
        required: true,
        choices: [
          { id: "opt1", label: { default: "Option 1" } },
          { id: "opt2", label: { default: "Option 2" } },
        ],
      } as unknown as TSurveyRankingElement;

      const result = validateElementResponse(element, ["opt1"], "en", mockT);
      expect(result.valid).toBe(true);
    });

    test("should return error when required ranking element has no ranked options", () => {
      const element: TSurveyElement = {
        id: "rank1",
        type: TSurveyElementTypeEnum.Ranking,
        headline: { default: "Rank these" },
        required: true,
        choices: [
          { id: "opt1", label: { default: "Option 1" } },
          { id: "opt2", label: { default: "Option 2" } },
        ],
      } as unknown as TSurveyRankingElement;

      const result = validateElementResponse(element, [], "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    test("should handle required matrix element - at least 1 row must be answered", () => {
      const element: TSurveyElement = {
        id: "matrix1",
        type: TSurveyElementTypeEnum.Matrix,
        headline: { default: "Matrix question" },
        required: true,
        shuffleOption: "none",
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Col 1" } },
          { id: "col2", label: { default: "Col 2" } },
        ],
      } as unknown as TSurveyMatrixElement;

      // At least 1 row answered should pass
      const result1 = validateElementResponse(element, { row1: "col1" }, "en", mockT);
      expect(result1.valid).toBe(true);

      // All rows answered should also pass
      const result2 = validateElementResponse(element, { row1: "col1", row2: "col2" }, "en", mockT);
      expect(result2.valid).toBe(true);
    });

    test("should return error when required matrix element has no rows answered", () => {
      const element: TSurveyElement = {
        id: "matrix1",
        type: TSurveyElementTypeEnum.Matrix,
        headline: { default: "Matrix question" },
        required: true,
        shuffleOption: "none",
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Col 1" } },
          { id: "col2", label: { default: "Col 2" } },
        ],
      } as unknown as TSurveyMatrixElement;

      const result = validateElementResponse(element, { row1: "col1" }, "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("validation rules - AND logic", () => {
    test("should return valid when all rules pass", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 5 } },
            { id: "rule2", type: "maxLength", params: { max: 10 } },
          ],
          logic: "and",
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hello", "en", mockT);
      expect(result.valid).toBe(true);
    });

    test("should return error when one rule fails", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 10 } },
            { id: "rule2", type: "maxLength", params: { max: 20 } },
          ],
          logic: "and",
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hi", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    test("should return multiple errors when multiple rules fail", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 10 } },
            { id: "rule2", type: "maxLength", params: { max: 5 } },
          ],
          logic: "and",
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hello", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("should default to AND logic when logic is not specified", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 10 } },
            { id: "rule2", type: "maxLength", params: { max: 5 } },
          ],
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hello", "en", mockT);
      expect(result.valid).toBe(false);
    });
  });

  describe("validation rules - OR logic", () => {
    test("should return valid when at least one rule passes", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 10 } },
            { id: "rule2", type: "maxLength", params: { max: 20 } },
          ],
          logic: "or",
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hello", "en", mockT);
      expect(result.valid).toBe(true);
    });

    test("should return error when all rules fail", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [
            { id: "rule1", type: "minLength", params: { min: 10 } },
            { id: "rule2", type: "maxLength", params: { max: 3 } },
          ],
          logic: "or",
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "hello", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("implicit validation for OpenText inputType", () => {
    test("should add implicit email validation for email inputType", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        inputType: "email",
        required: false,
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "invalid-email", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === "__implicit_email__")).toBe(true);
    });

    test("should add implicit url validation for url inputType", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        inputType: "url",
        required: false,
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "not-a-url", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === "__implicit_url__")).toBe(true);
    });

    test("should add implicit phone validation for phone inputType", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        inputType: "phone",
        required: false,
        charLimit: 0,
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "invalid-phone", "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === "__implicit_phone__")).toBe(true);
    });

    test("should not add implicit rule if explicit rule exists", () => {
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        inputType: "email",
        required: false,
        charLimit: 0,
        validation: {
          rules: [{ id: "rule1", type: "email", params: {} }],
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "test@example.com", "en", mockT);
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.ruleId === "__implicit_email__")).toBe(false);
    });
  });

  describe("implicit validation for ContactInfo", () => {
    test("should add implicit email validation for email field", () => {
      const element: TSurveyElement = {
        id: "contact1",
        type: TSurveyElementTypeEnum.ContactInfo,
        headline: { default: "Contact Info" },
        firstName: { show: true, required: false, placeholder: { default: "First Name" } },
        lastName: { show: true, required: false, placeholder: { default: "Last Name" } },
        email: { show: true, required: false, placeholder: { default: "Email" } },
        phone: { show: false, required: false, placeholder: { default: "Phone" } },
        company: { show: false, required: false, placeholder: { default: "Company" } },
        required: false,
      } as unknown as TSurveyContactInfoElement;

      const result = validateElementResponse(element, ["John", "Doe", "invalid-email", "", ""], "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === "__implicit_email_field__")).toBe(true);
    });

    test("should add implicit phone validation for phone field", () => {
      const element: TSurveyElement = {
        id: "contact1",
        type: TSurveyElementTypeEnum.ContactInfo,
        headline: { default: "Contact Info" },
        firstName: { show: true, required: false, placeholder: { default: "First Name" } },
        lastName: { show: true, required: false, placeholder: { default: "Last Name" } },
        email: { show: false, required: false, placeholder: { default: "Email" } },
        phone: { show: true, required: false, placeholder: { default: "Phone" } },
        company: { show: false, required: false, placeholder: { default: "Company" } },
        required: false,
      } as unknown as TSurveyContactInfoElement;

      const result = validateElementResponse(element, ["John", "Doe", "", "invalid-phone", ""], "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.ruleId === "__implicit_phone_field__")).toBe(true);
    });

    test("should not add implicit rule if explicit rule exists", () => {
      const element: TSurveyElement = {
        id: "contact1",
        type: TSurveyElementTypeEnum.ContactInfo,
        headline: { default: "Contact Info" },
        firstName: { show: true, required: false, placeholder: { default: "First Name" } },
        lastName: { show: true, required: false, placeholder: { default: "Last Name" } },
        email: { show: true, required: false, placeholder: { default: "Email" } },
        phone: { show: false, required: false, placeholder: { default: "Phone" } },
        company: { show: false, required: false, placeholder: { default: "Company" } },
        required: false,
        validation: {
          rules: [{ id: "rule1", type: "email", field: "email", params: {} }],
        },
      } as unknown as TSurveyContactInfoElement;

      const result = validateElementResponse(
        element,
        ["John", "Doe", "test@example.com", "", ""],
        "en",
        mockT
      );
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.ruleId === "__implicit_email_field__")).toBe(false);
    });
  });

  describe("field-specific validation for Address", () => {
    test("should validate specific field in address element", () => {
      const element: TSurveyElement = {
        id: "address1",
        type: TSurveyElementTypeEnum.Address,
        headline: { default: "Address" },
        addressLine1: { show: true, required: false, placeholder: { default: "Address Line 1" } },
        addressLine2: { show: false, required: false, placeholder: { default: "Address Line 2" } },
        city: { show: true, required: false, placeholder: { default: "City" } },
        state: { show: true, required: false, placeholder: { default: "State" } },
        zip: { show: true, required: false, placeholder: { default: "ZIP" } },
        country: { show: true, required: false, placeholder: { default: "Country" } },
        required: false,
        validation: {
          rules: [{ id: "rule1", type: "minLength", field: "city", params: { min: 3 } }],
        },
      } as unknown as TSurveyAddressElement;

      const result = validateElementResponse(element, ["123 Main St", "", "NY", "", "", ""], "en", mockT);
      expect(result.valid).toBe(false);
    });

    test("should validate correct field value", () => {
      const element: TSurveyElement = {
        id: "address1",
        type: TSurveyElementTypeEnum.Address,
        headline: { default: "Address" },
        addressLine1: { show: true, required: false, placeholder: { default: "Address Line 1" } },
        addressLine2: { show: false, required: false, placeholder: { default: "Address Line 2" } },
        city: { show: true, required: false, placeholder: { default: "City" } },
        state: { show: true, required: false, placeholder: { default: "State" } },
        zip: { show: true, required: false, placeholder: { default: "ZIP" } },
        country: { show: true, required: false, placeholder: { default: "Country" } },
        required: false,
        validation: {
          rules: [{ id: "rule1", type: "minLength", field: "city", params: { min: 3 } }],
        },
      } as unknown as TSurveyAddressElement;

      const result = validateElementResponse(
        element,
        ["123 Main St", "", "New York", "", "", ""],
        "en",
        mockT
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("field-specific validation for ContactInfo", () => {
    test("should validate specific field in contact info element", () => {
      const element: TSurveyElement = {
        id: "contact1",
        type: TSurveyElementTypeEnum.ContactInfo,
        headline: { default: "Contact Info" },
        firstName: { show: true, required: false, placeholder: { default: "First Name" } },
        lastName: { show: true, required: false, placeholder: { default: "Last Name" } },
        email: { show: true, required: false, placeholder: { default: "Email" } },
        phone: { show: true, required: false, placeholder: { default: "Phone" } },
        company: { show: false, required: false, placeholder: { default: "Company" } },
        required: false,
        validation: {
          rules: [{ id: "rule1", type: "minLength", field: "firstName", params: { min: 3 } }],
        },
      } as unknown as TSurveyContactInfoElement;

      const result = validateElementResponse(
        element,
        ["Jo", "Doe", "test@example.com", "1234567890", ""],
        "en",
        mockT
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("matrix element validation rules", () => {
    test("should apply validation rules when matrix is required", () => {
      const element: TSurveyElement = {
        id: "matrix1",
        type: TSurveyElementTypeEnum.Matrix,
        headline: { default: "Matrix question" },
        required: true,
        shuffleOption: "none",
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Col 1" } },
          { id: "col2", label: { default: "Col 2" } },
        ],
        validation: {
          rules: [{ id: "rule1", type: "minRowsAnswered", params: { min: 2 } }],
        },
      } as unknown as TSurveyMatrixElement;

      // Required check passes (at least 1 row), but validation rule fails (needs 2 rows)
      const result = validateElementResponse(element, { row1: "col1" }, "en", mockT);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
    });

    test("should apply validation rules when matrix is not required", () => {
      const element: TSurveyElement = {
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
        validation: {
          rules: [{ id: "rule1", type: "minRowsAnswered", params: { min: 2 } }],
        },
      } as unknown as TSurveyMatrixElement;

      const result = validateElementResponse(element, { row1: "col1" }, "en", mockT);
      expect(result.valid).toBe(false);
    });

    test("should apply answerAllRows validation rule", () => {
      const element: TSurveyElement = {
        id: "matrix1",
        type: TSurveyElementTypeEnum.Matrix,
        headline: { default: "Matrix question" },
        required: false,
        shuffleOption: "none",
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Col 1" } },
          { id: "col2", label: { default: "Col 2" } },
        ],
        validation: {
          rules: [{ id: "rule1", type: "answerAllRows", params: {} }],
        },
      } as unknown as TSurveyMatrixElement;

      // Only 1 row answered, should fail
      const result1 = validateElementResponse(element, { row1: "col1" }, "en", mockT);
      expect(result1.valid).toBe(false);

      // All rows answered, should pass
      const result2 = validateElementResponse(element, { row1: "col1", row2: "col2" }, "en", mockT);
      expect(result2.valid).toBe(true);
    });
  });

  describe("unknown validation rule type", () => {
    test("should handle unknown rule type gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const element: TSurveyElement = {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        charLimit: 0,
        validation: {
          rules: [{ id: "rule1", type: "unknown" as any, params: {} }],
        },
      } as unknown as TSurveyOpenTextElement;

      const result = validateElementResponse(element, "test", "en", mockT);
      expect(result.valid).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe("validateBlockResponses", () => {
  test("should return empty error map when all elements are valid", () => {
    const elements: TSurveyElement[] = [
      {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        charLimit: 0,
      } as TSurveyOpenTextElement,
      {
        id: "text2",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
        charLimit: 0,
      } as TSurveyOpenTextElement,
    ];

    const responses: TResponseData = {
      text1: "value1",
      text2: "value2",
    };

    const result = validateBlockResponses(elements, responses, "en", mockT);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test("should return error map with invalid elements", () => {
    const elements: TSurveyElement[] = [
      {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question 1" },
        required: true,
        inputType: "text",
        charLimit: 0,
      } as TSurveyOpenTextElement,
      {
        id: "text2",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
        charLimit: 0,
      } as TSurveyOpenTextElement,
    ];

    const responses: TResponseData = {
      text1: "",
      text2: "value2",
    };

    const result = validateBlockResponses(elements, responses, "en", mockT);
    expect(Object.keys(result)).toHaveLength(1);
    const text1Errors = result.text1;
    expect(text1Errors).toBeDefined();
    expect(text1Errors?.length).toBeGreaterThan(0);
  });

  test("should handle missing responses", () => {
    const elements: TSurveyElement[] = [
      {
        id: "text1",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: true,
        inputType: "text",
        charLimit: 0,
      } as TSurveyOpenTextElement,
    ];

    const responses: TResponseData = {};

    const result = validateBlockResponses(elements, responses, "en", mockT);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.text1).toBeDefined();
  });
});

describe("getFirstErrorMessage", () => {
  test("should return first error message for element", () => {
    const errorMap = {
      text1: [
        { ruleId: "rule1", ruleType: "minLength" as const, message: "First error" },
        { ruleId: "rule2", ruleType: "maxLength" as const, message: "Second error" },
      ],
    };

    const message = getFirstErrorMessage(errorMap, "text1");
    expect(message).toBe("First error");
  });

  test("should return undefined when element has no errors", () => {
    const errorMap = {
      text1: [{ ruleId: "rule1", ruleType: "minLength" as const, message: "Error" }],
    };

    const message = getFirstErrorMessage(errorMap, "text2");
    expect(message).toBeUndefined();
  });

  test("should return undefined when error map is empty", () => {
    const errorMap = {};
    const message = getFirstErrorMessage(errorMap, "text1");
    expect(message).toBeUndefined();
  });
});
