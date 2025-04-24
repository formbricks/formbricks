import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { getInsightsBySurveyIdQuestionId } from "./insights";
// Now that all the module dependencies are mocked, import the actual functions
import { getQuestionSummary, getSurveySummaryDropOff, getSurveySummaryMeta } from "./surveySummary";

// Mock the insights module with specific implementation
vi.mock("./insights", () => ({
  getInsightsBySurveyIdQuestionId: vi.fn().mockResolvedValue({
    summaries: [],
    totalCount: 0,
  }),
}));

// Mock other module imports before importing the actual functions
vi.mock("@/lib/cache");
vi.mock("react", () => ({
  cache: vi.fn(),
}));
vi.mock("@/lib/display/service");
vi.mock("@/lib/response/service");
vi.mock("@/lib/survey/service");
vi.mock("@/lib/survey/cache");
vi.mock("@/lib/response/cache");
vi.mock("@/lib/display/cache");
vi.mock("@formbricks/database");

describe("getSurveySummaryMeta", () => {
  test("calculates correct meta information", () => {
    const mockResponses = [
      {
        id: "resp1",
        finished: true,
        ttc: { _total: 50, q1: 20, q2: 30 },
      },
      {
        id: "resp2",
        finished: true,
        ttc: { _total: 30, q1: 10, q2: 20 },
      },
      {
        id: "resp3",
        finished: false,
        ttc: { _total: 15, q1: 15 },
      },
    ] as any[];

    const displayCount = 100;

    const result = getSurveySummaryMeta(mockResponses, displayCount);

    expect(result).toEqual({
      displayCount: 100,
      totalResponses: 3,
      startsPercentage: 3,
      completedResponses: 2,
      completedPercentage: 2,
      dropOffCount: 1,
      dropOffPercentage: 33.33,
      ttcAverage: 31.67,
    });
  });

  test("handles zero responses", () => {
    const mockResponses = [] as any[];
    const displayCount = 100;

    const result = getSurveySummaryMeta(mockResponses, displayCount);

    expect(result).toEqual({
      displayCount: 100,
      totalResponses: 0,
      startsPercentage: 0,
      completedResponses: 0,
      completedPercentage: 0,
      dropOffCount: 0,
      dropOffPercentage: 0,
      ttcAverage: 0,
    });
  });

  test("handles zero displayCount", () => {
    const mockResponses = [
      {
        id: "resp1",
        finished: true,
        ttc: { _total: 50, q1: 20, q2: 30 },
      },
    ] as any[];

    const displayCount = 0;

    const result = getSurveySummaryMeta(mockResponses, displayCount);

    expect(result).toEqual({
      displayCount: 0,
      totalResponses: 1,
      startsPercentage: 0,
      completedResponses: 1,
      completedPercentage: 0,
      dropOffCount: 0,
      dropOffPercentage: 0,
      ttcAverage: 50,
    });
  });
});

describe("getSurveySummaryDropOff", () => {
  test("calculates correct drop-off information for a simple survey", () => {
    const mockSurvey = {
      id: "survey1",
      questions: [
        { id: "q1", type: "openText", required: true, headline: { default: "Question 1" } },
        { id: "q2", type: "rating", required: true, headline: { default: "Question 2" } },
      ],
      welcomeCard: { enabled: false },
    } as any;

    const mockResponses = [
      {
        id: "resp1",
        data: { q1: "Answer 1", q2: 5 },
        finished: true,
        ttc: { q1: 20, q2: 30 },
      },
      {
        id: "resp2",
        data: { q1: "Answer 2" },
        finished: false,
        ttc: { q1: 25 },
      },
    ] as any[];

    const displayCount = 3;

    const result = getSurveySummaryDropOff(mockSurvey, mockResponses, displayCount);

    // First question: 1 person dropped off out of 3 displays
    // Second question: 1 person dropped off out of 2 who saw it
    expect(result).toHaveLength(2);
    expect(result[0].dropOffCount).toBe(1);
    expect(result[0].impressions).toBe(3);
    expect(result[1].dropOffCount).toBe(1);
    expect(result[1].impressions).toBe(2);
  });

  test("handles survey with welcome card", () => {
    const mockSurvey = {
      id: "survey1",
      questions: [{ id: "q1", type: "openText", required: true, headline: { default: "Question 1" } }],
      welcomeCard: { enabled: true },
    } as any;

    const mockResponses = [
      {
        id: "resp1",
        data: { q1: "Answer 1" },
        finished: true,
        ttc: { q1: 20 },
      },
      {
        id: "resp2",
        data: {},
        finished: false,
        ttc: {},
      },
    ] as any[];

    const displayCount = 3;

    const result = getSurveySummaryDropOff(mockSurvey, mockResponses, displayCount);

    expect(result).toHaveLength(1);
    expect(result[0].dropOffCount).toBe(1);
    expect(result[0].impressions).toBe(2);
  });
});

describe("getQuestionSummary", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
  });

  test("processes open text questions correctly", async () => {
    const mockSurvey = {
      id: "survey1",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.OpenText,
          required: true,
          headline: { default: "Question 1" },
          insightsEnabled: true,
        },
      ],
    } as any;

    const mockResponses = [
      {
        id: "resp1",
        data: { q1: "Answer 1" },
        updatedAt: new Date("2023-01-01"),
        contact: { id: "contact1", userId: "user1" },
        contactAttributes: {},
        ttc: { q1: 20 },
      },
      {
        id: "resp2",
        data: { q1: "Answer 2" },
        updatedAt: new Date("2023-01-02"),
        contact: null,
        contactAttributes: {},
        ttc: { q1: 25 },
      },
    ] as any[];

    const mockDropOff = [{ questionId: "q1", dropOffCount: 0, impressions: 2 }] as any[];

    // Set up mock for insights
    vi.mocked(getInsightsBySurveyIdQuestionId).mockResolvedValueOnce({
      summaries: [],
      totalCount: 0,
    });

    const result = await getQuestionSummary(mockSurvey, mockResponses, mockDropOff);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(TSurveyQuestionTypeEnum.OpenText);
    expect(result[0].responseCount).toBe(2);
    expect(result[0].samples).toHaveLength(2);
    expect(result[0].insightsEnabled).toBe(true);
    expect(getInsightsBySurveyIdQuestionId).toHaveBeenCalledWith("survey1", "q1", ["resp1", "resp2"], 50);
  });

  test("processes rating questions correctly", async () => {
    const mockSurvey = {
      id: "survey1",
      questions: [
        {
          id: "q1",
          type: TSurveyQuestionTypeEnum.Rating,
          required: true,
          headline: { default: "Rating Question" },
          range: 5,
        },
      ],
    } as any;

    const mockResponses = [
      {
        id: "resp1",
        data: { q1: 4 },
        updatedAt: new Date("2023-01-01"),
        contact: null,
        contactAttributes: {},
        ttc: { q1: 20 },
      },
      {
        id: "resp2",
        data: { q1: 5 },
        updatedAt: new Date("2023-01-02"),
        contact: null,
        contactAttributes: {},
        ttc: { q1: 25 },
      },
      {
        id: "resp3",
        data: { q1: 3 },
        updatedAt: new Date("2023-01-03"),
        contact: null,
        contactAttributes: {},
        ttc: { q1: 15 },
      },
    ] as any[];

    const mockDropOff = [{ questionId: "q1", dropOffCount: 0, impressions: 3 }] as any[];

    const result = await getQuestionSummary(mockSurvey, mockResponses, mockDropOff);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(TSurveyQuestionTypeEnum.Rating);
    expect(result[0].responseCount).toBe(3);
    expect(result[0].average).toBe(4);
    expect(result[0].choices).toHaveLength(5);
    expect(result[0].choices[2].count).toBe(1); // Rating 3 chosen once
    expect(result[0].choices[3].count).toBe(1); // Rating 4 chosen once
    expect(result[0].choices[4].count).toBe(1); // Rating 5 chosen once
  });
});
