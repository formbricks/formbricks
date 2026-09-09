import { describe, expect, test, vi } from "vitest";
import { prepareV3SurveyCreateInput } from "../prepare";
import {
  IMPORTED_SURVEY_ELEMENT_TYPES,
  IMPORTED_SURVEY_MAX_BLOCKS,
  IMPORTED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
} from "./constants";
import { createGeneratedSurveyDraftSchema, createLocalizedText } from "./schemas";
import {
  V3SurveyGeneratedPayloadValidationError,
  buildV3SurveyCreatePayloadFromDraft,
  createSurveyDraftGenerationRequest,
} from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/service", () => ({ generateOrganizationAIObject: vi.fn() }));

const workspaceId = "clxx1234567890123456789012";
const input = { workspaceId, type: "link" as const };
const codes = ["en-US", "de-DE"] as const;

const importSchema = createGeneratedSurveyDraftSchema({
  text: createLocalizedText(codes, 220),
  description: createLocalizedText(codes, 320),
  choice: createLocalizedText(codes, 80),
  limits: {
    maxBlocks: IMPORTED_SURVEY_MAX_BLOCKS,
    maxQuestionsPerBlock: IMPORTED_SURVEY_MAX_QUESTIONS_PER_BLOCK,
  },
  elementTypes: IMPORTED_SURVEY_ELEMENT_TYPES,
  languageCodes: codes,
});

const bilingual = (en: string, de?: string) => [
  { languageCode: "en-US", text: en },
  ...(de ? [{ languageCode: "de-DE", text: de }] : []),
];

const element = (
  type: string,
  headline: ReturnType<typeof bilingual>,
  extra: Record<string, unknown> = {}
) => ({
  type,
  headline,
  subheader: null,
  required: false,
  placeholder: null,
  longAnswer: null,
  choices: null,
  lowerLabel: null,
  upperLabel: null,
  scale: null,
  range: null,
  ...extra,
});

const draft = (elements: ReturnType<typeof element>[], overrides: Record<string, unknown> = {}) => ({
  language: "en-US",
  defaultLanguage: "en-US",
  name: bilingual("Feedback", "Feedback"),
  description: null,
  welcomeCard: null,
  ending: null,
  blocks: [{ name: bilingual("Block", "Block"), questions: elements }],
  ...overrides,
});

const languages = { defaultLanguage: "en-US", codes: [...codes] };
const build = (value: unknown) =>
  buildV3SurveyCreatePayloadFromDraft(input, value, { schema: importSchema.internal, languages });

describe("buildV3SurveyCreatePayloadFromDraft with languages", () => {
  test("a bilingual draft produces a payload declaring both languages and public locale maps", () => {
    const result = build(
      draft([element("openText", bilingual("How was it?", "Wie war es?"), { longAnswer: true })])
    );

    expect(result.payload.defaultLanguage).toBe("en-US");
    expect(result.payload.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(result.payload.blocks[0].elements[0].headline).toEqual({
      "en-US": "How was it?",
      "de-DE": "Wie war es?",
    });
    expect(result.payload.name).toBe("Feedback");
    expect(result.translationFills).toEqual([]);
    expect(result.validation.valid).toBe(true);
  });

  test("a text missing a declared language is filled from the default and recorded", () => {
    const result = build(draft([element("nps", bilingual("Recommend us?"))]));

    const headline = result.payload.blocks[0].elements[0].headline;
    expect(headline).toEqual({ "en-US": "Recommend us?", "de-DE": "Recommend us?" });
    expect(result.translationFills).toEqual([
      expect.objectContaining({ languageCode: "de-DE", path: expect.stringContaining("headline") }),
    ]);
    expect(result.validation.valid).toBe(true);
  });

  test("a language code outside the declared set is rejected by the import schema", () => {
    const bad = draft([
      element("openText", [
        { languageCode: "en-US", text: "Q" },
        { languageCode: "fr-FR", text: "Q" },
      ]),
    ]);

    expect(() => build(bad)).toThrow(V3SurveyGeneratedPayloadValidationError);
    expect(
      importSchema.internal.safeParse({ ...draft([]), blocks: [], defaultLanguage: "fr-FR" }).success
    ).toBe(false);
  });

  test("a 16-block × 8-question draft is accepted by the import variant only", () => {
    const question = element("openText", bilingual("Q", "F"));
    const big = draft([], {
      blocks: Array.from({ length: 16 }, (_, index) => ({
        name: bilingual(`Block ${index + 1}`, `Block ${index + 1}`),
        questions: Array.from({ length: 8 }, () => question),
      })),
    });

    expect(importSchema.internal.safeParse(big).success).toBe(true);
    expect(createGeneratedSurveyDraftSchema().internal.safeParse(big).success).toBe(false);
    expect(build(big).payload.blocks).toHaveLength(16);
  });

  test("cta, consent, address and contactInfo build create-valid elements", () => {
    const result = build(
      draft([
        element("cta", bilingual("Read the docs", "Lies die Doku"), {
          buttonLabel: bilingual("Open", "Öffnen"),
          buttonUrl: "https://formbricks.com/docs",
        }),
        element("consent", bilingual("Terms", "Bedingungen"), {
          label: bilingual("I accept the terms", "Ich akzeptiere die Bedingungen"),
          required: true,
        }),
        element("address", bilingual("Where do you live?", "Wo wohnst du?"), {
          fields: ["addressLine1", "city", "country"],
          required: true,
        }),
        element("contactInfo", bilingual("How can we reach you?", "Wie erreichen wir dich?"), {
          fields: ["email"],
        }),
      ])
    );

    const [cta, consent, address, contactInfo] = result.payload.blocks[0].elements as Array<
      Record<string, unknown>
    >;
    expect(cta).toMatchObject({
      type: "cta",
      buttonExternal: true,
      buttonUrl: "https://formbricks.com/docs",
      ctaButtonLabel: { "en-US": "Open", "de-DE": "Öffnen" },
    });
    expect(consent).toMatchObject({ type: "consent", label: { "en-US": "I accept the terms" } });
    expect(address).toMatchObject({
      type: "address",
      addressLine1: { show: true, required: true },
      addressLine2: { show: false, required: false },
      country: { show: true, required: true },
    });
    expect(contactInfo).toMatchObject({
      type: "contactInfo",
      email: { show: true, required: false },
      phone: { show: false, required: false },
    });
    expect(prepareV3SurveyCreateInput(result.payload).ok).toBe(true);
  });

  test("the default (Create with AI) variant rejects the import-only element types", () => {
    const parsed = createGeneratedSurveyDraftSchema().internal.safeParse({
      language: "en-US",
      name: "Feedback",
      description: null,
      welcomeCard: null,
      ending: null,
      blocks: [
        {
          name: "Block",
          questions: [
            {
              type: "cta",
              headline: "Read the docs",
              subheader: null,
              required: false,
              placeholder: null,
              longAnswer: null,
              choices: null,
              lowerLabel: null,
              upperLabel: null,
              scale: null,
              range: null,
            },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("createSurveyDraftGenerationRequest", () => {
  test("shares the model knobs and passes prompts through", () => {
    const request = createSurveyDraftGenerationRequest({
      schema: importSchema.forAI,
      schemaName: "ImportedSurveyDraft",
      schemaDescription: "d",
      system: "s",
      prompt: "p",
    });

    expect(request).toMatchObject({
      schemaName: "ImportedSurveyDraft",
      system: "s",
      prompt: "p",
      temperature: 0.2,
      maxOutputTokens: 8192,
      timeout: 45_000,
    });
    expect(request.schema).toBe(importSchema.forAI);
  });
});
