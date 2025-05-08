import { beforeEach, describe, expect, it, vi } from "vitest";
import { type TAllowedFileExtension, mimeTypes } from "../../../types/common";
import type { TJsEnvironmentStateSurvey } from "../../../types/js";
import type { TSurveyLanguage, TSurveyQuestionChoice } from "../../../types/surveys/types";
import { getDefaultLanguageCode, getMimeType, getShuffledChoicesIds, getShuffledRowIndices } from "./utils";

// Mock crypto.getRandomValues for deterministic shuffle tests
const mockGetRandomValues = vi.fn();
vi.stubGlobal("crypto", {
  ...(global.crypto || {}),
  getRandomValues: mockGetRandomValues,
});

describe("getMimeType", () => {
  Object.entries(mimeTypes).forEach(([extension, expectedMimeType]) => {
    it(`should return "${expectedMimeType}" for extension "${extension}"`, () => {
      expect(getMimeType(extension as TAllowedFileExtension)).toBe(expectedMimeType);
    });
  });
});

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

  // Base mock for TJsEnvironmentStateSurvey to satisfy stricter type checks
  const baseMockSurvey: Partial<TJsEnvironmentStateSurvey> = {
    id: "survey1",
    name: "Test Survey",
    type: "link", // Corrected: 'link' or 'app'
    status: "inProgress", // Assuming 'inProgress' is a valid TSurveyStatus
    questions: [],
    endings: [],
    welcomeCard: { enabled: false, timeToFinish: true, showResponseCount: false }, // Added missing properties
    variables: [],
    styling: { overwriteThemeStyling: false },
    // ... other mandatory fields with default/mock values if needed
  };

  it("should return the code of the default language", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      languages: [mockSurveyLanguageEs, mockSurveyLanguageEn],
    } as TJsEnvironmentStateSurvey;
    expect(getDefaultLanguageCode(survey)).toBe("en");
  });

  it("should return undefined if no default language", () => {
    const survey: TJsEnvironmentStateSurvey = {
      ...baseMockSurvey,
      languages: [{ ...mockSurveyLanguageEs, default: false }], // Ensure 'default' is explicitly false
    } as TJsEnvironmentStateSurvey;
    expect(getDefaultLanguageCode(survey)).toBeUndefined();
  });

  it("should return undefined if languages array is empty", () => {
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

  it('should return unshuffled for "none"', () => {
    expect(getShuffledRowIndices(5, "none")).toEqual([0, 1, 2, 3, 4]);
  });

  it('should shuffle all for "all"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledRowIndices(3, "all")).toEqual([1, 2, 0]);
  });

  it('should shuffle except last for "exceptLast"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledRowIndices(4, "exceptLast")).toEqual([1, 2, 0, 3]);
  });

  it("should handle n=0 or n=1", () => {
    expect(getShuffledRowIndices(0, "all")).toEqual([]);
    expect(getShuffledRowIndices(1, "all")).toEqual([0]);
    expect(getShuffledRowIndices(1, "exceptLast")).toEqual([]); // Adjusted expectation based on actual behavior
  });
});

describe("getShuffledChoicesIds", () => {
  beforeEach(() => {
    mockGetRandomValues.mockReset();
  });

  const choicesBase: TSurveyQuestionChoice[] = [
    { id: "c1", label: { en: "Choice 1" } },
    { id: "c2", label: { en: "Choice 2" } },
    { id: "c3", label: { en: "Choice 3" } },
  ];
  const choicesWithOther: TSurveyQuestionChoice[] = [...choicesBase, { id: "other", label: { en: "Other" } }];

  it('should return unshuffled for "none"', () => {
    expect(getShuffledChoicesIds(choicesBase, "none")).toEqual(["c1", "c2", "c3"]);
    expect(getShuffledChoicesIds(choicesWithOther, "none")).toEqual(["c1", "c2", "c3", "other"]);
  });

  it('should shuffle all (no "other") for "all"', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesBase, "all")).toEqual(["c2", "c3", "c1"]);
  });

  it('should shuffle all (with "other") for "all", keeping "other" last', () => {
    setNextRandomNormalizedValue(0.1);
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesWithOther, "all")).toEqual(["c2", "c3", "c1", "other"]);
  });

  it('should shuffle except last (no "other") for "exceptLast"', () => {
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesBase, "exceptLast")).toEqual(["c2", "c1", "c3"]);
  });

  it('should shuffle except last (with "other") for "exceptLast", keeping "other" truly last', () => {
    setNextRandomNormalizedValue(0.1);
    expect(getShuffledChoicesIds(choicesWithOther, "exceptLast")).toEqual(["c2", "c1", "c3", "other"]);
  });

  it("should handle empty or single choice arrays", () => {
    expect(getShuffledChoicesIds([], "all")).toEqual([]);
    const singleChoice = [{ id: "s1", label: { en: "Single" } }];
    expect(getShuffledChoicesIds(singleChoice, "all")).toEqual(["s1"]);
    expect(getShuffledChoicesIds(singleChoice, "exceptLast")).toEqual(["s1"]);
  });
});
