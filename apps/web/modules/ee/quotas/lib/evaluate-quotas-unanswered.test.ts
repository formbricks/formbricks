import { describe, expect, test, vi } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TSurveyQuota } from "@formbricks/types/quota";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { evaluateQuotas } from "./utils";

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/response/service", () => ({ updateResponse: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

/**
 * P71 is show-if only (jobenjada review #26): a quota reads a skipped question as it always has, the
 * real survey logic deciding. "Does not equal X" matches a question the respondent skipped.
 */

const survey = {
  id: "survey1",
  name: "Survey",
  blocks: [
    {
      id: "b1",
      name: "b1",
      elements: [
        {
          id: "fav",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "fav" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ],
  endings: [],
  variables: [],
  embeddedFields: [],
  languages: [],
} as unknown as TJsWorkspaceStateSurvey;

const quota: TSurveyQuota = {
  id: "not-x",
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "survey1",
  name: "Not X",
  limit: 10,
  logic: {
    connector: "and",
    conditions: [
      {
        id: "c1",
        leftOperand: { type: "element", value: "fav" },
        operator: "doesNotEqual",
        rightOperand: { type: "static", value: "x" },
      },
    ],
  },
  action: "endSurvey",
  endingCardId: null,
  countPartialSubmissions: false,
};

describe("a quota on a skipped question", () => {
  test('"does not equal X" counts a response that skipped it', () => {
    const { passedQuotas } = evaluateQuotas(survey, {}, {}, [quota], "default");

    expect(passedQuotas.map((passed) => passed.id)).toEqual(["not-x"]);
  });
});
