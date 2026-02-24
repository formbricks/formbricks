import { beforeEach, describe, expect, test, vi } from "vitest";
import { TConnectorFormbricksMapping } from "@formbricks/types/connector";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { transformResponseToFeedbackRecords } from "./transform";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (_val: Record<string, string>, _lang: string) => _val?.default ?? "",
}));

vi.mock("@formbricks/types/surveys/validation", () => ({
  getTextContent: (str: string) => str,
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: (blocks: Array<{ elements: unknown[] }>) =>
    blocks.flatMap((block) => block.elements),
}));

const NOW = new Date("2026-02-24T10:00:00.000Z");

const mockSurvey = {
  id: "survey-1",
  name: "Product Feedback",
  blocks: [
    {
      elements: [
        { id: "el-text", type: "openText", headline: { default: "How can we improve?" } },
        { id: "el-nps", type: "nps", headline: { default: "How likely to recommend?" } },
        { id: "el-rating", type: "rating", headline: { default: "Rate your experience" } },
        { id: "el-date", type: "date", headline: { default: "When did you visit?" } },
        { id: "el-bool", type: "consent", headline: { default: "Do you agree?" } },
        {
          id: "el-multi",
          type: "multipleChoiceMulti",
          headline: { default: "Select features" },
        },
      ],
    },
  ],
} as unknown as TSurvey;

const mockResponse = {
  id: "resp-1",
  createdAt: NOW,
  data: {
    "el-text": "Great product!",
    "el-nps": 9,
    "el-rating": 4,
    "el-date": "2026-01-15",
    "el-bool": "true",
    "el-multi": ["feat-a", "feat-b"],
  },
  language: "en",
  contact: { userId: "user-42" },
} as unknown as TResponse;

const createMapping = (
  overrides: Partial<TConnectorFormbricksMapping> &
    Pick<TConnectorFormbricksMapping, "elementId" | "hubFieldType">
): TConnectorFormbricksMapping => ({
  id: `mapping-${overrides.elementId}`,
  createdAt: NOW,
  connectorId: "conn-1",
  environmentId: "env-1",
  surveyId: "survey-1",
  customFieldLabel: null,
  ...overrides,
});

const allMappings: TConnectorFormbricksMapping[] = [
  createMapping({ elementId: "el-text", hubFieldType: "text" }),
  createMapping({ elementId: "el-nps", hubFieldType: "nps" }),
  createMapping({ elementId: "el-rating", hubFieldType: "rating" }),
  createMapping({ elementId: "el-date", hubFieldType: "date" }),
  createMapping({ elementId: "el-bool", hubFieldType: "boolean" }),
  createMapping({ elementId: "el-multi", hubFieldType: "categorical" }),
];

describe("transformResponseToFeedbackRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns empty array when response has no data", () => {
    const emptyResponse = { ...mockResponse, data: null } as unknown as TResponse;
    const result = transformResponseToFeedbackRecords(emptyResponse, mockSurvey, allMappings);
    expect(result).toEqual([]);
  });

  test("returns empty array when no mappings match the survey", () => {
    const otherSurveyMappings = allMappings.map((m) => ({ ...m, surveyId: "other-survey" }));
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, otherSurveyMappings);
    expect(result).toEqual([]);
  });

  test("skips elements with empty string values", () => {
    const response = {
      ...mockResponse,
      data: { "el-text": "" },
    } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
    expect(result).toEqual([]);
  });

  test("skips elements with undefined values", () => {
    const response = {
      ...mockResponse,
      data: { "el-nps": 9 },
    } as unknown as TResponse;
    const mappings = [
      createMapping({ elementId: "el-text", hubFieldType: "text" }),
      createMapping({ elementId: "el-nps", hubFieldType: "nps" }),
    ];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].field_id).toBe("el-nps");
  });

  test("transforms text field correctly", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source_type: "formbricks",
      field_id: "el-text",
      field_type: "text",
      field_label: "How can we improve?",
      source_id: "survey-1",
      source_name: "Product Feedback",
      value_text: "Great product!",
      language: "en",
      user_identifier: "user-42",
    });
  });

  test("transforms nps field correctly", () => {
    const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].value_number).toBe(9);
    expect(result[0].field_type).toBe("nps");
  });

  test("transforms rating field correctly", () => {
    const mappings = [createMapping({ elementId: "el-rating", hubFieldType: "rating" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].value_number).toBe(4);
  });

  test("transforms date field to ISO string", () => {
    const mappings = [createMapping({ elementId: "el-date", hubFieldType: "date" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].value_date).toBe(new Date("2026-01-15").toISOString());
  });

  test("transforms boolean field correctly", () => {
    const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].value_boolean).toBe(true);
  });

  test("transforms categorical (multi-select) field to comma-separated text", () => {
    const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result).toHaveLength(1);
    expect(result[0].value_text).toBe("feat-a, feat-b");
  });

  test("uses customFieldLabel when provided", () => {
    const mappings = [
      createMapping({ elementId: "el-text", hubFieldType: "text", customFieldLabel: "Custom Label" }),
    ];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result[0].field_label).toBe("Custom Label");
  });

  test("sets collected_at from response createdAt", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result[0].collected_at).toBe(NOW.toISOString());
  });

  test("includes tenant_id when provided", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, "tenant-abc");
    expect(result[0].tenant_id).toBe("tenant-abc");
  });

  test("omits tenant_id when not provided", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings);
    expect(result[0].tenant_id).toBeUndefined();
  });

  test("omits language when response language is 'default'", () => {
    const response = { ...mockResponse, language: "default" } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
    expect(result[0].language).toBeUndefined();
  });

  test("omits user_identifier when contact has no userId", () => {
    const response = { ...mockResponse, contact: null } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
    expect(result[0].user_identifier).toBeUndefined();
  });

  test("transforms all mappings in a single call", () => {
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, allMappings);
    expect(result).toHaveLength(6);
    const fieldIds = result.map((r) => r.field_id);
    expect(fieldIds).toEqual(["el-text", "el-nps", "el-rating", "el-date", "el-bool", "el-multi"]);
  });

  test("falls back to 'Untitled' for element with no headline", () => {
    const survey = {
      ...mockSurvey,
      blocks: [{ elements: [{ id: "el-bare", type: "openText" }] }],
    } as unknown as TSurvey;
    const response = {
      ...mockResponse,
      data: { "el-bare": "some text" },
    } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-bare", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, survey, mappings);
    expect(result[0].field_label).toBe("Untitled");
  });

  describe("convertValueToHubFields edge cases", () => {
    test("parses numeric string for nps field", () => {
      const response = {
        ...mockResponse,
        data: { "el-nps": "7" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_number).toBe(7);
    });

    test("returns empty fields for non-parseable numeric string", () => {
      const response = {
        ...mockResponse,
        data: { "el-nps": "not-a-number" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_number).toBeUndefined();
    });

    test("handles object value for text field", () => {
      const response = {
        ...mockResponse,
        data: { "el-text": { nested: "value" } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_text).toBe(JSON.stringify({ nested: "value" }));
    });

    test("handles invalid date string gracefully", () => {
      const response = {
        ...mockResponse,
        data: { "el-date": "not-a-date" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-date", hubFieldType: "date" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_date).toBeUndefined();
    });

    test("converts boolean string '1' to true", () => {
      const response = {
        ...mockResponse,
        data: { "el-bool": "1" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_boolean).toBe(true);
    });

    test("converts boolean string 'false' to false", () => {
      const response = {
        ...mockResponse,
        data: { "el-bool": "false" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_boolean).toBe(false);
    });

    test("handles array value for text field", () => {
      const response = {
        ...mockResponse,
        data: { "el-text": ["a", "b", "c"] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_text).toBe("a, b, c");
    });

    test("handles single string value for categorical field", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": "single-choice" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings);
      expect(result[0].value_text).toBe("single-choice");
    });
  });
});
