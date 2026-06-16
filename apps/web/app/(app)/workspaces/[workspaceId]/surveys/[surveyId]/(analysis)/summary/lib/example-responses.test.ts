import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import {
  EXAMPLE_AI_GENERATED_TAG_NAME,
  EXAMPLE_IMPRESSION_ONLY_COUNT,
  EXAMPLE_RESPONSE_COUNT,
  buildExampleImpressionTimestamps,
  buildExampleResponsesSchema,
  generateExampleResponseDataset,
  generateExampleResponses,
  toExampleResponseInput,
} from "./example-responses";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIObject: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ai/service", () => ({
  generateOrganizationAIObject: mocks.generateOrganizationAIObject,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
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
    endings: [{ id: "ending_1" }],
    blocks: [{ id: "block_1", name: "Block 1", elements: questions }],
    questions: [],
  }) as unknown as TSurvey;

const makeLegacySurvey = (questions: TSurvey["questions"]): TSurvey =>
  ({
    id: "survey_1",
    name: "Demo Survey",
    welcomeCard: { enabled: false, headline: i18n("Welcome") },
    blocks: [],
    questions,
  }) as unknown as TSurvey;

const mockOpenTextAnswers = (survey: TSurvey): void => {
  const { ctx } = buildExampleResponsesSchema(survey);
  vi.mocked(mocks.generateOrganizationAIObject).mockResolvedValue({
    object: {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, index) => ({
        rowId: `row_${index}`,
        answers: ctx.openTextElementIds.map((id) => ({
          elementId: id,
          answer: `Open text answer ${index}`,
        })),
      })),
    },
  });
};

const getOpenTextRowsFromPrompt = (
  prompt: string
): Array<{
  rowId: string;
  requestedOpenTextAnswers: Array<{ elementId: string }>;
}> => {
  const marker = "Survey context (JSON):\n";
  const contextStart = prompt.indexOf(marker);
  if (contextStart === -1) throw new Error("Expected survey context in prompt");

  return JSON.parse(prompt.slice(contextStart + marker.length)).rows;
};

describe("buildExampleResponsesSchema", () => {
  beforeEach(() => vi.clearAllMocks());

  test("collects supported elements and tracks open-text ids for the text-only LLM schema", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
      {
        ...baseQuestion,
        id: "q_choice",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Founder") },
          { id: "c2", label: i18n("Engineer") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_file",
        type: TSurveyElementTypeEnum.FileUpload,
        allowMultipleFiles: false,
      },
    ] as unknown as TSurvey["questions"]);

    const { ctx, schema } = buildExampleResponsesSchema(survey);

    expect(ctx.supportedElementIds).toEqual(["q_text", "q_rating", "q_choice"]);
    expect(ctx.openTextElementIds).toEqual(["q_text"]);
    expect(
      schema.safeParse({
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, index) => ({
          rowId: `row_${index}`,
          answers: [{ elementId: "q_text", answer: `Answer ${index}` }],
        })),
      }).success
    ).toBe(true);
    expect(JSON.stringify(z.toJSONSchema(schema))).not.toContain("propertyNames");
  });

  test("reads legacy survey.questions when blocks are empty", () => {
    const survey = makeLegacySurvey([
      { ...baseQuestion, id: "q_legacy", type: TSurveyElementTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);

    expect(ctx.supportedElementIds).toEqual(["q_legacy"]);
    expect(ctx.openTextElementIds).toEqual(["q_legacy"]);
  });

  test("drops elements that cannot be generated meaningfully", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_empty_choice",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
        choices: [],
      },
      {
        ...baseQuestion,
        id: "q_empty_matrix",
        type: TSurveyElementTypeEnum.Matrix,
        rows: [{ id: "r1", label: { default: "" } }],
        columns: [{ id: "c1", label: i18n("Good") }],
      },
      {
        ...baseQuestion,
        id: "q_empty_address",
        type: TSurveyElementTypeEnum.Address,
        addressLine1: { show: false, required: false, placeholder: i18n("") },
        addressLine2: { show: false, required: false, placeholder: i18n("") },
        city: { show: false, required: false, placeholder: i18n("") },
        state: { show: false, required: false, placeholder: i18n("") },
        zip: { show: false, required: false, placeholder: i18n("") },
        country: { show: false, required: false, placeholder: i18n("") },
      },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);

    expect(ctx.supportedElementIds).toEqual([]);
    expect(ctx.openTextElementIds).toEqual([]);
  });
});

describe("generateExampleResponseDataset", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns an empty dataset when the survey has no supported question types", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_file",
        type: TSurveyElementTypeEnum.FileUpload,
        allowMultipleFiles: false,
      },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    expect(result).toEqual({ responses: [], displays: [], tagName: EXAMPLE_AI_GENERATED_TAG_NAME });
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("generates closed-ended answers locally with lumpy distributions and no LLM call", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_role",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Founder") },
          { id: "c2", label: i18n("Executive") },
          { id: "c3", label: i18n("Product Manager") },
          { id: "c4", label: i18n("Product Owner") },
          { id: "c5", label: i18n("Software Engineer") },
        ],
      },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });
    const roleCounts = result.responses.reduce<Record<string, number>>((acc, response) => {
      const role = response.data.q_role;
      if (typeof role === "string") acc[role] = (acc[role] ?? 0) + 1;
      return acc;
    }, {});

    expect(result.responses).toHaveLength(EXAMPLE_RESPONSE_COUNT);
    expect(result.displays).toHaveLength(EXAMPLE_IMPRESSION_ONLY_COUNT);
    expect(result.tagName).toBe(EXAMPLE_AI_GENERATED_TAG_NAME);
    expect(Object.values(roleCounts)).toContain(4);
    expect(Object.values(roleCounts)).not.toEqual([2, 2, 2, 2, 2]);
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("asks the LLM only for open-text answers and merges them with planned answers", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS },
    ] as unknown as TSurvey["questions"]);
    mockOpenTextAnswers(survey);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    expect(result.responses[2].data.q_text).toBe("Open text answer 2");
    expect(result.responses[2].data.q_nps).toBeTypeOf("number");
    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mocks.generateOrganizationAIObject).mock.calls[0][0];
    expect(call.organizationId).toBe("org_1");
    expect(call.system).toContain("simulating real survey respondents");
    expect(call.system).toContain("non-empty string");
    expect(call.prompt).toContain("requestedOpenTextAnswers");
    expect(call.prompt).toContain("plannedAnswers");
    expect(call.prompt).toContain("hi");
    expect(call.prompt).not.toContain("Generate 10 diverse example responses");
    expect(call.temperature).toBe(0);
    expect(call.maxOutputTokens).toBe(4096);
    expect(call.timeout).toBe(45_000);
  });

  test("chunks large open-text batches and falls back only for failed chunks", async () => {
    const survey = makeSurvey(
      Array.from({ length: 4 }, (_, index) => ({
        ...baseQuestion,
        id: `q_text_${index + 1}`,
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n(`Question ${index + 1}`),
      })) as unknown as TSurvey["questions"]
    );
    const providerError = new Error("provider failed");
    let callIndex = 0;

    vi.mocked(mocks.generateOrganizationAIObject).mockImplementation(async (call) => {
      callIndex += 1;
      if (callIndex === 2) throw providerError;

      const rows = getOpenTextRowsFromPrompt(String(call.prompt));
      return {
        object: {
          responses: rows.map((row) => ({
            rowId: row.rowId,
            answers: row.requestedOpenTextAnswers.map(({ elementId }) => ({
              elementId,
              answer: `AI ${row.rowId} ${elementId}`,
            })),
          })),
        },
      };
    });

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledTimes(2);
    expect(result.responses[2].data.q_text_1).toBe("AI row_2 q_text_1");
    expect(result.responses[7].data.q_text_1).not.toBe("AI row_7 q_text_1");
    expect(result.responses[7].data.q_text_1).toBeTypeOf("string");
    expect(mocks.loggerError).toHaveBeenCalledWith(
      { err: providerError, organizationId: "org_1" },
      "Failed to generate open-text example responses with AI; using fallback answers"
    );
  });

  test("uses question-aware fallback text when the LLM omits open-text answers", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_audience",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("What type of people would most benefit from this?"),
      },
      {
        ...baseQuestion,
        id: "q_benefit",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("What is the main benefit you receive from this?"),
      },
      {
        ...baseQuestion,
        id: "q_improve",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("How can we improve this for you?"),
      },
    ] as unknown as TSurvey["questions"]);
    vi.mocked(mocks.generateOrganizationAIObject).mockResolvedValue({
      object: {
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, index) => ({
          rowId: `row_${index}`,
          answers: [],
        })),
      },
    });

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });
    const finished = result.responses.find((response) => response.finished);

    expect(finished).toBeDefined();
    if (!finished) throw new Error("Expected at least one finished response");
    expect(finished.data.q_audience).not.toBe(finished.data.q_benefit);
    expect(finished.data.q_benefit).not.toBe(finished.data.q_improve);
    expect(finished.data.q_improve).toMatch(/Make|guidance|Tighten|clearer/);
  });

  test("generates address and contact info locally in the expected wire format", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_addr",
        type: TSurveyElementTypeEnum.Address,
        addressLine1: { show: true, required: true, placeholder: i18n("Street") },
        addressLine2: { show: false, required: false, placeholder: i18n("") },
        city: { show: true, required: true, placeholder: i18n("City") },
        state: { show: false, required: false, placeholder: i18n("") },
        zip: { show: true, required: false, placeholder: i18n("Zip") },
        country: { show: true, required: true, placeholder: i18n("Country") },
      },
      {
        ...baseQuestion,
        id: "q_contact",
        type: TSurveyElementTypeEnum.ContactInfo,
        firstName: { show: true, required: true, placeholder: i18n("First") },
        lastName: { show: false, required: false, placeholder: i18n("") },
        email: { show: true, required: true, placeholder: i18n("Email") },
        phone: { show: false, required: false, placeholder: i18n("") },
        company: { show: true, required: false, placeholder: i18n("Company") },
      },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });
    const finished = result.responses.find((response) => response.finished);

    expect(finished).toBeDefined();
    if (!finished) throw new Error("Expected at least one finished response");
    expect(finished.data.q_addr).toEqual(["5 Sample Road", "", "London", "", "SW1A 1AA", "GB"]);
    expect(finished.data.q_contact).toEqual(["Sam", "", "sam.rivers@example.com", "", "Sample Systems"]);
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("emits the new dataset contract for drop-offs, metadata, timestamps, displays, and tag", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
    ] as unknown as TSurvey["questions"]);
    mockOpenTextAnswers(survey);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });
    const finished = result.responses.filter((response) => response.finished);
    const dropped = result.responses.filter((response) => !response.finished);

    expect(finished).toHaveLength(8);
    expect(dropped).toHaveLength(2);
    expect(result.displays).toHaveLength(EXAMPLE_IMPRESSION_ONLY_COUNT);
    for (const response of result.responses) {
      expect(response.meta.source).toBe("example-generation");
      expect(response.meta.userAgent?.browser).toBeTypeOf("string");
      expect(response.createdAt).toBeInstanceOf(Date);
    }
    for (const display of result.displays) {
      expect(display.createdAt).toBeInstanceOf(Date);
    }
  });

  test("falls back to local open-text answers when the LLM call fails", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);
    const error = new Error("provider failed");
    vi.mocked(mocks.generateOrganizationAIObject).mockRejectedValue(error);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    expect(result.responses).toHaveLength(EXAMPLE_RESPONSE_COUNT);
    expect(result.responses.some((response) => typeof response.data.q_text === "string")).toBe(true);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      { err: error, organizationId: "org_1" },
      "Failed to generate open-text example responses with AI; using fallback answers"
    );
  });

  test("strips HTML from headlines before sending them to the LLM", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_text",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n(
          '<p class="fb-editor-paragraph"><b><strong>How likely are you to shop today?</strong></b></p>'
        ),
      },
    ] as unknown as TSurvey["questions"]);
    mockOpenTextAnswers(survey);

    await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    const call = vi.mocked(mocks.generateOrganizationAIObject).mock.calls[0][0];
    expect(call.prompt).toContain("How likely are you to shop today?");
    expect(call.prompt).not.toContain("fb-editor-paragraph");
    expect(call.prompt).not.toContain("<strong>");
  });

  test("uses survey-agnostic fallback answers when no keyword branch matches", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_reason",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("What is your primary reason for visiting today?"),
      },
    ] as unknown as TSurvey["questions"]);
    vi.mocked(mocks.generateOrganizationAIObject).mockResolvedValue({
      object: {
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, index) => ({
          rowId: `row_${index}`,
          answers: [],
        })),
      },
    });

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    for (const response of result.responses) {
      const answer = String(response.data.q_reason ?? "");
      // Profile priorities are SaaS-flavoured ("team adoption", "missing features", etc.).
      // Generic surveys (like this purchase-intent one) must not leak those into answers.
      expect(answer).not.toMatch(/team adoption|missing features|reporting|reliability|speed|setup/i);
    }
  });

  test("never ships duplicate open-text answers within a single row", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_reason",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("What is your primary reason for visiting today?"),
      },
      {
        ...baseQuestion,
        id: "q_block",
        type: TSurveyElementTypeEnum.OpenText,
        headline: i18n("What, if anything, is holding you back from making a purchase today?"),
      },
    ] as unknown as TSurvey["questions"]);
    vi.mocked(mocks.generateOrganizationAIObject).mockResolvedValue({
      object: {
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, index) => ({
          rowId: `row_${index}`,
          answers: [],
        })),
      },
    });

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });

    for (const response of result.responses) {
      expect(response.data.q_reason).not.toEqual(response.data.q_block);
    }
  });

  test("locally generates valid answers for the remaining closed-ended element types", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS },
      { ...baseQuestion, id: "q_csat", type: TSurveyElementTypeEnum.CSAT, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_ces", type: TSurveyElementTypeEnum.CES, scale: "number", range: 7 },
      { ...baseQuestion, id: "q_date", type: TSurveyElementTypeEnum.Date, format: "M-d-y" },
      { ...baseQuestion, id: "q_consent", type: TSurveyElementTypeEnum.Consent, label: i18n("I agree") },
      {
        ...baseQuestion,
        id: "q_multi",
        type: TSurveyElementTypeEnum.MultipleChoiceMulti,
        choices: [
          { id: "c1", label: i18n("A") },
          { id: "c2", label: i18n("B") },
          { id: "c3", label: i18n("C") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_rank",
        type: TSurveyElementTypeEnum.Ranking,
        choices: [
          { id: "c1", label: i18n("A") },
          { id: "c2", label: i18n("B") },
          { id: "c3", label: i18n("C") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_matrix",
        type: TSurveyElementTypeEnum.Matrix,
        rows: [
          { id: "r1", label: i18n("Speed") },
          { id: "r2", label: i18n("Price") },
        ],
        columns: [
          { id: "c1", label: i18n("Bad") },
          { id: "c2", label: i18n("Good") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_pic",
        type: TSurveyElementTypeEnum.PictureSelection,
        allowMulti: true,
        choices: [
          { id: "pic_1", imageUrl: "https://example.com/a.png" },
          { id: "pic_2", imageUrl: "https://example.com/b.png" },
        ],
      },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponseDataset({ survey, organizationId: "org_1" });
    const finished = result.responses.find((response) => response.finished);

    expect(finished).toBeDefined();
    if (!finished) throw new Error("Expected at least one finished response");
    expect(finished.data.q_nps).toBeTypeOf("number");
    expect(finished.data.q_csat).toBeTypeOf("number");
    expect(finished.data.q_ces).toBeTypeOf("number");
    expect(finished.data.q_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(finished.data.q_consent).toBe("accepted");
    expect(Array.isArray(finished.data.q_multi)).toBe(true);
    expect(Array.isArray(finished.data.q_rank)).toBe(true);
    expect((finished.data.q_rank as string[]).slice().sort()).toEqual(["A", "B", "C"]);
    expect(finished.data.q_matrix).toEqual(expect.objectContaining({ Speed: expect.any(String) }));
    expect(Array.isArray(finished.data.q_pic)).toBe(true);
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("generateExampleResponses returns only the response rows for compatibility", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });

    expect(result).toHaveLength(EXAMPLE_RESPONSE_COUNT);
  });
});

describe("toExampleResponseInput", () => {
  const createdAt = new Date("2026-05-20T10:00:00Z");

  test("forwards generated metadata into the TResponseInput shape", () => {
    const out = toExampleResponseInput(
      "survey_1",
      "workspace_1",
      {
        data: { q_text: "hello" },
        ttc: { q_text: 4200 },
        finished: true,
        endingId: "ending_1",
        language: "de",
        meta: {
          source: "example-generation",
          userAgent: { browser: "Chrome", device: "desktop", os: "macOS" },
          country: "DE",
        },
        createdAt,
      },
      "display_xyz"
    );

    expect(out).toEqual({
      workspaceId: "workspace_1",
      surveyId: "survey_1",
      finished: true,
      endingId: "ending_1",
      language: "de",
      data: { q_text: "hello" },
      ttc: { q_text: 4200 },
      meta: {
        source: "example-generation",
        userAgent: { browser: "Chrome", device: "desktop", os: "macOS" },
        country: "DE",
      },
      displayId: "display_xyz",
    });
  });

  test("omits displayId key entirely when no display is supplied", () => {
    const out = toExampleResponseInput("survey_1", "workspace_1", {
      data: { q_text: "hello" },
      ttc: { q_text: 4200 },
      finished: true,
      endingId: null,
      language: null,
      meta: { source: "example-generation" },
      createdAt,
    });

    expect(out).not.toHaveProperty("displayId");
  });

  test("buildExampleImpressionTimestamps returns the requested count of past dates", () => {
    const now = Date.now();
    const dates = buildExampleImpressionTimestamps(7);

    expect(dates).toHaveLength(7);
    for (const date of dates) {
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeLessThanOrEqual(now);
      expect(date.getTime()).toBeGreaterThan(now - 11 * 24 * 60 * 60 * 1000);
    }
  });
});
