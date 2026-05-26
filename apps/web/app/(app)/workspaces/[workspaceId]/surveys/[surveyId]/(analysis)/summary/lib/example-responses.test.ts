import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { type TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  EXAMPLE_RESPONSE_COUNT,
  buildExampleResponsesSchema,
  generateExampleResponses,
  toExampleResponseInput,
} from "./example-responses";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: mocks.generateOrganizationAIObject,
}));

const i18n = (s: string) => ({ default: s });

const baseQuestion = {
  required: true,
  headline: i18n("hi"),
  subheader: undefined,
};

const makeSurvey = (questions: TSurvey["questions"]): TSurvey =>
  ({
    id: "survey_1",
    name: "Demo Survey",
    welcomeCard: { enabled: false, headline: i18n("Welcome") },
    questions,
  }) as unknown as TSurvey;

describe("buildExampleResponsesSchema", () => {
  beforeEach(() => vi.clearAllMocks());

  test("includes every supported question id; omits unsupported types", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyQuestionTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyQuestionTypeEnum.Rating, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_nps", type: TSurveyQuestionTypeEnum.NPS },
      {
        ...baseQuestion,
        id: "q_choice_single",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Yes") },
          { id: "c2", label: i18n("No") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_choice_multi",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        choices: [
          { id: "c1", label: i18n("A") },
          { id: "c2", label: i18n("B") },
          { id: "c3", label: i18n("C") },
        ],
      },
      // Unsupported types are dropped from the schema.
      { ...baseQuestion, id: "q_date", type: TSurveyQuestionTypeEnum.Date, format: "M-d-y" },
      { ...baseQuestion, id: "q_cta", type: TSurveyQuestionTypeEnum.CTA, buttonExternal: false },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedQuestionIds).toEqual([
      "q_text",
      "q_rating",
      "q_nps",
      "q_choice_single",
      "q_choice_multi",
    ]);
  });

  test("validates correctly-shaped LLM output", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyQuestionTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyQuestionTypeEnum.Rating, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_nps", type: TSurveyQuestionTypeEnum.NPS },
      {
        ...baseQuestion,
        id: "q_choice",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Yes") },
          { id: "c2", label: i18n("No") },
        ],
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const goodPayload = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, i) => ({
        q_text: `Answer ${i}`,
        q_rating: (i % 5) + 1,
        q_nps: i * 2,
        q_choice: i % 2 === 0 ? "Yes" : "No",
      })),
    };
    expect(schema.safeParse(goodPayload).success).toBe(true);
  });

  test("rejects out-of-range rating values", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_rating", type: TSurveyQuestionTypeEnum.Rating, scale: "number", range: 3 },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    const badPayload = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rating: 5 })),
    };
    expect(schema.safeParse(badPayload).success).toBe(false);
  });

  test("rejects fewer than N responses", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_nps", type: TSurveyQuestionTypeEnum.NPS },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    expect(schema.safeParse({ responses: [{ q_nps: 5 }] }).success).toBe(false);
  });

  test("rejects choice labels not in the survey", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_choice",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Yes") },
          { id: "c2", label: i18n("No") },
        ],
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    const bad = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_choice: "Maybe" })),
    };
    expect(schema.safeParse(bad).success).toBe(false);
  });

  test("treats optional questions as optional", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_opt", type: TSurveyQuestionTypeEnum.OpenText, required: false },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    const skipping = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({})),
    };
    expect(schema.safeParse(skipping).success).toBe(true);
  });
});

describe("generateExampleResponses", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns an empty array when the survey has no supported question types", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_date", type: TSurveyQuestionTypeEnum.Date, format: "M-d-y" },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });
    expect(result).toEqual([]);
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("maps LLM output into TResponseData payloads, dropping nullish answers", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyQuestionTypeEnum.OpenText },
      { ...baseQuestion, id: "q_nps", type: TSurveyQuestionTypeEnum.NPS, required: false },
    ] as unknown as TSurvey["questions"]);

    mocks.generateOrganizationAIObject.mockResolvedValue({
      object: {
        responses: [
          { q_text: "Great product", q_nps: 9 },
          { q_text: "Could be better", q_nps: null }, // simulating "skipped optional"
          { q_text: "Fine", q_nps: 7 },
          { q_text: "Loved it" }, // missing key
          { q_text: "Meh", q_nps: 4 },
        ],
      },
    });

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });
    expect(result).toHaveLength(EXAMPLE_RESPONSE_COUNT);
    expect(result[0].data).toEqual({ q_text: "Great product", q_nps: 9 });
    expect(result[1].data).toEqual({ q_text: "Could be better" }); // null dropped
    expect(result[3].data).toEqual({ q_text: "Loved it" }); // missing key dropped
    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledTimes(1);
    const call = mocks.generateOrganizationAIObject.mock.calls[0][0];
    expect(call.organizationId).toBe("org_1");
    expect(call.system).toContain("example survey responses");
    expect(call.prompt).toContain("Generate 5 diverse example responses");
  });

  test("propagates errors from the LLM call (gating errors, network, etc.)", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyQuestionTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);

    mocks.generateOrganizationAIObject.mockRejectedValue(new Error("ai_features_not_enabled"));
    await expect(generateExampleResponses({ survey, organizationId: "org_1" })).rejects.toThrow(
      "ai_features_not_enabled"
    );
  });
});

describe("toExampleResponseInput", () => {
  test("produces a finished TResponseInput keyed to the survey + workspace", () => {
    const out = toExampleResponseInput("survey_1", "workspace_1", { data: { q_text: "hello" } });
    expect(out).toEqual({
      workspaceId: "workspace_1",
      surveyId: "survey_1",
      finished: true,
      data: { q_text: "hello" },
      meta: { source: "example-generation" },
    });
  });
});
