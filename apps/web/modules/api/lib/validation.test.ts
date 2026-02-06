import { beforeEach, describe, expect, test, vi } from "vitest";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TValidationErrorMap } from "@formbricks/types/surveys/validation-rules";
import {
  formatValidationErrorsForV1Api,
  formatValidationErrorsForV2Api,
  validateResponseData,
} from "@/modules/api/lib/validation";

const mockTransformQuestionsToBlocks = vi.fn();
const mockGetElementsFromBlocks = vi.fn();
const mockValidateBlockResponses = vi.fn();

vi.mock("@/app/lib/api/survey-transformation", () => ({
  transformQuestionsToBlocks: (...args: unknown[]) => mockTransformQuestionsToBlocks(...args),
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: (...args: unknown[]) => mockGetElementsFromBlocks(...args),
}));

vi.mock("@formbricks/surveys/validation", () => ({
  validateBlockResponses: (...args: unknown[]) => mockValidateBlockResponses(...args),
}));

describe("validateResponseData", () => {
  beforeEach(() => vi.clearAllMocks());

  const mockBlocks: TSurveyBlock[] = [
    {
      id: "block1",
      name: "Block 1",
      elements: [
        {
          id: "element1",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "Q1" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ];

  const mockQuestions: TSurveyQuestion[] = [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
      inputType: "text",
    } as unknown as TSurveyQuestion,
  ];

  const mockResponseData: TResponseData = { element1: "test" };
  const mockElements = [
    {
      id: "element1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
      inputType: "text",
      charLimit: { enabled: false },
    },
  ];

  test("should use blocks when provided", () => {
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    const result = validateResponseData(mockBlocks, mockResponseData, "en");

    expect(mockGetElementsFromBlocks).toHaveBeenCalledWith(mockBlocks);
    expect(mockValidateBlockResponses).toHaveBeenCalledWith(mockElements, mockResponseData, "en");
    expect(result).toBeNull();
  });

  test("should return error map when validation fails", () => {
    const errorMap: TValidationErrorMap = {
      element1: [{ ruleId: "minLength", ruleType: "minLength", message: "Min length required" }],
    };
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue(errorMap);

    expect(validateResponseData(mockBlocks, mockResponseData, "en")).toEqual(errorMap);
  });

  test("should transform questions to blocks when blocks are empty", () => {
    const transformedBlocks = [{ ...mockBlocks[0] }];
    mockTransformQuestionsToBlocks.mockReturnValue(transformedBlocks);
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    validateResponseData([], mockResponseData, "en", true, mockQuestions);

    expect(mockTransformQuestionsToBlocks).toHaveBeenCalledWith(mockQuestions, []);
    expect(mockGetElementsFromBlocks).toHaveBeenCalledWith(transformedBlocks);
  });

  test("should prefer blocks over questions", () => {
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    validateResponseData(mockBlocks, mockResponseData, "en", true, mockQuestions);

    expect(mockTransformQuestionsToBlocks).not.toHaveBeenCalled();
  });

  test("should return null when both blocks and questions are empty", () => {
    expect(validateResponseData([], mockResponseData, "en", true, [])).toBeNull();
    expect(validateResponseData(null, mockResponseData, "en", true, [])).toBeNull();
    expect(validateResponseData(undefined, mockResponseData, "en", true, null)).toBeNull();
  });

  test("should use default language code", () => {
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    validateResponseData(mockBlocks, mockResponseData);

    expect(mockValidateBlockResponses).toHaveBeenCalledWith(mockElements, mockResponseData, "en");
  });

  test("should validate only present fields when finished is false", () => {
    const partialResponseData: TResponseData = { element1: "test" };
    const partialElements = [mockElements[0]];
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    validateResponseData(mockBlocks, partialResponseData, "en", false);

    expect(mockValidateBlockResponses).toHaveBeenCalledWith(partialElements, partialResponseData, "en");
  });

  test("should validate all fields when finished is true", () => {
    const partialResponseData: TResponseData = { element1: "test" };
    mockGetElementsFromBlocks.mockReturnValue(mockElements);
    mockValidateBlockResponses.mockReturnValue({});

    validateResponseData(mockBlocks, partialResponseData, "en", true);

    expect(mockValidateBlockResponses).toHaveBeenCalledWith(mockElements, partialResponseData, "en");
  });
});

describe("formatValidationErrorsForV2Api", () => {
  test("should convert error map to V2 API format", () => {
    const errorMap: TValidationErrorMap = {
      element1: [{ ruleId: "minLength", ruleType: "minLength", message: "Min length required" }],
    };

    const result = formatValidationErrorsForV2Api(errorMap);

    expect(result).toEqual([
      {
        field: "response.data.element1",
        issue: "Min length required",
        meta: { elementId: "element1", ruleId: "minLength", ruleType: "minLength" },
      },
    ]);
  });

  test("should handle multiple errors per element", () => {
    const errorMap: TValidationErrorMap = {
      element1: [
        { ruleId: "minLength", ruleType: "minLength", message: "Min length" },
        { ruleId: "maxLength", ruleType: "maxLength", message: "Max length" },
      ],
    };

    const result = formatValidationErrorsForV2Api(errorMap);

    expect(result).toHaveLength(2);
    expect(result[0].field).toBe("response.data.element1");
    expect(result[1].field).toBe("response.data.element1");
  });

  test("should handle multiple elements", () => {
    const errorMap: TValidationErrorMap = {
      element1: [{ ruleId: "minLength", ruleType: "minLength", message: "Min length" }],
      element2: [{ ruleId: "maxLength", ruleType: "maxLength", message: "Max length" }],
    };

    const result = formatValidationErrorsForV2Api(errorMap);

    expect(result).toHaveLength(2);
    expect(result[0].field).toBe("response.data.element1");
    expect(result[1].field).toBe("response.data.element2");
  });
});

describe("formatValidationErrorsForV1Api", () => {
  test("should convert error map to V1 API format", () => {
    const errorMap: TValidationErrorMap = {
      element1: [{ ruleId: "minLength", ruleType: "minLength", message: "Min length required" }],
    };

    expect(formatValidationErrorsForV1Api(errorMap)).toEqual({
      "response.data.element1": "Min length required",
    });
  });

  test("should combine multiple errors with semicolon", () => {
    const errorMap: TValidationErrorMap = {
      element1: [
        { ruleId: "minLength", ruleType: "minLength", message: "Min length" },
        { ruleId: "maxLength", ruleType: "maxLength", message: "Max length" },
      ],
    };

    expect(formatValidationErrorsForV1Api(errorMap)).toEqual({
      "response.data.element1": "Min length; Max length",
    });
  });

  test("should handle multiple elements", () => {
    const errorMap: TValidationErrorMap = {
      element1: [{ ruleId: "minLength", ruleType: "minLength", message: "Min length" }],
      element2: [{ ruleId: "maxLength", ruleType: "maxLength", message: "Max length" }],
    };

    expect(formatValidationErrorsForV1Api(errorMap)).toEqual({
      "response.data.element1": "Min length",
      "response.data.element2": "Max length",
    });
  });
});
