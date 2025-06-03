import { getDisplayCountBySurveyId } from "@/lib/display/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { evaluateLogic, performActions } from "@/lib/surveyLogic/utils";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
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
  getLocalizedValue: vi.fn((value, lang) => {
    // Handle the case when value is undefined or null
    if (!value) return "";
    return value[lang] || value.default || "";
  }),
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

  describe("Ranking question type tests", () => {
    test("getQuestionSummary correctly processes ranking question with default language responses", async () => {
      const question = {
        id: "ranking-q1",
        type: TSurveyQuestionTypeEnum.Ranking,
        headline: { default: "Rank these items" },
        required: true,
        choices: [
          { id: "item1", label: { default: "Item 1" } },
          { id: "item2", label: { default: "Item 2" } },
          { id: "item3", label: { default: "Item 3" } },
        ],
      };

      const survey = {
        id: "survey-1",
        questions: [question],
        languages: [],
        welcomeCard: { enabled: false },
      } as unknown as TSurvey;

      const responses = [
        {
          id: "response-1",
          data: { "ranking-q1": ["Item 1", "Item 2", "Item 3"] },
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        },
        {
          id: "response-2",
          data: { "ranking-q1": ["Item 2", "Item 1", "Item 3"] },
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        },
      ];

      const dropOff = [
        { questionId: "ranking-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
      ] as unknown as TSurveySummary["dropOff"];

      const summary = await getQuestionSummary(survey, responses, dropOff);

      expect(summary).toHaveLength(1);
      expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Ranking);
      expect(summary[0].responseCount).toBe(2);
      expect((summary[0] as any).choices).toHaveLength(3);

      // Item 1 is in position 1 once and position 2 once, so avg ranking should be (1+2)/2 = 1.5
      const item1 = (summary[0] as any).choices.find((c) => c.value === "Item 1");
      expect(item1.count).toBe(2);
      expect(item1.avgRanking).toBe(1.5);

      // Item 2 is in position 1 once and position 2 once, so avg ranking should be (1+2)/2 = 1.5
      const item2 = (summary[0] as any).choices.find((c) => c.value === "Item 2");
      expect(item2.count).toBe(2);
      expect(item2.avgRanking).toBe(1.5);

      // Item 3 is in position 3 twice, so avg ranking should be 3
      const item3 = (summary[0] as any).choices.find((c) => c.value === "Item 3");
      expect(item3.count).toBe(2);
      expect(item3.avgRanking).toBe(3);
    });

    test("getQuestionSummary correctly processes ranking question with non-default language responses", async () => {
      const question = {
        id: "ranking-q1",
        type: TSurveyQuestionTypeEnum.Ranking,
        headline: { default: "Rank these items", es: "Clasifica estos elementos" },
        required: true,
        choices: [
          { id: "item1", label: { default: "Item 1", es: "Elemento 1" } },
          { id: "item2", label: { default: "Item 2", es: "Elemento 2" } },
          { id: "item3", label: { default: "Item 3", es: "Elemento 3" } },
        ],
      };

      const survey = {
        id: "survey-1",
        questions: [question],
        languages: [{ language: { code: "es" }, default: false }],
        welcomeCard: { enabled: false },
      } as unknown as TSurvey;

      // Spanish response with Spanish labels
      const responses = [
        {
          id: "response-1",
          data: { "ranking-q1": ["Elemento 2", "Elemento 1", "Elemento 3"] },
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: "es",
          ttc: {},
          finished: true,
        },
      ];

      // Mock checkForI18n for this test case
      vi.mock("./surveySummary", async (importOriginal) => {
        const originalModule = await importOriginal();
        return {
          ...(originalModule as object),
          checkForI18n: vi.fn().mockImplementation(() => {
            // NOSONAR
            // Convert Spanish labels to default language labels
            return ["Item 2", "Item 1", "Item 3"];
          }),
        };
      });

      const dropOff = [
        { questionId: "ranking-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
      ] as unknown as TSurveySummary["dropOff"];

      const summary = await getQuestionSummary(survey, responses, dropOff);

      expect(summary).toHaveLength(1);
      expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Ranking);
      expect(summary[0].responseCount).toBe(1);

      // Item 1 is in position 2, so avg ranking should be 2
      const item1 = (summary[0] as any).choices.find((c) => c.value === "Item 1");
      expect(item1.count).toBe(1);
      expect(item1.avgRanking).toBe(2);

      // Item 2 is in position 1, so avg ranking should be 1
      const item2 = (summary[0] as any).choices.find((c) => c.value === "Item 2");
      expect(item2.count).toBe(1);
      expect(item2.avgRanking).toBe(1);

      // Item 3 is in position 3, so avg ranking should be 3
      const item3 = (summary[0] as any).choices.find((c) => c.value === "Item 3");
      expect(item3.count).toBe(1);
      expect(item3.avgRanking).toBe(3);
    });

    test("getQuestionSummary handles ranking question with no ranking data in responses", async () => {
      const question = {
        id: "ranking-q1",
        type: TSurveyQuestionTypeEnum.Ranking,
        headline: { default: "Rank these items" },
        required: false,
        choices: [
          { id: "item1", label: { default: "Item 1" } },
          { id: "item2", label: { default: "Item 2" } },
          { id: "item3", label: { default: "Item 3" } },
        ],
      };

      const survey = {
        id: "survey-1",
        questions: [question],
        languages: [],
        welcomeCard: { enabled: false },
      } as unknown as TSurvey;

      // Responses without any ranking data
      const responses = [
        {
          id: "response-1",
          data: {}, // No ranking data
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        } as any,
        {
          id: "response-2",
          data: { "other-q": "some value" }, // No ranking data
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        } as any,
      ];

      const dropOff = [
        { questionId: "ranking-q1", impressions: 2, dropOffCount: 2, dropOffPercentage: 100 },
      ] as unknown as TSurveySummary["dropOff"];

      const summary = await getQuestionSummary(survey, responses, dropOff);

      expect(summary).toHaveLength(1);
      expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Ranking);
      expect(summary[0].responseCount).toBe(0);
      expect((summary[0] as any).choices).toHaveLength(3);

      // All items should have count 0 and avgRanking 0
      (summary[0] as any).choices.forEach((choice) => {
        expect(choice.count).toBe(0);
        expect(choice.avgRanking).toBe(0);
      });
    });

    test("getQuestionSummary handles ranking question with non-array answers", async () => {
      const question = {
        id: "ranking-q1",
        type: TSurveyQuestionTypeEnum.Ranking,
        headline: { default: "Rank these items" },
        required: true,
        choices: [
          { id: "item1", label: { default: "Item 1" } },
          { id: "item2", label: { default: "Item 2" } },
          { id: "item3", label: { default: "Item 3" } },
        ],
      };

      const survey = {
        id: "survey-1",
        questions: [question],
        languages: [],
        welcomeCard: { enabled: false },
      } as unknown as TSurvey;

      // Responses with invalid ranking data (not an array)
      const responses = [
        {
          id: "response-1",
          data: { "ranking-q1": "Item 1" }, // Not an array
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        },
      ];

      const dropOff = [
        { questionId: "ranking-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
      ] as unknown as TSurveySummary["dropOff"];

      const summary = await getQuestionSummary(survey, responses, dropOff);

      expect(summary).toHaveLength(1);
      expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Ranking);
      expect(summary[0].responseCount).toBe(0); // No valid responses
      expect((summary[0] as any).choices).toHaveLength(3);

      // All items should have count 0 and avgRanking 0 since we had no valid ranking data
      (summary[0] as any).choices.forEach((choice) => {
        expect(choice.count).toBe(0);
        expect(choice.avgRanking).toBe(0);
      });
    });

    test("getQuestionSummary handles ranking question with values not in choices", async () => {
      const question = {
        id: "ranking-q1",
        type: TSurveyQuestionTypeEnum.Ranking,
        headline: { default: "Rank these items" },
        required: true,
        choices: [
          { id: "item1", label: { default: "Item 1" } },
          { id: "item2", label: { default: "Item 2" } },
          { id: "item3", label: { default: "Item 3" } },
        ],
      };

      const survey = {
        id: "survey-1",
        questions: [question],
        languages: [],
        welcomeCard: { enabled: false },
      } as unknown as TSurvey;

      // Response with some values not in choices
      const responses = [
        {
          id: "response-1",
          data: { "ranking-q1": ["Item 1", "Unknown Item", "Item 3"] }, // "Unknown Item" is not in choices
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        },
      ];

      const dropOff = [
        { questionId: "ranking-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
      ] as unknown as TSurveySummary["dropOff"];

      const summary = await getQuestionSummary(survey, responses, dropOff);

      expect(summary).toHaveLength(1);
      expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Ranking);
      expect(summary[0].responseCount).toBe(1);
      expect((summary[0] as any).choices).toHaveLength(3);

      // Item 1 is in position 1, so avg ranking should be 1
      const item1 = (summary[0] as any).choices.find((c) => c.value === "Item 1");
      expect(item1.count).toBe(1);
      expect(item1.avgRanking).toBe(1);

      // Item 2 was not ranked, so should have count 0 and avgRanking 0
      const item2 = (summary[0] as any).choices.find((c) => c.value === "Item 2");
      expect(item2.count).toBe(0);
      expect(item2.avgRanking).toBe(0);

      // Item 3 is in position 3, so avg ranking should be 3
      const item3 = (summary[0] as any).choices.find((c) => c.value === "Item 3");
      expect(item3.count).toBe(1);
      expect(item3.avgRanking).toBe(3);
    });
  });
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
    expect(prisma.response.findMany).toHaveBeenCalled(); // Check if getResponsesForSummary was effectively called
    expect(getDisplayCountBySurveyId).toHaveBeenCalled();
  });

  test("throws ResourceNotFoundError if survey not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    await expect(getSurveySummary(mockSurveyId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("handles filterCriteria", async () => {
    const filterCriteria: TResponseFilterCriteria = { finished: true };
    const finishedResponses = mockResponses
      .filter((r) => r.finished)
      .map((r) => ({ ...r, contactId: null, personAttributes: {} }));
    vi.mocked(prisma.response.findMany).mockResolvedValue(finishedResponses as any);

    await getSurveySummary(mockSurveyId, filterCriteria);

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

  test("getResponsesForSummary handles null contact properly", async () => {
    const mockSurvey = { id: "survey-1" } as unknown as TSurvey;
    const mockResponse = {
      id: "response-1",
      data: {},
      updatedAt: new Date(),
      contact: null,
      contactAttributes: {},
      language: "en",
      ttc: {},
      finished: true,
    };

    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(prisma.response.findMany).mockResolvedValue([mockResponse]);

    const result = await getResponsesForSummary("survey-1", 10, 0);

    expect(result).toHaveLength(1);
    expect(result[0].contact).toBeNull();
    expect(prisma.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { surveyId: "survey-1" },
      })
    );
  });

  test("getResponsesForSummary extracts contact id and userId when contact exists", async () => {
    const mockSurvey = { id: "survey-1" } as unknown as TSurvey;
    const mockResponse = {
      id: "response-1",
      data: {},
      updatedAt: new Date(),
      contact: {
        id: "contact-1",
        attributes: [
          { attributeKey: { key: "userId" }, value: "user-123" },
          { attributeKey: { key: "email" }, value: "test@example.com" },
        ],
      },
      contactAttributes: {},
      language: "en",
      ttc: {},
      finished: true,
    };

    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(prisma.response.findMany).mockResolvedValue([mockResponse]);

    const result = await getResponsesForSummary("survey-1", 10, 0);

    expect(result).toHaveLength(1);
    expect(result[0].contact).toEqual({
      id: "contact-1",
      userId: "user-123",
    });
  });

  test("getResponsesForSummary handles contact without userId attribute", async () => {
    const mockSurvey = { id: "survey-1" } as unknown as TSurvey;
    const mockResponse = {
      id: "response-1",
      data: {},
      updatedAt: new Date(),
      contact: {
        id: "contact-1",
        attributes: [{ attributeKey: { key: "email" }, value: "test@example.com" }],
      },
      contactAttributes: {},
      language: "en",
      ttc: {},
      finished: true,
    };

    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(prisma.response.findMany).mockResolvedValue([mockResponse]);

    const result = await getResponsesForSummary("survey-1", 10, 0);

    expect(result).toHaveLength(1);
    expect(result[0].contact).toEqual({
      id: "contact-1",
      userId: undefined,
    });
  });

  test("getResponsesForSummary throws DatabaseError when Prisma throws PrismaClientKnownRequestError", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ id: "survey-1" } as unknown as TSurvey);

    const prismaError = new Prisma.PrismaClientKnownRequestError("Database connection error", {
      code: "P2002",
      clientVersion: "4.0.0",
    });

    vi.mocked(prisma.response.findMany).mockRejectedValue(prismaError);

    await expect(getResponsesForSummary("survey-1", 10, 0)).rejects.toThrow(DatabaseError);
    await expect(getResponsesForSummary("survey-1", 10, 0)).rejects.toThrow("Database connection error");
  });

  test("getResponsesForSummary rethrows non-Prisma errors", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ id: "survey-1" } as unknown as TSurvey);

    const genericError = new Error("Something else went wrong");
    vi.mocked(prisma.response.findMany).mockRejectedValue(genericError);

    await expect(getResponsesForSummary("survey-1", 10, 0)).rejects.toThrow("Something else went wrong");
    await expect(getResponsesForSummary("survey-1", 10, 0)).rejects.toThrow(Error);
    await expect(getResponsesForSummary("survey-1", 10, 0)).rejects.not.toThrow(DatabaseError);
  });

  test("getSurveySummary throws DatabaseError when Prisma throws PrismaClientKnownRequestError", async () => {
    vi.mocked(getSurvey).mockResolvedValue({
      id: "survey-1",
      questions: [],
      welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
      languages: [],
    } as unknown as TSurvey);

    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(10);

    const prismaError = new Prisma.PrismaClientKnownRequestError("Database connection error", {
      code: "P2002",
      clientVersion: "4.0.0",
    });

    vi.mocked(prisma.response.findMany).mockRejectedValue(prismaError);

    await expect(getSurveySummary("survey-1")).rejects.toThrow(DatabaseError);
    await expect(getSurveySummary("survey-1")).rejects.toThrow("Database connection error");
  });

  test("getSurveySummary rethrows non-Prisma errors", async () => {
    vi.mocked(getSurvey).mockResolvedValue({
      id: "survey-1",
      questions: [],
      welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
      languages: [],
    } as unknown as TSurvey);

    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(10);

    const genericError = new Error("Something else went wrong");
    vi.mocked(prisma.response.findMany).mockRejectedValue(genericError);

    await expect(getSurveySummary("survey-1")).rejects.toThrow("Something else went wrong");
    await expect(getSurveySummary("survey-1")).rejects.toThrow(Error);
    await expect(getSurveySummary("survey-1")).rejects.not.toThrow(DatabaseError);
  });
});

describe("Address and ContactInfo question types", () => {
  test("getQuestionSummary correctly processes Address question with valid responses", async () => {
    const question = {
      id: "address-q1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "What's your address?" },
      required: true,
      fields: ["line1", "line2", "city", "state", "zip", "country"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "address-q1": [
            { type: "line1", value: "123 Main St" },
            { type: "city", value: "San Francisco" },
            { type: "state", value: "CA" },
          ],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      } as any,
      {
        id: "response-2",
        data: {
          "address-q1": [
            { type: "line1", value: "456 Oak Ave" },
            { type: "city", value: "Seattle" },
            { type: "state", value: "WA" },
          ],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      } as any,
    ];

    const dropOff = [
      { questionId: "address-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Address);
    expect(summary[0].responseCount).toBe(2);
    expect((summary[0] as any).samples).toHaveLength(2);
    expect((summary[0] as any).samples[0].value).toEqual(responses[0].data["address-q1"]);
    expect((summary[0] as any).samples[1].value).toEqual(responses[1].data["address-q1"]);
  });

  test("getQuestionSummary correctly processes ContactInfo question with valid responses", async () => {
    const question = {
      id: "contact-q1",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Your contact information" },
      required: true,
      fields: ["firstName", "lastName", "email", "phone"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "contact-q1": [
            { type: "firstName", value: "John" },
            { type: "lastName", value: "Doe" },
            { type: "email", value: "john@example.com" },
          ],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "contact-q1": [
            { type: "firstName", value: "Jane" },
            { type: "lastName", value: "Smith" },
            { type: "email", value: "jane@example.com" },
          ],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "contact-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.ContactInfo);
    expect((summary[0] as any).responseCount).toBe(2);
    expect((summary[0] as any).samples).toHaveLength(2);
    expect((summary[0] as any).samples[0].value).toEqual(responses[0].data["contact-q1"]);
    expect((summary[0] as any).samples[1].value).toEqual(responses[1].data["contact-q1"]);
  });

  test("getQuestionSummary handles empty array answers for Address type", async () => {
    const question = {
      id: "address-q1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "What's your address?" },
      required: false,
      fields: ["line1", "line2", "city", "state", "zip", "country"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "address-q1": [] }, // Empty array
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "address-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect((summary[0] as any).type).toBe(TSurveyQuestionTypeEnum.Address);
    expect((summary[0] as any).responseCount).toBe(0); // Should be 0 as empty array doesn't count as response
    expect((summary[0] as any).samples).toHaveLength(0);
  });

  test("getQuestionSummary handles non-array answers for ContactInfo type", async () => {
    const question = {
      id: "contact-q1",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Your contact information" },
      required: true,
      fields: ["firstName", "lastName", "email", "phone"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "contact-q1": "Not an array" }, // String instead of array
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "contact-q1": { name: "John" } }, // Object instead of array
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: {}, // No data for this question
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "contact-q1", impressions: 3, dropOffCount: 3, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect((summary[0] as any).type).toBe(TSurveyQuestionTypeEnum.ContactInfo);
    expect((summary[0] as any).responseCount).toBe(0); // Should be 0 as no valid responses
    expect((summary[0] as any).samples).toHaveLength(0);
  });

  test("getQuestionSummary handles mix of valid and invalid responses for Address type", async () => {
    const question = {
      id: "address-q1",
      type: TSurveyQuestionTypeEnum.Address,
      headline: { default: "What's your address?" },
      required: true,
      fields: ["line1", "line2", "city", "state", "zip", "country"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // One valid response, one invalid
    const responses = [
      {
        id: "response-1",
        data: {
          "address-q1": [
            { type: "line1", value: "123 Main St" },
            { type: "city", value: "San Francisco" },
          ],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "address-q1": "Invalid format" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "address-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect((summary[0] as any).type).toBe(TSurveyQuestionTypeEnum.Address);
    expect((summary[0] as any).responseCount).toBe(1); // Should be 1 as only one valid response
    expect((summary[0] as any).samples).toHaveLength(1);
    expect((summary[0] as any).samples[0].value).toEqual(responses[0].data["address-q1"]);
  });

  test("getQuestionSummary applies VALUES_LIMIT correctly for ContactInfo type", async () => {
    const question = {
      id: "contact-q1",
      type: TSurveyQuestionTypeEnum.ContactInfo,
      headline: { default: "Your contact information" },
      required: true,
      fields: ["firstName", "lastName", "email"],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // Create 100 responses (more than VALUES_LIMIT which is 50)
    const responses = Array.from(
      { length: 100 },
      (_, i) =>
        ({
          id: `response-${i}`,
          data: {
            "contact-q1": [
              { type: "firstName", value: `First${i}` },
              { type: "lastName", value: `Last${i}` },
              { type: "email", value: `user${i}@example.com` },
            ],
          },
          updatedAt: new Date(),
          contact: null,
          contactAttributes: {},
          language: null,
          ttc: {},
          finished: true,
        }) as any
    );

    const dropOff = [
      { questionId: "contact-q1", impressions: 100, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect((summary[0] as any).type).toBe(TSurveyQuestionTypeEnum.ContactInfo);
    expect((summary[0] as any).responseCount).toBe(100); // All responses are valid
    expect((summary[0] as any).samples).toHaveLength(50); // Limited to VALUES_LIMIT (50)
  });
});

describe("Matrix question type tests", () => {
  test("getQuestionSummary correctly processes Matrix question with valid responses", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }, { default: "Price" }],
      columns: [{ default: "Poor" }, { default: "Average" }, { default: "Good" }, { default: "Excellent" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Speed: "Good",
            Quality: "Excellent",
            Price: "Average",
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "matrix-q1": {
            Speed: "Average",
            Quality: "Good",
            Price: "Poor",
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "matrix-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(2);

    // Verify Speed row
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(2);
    expect(speedRow.columnPercentages).toHaveLength(4); // 4 columns
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(50);
    expect(speedRow.columnPercentages.find((col) => col.column === "Average").percentage).toBe(50);

    // Verify Quality row
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(2);
    expect(qualityRow.columnPercentages.find((col) => col.column === "Excellent").percentage).toBe(50);
    expect(qualityRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(50);

    // Verify Price row
    const priceRow = summary[0].data.find((row) => row.rowLabel === "Price");
    expect(priceRow.totalResponsesForRow).toBe(2);
    expect(priceRow.columnPercentages.find((col) => col.column === "Poor").percentage).toBe(50);
    expect(priceRow.columnPercentages.find((col) => col.column === "Average").percentage).toBe(50);
  });

  test("getQuestionSummary correctly processes Matrix question with non-default language responses", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects", es: "Califica estos aspectos" },
      required: true,
      rows: [
        { default: "Speed", es: "Velocidad" },
        { default: "Quality", es: "Calidad" },
        { default: "Price", es: "Precio" },
      ],
      columns: [
        { default: "Poor", es: "Malo" },
        { default: "Average", es: "Promedio" },
        { default: "Good", es: "Bueno" },
        { default: "Excellent", es: "Excelente" },
      ],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [{ language: { code: "es" }, default: false }],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // Spanish response with Spanish labels
    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Velocidad: "Bueno",
            Calidad: "Excelente",
            Precio: "Promedio",
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "es",
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "matrix-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    // Mock getLocalizedValue for this test
    const getLocalizedValueOriginal = getLocalizedValue;
    vi.mocked(getLocalizedValue).mockImplementation((obj, langCode) => {
      if (!obj) return "";

      if (langCode === "es" && typeof obj === "object" && "es" in obj) {
        return obj.es;
      }

      if (typeof obj === "object" && "default" in obj) {
        return obj.default;
      }

      return "";
    });

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    // Reset the mock after test
    vi.mocked(getLocalizedValue).mockImplementation(getLocalizedValueOriginal);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(1);

    // Verify Speed row with localized values mapped to default language
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(1);
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(100);

    // Verify Quality row
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(1);
    expect(qualityRow.columnPercentages.find((col) => col.column === "Excellent").percentage).toBe(100);

    // Verify Price row
    const priceRow = summary[0].data.find((row) => row.rowLabel === "Price");
    expect(priceRow.totalResponsesForRow).toBe(1);
    expect(priceRow.columnPercentages.find((col) => col.column === "Average").percentage).toBe(100);
  });

  test("getQuestionSummary handles missing or invalid data for Matrix questions", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: false,
      rows: [{ default: "Speed" }, { default: "Quality" }],
      columns: [{ default: "Poor" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {}, // No matrix data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "matrix-q1": "Not an object", // Invalid format - not an object
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: {
          "matrix-q1": {}, // Empty object
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-4",
        data: {
          "matrix-q1": {
            Speed: "Invalid", // Value not in columns
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "matrix-q1", impressions: 4, dropOffCount: 4, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(3); // Count is 3 because responses 2, 3, and 4 have the "matrix-q1" property

    // All rows should have zero responses for all columns
    summary[0].data.forEach((row) => {
      expect(row.totalResponsesForRow).toBe(0);
      row.columnPercentages.forEach((col) => {
        expect(col.percentage).toBe(0);
      });
    });
  });

  test("getQuestionSummary handles partial and incomplete matrix responses", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }, { default: "Price" }],
      columns: [{ default: "Poor" }, { default: "Average" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Speed: "Good",
            // Quality is missing
            Price: "Average",
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "matrix-q1": {
            Speed: "Average",
            Quality: "Good",
            Price: "Poor",
            ExtraRow: "Poor", // Row not in question definition
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "matrix-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(2);

    // Verify Speed row - both responses provided data
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(2);
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(50);
    expect(speedRow.columnPercentages.find((col) => col.column === "Average").percentage).toBe(50);

    // Verify Quality row - only one response provided data
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(1);
    expect(qualityRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(100);

    // Verify Price row - both responses provided data
    const priceRow = summary[0].data.find((row) => row.rowLabel === "Price");
    expect(priceRow.totalResponsesForRow).toBe(2);

    // ExtraRow should not appear in the summary
    expect(summary[0].data.find((row) => row.rowLabel === "ExtraRow")).toBeUndefined();
  });

  test("getQuestionSummary handles zero responses for Matrix question correctly", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }],
      columns: [{ default: "Poor" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // No responses with matrix data
    const responses = [
      {
        id: "response-1",
        data: { "other-question": "value" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "matrix-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(0);

    // All rows should have proper structure but zero counts
    expect(summary[0].data).toHaveLength(2); // 2 rows

    summary[0].data.forEach((row) => {
      expect(row.columnPercentages).toHaveLength(2); // 2 columns
      expect(row.totalResponsesForRow).toBe(0);
      expect(row.columnPercentages[0].percentage).toBe(0);
      expect(row.columnPercentages[1].percentage).toBe(0);
    });
  });

  test("getQuestionSummary handles Matrix question with mixed valid and invalid column values", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }, { default: "Price" }],
      columns: [{ default: "Poor" }, { default: "Average" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Speed: "Good", // Valid
            Quality: "Invalid Column", // Invalid
            Price: "Average", // Valid
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "matrix-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(1);

    // Speed row should have a valid response
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(1);
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(100);

    // Quality row should have no valid responses
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(0);
    qualityRow.columnPercentages.forEach((col) => {
      expect(col.percentage).toBe(0);
    });

    // Price row should have a valid response
    const priceRow = summary[0].data.find((row) => row.rowLabel === "Price");
    expect(priceRow.totalResponsesForRow).toBe(1);
    expect(priceRow.columnPercentages.find((col) => col.column === "Average").percentage).toBe(100);
  });

  test("getQuestionSummary handles Matrix question with invalid row labels", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }],
      columns: [{ default: "Poor" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Speed: "Good", // Valid
            InvalidRow: "Poor", // Invalid row
            AnotherInvalidRow: "Good", // Invalid row
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "matrix-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(1);

    // There should only be rows for the defined question rows
    expect(summary[0].data).toHaveLength(2); // 2 rows

    // Speed row should have a valid response
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(1);
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(100);

    // Quality row should have no responses
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(0);

    // Invalid rows should not appear in the summary
    expect(summary[0].data.find((row) => row.rowLabel === "InvalidRow")).toBeUndefined();
    expect(summary[0].data.find((row) => row.rowLabel === "AnotherInvalidRow")).toBeUndefined();
  });

  test("getQuestionSummary handles Matrix question with mixed language responses", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects", fr: "Évaluez ces aspects" },
      required: true,
      rows: [
        { default: "Speed", fr: "Vitesse" },
        { default: "Quality", fr: "Qualité" },
      ],
      columns: [
        { default: "Poor", fr: "Médiocre" },
        { default: "Good", fr: "Bon" },
      ],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [
        { language: { code: "en" }, default: true },
        { language: { code: "fr" }, default: false },
      ],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": {
            Speed: "Good", // English
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "en",
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "matrix-q1": {
            Vitesse: "Bon", // French
          },
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: "fr",
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "matrix-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    // Mock getLocalizedValue to handle our specific test case
    const originalGetLocalizedValue = getLocalizedValue;
    vi.mocked(getLocalizedValue).mockImplementation((obj, langCode) => {
      if (!obj) return "";

      if (langCode === "fr" && typeof obj === "object" && "fr" in obj) {
        return obj.fr;
      }

      if (typeof obj === "object" && "default" in obj) {
        return obj.default;
      }

      return "";
    });

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    // Reset mock
    vi.mocked(getLocalizedValue).mockImplementation(originalGetLocalizedValue);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(2);

    // Speed row should have both responses
    const speedRow = summary[0].data.find((row) => row.rowLabel === "Speed");
    expect(speedRow.totalResponsesForRow).toBe(2);
    expect(speedRow.columnPercentages.find((col) => col.column === "Good").percentage).toBe(100);

    // Quality row should have no responses
    const qualityRow = summary[0].data.find((row) => row.rowLabel === "Quality");
    expect(qualityRow.totalResponsesForRow).toBe(0);
  });

  test("getQuestionSummary handles Matrix question with null response data", async () => {
    const question = {
      id: "matrix-q1",
      type: TSurveyQuestionTypeEnum.Matrix,
      headline: { default: "Rate these aspects" },
      required: true,
      rows: [{ default: "Speed" }, { default: "Quality" }],
      columns: [{ default: "Poor" }, { default: "Good" }],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "matrix-q1": null, // Null response data
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "matrix-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Matrix);
    expect(summary[0].responseCount).toBe(0); // Counts as response even with null data

    // Both rows should have zero responses
    summary[0].data.forEach((row) => {
      expect(row.totalResponsesForRow).toBe(0);
      row.columnPercentages.forEach((col) => {
        expect(col.percentage).toBe(0);
      });
    });
  });
});

describe("NPS question type tests", () => {
  test("getQuestionSummary correctly processes NPS question with valid responses", async () => {
    const question = {
      id: "nps-q1",
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend us?" },
      required: true,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "nps-q1": 10 }, // Promoter (9-10)
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "nps-q1": 7 }, // Passive (7-8)
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: { "nps-q1": 3 }, // Detractor (0-6)
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-4",
        data: { "nps-q1": 9 }, // Promoter (9-10)
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "nps-q1", impressions: 4, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.NPS);
    expect(summary[0].responseCount).toBe(4);

    // NPS score = (promoters - detractors) / total * 100
    // Promoters: 2, Detractors: 1, Total: 4
    // (2 - 1) / 4 * 100 = 25
    expect(summary[0].score).toBe(25);

    // Verify promoters
    expect(summary[0].promoters.count).toBe(2);
    expect(summary[0].promoters.percentage).toBe(50); // 2/4 * 100

    // Verify passives
    expect(summary[0].passives.count).toBe(1);
    expect(summary[0].passives.percentage).toBe(25); // 1/4 * 100

    // Verify detractors
    expect(summary[0].detractors.count).toBe(1);
    expect(summary[0].detractors.percentage).toBe(25); // 1/4 * 100

    // Verify dismissed (none in this test)
    expect(summary[0].dismissed.count).toBe(0);
    expect(summary[0].dismissed.percentage).toBe(0);
  });

  test("getQuestionSummary handles NPS question with dismissed responses", async () => {
    const question = {
      id: "nps-q1",
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend us?" },
      required: false,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "nps-q1": 10 }, // Promoter
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "nps-q1": 5 },
        finished: true,
      },
      {
        id: "response-2",
        data: {}, // No answer but has time tracking
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "nps-q1": 3 },
        finished: true,
      },
      {
        id: "response-3",
        data: {}, // No answer but has time tracking
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "nps-q1": 2 },
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "nps-q1", impressions: 3, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.NPS);
    expect(summary[0].responseCount).toBe(3);

    // NPS score = (promoters - detractors) / total * 100
    // Promoters: 1, Detractors: 0, Total: 3
    // (1 - 0) / 3 * 100 = 33.33
    expect(summary[0].score).toBe(33.33);

    // Verify promoters
    expect(summary[0].promoters.count).toBe(1);
    expect(summary[0].promoters.percentage).toBe(33.33); // 1/3 * 100

    // Verify dismissed
    expect(summary[0].dismissed.count).toBe(2);
    expect(summary[0].dismissed.percentage).toBe(66.67); // 2/3 * 100
  });

  test("getQuestionSummary handles NPS question with no responses", async () => {
    const question = {
      id: "nps-q1",
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend us?" },
      required: true,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // No responses with NPS data
    const responses = [
      {
        id: "response-1",
        data: { "other-q": "value" }, // No NPS data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "nps-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.NPS);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].score).toBe(0);

    expect(summary[0].promoters.count).toBe(0);
    expect(summary[0].promoters.percentage).toBe(0);

    expect(summary[0].passives.count).toBe(0);
    expect(summary[0].passives.percentage).toBe(0);

    expect(summary[0].detractors.count).toBe(0);
    expect(summary[0].detractors.percentage).toBe(0);

    expect(summary[0].dismissed.count).toBe(0);
    expect(summary[0].dismissed.percentage).toBe(0);
  });

  test("getQuestionSummary handles NPS question with invalid values", async () => {
    const question = {
      id: "nps-q1",
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend us?" },
      required: true,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "nps-q1": "invalid" }, // String instead of number
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "nps-q1": null }, // Null value
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: { "nps-q1": 5 }, // Valid detractor
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "nps-q1", impressions: 3, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.NPS);
    expect(summary[0].responseCount).toBe(1); // Only one valid response

    // Only one valid response is a detractor
    expect(summary[0].detractors.count).toBe(1);
    expect(summary[0].detractors.percentage).toBe(100);

    // Score should be -100 since all valid responses are detractors
    expect(summary[0].score).toBe(-100);
  });
});

describe("Rating question type tests", () => {
  test("getQuestionSummary correctly processes Rating question with valid responses", async () => {
    const question = {
      id: "rating-q1",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "How would you rate our service?" },
      required: true,
      scale: "number",
      range: 5, // 1-5 rating
      lowerLabel: { default: "Poor" },
      upperLabel: { default: "Excellent" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "rating-q1": 5 }, // Highest rating
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "rating-q1": 4 },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: { "rating-q1": 3 },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-4",
        data: { "rating-q1": 5 }, // Another highest rating
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "rating-q1", impressions: 4, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Rating);
    expect(summary[0].responseCount).toBe(4);

    // Average rating = (5 + 4 + 3 + 5) / 4 = 4.25
    expect(summary[0].average).toBe(4.25);

    // Verify each rating option count and percentage
    const rating5 = summary[0].choices.find((c) => c.rating === 5);
    expect(rating5.count).toBe(2);
    expect(rating5.percentage).toBe(50); // 2/4 * 100

    const rating4 = summary[0].choices.find((c) => c.rating === 4);
    expect(rating4.count).toBe(1);
    expect(rating4.percentage).toBe(25); // 1/4 * 100

    const rating3 = summary[0].choices.find((c) => c.rating === 3);
    expect(rating3.count).toBe(1);
    expect(rating3.percentage).toBe(25); // 1/4 * 100

    const rating2 = summary[0].choices.find((c) => c.rating === 2);
    expect(rating2.count).toBe(0);
    expect(rating2.percentage).toBe(0);

    const rating1 = summary[0].choices.find((c) => c.rating === 1);
    expect(rating1.count).toBe(0);
    expect(rating1.percentage).toBe(0);

    // Verify dismissed (none in this test)
    expect(summary[0].dismissed.count).toBe(0);
  });

  test("getQuestionSummary handles Rating question with dismissed responses", async () => {
    const question = {
      id: "rating-q1",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "How would you rate our service?" },
      required: false,
      scale: "number",
      range: 5,
      lowerLabel: { default: "Poor" },
      upperLabel: { default: "Excellent" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "rating-q1": 5 }, // Valid rating
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "rating-q1": 3 },
        finished: true,
      },
      {
        id: "response-2",
        data: {}, // No answer, but has time tracking
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "rating-q1": 2 },
        finished: true,
      },
      {
        id: "response-3",
        data: {}, // No answer, but has time tracking
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "rating-q1": 4 },
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "rating-q1", impressions: 3, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Rating);
    expect(summary[0].responseCount).toBe(1); // Only one valid rating
    expect(summary[0].average).toBe(5); // Average of the one valid rating

    // Verify dismissed count
    expect(summary[0].dismissed.count).toBe(2);
  });

  test("getQuestionSummary handles Rating question with no responses", async () => {
    const question = {
      id: "rating-q1",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "How would you rate our service?" },
      required: true,
      scale: "number",
      range: 5,
      lowerLabel: { default: "Poor" },
      upperLabel: { default: "Excellent" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // No responses with rating data
    const responses = [
      {
        id: "response-1",
        data: { "other-q": "value" }, // No rating data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "rating-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Rating);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].average).toBe(0);

    // Verify all ratings have 0 count and percentage
    summary[0].choices.forEach((choice) => {
      expect(choice.count).toBe(0);
      expect(choice.percentage).toBe(0);
    });

    // Verify dismissed is 0
    expect(summary[0].dismissed.count).toBe(0);
  });
});

describe("PictureSelection question type tests", () => {
  test("getQuestionSummary correctly processes PictureSelection with valid responses", async () => {
    const question = {
      id: "picture-q1",
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Select the images you like" },
      required: true,
      choices: [
        { id: "img1", imageUrl: "https://example.com/img1.jpg" },
        { id: "img2", imageUrl: "https://example.com/img2.jpg" },
        { id: "img3", imageUrl: "https://example.com/img3.jpg" },
      ],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "picture-q1": ["img1", "img3"] },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "picture-q1": ["img2"] },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "picture-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.PictureSelection);
    expect(summary[0].responseCount).toBe(2);
    expect(summary[0].selectionCount).toBe(3); // Total selections: img1, img2, img3

    // Check individual choice counts
    const img1 = summary[0].choices.find((c) => c.id === "img1");
    expect(img1.count).toBe(1);
    expect(img1.percentage).toBe(50);

    const img2 = summary[0].choices.find((c) => c.id === "img2");
    expect(img2.count).toBe(1);
    expect(img2.percentage).toBe(50);

    const img3 = summary[0].choices.find((c) => c.id === "img3");
    expect(img3.count).toBe(1);
    expect(img3.percentage).toBe(50);
  });

  test("getQuestionSummary handles PictureSelection with no valid responses", async () => {
    const question = {
      id: "picture-q1",
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Select the images you like" },
      required: true,
      choices: [
        { id: "img1", imageUrl: "https://example.com/img1.jpg" },
        { id: "img2", imageUrl: "https://example.com/img2.jpg" },
      ],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "picture-q1": "not-an-array" }, // Invalid format
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {}, // No data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "picture-q1", impressions: 2, dropOffCount: 2, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.PictureSelection);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].selectionCount).toBe(0);

    // All choices should have zero count
    summary[0].choices.forEach((choice) => {
      expect(choice.count).toBe(0);
      expect(choice.percentage).toBe(0);
    });
  });

  test("getQuestionSummary handles PictureSelection with invalid choice ids", async () => {
    const question = {
      id: "picture-q1",
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Select the images you like" },
      required: true,
      choices: [
        { id: "img1", imageUrl: "https://example.com/img1.jpg" },
        { id: "img2", imageUrl: "https://example.com/img2.jpg" },
      ],
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "picture-q1": ["invalid-id", "img1"] }, // One valid, one invalid ID
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "picture-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.PictureSelection);
    expect(summary[0].responseCount).toBe(1);
    expect(summary[0].selectionCount).toBe(2); // Total selections including invalid one

    // img1 should be counted
    const img1 = summary[0].choices.find((c) => c.id === "img1");
    expect(img1.count).toBe(1);
    expect(img1.percentage).toBe(100);

    // img2 should not be counted
    const img2 = summary[0].choices.find((c) => c.id === "img2");
    expect(img2.count).toBe(0);
    expect(img2.percentage).toBe(0);

    // Invalid ID should not appear in choices
    expect(summary[0].choices.find((c) => c.id === "invalid-id")).toBeUndefined();
  });
});

describe("CTA question type tests", () => {
  test("getQuestionSummary correctly processes CTA with valid responses", async () => {
    const question = {
      id: "cta-q1",
      type: TSurveyQuestionTypeEnum.CTA,
      headline: { default: "Would you like to try our product?" },
      buttonLabel: { default: "Try Now" },
      buttonExternal: false,
      buttonUrl: "https://example.com",
      required: true,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "cta-q1": "clicked" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "cta-q1": "dismissed" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-3",
        data: { "cta-q1": "clicked" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      {
        questionId: "cta-q1",
        impressions: 5, // 5 total impressions (including 2 that didn't respond)
        dropOffCount: 0,
        dropOffPercentage: 0,
      },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.CTA);
    expect(summary[0].responseCount).toBe(3);
    expect(summary[0].impressionCount).toBe(5);
    expect(summary[0].clickCount).toBe(2);
    expect(summary[0].skipCount).toBe(1);

    // CTR calculation: clicks / impressions * 100
    expect(summary[0].ctr.count).toBe(2);
    expect(summary[0].ctr.percentage).toBe(40); // (2/5)*100 = 40%
  });

  test("getQuestionSummary handles CTA with no responses", async () => {
    const question = {
      id: "cta-q1",
      type: TSurveyQuestionTypeEnum.CTA,
      headline: { default: "Would you like to try our product?" },
      buttonLabel: { default: "Try Now" },
      buttonExternal: false,
      buttonUrl: "https://example.com",
      required: false,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {}, // No data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      {
        questionId: "cta-q1",
        impressions: 3, // 3 total impressions
        dropOffCount: 3,
        dropOffPercentage: 100,
      },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.CTA);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].impressionCount).toBe(3);
    expect(summary[0].clickCount).toBe(0);
    expect(summary[0].skipCount).toBe(0);

    expect(summary[0].ctr.count).toBe(0);
    expect(summary[0].ctr.percentage).toBe(0);
  });
});

describe("Consent question type tests", () => {
  test("getQuestionSummary correctly processes Consent with valid responses", async () => {
    const question = {
      id: "consent-q1",
      type: TSurveyQuestionTypeEnum.Consent,
      headline: { default: "Do you consent to our terms?" },
      required: true,
      label: { default: "I agree to the terms" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "consent-q1": "accepted" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {}, // Nothing, but time was spent so it's dismissed
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "consent-q1": 5 },
        finished: true,
      },
      {
        id: "response-3",
        data: { "consent-q1": "accepted" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "consent-q1", impressions: 3, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Consent);
    expect(summary[0].responseCount).toBe(3);

    // 2 accepted / 3 total = 66.67%
    expect(summary[0].accepted.count).toBe(2);
    expect(summary[0].accepted.percentage).toBe(66.67);

    // 1 dismissed / 3 total = 33.33%
    expect(summary[0].dismissed.count).toBe(1);
    expect(summary[0].dismissed.percentage).toBe(33.33);
  });

  test("getQuestionSummary handles Consent with no responses", async () => {
    const question = {
      id: "consent-q1",
      type: TSurveyQuestionTypeEnum.Consent,
      headline: { default: "Do you consent to our terms?" },
      required: false,
      label: { default: "I agree to the terms" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "other-q": "value" }, // No consent data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "consent-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Consent);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].accepted.count).toBe(0);
    expect(summary[0].accepted.percentage).toBe(0);
    expect(summary[0].dismissed.count).toBe(0);
    expect(summary[0].dismissed.percentage).toBe(0);
  });

  test("getQuestionSummary handles Consent with invalid values", async () => {
    const question = {
      id: "consent-q1",
      type: TSurveyQuestionTypeEnum.Consent,
      headline: { default: "Do you consent to our terms?" },
      required: true,
      label: { default: "I agree to the terms" },
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "consent-q1": "invalid-value" }, // Invalid value
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "consent-q1": 3 },
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "consent-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Consent);
    expect(summary[0].responseCount).toBe(1); // Counted as response due to ttc
    expect(summary[0].accepted.count).toBe(0); // Not accepted
    expect(summary[0].dismissed.count).toBe(1); // Counted as dismissed
  });
});

describe("Date question type tests", () => {
  test("getQuestionSummary correctly processes Date question with valid responses", async () => {
    const question = {
      id: "date-q1",
      type: TSurveyQuestionTypeEnum.Date,
      headline: { default: "When is your birthday?" },
      required: true,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "date-q1": "2023-01-15" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: { "date-q1": "1990-05-20" },
        updatedAt: new Date(),
        contact: { id: "contact-1", userId: "user-1" },
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "date-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Date);
    expect(summary[0].responseCount).toBe(2);
    expect(summary[0].samples).toHaveLength(2);

    // Check sample values
    expect(summary[0].samples[0].value).toBe("2023-01-15");
    expect(summary[0].samples[1].value).toBe("1990-05-20");

    // Check contact information is preserved
    expect(summary[0].samples[1].contact).toEqual({ id: "contact-1", userId: "user-1" });
  });

  test("getQuestionSummary handles Date question with no responses", async () => {
    const question = {
      id: "date-q1",
      type: TSurveyQuestionTypeEnum.Date,
      headline: { default: "When is your birthday?" },
      required: false,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {}, // No date data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "date-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Date);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].samples).toHaveLength(0);
  });

  test("getQuestionSummary applies VALUES_LIMIT correctly for Date question", async () => {
    const question = {
      id: "date-q1",
      type: TSurveyQuestionTypeEnum.Date,
      headline: { default: "When is your birthday?" },
      required: true,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    // Create 100 responses (more than VALUES_LIMIT which is 50)
    const responses = Array.from({ length: 100 }, (_, i) => ({
      id: `response-${i}`,
      data: { "date-q1": `2023-01-${(i % 28) + 1}` },
      updatedAt: new Date(),
      contact: null,
      contactAttributes: {},
      language: null,
      ttc: {},
      finished: true,
    }));

    const dropOff = [
      { questionId: "date-q1", impressions: 100, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Date);
    expect(summary[0].responseCount).toBe(100);
    expect(summary[0].samples).toHaveLength(50); // Limited to VALUES_LIMIT (50)
  });
});

describe("FileUpload question type tests", () => {
  test("getQuestionSummary correctly processes FileUpload question with valid responses", async () => {
    const question = {
      id: "file-q1",
      type: TSurveyQuestionTypeEnum.FileUpload,
      headline: { default: "Upload your documents" },
      required: true,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {
          "file-q1": ["https://example.com/file1.pdf", "https://example.com/file2.jpg"],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {
          "file-q1": ["https://example.com/file3.docx"],
        },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "file-q1", impressions: 2, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.FileUpload);
    expect(summary[0].responseCount).toBe(2);
    expect(summary[0].files).toHaveLength(2);

    // Check file values
    expect(summary[0].files[0].value).toEqual([
      "https://example.com/file1.pdf",
      "https://example.com/file2.jpg",
    ]);
    expect(summary[0].files[1].value).toEqual(["https://example.com/file3.docx"]);
  });

  test("getQuestionSummary handles FileUpload question with no responses", async () => {
    const question = {
      id: "file-q1",
      type: TSurveyQuestionTypeEnum.FileUpload,
      headline: { default: "Upload your documents" },
      required: false,
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: {}, // No file data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "file-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.FileUpload);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].files).toHaveLength(0);
  });
});

describe("Cal question type tests", () => {
  test("getQuestionSummary correctly processes Cal with valid responses", async () => {
    const question = {
      id: "cal-q1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting with us" },
      required: true,
      calUserName: "test-user",
      calEventSlug: "15min",
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "cal-q1": "booked" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
      {
        id: "response-2",
        data: {}, // Skipped but spent time
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "cal-q1": 10 },
        finished: true,
      },
      {
        id: "response-3",
        data: { "cal-q1": "booked" },
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ] as any;

    const dropOff = [
      { questionId: "cal-q1", impressions: 3, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Cal);
    expect(summary[0].responseCount).toBe(3);

    // 2 booked / 3 total = 66.67%
    expect(summary[0].booked.count).toBe(2);
    expect(summary[0].booked.percentage).toBe(66.67);

    // 1 skipped / 3 total = 33.33%
    expect(summary[0].skipped.count).toBe(1);
    expect(summary[0].skipped.percentage).toBe(33.33);
  });

  test("getQuestionSummary handles Cal with no responses", async () => {
    const question = {
      id: "cal-q1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting with us" },
      required: false,
      calUserName: "test-user",
      calEventSlug: "15min",
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "other-q": "value" }, // No Cal data
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: {},
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "cal-q1", impressions: 1, dropOffCount: 1, dropOffPercentage: 100 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Cal);
    expect(summary[0].responseCount).toBe(0);
    expect(summary[0].booked.count).toBe(0);
    expect(summary[0].booked.percentage).toBe(0);
    expect(summary[0].skipped.count).toBe(0);
    expect(summary[0].skipped.percentage).toBe(0);
  });

  test("getQuestionSummary handles Cal with invalid values", async () => {
    const question = {
      id: "cal-q1",
      type: TSurveyQuestionTypeEnum.Cal,
      headline: { default: "Book a meeting with us" },
      required: true,
      calUserName: "test-user",
      calEventSlug: "15min",
    };

    const survey = {
      id: "survey-1",
      questions: [question],
      languages: [],
      welcomeCard: { enabled: false },
    } as unknown as TSurvey;

    const responses = [
      {
        id: "response-1",
        data: { "cal-q1": "invalid-value" }, // Invalid value
        updatedAt: new Date(),
        contact: null,
        contactAttributes: {},
        language: null,
        ttc: { "cal-q1": 5 },
        finished: true,
      },
    ];

    const dropOff = [
      { questionId: "cal-q1", impressions: 1, dropOffCount: 0, dropOffPercentage: 0 },
    ] as unknown as TSurveySummary["dropOff"];

    const summary: any = await getQuestionSummary(survey, responses, dropOff);

    expect(summary).toHaveLength(1);
    expect(summary[0].type).toBe(TSurveyQuestionTypeEnum.Cal);
    expect(summary[0].responseCount).toBe(1); // Counted as response due to ttc
    expect(summary[0].booked.count).toBe(0);
    expect(summary[0].skipped.count).toBe(1); // Counted as skipped
  });
});
