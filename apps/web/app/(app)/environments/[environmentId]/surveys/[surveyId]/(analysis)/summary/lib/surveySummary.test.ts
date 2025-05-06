import { cache } from "@/lib/cache";
import { getDisplayCountBySurveyId } from "@/lib/display/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { evaluateLogic, performActions } from "@/lib/surveyLogic/utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TLanguage } from "@formbricks/types/project";
import { TResponseFilterCriteria } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveySummary,
} from "@formbricks/types/surveys/types";
import {
  getQuestionSummary,
  getResponsesForSummary,
  getSurveySummary,
  getSurveySummaryDropOff,
  getSurveySummaryMeta,
} from "./surveySummary";
// Ensure this path is correct
import { convertFloatTo2Decimal } from "./utils";

// Mock dependencies
vi.mock("@/lib/cache", async () => {
  const actual = await vi.importActual("@/lib/cache");
  return {
    ...(actual as any),
    cache: vi.fn((fn) => fn()), // Mock cache function to just execute the passed function
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn().mockImplementation((fn) => fn),
  };
});

vi.mock("@/lib/display/service", () => ({
  getDisplayCountBySurveyId: vi.fn(),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((value, lang) => value[lang] || value.default || ""),
}));
vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: vi.fn(),
}));
vi.mock("@/lib/response/utils", () => ({
  buildWhereClause: vi.fn(() => ({})),
}));
vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));
vi.mock("@/lib/surveyLogic/utils", () => ({
  evaluateLogic: vi.fn(),
  performActions: vi.fn(() => ({ jumpTarget: undefined, requiredQuestionIds: [], calculations: {} })),
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("./utils", () => ({
  convertFloatTo2Decimal: vi.fn((num) =>
    num !== undefined && num !== null ? parseFloat(num.toFixed(2)) : 0
  ),
}));

const mockSurveyId = "survey_123";

const mockBaseSurvey: TSurvey = {
  id: mockSurveyId,
  name: "Test Survey",
  questions: [],
  welcomeCard: { enabled: false, headline: { default: "Welcome" } } as unknown as TSurvey["welcomeCard"],
  endings: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  languages: [
    { language: { id: "lang1", code: "en" } as unknown as TLanguage, default: true, enabled: true },
  ],
  variables: [],
  autoClose: null,
  triggers: [],
  status: "inProgress",
  type: "app",
  styling: {},
  segment: null,
  recontactDays: null,
  autoComplete: null,
  closeOnDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  displayOption: "displayOnce",
  displayPercentage: null,
  environmentId: "env_123",
  singleUse: null,
  surveyClosedMessage: null,
  resultShareKey: null,
  pin: null,
  createdBy: "user_123",
  isSingleResponsePerEmailEnabled: false,
  isVerifyEmailEnabled: false,
  projectOverwrites: null,
  runOnDate: null,
  showLanguageSwitch: false,
  isBackButtonHidden: false,
  followUps: [],
  recaptcha: { enabled: false, threshold: 0.5 },
} as unknown as TSurvey;

const mockResponses = [
  {
    id: "res1",
    data: { q1: "Answer 1" },
    updatedAt: new Date(),
    contact: null,
    contactAttributes: {},
    language: "en",
    ttc: { q1: 100, _total: 100 },
    finished: true,
  },
  {
    id: "res2",
    data: { q1: "Answer 2" },
    updatedAt: new Date(),
    contact: null,
    contactAttributes: {},
    language: "en",
    ttc: { q1: 150, _total: 150 },
    finished: true,
  },
  {
    id: "res3",
    data: {},
    updatedAt: new Date(),
    contact: null,
    contactAttributes: {},
    language: "en",
    ttc: {},
    finished: false,
  },
] as any;

describe("getSurveySummaryMeta", () => {
  beforeEach(() => {
    vi.mocked(convertFloatTo2Decimal).mockImplementation((num) =>
      num !== undefined && num !== null ? parseFloat(num.toFixed(2)) : 0
    );

    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("calculates meta correctly", () => {
    const meta = getSurveySummaryMeta(mockResponses, 10);
    expect(meta.displayCount).toBe(10);
    expect(meta.totalResponses).toBe(3);
    expect(meta.startsPercentage).toBe(30);
    expect(meta.completedResponses).toBe(2);
    expect(meta.completedPercentage).toBe(20);
    expect(meta.dropOffCount).toBe(1);
    expect(meta.dropOffPercentage).toBe(33.33); // (1/3)*100
    expect(meta.ttcAverage).toBe(125); // (100+150)/2
  });

  test("handles zero display count", () => {
    const meta = getSurveySummaryMeta(mockResponses, 0);
    expect(meta.startsPercentage).toBe(0);
    expect(meta.completedPercentage).toBe(0);
  });

  test("handles zero responses", () => {
    const meta = getSurveySummaryMeta([], 10);
    expect(meta.totalResponses).toBe(0);
    expect(meta.completedResponses).toBe(0);
    expect(meta.dropOffCount).toBe(0);
    expect(meta.dropOffPercentage).toBe(0);
    expect(meta.ttcAverage).toBe(0);
  });
});

describe("getSurveySummaryDropOff", () => {
  const surveyWithQuestions: TSurvey = {
    ...mockBaseSurvey,
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Q1" },
        required: true,
      } as unknown as TSurveyQuestion,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Q2" },
        required: true,
      } as unknown as TSurveyQuestion,
    ] as TSurveyQuestion[],
  };

  beforeEach(() => {
    vi.mocked(getLocalizedValue).mockImplementation((val, _) => val?.default || "");
    vi.mocked(convertFloatTo2Decimal).mockImplementation((num) =>
      num !== undefined && num !== null ? parseFloat(num.toFixed(2)) : 0
    );
    vi.mocked(evaluateLogic).mockReturnValue(false); // Default: no logic triggers
    vi.mocked(performActions).mockReturnValue({
      jumpTarget: undefined,
      requiredQuestionIds: [],
      calculations: {},
    });
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("calculates dropOff correctly with welcome card disabled", () => {
    const responses = [
      {
        id: "r1",
        data: { q1: "a" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "en",
        ttc: { q1: 10 },
        finished: false,
      }, // Dropped at q2
      {
        id: "r2",
        data: { q1: "b", q2: "c" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "en",
        ttc: { q1: 10, q2: 10 },
        finished: true,
      }, // Completed
    ] as any;
    const displayCount = 5; // 5 displays
    const dropOff = getSurveySummaryDropOff(surveyWithQuestions, responses, displayCount);

    expect(dropOff.length).toBe(2);
    // Q1
    expect(dropOff[0].questionId).toBe("q1");
    expect(dropOff[0].impressions).toBe(displayCount); // Welcome card disabled, so first question impressions = displayCount
    expect(dropOff[0].dropOffCount).toBe(displayCount - responses.length); // 5 displays - 2 started = 3 dropped before q1
    expect(dropOff[0].dropOffPercentage).toBe(60); // (3/5)*100
    expect(dropOff[0].ttc).toBe(10);

    // Q2
    expect(dropOff[1].questionId).toBe("q2");
    expect(dropOff[1].impressions).toBe(responses.length); // 2 responses reached q1, so 2 impressions for q2
    expect(dropOff[1].dropOffCount).toBe(1); // 1 response dropped at q2
    expect(dropOff[1].dropOffPercentage).toBe(50); // (1/2)*100
    expect(dropOff[1].ttc).toBe(10);
  });

  test("handles logic jumps", () => {
    const surveyWithLogic: TSurvey = {
      ...mockBaseSurvey,
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Q1" },
          required: true,
        } as unknown as TSurveyQuestion,
        {
          id: "q2",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Q2" },
          required: true,
          logic: [{ conditions: [], actions: [{ type: "jumpTo", details: { value: "q4" } }] }],
        } as unknown as TSurveyQuestion,
        { id: "q3", type: TSurveyQuestionTypeEnum.OpenText, headline: { default: "Q3" }, required: true },
        { id: "q4", type: TSurveyQuestionTypeEnum.OpenText, headline: { default: "Q4" }, required: true },
      ] as TSurveyQuestion[],
    };
    const responses = [
      {
        id: "r1",
        data: { q1: "a", q2: "b" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "en",
        ttc: { q1: 10, q2: 10 },
        finished: false,
      }, // Jumps from q2 to q4, drops at q4
    ];
    vi.mocked(evaluateLogic).mockImplementation((_s, data, _v, _, _l) => {
      // Simulate logic on q2 triggering
      return data.q2 === "b";
    });
    vi.mocked(performActions).mockImplementation((_s, actions, _d, _v) => {
      if ((actions[0] as any).type === "jumpTo") {
        return { jumpTarget: (actions[0] as any).details.value, requiredQuestionIds: [], calculations: {} };
      }
      return { jumpTarget: undefined, requiredQuestionIds: [], calculations: {} };
    });

    const dropOff = getSurveySummaryDropOff(surveyWithLogic, responses, 1);

    expect(dropOff[0].impressions).toBe(1); // q1
    expect(dropOff[1].impressions).toBe(1); // q2
    expect(dropOff[2].impressions).toBe(0); // q3 (skipped)
    expect(dropOff[3].impressions).toBe(1); // q4 (jumped to)
    expect(dropOff[3].dropOffCount).toBe(1); // Dropped at q4
  });
});

describe("getQuestionSummary", () => {
  const survey: TSurvey = {
    ...mockBaseSurvey,
    questions: [
      {
        id: "q_open",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Text" },
      } as unknown as TSurveyQuestion,
      {
        id: "q_multi_single",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Multi Single" },
        choices: [
          { id: "c1", label: { default: "Choice 1" } },
          { id: "c2", label: { default: "Choice 2" } },
        ],
      } as unknown as TSurveyQuestion,
    ] as TSurveyQuestion[],
    hiddenFields: { enabled: true, fieldIds: ["hidden1"] },
  };
  const responses = [
    {
      id: "r1",
      data: { q_open: "Open answer", q_multi_single: "Choice 1", hidden1: "Hidden val" },
      updatedAt: new Date(),
      contact: null,
      contactAttributes: {},
      language: "en",
      ttc: {},
      finished: true,
    },
  ];
  const mockDropOff: TSurveySummary["dropOff"] = []; // Simplified for this test

  beforeEach(() => {
    vi.mocked(getLocalizedValue).mockImplementation((val, _) => val?.default || "");
    vi.mocked(convertFloatTo2Decimal).mockImplementation((num) =>
      num !== undefined && num !== null ? parseFloat(num.toFixed(2)) : 0
    );
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("summarizes OpenText questions", async () => {
    const summary = await getQuestionSummary(survey, responses, mockDropOff);
    const openTextSummary = summary.find((s: any) => s.question?.id === "q_open");
    expect(openTextSummary?.type).toBe(TSurveyQuestionTypeEnum.OpenText);
    expect(openTextSummary?.responseCount).toBe(1);
    // @ts-expect-error
    expect(openTextSummary?.samples[0].value).toBe("Open answer");
  });

  test("summarizes MultipleChoiceSingle questions", async () => {
    const summary = await getQuestionSummary(survey, responses, mockDropOff);
    const multiSingleSummary = summary.find((s: any) => s.question?.id === "q_multi_single");
    expect(multiSingleSummary?.type).toBe(TSurveyQuestionTypeEnum.MultipleChoiceSingle);
    expect(multiSingleSummary?.responseCount).toBe(1);
    // @ts-expect-error
    expect(multiSingleSummary?.choices[0].value).toBe("Choice 1");
    // @ts-expect-error
    expect(multiSingleSummary?.choices[0].count).toBe(1);
    // @ts-expect-error
    expect(multiSingleSummary?.choices[0].percentage).toBe(100);
  });

  test("summarizes HiddenFields", async () => {
    const summary = await getQuestionSummary(survey, responses, mockDropOff);
    const hiddenFieldSummary = summary.find((s) => s.type === "hiddenField" && s.id === "hidden1");
    expect(hiddenFieldSummary).toBeDefined();
    expect(hiddenFieldSummary?.responseCount).toBe(1);
    // @ts-expect-error
    expect(hiddenFieldSummary?.samples[0].value).toBe("Hidden val");
  });

  // Add more tests for other question types (NPS, CTA, Rating, etc.)
});

describe("getSurveySummary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks for services
    vi.mocked(getSurvey).mockResolvedValue(mockBaseSurvey);
    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(mockResponses.length);
    // For getResponsesForSummary mock, we need to ensure it's correctly used by getSurveySummary
    // Since getSurveySummary calls getResponsesForSummary internally, we'll mock prisma.response.findMany
    // which is used by the actual implementation of getResponsesForSummary.
    vi.mocked(prisma.response.findMany).mockResolvedValue(
      mockResponses.map((r) => ({ ...r, contactId: null, personAttributes: {} })) as any
    );
    vi.mocked(getDisplayCountBySurveyId).mockResolvedValue(10);

    // Mock internal function calls if they are complex, otherwise let them run with mocked data
    // For simplicity, we can assume getSurveySummaryDropOff and getQuestionSummary are tested independently
    // and will work correctly if their inputs (survey, responses, displayCount) are correct.
    // Or, provide simplified mocks for them if needed.
    vi.mocked(getLocalizedValue).mockImplementation((val, _) => val?.default || "");
    vi.mocked(convertFloatTo2Decimal).mockImplementation((num) =>
      num !== undefined && num !== null ? parseFloat(num.toFixed(2)) : 0
    );
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("returns survey summary successfully", async () => {
    const summary = await getSurveySummary(mockSurveyId);
    expect(summary.meta.totalResponses).toBe(mockResponses.length);
    expect(summary.meta.displayCount).toBe(10);
    expect(summary.dropOff).toBeDefined();
    expect(summary.summary).toBeDefined();
    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getResponseCountBySurveyId).toHaveBeenCalledWith(mockSurveyId, undefined);
    expect(prisma.response.findMany).toHaveBeenCalled(); // Check if getResponsesForSummary was effectively called
    expect(getDisplayCountBySurveyId).toHaveBeenCalled();
  });

  test("throws ResourceNotFoundError if survey not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    await expect(getSurveySummary(mockSurveyId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("handles filterCriteria", async () => {
    const filterCriteria: TResponseFilterCriteria = { finished: true };
    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(2); // Assume 2 finished responses
    const finishedResponses = mockResponses
      .filter((r) => r.finished)
      .map((r) => ({ ...r, contactId: null, personAttributes: {} }));
    vi.mocked(prisma.response.findMany).mockResolvedValue(finishedResponses as any);

    await getSurveySummary(mockSurveyId, filterCriteria);

    expect(getResponseCountBySurveyId).toHaveBeenCalledWith(mockSurveyId, filterCriteria);
    expect(prisma.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ surveyId: mockSurveyId }), // buildWhereClause is mocked
      })
    );
    expect(getDisplayCountBySurveyId).toHaveBeenCalledWith(
      mockSurveyId,
      expect.objectContaining({ responseIds: expect.any(Array) })
    );
  });
});

describe("getResponsesForSummary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSurvey).mockResolvedValue(mockBaseSurvey);
    vi.mocked(prisma.response.findMany).mockResolvedValue(
      mockResponses.map((r) => ({ ...r, contactId: null, personAttributes: {} })) as any
    );
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  test("fetches and transforms responses", async () => {
    const limit = 2;
    const offset = 0;
    const result = await getResponsesForSummary(mockSurveyId, limit, offset);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(prisma.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: limit,
        skip: offset,
        where: { surveyId: mockSurveyId }, // buildWhereClause is mocked to return {}
      })
    );
    expect(result.length).toBe(mockResponses.length); // Mock returns all, actual would be limited by prisma
    expect(result[0].id).toBe(mockResponses[0].id);
    expect(result[0].contact).toBeNull(); // As per transformation logic
  });

  test("returns empty array if survey not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    const result = await getResponsesForSummary(mockSurveyId, 10, 0);
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on prisma failure", async () => {
    vi.mocked(prisma.response.findMany).mockRejectedValue(new Error("DB error"));
    await expect(getResponsesForSummary(mockSurveyId, 10, 0)).rejects.toThrow("DB error");
  });
});

// Add afterEach to clear mocks if not using vi.resetAllMocks() in beforeEach
afterEach(() => {
  vi.clearAllMocks();
});
