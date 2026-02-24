import { describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { transformToUnifySurvey } from "./lib";

vi.mock("@formbricks/types/surveys/validation", () => ({
  getTextContent: (str: string) => str,
}));

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (val: Record<string, string>, _lang: string) => val?.default ?? "",
}));

vi.mock("@/lib/survey/utils", () => ({
  getElementsFromBlocks: (blocks: Array<{ elements: unknown[] }>) =>
    blocks.flatMap((block) => block.elements),
}));

vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: (headline: Record<string, string>) => headline,
}));

const NOW = new Date("2026-02-24T10:00:00.000Z");

const createMockSurvey = (overrides: Partial<TSurvey> = {}): TSurvey =>
  ({
    id: "survey-1",
    name: "Test Survey",
    status: "inProgress",
    createdAt: NOW,
    blocks: [
      {
        elements: [
          {
            id: "el-text",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "What do you think?" },
            required: true,
          },
          {
            id: "el-nps",
            type: TSurveyElementTypeEnum.NPS,
            headline: { default: "How likely to recommend?" },
            required: false,
          },
        ],
      },
    ],
    ...overrides,
  }) as unknown as TSurvey;

describe("transformToUnifySurvey", () => {
  test("transforms a survey with basic elements", () => {
    const result = transformToUnifySurvey(createMockSurvey());

    expect(result).toEqual({
      id: "survey-1",
      name: "Test Survey",
      status: "active",
      createdAt: NOW,
      elements: [
        {
          id: "el-text",
          type: TSurveyElementTypeEnum.OpenText,
          headline: "What do you think?",
          required: true,
        },
        {
          id: "el-nps",
          type: TSurveyElementTypeEnum.NPS,
          headline: "How likely to recommend?",
          required: false,
        },
      ],
    });
  });

  test("filters out CTA elements", () => {
    const survey = createMockSurvey({
      blocks: [
        {
          elements: [
            {
              id: "el-text",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Feedback" },
              required: true,
            },
            {
              id: "el-cta",
              type: TSurveyElementTypeEnum.CTA,
              headline: { default: "Click here" },
              required: false,
            },
          ],
        },
      ],
    } as Partial<TSurvey>);

    const result = transformToUnifySurvey(survey);

    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].id).toBe("el-text");
  });

  test("defaults required to false when not set", () => {
    const survey = createMockSurvey({
      blocks: [
        {
          elements: [
            {
              id: "el-1",
              type: TSurveyElementTypeEnum.Rating,
              headline: { default: "Rate us" },
            },
          ],
        },
      ],
    } as Partial<TSurvey>);

    const result = transformToUnifySurvey(survey);
    expect(result.elements[0].required).toBe(false);
  });

  test("falls back to 'Untitled' when headline is empty", () => {
    const survey = createMockSurvey({
      blocks: [
        {
          elements: [
            {
              id: "el-1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "" },
              required: false,
            },
          ],
        },
      ],
    } as Partial<TSurvey>);

    const result = transformToUnifySurvey(survey);
    expect(result.elements[0].headline).toBe("Untitled");
  });

  describe("mapSurveyStatus", () => {
    test("maps 'inProgress' to 'active'", () => {
      const result = transformToUnifySurvey(createMockSurvey({ status: "inProgress" } as Partial<TSurvey>));
      expect(result.status).toBe("active");
    });

    test("maps 'paused' to 'paused'", () => {
      const result = transformToUnifySurvey(createMockSurvey({ status: "paused" } as Partial<TSurvey>));
      expect(result.status).toBe("paused");
    });

    test("maps 'draft' to 'draft'", () => {
      const result = transformToUnifySurvey(createMockSurvey({ status: "draft" } as Partial<TSurvey>));
      expect(result.status).toBe("draft");
    });

    test("maps 'completed' to 'completed'", () => {
      const result = transformToUnifySurvey(createMockSurvey({ status: "completed" } as Partial<TSurvey>));
      expect(result.status).toBe("completed");
    });

    test("maps unknown status to 'draft'", () => {
      const result = transformToUnifySurvey(createMockSurvey({ status: "archived" } as Partial<TSurvey>));
      expect(result.status).toBe("draft");
    });
  });

  test("handles multiple blocks", () => {
    const survey = createMockSurvey({
      blocks: [
        {
          elements: [
            {
              id: "el-1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { default: "Q1" },
              required: true,
            },
          ],
        },
        {
          elements: [
            { id: "el-2", type: TSurveyElementTypeEnum.Rating, headline: { default: "Q2" }, required: false },
          ],
        },
      ],
    } as Partial<TSurvey>);

    const result = transformToUnifySurvey(survey);
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].id).toBe("el-1");
    expect(result.elements[1].id).toBe("el-2");
  });

  test("handles empty blocks", () => {
    const survey = createMockSurvey({ blocks: [] } as Partial<TSurvey>);
    const result = transformToUnifySurvey(survey);
    expect(result.elements).toEqual([]);
  });

  test("preserves all element types except CTA", () => {
    const elementTypes = [
      TSurveyElementTypeEnum.OpenText,
      TSurveyElementTypeEnum.NPS,
      TSurveyElementTypeEnum.Rating,
      TSurveyElementTypeEnum.MultipleChoiceSingle,
      TSurveyElementTypeEnum.MultipleChoiceMulti,
      TSurveyElementTypeEnum.Date,
      TSurveyElementTypeEnum.Consent,
      TSurveyElementTypeEnum.Matrix,
      TSurveyElementTypeEnum.Ranking,
      TSurveyElementTypeEnum.PictureSelection,
      TSurveyElementTypeEnum.ContactInfo,
      TSurveyElementTypeEnum.Address,
      TSurveyElementTypeEnum.FileUpload,
      TSurveyElementTypeEnum.Cal,
      TSurveyElementTypeEnum.CTA,
    ];

    const survey = createMockSurvey({
      blocks: [
        {
          elements: elementTypes.map((type, i) => ({
            id: `el-${i.toString()}`,
            type,
            headline: { default: `Question ${i.toString()}` },
            required: false,
          })),
        },
      ],
    } as Partial<TSurvey>);

    const result = transformToUnifySurvey(survey);
    const resultTypes = result.elements.map((e) => e.type);

    expect(resultTypes).not.toContain(TSurveyElementTypeEnum.CTA);
    expect(result.elements).toHaveLength(elementTypes.length - 1);
  });
});
