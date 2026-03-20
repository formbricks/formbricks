import { TSurveySummary } from "@formbricks/types/surveys/types";

export const MOCK_SURVEY_ID = "survey-test-123";
export const MOCK_USER_ID = "user-test-456";
export const MOCK_LINK_ID = "link-test-789";
export const MOCK_TOKEN = "mock-jwt-token-abc";

export const MOCK_SHARE_LINK = {
  id: MOCK_LINK_ID,
  surveyId: MOCK_SURVEY_ID,
  token: MOCK_TOKEN,
  label: "Test Link",
  expiresAt: null,
  revokedAt: null,
  createdById: MOCK_USER_ID,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

export const MOCK_SUMMARY_WITH_PII: TSurveySummary = {
  meta: {
    completedPercentage: 75,
    completedResponses: 15,
    displayCount: 20,
    dropOffPercentage: 25,
    dropOffCount: 5,
    startsPercentage: 100,
    totalResponses: 20,
    ttcAverage: 30,
  },
  dropOff: [
    {
      elementId: "q1",
      label: "Question 1",
      impressions: 20,
      dropOffCount: 5,
      dropOffPercentage: 25,
    },
  ],
  summary: [
    {
      type: "openText",
      responseCount: 2,
      question: {
        id: "q1",
        type: "openText",
        headline: { default: "What do you think?" },
        required: false,
        inputType: "text",
        configuredLanguages: ["default"],
      },
      samples: [
        {
          id: "resp-1",
          updatedAt: new Date("2025-01-01"),
          value: "Great product!",
          contact: { id: "contact-1" },
          contactAttributes: { email: "user@example.com" },
        },
        {
          id: "resp-2",
          updatedAt: new Date("2025-01-02"),
          value: "Needs improvement",
          contact: null,
          contactAttributes: {},
        },
      ],
    },
    {
      type: "multipleChoiceSingle",
      responseCount: 3,
      question: {
        id: "q2",
        type: "multipleChoiceSingle",
        headline: { default: "Pick one" },
        required: true,
        choices: [
          { id: "c1", label: { default: "Option A" } },
          { id: "c2", label: { default: "Option B" } },
          { id: "other", label: { default: "Other" } },
        ],
        shuffleOption: "none",
        configuredLanguages: ["default"],
      },
      choices: [
        { value: "Option A", count: 1, percentage: 33 },
        { value: "Option B", count: 1, percentage: 33 },
        {
          value: "Other",
          count: 1,
          percentage: 33,
          others: [
            {
              value: "Custom answer",
              contact: { id: "contact-2" },
              contactAttributes: { name: "John" },
            },
          ],
        },
      ],
    },
  ] as unknown as TSurveySummary["summary"],
  quotas: [
    {
      quotaId: "quota-1",
      status: "in_progress" as const,
      questionsAndFilters: [],
      currentCount: 5,
      limit: 10,
      recurrence: "none" as const,
    },
  ],
};
