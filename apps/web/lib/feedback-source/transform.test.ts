import { beforeEach, describe, expect, test, vi } from "vitest";
import { TFeedbackSourceFormbricksMapping } from "@formbricks/types/feedback-source";
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

const mockTenantId = "cmp2f6428000504la7iyh87h1";

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
  overrides: Partial<TFeedbackSourceFormbricksMapping> &
    Pick<TFeedbackSourceFormbricksMapping, "elementId" | "hubFieldType">
): TFeedbackSourceFormbricksMapping => ({
  id: `mapping-${overrides.elementId}`,
  createdAt: NOW,
  feedbackSourceId: "conn-1",
  workspaceId: "env-1",
  surveyId: "survey-1",
  customFieldLabel: null,
  ...overrides,
});

const allMappings: TFeedbackSourceFormbricksMapping[] = [
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
    const result = transformResponseToFeedbackRecords(emptyResponse, mockSurvey, allMappings, mockTenantId);
    expect(result).toEqual([]);
  });

  test("returns empty array when no mappings match the survey", () => {
    const otherSurveyMappings = allMappings.map((m) => ({ ...m, surveyId: "other-survey" }));
    const result = transformResponseToFeedbackRecords(
      mockResponse,
      mockSurvey,
      otherSurveyMappings,
      mockTenantId
    );
    expect(result).toEqual([]);
  });

  test("skips elements with empty string values", () => {
    const response = {
      ...mockResponse,
      data: { "el-text": "" },
    } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
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
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].field_id).toBe("el-nps");
  });

  test("transforms text field correctly", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source_type: "formbricks_survey",
      field_id: "el-text",
      field_type: "text",
      field_label: "How can we improve?",
      source_id: "survey-1",
      source_name: "Product Feedback",
      value_text: "Great product!",
      language: "en",
      user_id: "user-42",
    });
  });

  test("transforms nps field correctly", () => {
    const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].value_number).toBe(9);
    expect(result[0].field_type).toBe("nps");
  });

  test("transforms rating field correctly", () => {
    const mappings = [createMapping({ elementId: "el-rating", hubFieldType: "rating" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].value_number).toBe(4);
  });

  test("transforms date field to ISO string", () => {
    const mappings = [createMapping({ elementId: "el-date", hubFieldType: "date" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].value_date).toBe(new Date("2026-01-15").toISOString());
  });

  test("transforms boolean field correctly", () => {
    const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].value_boolean).toBe(true);
  });

  test("transforms categorical (multi-select) field to comma-separated text", () => {
    const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result).toHaveLength(1);
    expect(result[0].value_text).toBe("feat-a, feat-b");
  });

  test("uses customFieldLabel when provided", () => {
    const mappings = [
      createMapping({ elementId: "el-text", hubFieldType: "text", customFieldLabel: "Custom Label" }),
    ];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result[0].field_label).toBe("Custom Label");
  });

  test("sets collected_at from response createdAt", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, mockTenantId);
    expect(result[0].collected_at).toBe(NOW.toISOString());
  });

  test("falls back to updatedAt when createdAt is missing", () => {
    const updatedAt = new Date("2026-02-25T10:00:00.000Z");
    const response = { ...mockResponse, createdAt: undefined, updatedAt } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
    expect(result[0].collected_at).toBe(updatedAt.toISOString());
  });

  test("parses string createdAt values for collected_at", () => {
    const response = {
      ...mockResponse,
      createdAt: "2026-02-26T10:00:00.000Z",
    } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
    expect(result[0].collected_at).toBe("2026-02-26T10:00:00.000Z");
  });

  test("includes tenant_id when provided", () => {
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, mappings, "tenant-abc");
    expect(result[0].tenant_id).toBe("tenant-abc");
  });

  test("omits language when response language is 'default'", () => {
    const response = { ...mockResponse, language: "default" } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
    expect(result[0].language).toBeUndefined();
  });

  test("omits user_id when contact has no userId", () => {
    const response = { ...mockResponse, contact: null } as unknown as TResponse;
    const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
    const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
    expect(result[0].user_id).toBeUndefined();
  });

  test("transforms all mappings in a single call", () => {
    const result = transformResponseToFeedbackRecords(mockResponse, mockSurvey, allMappings, mockTenantId);
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
    const result = transformResponseToFeedbackRecords(response, survey, mappings, mockTenantId);
    expect(result[0].field_label).toBe("Untitled");
  });

  describe("convertValueToHubFields edge cases", () => {
    test("parses numeric string for nps field", () => {
      const response = {
        ...mockResponse,
        data: { "el-nps": "7" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_number).toBe(7);
    });

    test("returns empty fields for non-parseable numeric string", () => {
      const response = {
        ...mockResponse,
        data: { "el-nps": "not-a-number" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-nps", hubFieldType: "nps" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_number).toBeUndefined();
    });

    test("handles object value for text field", () => {
      const response = {
        ...mockResponse,
        data: { "el-text": { nested: "value" } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_text).toBe(JSON.stringify({ nested: "value" }));
    });

    test("handles invalid date string gracefully", () => {
      const response = {
        ...mockResponse,
        data: { "el-date": "not-a-date" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-date", hubFieldType: "date" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_date).toBeUndefined();
    });

    test("converts boolean string '1' to true", () => {
      const response = {
        ...mockResponse,
        data: { "el-bool": "1" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_boolean).toBe(true);
    });

    test("converts boolean string 'false' to false", () => {
      const response = {
        ...mockResponse,
        data: { "el-bool": "false" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-bool", hubFieldType: "boolean" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_boolean).toBe(false);
    });

    test("handles array value for text field", () => {
      const response = {
        ...mockResponse,
        data: { "el-text": ["a", "b", "c"] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-text", hubFieldType: "text" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_text).toBe("a, b, c");
    });

    test("handles single string value for categorical field", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": "single-choice" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_text).toBe("single-choice");
    });

    test("JSON-stringifies object value for categorical field (matrix/ranking responses)", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": { row1: "col1", row2: "col2" } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_text).toBe(JSON.stringify({ row1: "col1", row2: "col2" }));
      expect(result[0].value_text).not.toBe("[object Object]");
    });

    test("creates a record for a ranking response (string array)", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": ["LabelA", "LabelB", "LabelC"] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result).toHaveLength(1);
      expect(result[0].field_id).toBe("el-multi");
      expect(result[0].value_text).toBe("LabelA, LabelB, LabelC");
    });

    test("creates a record for an empty ranking response (empty array)", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": [] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-multi", hubFieldType: "categorical" })];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result).toHaveLength(1);
      expect(result[0].value_text).toBe("");
    });

    test("JSON-stringifies object value for unknown hubFieldType (default branch)", () => {
      const response = {
        ...mockResponse,
        data: { "el-multi": { row1: "col1" } },
      } as unknown as TResponse;
      const mappings = [
        createMapping({
          elementId: "el-multi",
          hubFieldType: "unknown-type" as TFeedbackSourceFormbricksMapping["hubFieldType"],
        }),
      ];
      const result = transformResponseToFeedbackRecords(response, mockSurvey, mappings, mockTenantId);
      expect(result[0].value_text).toBe(JSON.stringify({ row1: "col1" }));
      expect(result[0].value_text).not.toBe("[object Object]");
    });
  });

  describe("matrix expansion", () => {
    const matrixSurvey = {
      id: "survey-1",
      name: "Matrix Survey",
      blocks: [
        {
          elements: [
            {
              id: "el-matrix",
              type: "matrix",
              headline: { default: "Rate each feature" },
              rows: [
                { id: "row-1", label: { default: "Speed" } },
                { id: "row-2", label: { default: "Quality" } },
              ],
              columns: [
                { id: "col-1", label: { default: "Good" } },
                { id: "col-2", label: { default: "Bad" } },
              ],
            },
          ],
        },
      ],
    } as unknown as TSurvey;

    test("emits one record per answered row with shared field_group_id", () => {
      const response = {
        id: "resp-matrix",
        createdAt: NOW,
        data: { "el-matrix": { Speed: "Good", Quality: "Bad" } },
        language: "default",
        contact: { userId: "user-42" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-matrix", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, matrixSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.field_group_id === "el-matrix")).toBe(true);
      expect(result.every((r) => r.field_group_label === "Rate each feature")).toBe(true);
      expect(result.every((r) => r.submission_id === "resp-matrix")).toBe(true);
      expect(result.every((r) => r.metadata?.question_type === "matrix")).toBe(true);

      expect(result[0]).toMatchObject({
        field_id: "el-matrix__row-1",
        field_label: "Speed",
        field_type: "categorical",
        value_text: "Good",
      });
      expect(result[1]).toMatchObject({
        field_id: "el-matrix__row-2",
        field_label: "Quality",
        value_text: "Bad",
      });
    });

    test("skips matrix rows with empty cell value", () => {
      const response = {
        id: "resp-matrix-partial",
        createdAt: NOW,
        data: { "el-matrix": { Speed: "Good", Quality: "" } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-matrix", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, matrixSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0].field_id).toBe("el-matrix__row-1");
    });

    test("skips matrix rows whose label does not match any row choice", () => {
      const response = {
        id: "resp-matrix-stale",
        createdAt: NOW,
        data: { "el-matrix": { "Old Row Label": "Good", Quality: "Bad" } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-matrix", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, matrixSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0].field_id).toBe("el-matrix__row-2");
    });

    test("JSON-stringifies non-string matrix cell value (regression for ENG-891)", () => {
      const cellObject = { a: 1 };
      const response = {
        id: "resp-matrix-obj",
        createdAt: NOW,
        data: { "el-matrix": { Speed: cellObject } },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-matrix", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, matrixSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        field_id: "el-matrix__row-1",
        field_label: "Speed",
        field_group_id: "el-matrix",
        field_group_label: "Rate each feature",
        metadata: { question_type: "matrix" },
        value_text: JSON.stringify(cellObject),
      });
      expect(result[0].value_text).not.toBe("[object Object]");
    });

    test("emits no records for empty matrix response", () => {
      const response = {
        id: "resp-empty",
        createdAt: NOW,
        data: { "el-matrix": {} },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-matrix", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, matrixSurvey, mappings, mockTenantId);

      expect(result).toEqual([]);
    });
  });

  describe("ranking expansion", () => {
    const rankingSurvey = {
      id: "survey-1",
      name: "Ranking Survey",
      blocks: [
        {
          elements: [
            {
              id: "el-ranking",
              type: "ranking",
              headline: { default: "Rank these features" },
              choices: [
                { id: "ch-1", label: { default: "Reports" } },
                { id: "ch-2", label: { default: "Dashboards" } },
                { id: "ch-3", label: { default: "Alerts" } },
              ],
            },
          ],
        },
      ],
    } as unknown as TSurvey;

    test("emits one record per ranked item with rank as value_number", () => {
      const response = {
        id: "resp-ranking",
        createdAt: NOW,
        data: { "el-ranking": ["Dashboards", "Reports", "Alerts"] },
        language: "default",
        contact: { userId: "user-42" },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-ranking", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, rankingSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.field_group_id === "el-ranking")).toBe(true);
      expect(result.every((r) => r.field_group_label === "Rank these features")).toBe(true);
      expect(result.every((r) => r.field_type === "number")).toBe(true);
      expect(result.every((r) => r.metadata?.question_type === "ranking")).toBe(true);
      expect(result.every((r) => r.metadata?.total_items === 3)).toBe(true);

      expect(result[0]).toMatchObject({
        field_id: "el-ranking__ch-2",
        field_label: "Dashboards",
        value_number: 1,
      });
      expect(result[1]).toMatchObject({
        field_id: "el-ranking__ch-1",
        field_label: "Reports",
        value_number: 2,
      });
      expect(result[2]).toMatchObject({
        field_id: "el-ranking__ch-3",
        field_label: "Alerts",
        value_number: 3,
      });
    });

    test("emits no records for empty ranking response", () => {
      const response = {
        id: "resp-empty",
        createdAt: NOW,
        data: { "el-ranking": [] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-ranking", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, rankingSurvey, mappings, mockTenantId);

      expect(result).toEqual([]);
    });

    test("skips ranking items whose label does not match any choice", () => {
      const response = {
        id: "resp-ranking-stale",
        createdAt: NOW,
        data: { "el-ranking": ["Reports", "Removed Option"] },
      } as unknown as TResponse;
      const mappings = [createMapping({ elementId: "el-ranking", hubFieldType: "categorical" })];

      const result = transformResponseToFeedbackRecords(response, rankingSurvey, mappings, mockTenantId);

      expect(result).toHaveLength(1);
      expect(result[0].field_id).toBe("el-ranking__ch-1");
      expect(result[0].value_number).toBe(1);
    });
  });
});
