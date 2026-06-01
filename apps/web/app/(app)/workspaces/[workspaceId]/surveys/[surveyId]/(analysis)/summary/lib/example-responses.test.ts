import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import {
  EXAMPLE_RESPONSE_COUNT,
  buildExampleImpressionTimestamps,
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

// Helper: by default we put question data under `survey.blocks[].elements`
// because that's where modern surveys store it. Tests that need the legacy
// path can call `makeLegacySurvey` instead.
const makeSurvey = (questions: TSurvey["questions"]): TSurvey =>
  ({
    id: "survey_1",
    name: "Demo Survey",
    welcomeCard: { enabled: false, headline: i18n("Welcome") },
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

describe("buildExampleResponsesSchema", () => {
  beforeEach(() => vi.clearAllMocks());

  test("includes every supported question id; omits unsupported types", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS },
      {
        ...baseQuestion,
        id: "q_choice_single",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
        choices: [
          { id: "c1", label: i18n("Yes") },
          { id: "c2", label: i18n("No") },
        ],
      },
      {
        ...baseQuestion,
        id: "q_choice_multi",
        type: TSurveyElementTypeEnum.MultipleChoiceMulti,
        choices: [
          { id: "c1", label: i18n("A") },
          { id: "c2", label: i18n("B") },
          { id: "c3", label: i18n("C") },
        ],
      },
      // Unsupported types are dropped from the schema.
      {
        ...baseQuestion,
        id: "q_file",
        type: TSurveyElementTypeEnum.FileUpload,
        allowMultipleFiles: false,
      },
      { ...baseQuestion, id: "q_cta", type: TSurveyElementTypeEnum.CTA, buttonExternal: false },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual([
      "q_text",
      "q_rating",
      "q_nps",
      "q_choice_single",
      "q_choice_multi",
    ]);
  });

  test("validates correctly-shaped LLM output", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS },
      {
        ...baseQuestion,
        id: "q_choice",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
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
        q_nps: i % 11,
        q_choice: i % 2 === 0 ? "Yes" : "No",
      })),
    };
    expect(schema.safeParse(goodPayload).success).toBe(true);
  });

  test("rejects out-of-range rating values", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 3 },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    const badPayload = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rating: 5 })),
    };
    expect(schema.safeParse(badPayload).success).toBe(false);
  });

  test("rejects fewer than N responses", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    expect(schema.safeParse({ responses: [{ q_nps: 5 }] }).success).toBe(false);
  });

  test("rejects choice labels not in the survey", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_choice",
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
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
      { ...baseQuestion, id: "q_opt", type: TSurveyElementTypeEnum.OpenText, required: false },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);
    const skipping = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({})),
    };
    expect(schema.safeParse(skipping).success).toBe(true);
  });

  // Regression: modern surveys store question data under `blocks[].elements`,
  // legacy ones under `questions`. The collector walks both and de-dupes by id.
  test("reads questions from blocks[].elements when survey.questions is empty", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual(["q_text"]);
  });

  test("falls back to legacy survey.questions when blocks is empty", () => {
    const survey = makeLegacySurvey([
      { ...baseQuestion, id: "q_legacy", type: TSurveyElementTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual(["q_legacy"]);
  });

  test("supports CSAT, CES, Date, Ranking, Matrix, Address, ContactInfo", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_csat", type: TSurveyElementTypeEnum.CSAT, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_ces", type: TSurveyElementTypeEnum.CES, scale: "number", range: 7 },
      { ...baseQuestion, id: "q_date", type: TSurveyElementTypeEnum.Date, format: "M-d-y" },
      {
        ...baseQuestion,
        id: "q_rank",
        type: TSurveyElementTypeEnum.Ranking,
        choices: [
          { id: "c1", label: i18n("Speed") },
          { id: "c2", label: i18n("Price") },
          { id: "c3", label: i18n("Quality") },
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
        lastName: { show: true, required: false, placeholder: i18n("Last") },
        email: { show: true, required: true, placeholder: i18n("Email") },
        phone: { show: false, required: false, placeholder: i18n("") },
        company: { show: false, required: false, placeholder: i18n("") },
      },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual([
      "q_csat",
      "q_ces",
      "q_date",
      "q_rank",
      "q_matrix",
      "q_addr",
      "q_contact",
    ]);
  });

  test("validates CSAT and CES range bounds", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_csat", type: TSurveyElementTypeEnum.CSAT, scale: "number", range: 5 },
      { ...baseQuestion, id: "q_ces", type: TSurveyElementTypeEnum.CES, scale: "number", range: 7 },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const valid = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, i) => ({
        q_csat: (i % 5) + 1,
        q_ces: (i % 7) + 1,
      })),
    };
    expect(schema.safeParse(valid).success).toBe(true);

    const csatTooHigh = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_csat: 6, q_ces: 1 })),
    };
    expect(schema.safeParse(csatTooHigh).success).toBe(false);

    const cesTooHigh = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_csat: 5, q_ces: 8 })),
    };
    expect(schema.safeParse(cesTooHigh).success).toBe(false);
  });

  test("validates Date as ISO YYYY-MM-DD", () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_date", type: TSurveyElementTypeEnum.Date, format: "M-d-y" },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_date: "2025-09-14" })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const wrongFormat = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_date: "09/14/2025" })),
    };
    expect(schema.safeParse(wrongFormat).success).toBe(false);
  });

  test("Ranking requires a permutation of all choices (no duplicates, full length)", () => {
    const survey = makeSurvey([
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
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const fullPerm = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rank: ["B", "A", "C"] })),
    };
    expect(schema.safeParse(fullPerm).success).toBe(true);

    const duplicates = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rank: ["A", "A", "C"] })),
    };
    expect(schema.safeParse(duplicates).success).toBe(false);

    const tooShort = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rank: ["A", "B"] })),
    };
    expect(schema.safeParse(tooShort).success).toBe(false);

    const unknownLabel = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_rank: ["A", "B", "Z"] })),
    };
    expect(schema.safeParse(unknownLabel).success).toBe(false);
  });

  test("Matrix requires one column label per row", () => {
    const survey = makeSurvey([
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
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_matrix: { Speed: "Good", Price: "Bad" },
      })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const missingRow = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_matrix: { Speed: "Good" } })),
    };
    expect(schema.safeParse(missingRow).success).toBe(false);

    const unknownColumn = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_matrix: { Speed: "Mediocre", Price: "Bad" },
      })),
    };
    expect(schema.safeParse(unknownColumn).success).toBe(false);
  });

  test("Address schema only requires shown+required fields", () => {
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
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_addr: { addressLine1: "1 Test St", city: "Vienna", country: "AT" },
      })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const missingRequired = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_addr: { addressLine1: "1 Test St", country: "AT" },
      })),
    };
    expect(schema.safeParse(missingRequired).success).toBe(false);
  });

  test("ContactInfo enforces email format on the email field", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_contact",
        type: TSurveyElementTypeEnum.ContactInfo,
        firstName: { show: true, required: true, placeholder: i18n("First") },
        lastName: { show: false, required: false, placeholder: i18n("") },
        email: { show: true, required: true, placeholder: i18n("Email") },
        phone: { show: false, required: false, placeholder: i18n("") },
        company: { show: false, required: false, placeholder: i18n("") },
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_contact: { firstName: "Jane", email: "jane@example.com" },
      })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const badEmail = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_contact: { firstName: "Jane", email: "not-an-email" },
      })),
    };
    expect(schema.safeParse(badEmail).success).toBe(false);
  });

  test("Consent only accepts the literal 'accepted'", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_consent",
        type: TSurveyElementTypeEnum.Consent,
        label: i18n("I agree"),
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_consent: "accepted" })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const wrong = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_consent: "dismissed" })),
    };
    expect(schema.safeParse(wrong).success).toBe(false);
  });

  test("PictureSelection (single) requires exactly one known choice id", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_pic",
        type: TSurveyElementTypeEnum.PictureSelection,
        allowMulti: false,
        choices: [
          { id: "pic_1", imageUrl: "https://example.com/a.png" },
          { id: "pic_2", imageUrl: "https://example.com/b.png" },
          { id: "pic_3", imageUrl: "https://example.com/c.png" },
        ],
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, i) => ({
        q_pic: [`pic_${(i % 3) + 1}`],
      })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const tooMany = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_pic: ["pic_1", "pic_2"],
      })),
    };
    expect(schema.safeParse(tooMany).success).toBe(false);

    const unknownId = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_pic: ["pic_999"] })),
    };
    expect(schema.safeParse(unknownId).success).toBe(false);
  });

  test("PictureSelection (multi) allows 1..N unique ids", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_pic",
        type: TSurveyElementTypeEnum.PictureSelection,
        allowMulti: true,
        choices: [
          { id: "pic_1", imageUrl: "https://example.com/a.png" },
          { id: "pic_2", imageUrl: "https://example.com/b.png" },
          { id: "pic_3", imageUrl: "https://example.com/c.png" },
        ],
      },
    ] as unknown as TSurvey["questions"]);

    const { schema } = buildExampleResponsesSchema(survey);

    const ok = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_pic: ["pic_1", "pic_3"],
      })),
    };
    expect(schema.safeParse(ok).success).toBe(true);

    const duplicates = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
        q_pic: ["pic_1", "pic_1"],
      })),
    };
    expect(schema.safeParse(duplicates).success).toBe(false);

    const empty = {
      responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({ q_pic: [] })),
    };
    expect(schema.safeParse(empty).success).toBe(false);
  });

  test("drops Matrix when rows or columns are empty in default language", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_matrix",
        type: TSurveyElementTypeEnum.Matrix,
        rows: [{ id: "r1", label: { default: "" } }],
        columns: [{ id: "c1", label: i18n("Bad") }],
      },
    ] as unknown as TSurvey["questions"]);

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual([]);
  });

  test("drops Address/ContactInfo when no fields are shown", () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_addr",
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
  });

  test("dedupes when an id appears in both blocks and legacy questions", () => {
    const survey = {
      id: "survey_1",
      name: "Demo Survey",
      welcomeCard: { enabled: false, headline: i18n("Welcome") },
      blocks: [
        {
          id: "block_1",
          name: "Block 1",
          elements: [{ ...baseQuestion, id: "q_dup", type: TSurveyElementTypeEnum.OpenText }],
        },
      ],
      questions: [{ ...baseQuestion, id: "q_dup", type: TSurveyElementTypeEnum.OpenText }],
    } as unknown as TSurvey;

    const { ctx } = buildExampleResponsesSchema(survey);
    expect(ctx.supportedElementIds).toEqual(["q_dup"]);
  });
});

describe("generateExampleResponses", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns an empty array when the survey has no supported question types", async () => {
    const survey = makeSurvey([
      {
        ...baseQuestion,
        id: "q_file",
        type: TSurveyElementTypeEnum.FileUpload,
        allowMultipleFiles: false,
      },
    ] as unknown as TSurvey["questions"]);

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });
    expect(result).toEqual([]);
    expect(mocks.generateOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("maps LLM output into TResponseData payloads, dropping nullish answers", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_nps", type: TSurveyElementTypeEnum.NPS, required: false },
    ] as unknown as TSurvey["questions"]);

    // Build EXAMPLE_RESPONSE_COUNT rows so the schema accepts the LLM output;
    // first few exercise the nullish/missing-key branches in the mapper.
    const rows: Array<Record<string, unknown>> = [
      { q_text: "Great product", q_nps: 9 },
      { q_text: "Could be better", q_nps: null }, // simulating "skipped optional"
      { q_text: "Fine", q_nps: 7 },
      { q_text: "Loved it" }, // missing key
      { q_text: "Meh", q_nps: 4 },
    ];
    while (rows.length < EXAMPLE_RESPONSE_COUNT) {
      rows.push({ q_text: `Filler ${rows.length}`, q_nps: 8 });
    }

    mocks.generateOrganizationAIObject.mockResolvedValue({ object: { responses: rows } });

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });
    expect(result).toHaveLength(EXAMPLE_RESPONSE_COUNT);
    // First two responses are emitted as drop-offs (~20% drop-off rate), so
    // they may have a truncated answer set. Indices 2+ are finished and carry
    // the full data the mapper produced.
    expect(result[2].data).toEqual({ q_text: "Fine", q_nps: 7 });
    expect(result[3].data).toEqual({ q_text: "Loved it" }); // missing key dropped
    expect(mocks.generateOrganizationAIObject).toHaveBeenCalledTimes(1);
    const call = mocks.generateOrganizationAIObject.mock.calls[0][0];
    expect(call.organizationId).toBe("org_1");
    expect(call.system).toContain("example survey responses");
    expect(call.prompt).toContain(`Generate ${EXAMPLE_RESPONSE_COUNT} diverse example responses`);
  });

  test("emits realistic per-response metadata (ttc, meta, finished mix, createdAt)", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
      { ...baseQuestion, id: "q_rating", type: TSurveyElementTypeEnum.Rating, scale: "number", range: 5 },
    ] as unknown as TSurvey["questions"]);

    mocks.generateOrganizationAIObject.mockResolvedValue({
      object: {
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, (_, i) => ({
          q_text: `answer ${i}`,
          q_rating: (i % 5) + 1,
        })),
      },
    });

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });

    // Every row should carry a populated meta block and a createdAt date.
    for (const row of result) {
      expect(row.meta.source).toBe("example-generation");
      expect(row.meta.userAgent?.browser).toBeTypeOf("string");
      expect(row.meta.userAgent?.device).toBeTypeOf("string");
      expect(row.meta.userAgent?.os).toBeTypeOf("string");
      expect(row.meta.country).toBeTypeOf("string");
      expect(row.createdAt).toBeInstanceOf(Date);
    }

    // Drop-off contract: at least one unfinished response, and finished
    // responses keep both element answers + per-element ttc.
    const finished = result.filter((r) => r.finished);
    const dropped = result.filter((r) => !r.finished);
    expect(finished.length).toBeGreaterThan(0);
    expect(dropped.length).toBeGreaterThan(0);
    expect(finished.length + dropped.length).toBe(EXAMPLE_RESPONSE_COUNT);
    for (const f of finished) {
      expect(f.ttc.q_text).toBeGreaterThan(0);
      expect(f.ttc.q_rating).toBeGreaterThan(0);
    }
  });

  test("transforms Address/ContactInfo object output into fixed-length arrays", async () => {
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
        company: { show: false, required: false, placeholder: i18n("") },
      },
    ] as unknown as TSurvey["questions"]);

    mocks.generateOrganizationAIObject.mockResolvedValue({
      object: {
        responses: Array.from({ length: EXAMPLE_RESPONSE_COUNT }, () => ({
          q_addr: { addressLine1: "1 Test St", city: "Vienna", zip: "1010", country: "AT" },
          q_contact: { firstName: "Jane", email: "jane@example.com" },
        })),
      },
    });

    const result = await generateExampleResponses({ survey, organizationId: "org_1" });
    // First couple of rows are drop-offs (DROP_OFF_RATE * N), so check a row
    // that's guaranteed finished to assert the address/contact transformation.
    const finished = result.find((r) => r.finished);
    expect(finished).toBeDefined();
    expect(finished!.data.q_addr).toEqual(["1 Test St", "", "Vienna", "", "1010", "AT"]);
    expect(finished!.data.q_contact).toEqual(["Jane", "", "jane@example.com", "", ""]);
  });

  test("propagates errors from the LLM call (gating errors, network, etc.)", async () => {
    const survey = makeSurvey([
      { ...baseQuestion, id: "q_text", type: TSurveyElementTypeEnum.OpenText },
    ] as unknown as TSurvey["questions"]);

    mocks.generateOrganizationAIObject.mockRejectedValue(new Error("ai_features_not_enabled"));
    await expect(generateExampleResponses({ survey, organizationId: "org_1" })).rejects.toThrow(
      "ai_features_not_enabled"
    );
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
    for (const d of dates) {
      expect(d).toBeInstanceOf(Date);
      expect(d.getTime()).toBeLessThanOrEqual(now);
      // 10-day spread window from pickCreatedAt; allow a small buffer.
      expect(d.getTime()).toBeGreaterThan(now - 11 * 24 * 60 * 60 * 1000);
    }
  });

  test("propagates drop-off shape (finished=false, no language, null endingId)", () => {
    const out = toExampleResponseInput("survey_1", "workspace_1", {
      data: { q_text: "partial" },
      ttc: { q_text: 3000 },
      finished: false,
      endingId: null,
      language: null,
      meta: {
        source: "example-generation",
        userAgent: { browser: "Safari", device: "mobile", os: "iOS" },
        country: "US",
      },
      createdAt,
    });

    expect(out.finished).toBe(false);
    expect(out.endingId).toBeNull();
    expect(out.language).toBeUndefined();
  });
});
