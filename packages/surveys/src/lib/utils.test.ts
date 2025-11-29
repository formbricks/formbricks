import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TJsEnvironmentStateSurvey } from "../../../types/js";
import { type TAllowedFileExtension, mimeTypes } from "../../../types/storage";
import { TSurveyElementTypeEnum } from "../../../types/surveys/elements";
import type { TSurveyLanguage } from "../../../types/surveys/types";
import {
  findBlockByElementId,
  getDefaultLanguageCode,
  getElementsFromSurveyBlocks,
  getMimeType,
  getShuffledChoicesIds,
  getShuffledRowIndices,
} from "./utils";

// Mock crypto.getRandomValues for deterministic shuffle tests
const mockGetRandomValues = vi.fn();
vi.stubGlobal("crypto", {
  ...(global.crypto || {}),
  getRandomValues: mockGetRandomValues,
});

describe("getMimeType", () => {
  Object.entries(mimeTypes).forEach(([extension, expectedMimeType]) => {
    test(`should return "${expectedMimeType}" for extension "${extension}"`, () => {
      expect(getMimeType(extension as TAllowedFileExtension)).toBe(expectedMimeType);
    });
  });
});

// Base mock for TJsEnvironmentStateSurvey to satisfy stricter type checks
const baseMockSurvey: TJsEnvironmentStateSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "link",
  status: "inProgress",
  questions: [],
  blocks: [],
  endings: [],
  welcomeCard: { enabled: false, timeToFinish: true, showResponseCount: false },
  variables: [],
  styling: { overwriteThemeStyling: false },
  recontactDays: null,
  displayLimit: null,
  displayPercentage: null,
  languages: [],
  segment: null,
  hiddenFields: { enabled: false, fieldIds: [] },
  projectOverwrites: null,
  triggers: [],
  displayOption: "displayOnce",
} as unknown as TJsEnvironmentStateSurvey;

describe("getDefaultLanguageCode", () => {
  const mockSurveyLanguageEn: TSurveyLanguage = {
    default: true,
    enabled: true,
    language: {
      id: "lang1",
      code: "en",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
  };
  const mockSurveyLanguageEs: TSurveyLanguage = {
    default: false,
    enabled: true,
    language: {
      id: "lang2",
      code: "es",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "proj1",
    },
  };

  test("should return the code of the default language", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      languages: [mockSurveyLanguageEs, mockSurveyLanguageEn],
    } as TJsEnvironmentStateSurvey;
    expect(getDefaultLanguageCode(survey)).toBe("en");
  });

  test("should return undefined if no default language", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      languages: [{ ...mockSurveyLanguageEs, default: false }], // Ensure 'default' is explicitly false
    } as TJsEnvironmentStateSurvey;
    expect(getDefaultLanguageCode(survey)).toBeUndefined();
  });

  test("should return undefined if languages array is empty", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      languages: [],
    } as TJsEnvironmentStateSurvey;
    expect(getDefaultLanguageCode(survey)).toBeUndefined();
  });
});

const setNextRandomNormalizedValue = (val: number) => {
  mockGetRandomValues.mockImplementationOnce((typedArray: Uint32Array) => {
    typedArray[0] = Math.floor(val * 2 ** 32);
  });
};

describe("getShuffledRowIndices", () => {
  beforeEach(() => {
    mockGetRandomValues.mockReset();
  });

  test('should return unshuffled for "none"', () => {
    expect(getShuffledRowIndices(5, "none")).toEqual([0, 1, 2, 3, 4]);
  });

  test('should shuffle all for "all"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledRowIndices(3, "all")).toEqual([1, 2, 0]);
  });

  test('should shuffle except last for "exceptLast"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledRowIndices(4, "exceptLast")).toEqual([1, 2, 0, 3]);
  });

  test("should handle n=0 or n=1", () => {
    expect(getShuffledRowIndices(0, "all")).toEqual([]);
    expect(getShuffledRowIndices(1, "all")).toEqual([0]);
    expect(getShuffledRowIndices(1, "exceptLast")).toEqual([0]);
  });
});

describe("getShuffledChoicesIds", () => {
  beforeEach(() => {
    mockGetRandomValues.mockReset();
  });

  const choicesBase = [
    { id: "c1", label: { en: "Choice 1" } },
    { id: "c2", label: { en: "Choice 2" } },
    { id: "c3", label: { en: "Choice 3" } },
  ];
  const choicesWithOther = [...choicesBase, { id: "other", label: { en: "Other" } }];

  test('should return unshuffled for "none"', () => {
    expect(getShuffledChoicesIds(choicesBase, "none")).toEqual(["c1", "c2", "c3"]);
    expect(getShuffledChoicesIds(choicesWithOther, "none")).toEqual(["c1", "c2", "c3", "other"]);
  });

  test('should shuffle all (no "other") for "all"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesBase, "all")).toEqual(["c2", "c3", "c1"]);
  });

  test('should shuffle all (with "other") for "all", keeping "other" last', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesWithOther, "all")).toEqual(["c2", "c3", "c1", "other"]);
  });

  test('should shuffle except last (no "other") for "exceptLast"', () => {
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesBase, "exceptLast")).toEqual(["c2", "c1", "c3"]);
  });

  test('should shuffle except last (with "other") for "exceptLast", keeping "other" truly last', () => {
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesWithOther, "exceptLast")).toEqual(["c2", "c1", "c3", "other"]);
  });

  test("should handle empty or single choice arrays", () => {
    expect(getShuffledChoicesIds([], "all")).toEqual([]);
    const singleChoice = [{ id: "s1", label: { en: "Single" } }];
    expect(getShuffledChoicesIds(singleChoice, "all")).toEqual(["s1"]);
    expect(getShuffledChoicesIds(singleChoice, "exceptLast")).toEqual(["s1"]);
  });
});
describe("getQuestionsFromSurvey", () => {
  test("should return elements from blocks", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      blocks: [
        {
          id: "block1",
          name: "Block 1",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { en: "Question 1" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
            {
              id: "q2",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { en: "Question 2" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
        {
          id: "block2",
          name: "Block 2",
          elements: [
            {
              id: "q3",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { en: "Question 3" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
    };

    const questions = getElementsFromSurveyBlocks(survey.blocks);
    expect(questions).toHaveLength(3);
    expect(questions[0].id).toBe("q1");
    expect(questions[1].id).toBe("q2");
    expect(questions[2].id).toBe("q3");
  });

  test("should return empty array when blocks is empty", () => {
    const survey = {
      ...baseMockSurvey,
      blocks: [],
    } as TJsEnvironmentStateSurvey;

    expect(getElementsFromSurveyBlocks(survey.blocks)).toEqual([]);
  });

  test("should handle blocks with no elements", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      blocks: [
        { id: "block1", name: "Block 1", elements: [] },
        {
          id: "block2",
          name: "Block 2",
          elements: [
            {
              id: "q1",
              type: TSurveyElementTypeEnum.OpenText,
              headline: { en: "Q1" },
              required: false,
              inputType: "text",
              charLimit: { enabled: false },
            },
          ],
        },
      ],
    };

    const questions = getElementsFromSurveyBlocks(survey.blocks);
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("q1");
  });
});

describe("findBlockByElementId", () => {
  const survey: TJsEnvironmentStateSurvey = {
    ...baseMockSurvey,
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { en: "Question 1" },
            required: false,
            inputType: "text",
            charLimit: { enabled: false },
          },
          {
            id: "q2",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { en: "Question 2" },
            required: false,
            inputType: "text",
            charLimit: { enabled: false },
          },
        ],
      },
      {
        id: "block2",
        name: "Block 2",
        elements: [
          {
            id: "q3",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { en: "Question 3" },
            required: false,
            inputType: "text",
            charLimit: { enabled: false },
          },
        ],
      },
    ],
  };

  test("should find block containing the element", () => {
    const block = findBlockByElementId(survey.blocks, "q1");
    expect(block).toBeDefined();
    expect(block?.id).toBe("block1");

    const block2 = findBlockByElementId(survey.blocks, "q3");
    expect(block2).toBeDefined();
    expect(block2?.id).toBe("block2");
  });

  test("should return undefined for non-existent element", () => {
    const block = findBlockByElementId(survey.blocks, "nonexistent");
    expect(block).toBeUndefined();
  });
});
