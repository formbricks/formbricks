import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyResource,
} from "./serializers";

const baseSurvey = {
  id: "survey_1",
  workspaceId: "workspace_1",
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T11:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  status: "draft",
  metadata: {
    cx: "enterprise",
    arbitraryConfig: { default: "preserve-me", mode: "strict" },
    title: { default: "Product Feedback", "de-DE": "Produktfeedback" },
  },
  languages: [
    {
      default: true,
      enabled: true,
      language: { id: "lang_1", code: "en-US", alias: "en", createdAt: new Date(), updatedAt: new Date() },
    },
    {
      default: false,
      enabled: true,
      language: { id: "lang_2", code: "de-DE", alias: "de", createdAt: new Date(), updatedAt: new Date() },
    },
    {
      default: false,
      enabled: false,
      language: { id: "lang_3", code: "fr-FR", alias: "fr", createdAt: new Date(), updatedAt: new Date() },
    },
  ],
  questions: [],
  welcomeCard: {
    enabled: true,
    headline: { default: "Welcome", "de-DE": "Willkommen", "fr-FR": "Bienvenue" },
  },
  blocks: [
    {
      id: "block_1",
      name: "Intro",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: { default: "What should we improve?", "de-DE": "Was sollen wir verbessern?" },
          subheader: { default: "Tell us more" },
          required: true,
        },
      ],
    },
  ],
  endings: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
} as unknown as TSurvey;

const createLegacyHindiSurvey = (overrides: Partial<TSurvey> = {}) =>
  ({
    ...baseSurvey,
    languages: [
      {
        default: true,
        enabled: true,
        language: {
          id: "lang_1",
          code: "en",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        default: false,
        enabled: true,
        language: {
          id: "lang_2",
          code: "hi",
          alias: "hi-in",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome", hi: "स्वागत है" },
    },
    ...overrides,
  }) as unknown as TSurvey;

describe("serializeV3SurveyResource", () => {
  test("returns multilingual fields using emitted survey language codes", () => {
    const resource = serializeV3SurveyResource(baseSurvey);

    expect(resource.defaultLanguage).toBe("en-US");
    expect(resource).not.toHaveProperty("language");
    expect(resource.languages).toEqual([
      { code: "en-US", default: true, enabled: true, alias: "en" },
      { code: "de-DE", default: false, enabled: true, alias: "de" },
      { code: "fr-FR", default: false, enabled: false, alias: "fr" },
    ]);
    expect(resource).toMatchObject({
      metadata: {
        cx: "enterprise",
        arbitraryConfig: { default: "preserve-me", mode: "strict" },
        title: {
          "en-US": "Product Feedback",
          "de-DE": "Produktfeedback",
        },
      },
    });
    expect(resource).toMatchObject({
      welcomeCard: {
        headline: {
          "en-US": "Welcome",
          "de-DE": "Willkommen",
          "fr-FR": "Bienvenue",
        },
      },
    });
    expect(resource).toMatchObject({
      blocks: [
        {
          elements: [
            {
              headline: {
                "en-US": "What should we improve?",
                "de-DE": "Was sollen wir verbessern?",
              },
            },
          ],
        },
      ],
    });
  });

  test("does not expose the internal default pseudo-locale for surveys without configured languages", () => {
    const survey = {
      ...baseSurvey,
      languages: [],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
      },
      blocks: [
        {
          id: "block_1",
          name: "Intro",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { default: "What should we improve?" },
              required: true,
            },
          ],
        },
      ],
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey);

    expect(resource.defaultLanguage).toBe("en-US");
    expect(resource.languages).toEqual([{ code: "en-US", default: true, enabled: true }]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "en-US": "Welcome" } },
      blocks: [
        {
          elements: [
            {
              headline: { "en-US": "What should we improve?" },
            },
          ],
        },
      ],
    });
  });

  test("filters the implicit default language for surveys without configured languages", () => {
    const survey = {
      ...baseSurvey,
      languages: [],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["en-US"] });

    expect(resource).not.toHaveProperty("language");
    expect(resource).toMatchObject({ welcomeCard: { headline: { "en-US": "Welcome" } } });
  });

  test("preserves stored locale variants when their keys use non-canonical casing or separators", () => {
    const survey = {
      ...baseSurvey,
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome", de_de: "Willkommen" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey);

    expect(resource).toMatchObject({
      welcomeCard: {
        headline: {
          "en-US": "Welcome",
          "de-DE": "Willkommen",
        },
      },
    });
  });

  test("filters fields for case-insensitive underscore language selectors while preserving maps", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: ["DE_de"] });

    expect(resource).not.toHaveProperty("language");
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "de-DE": "Willkommen" } },
      blocks: [
        {
          elements: [
            {
              headline: { "de-DE": "Was sollen wir verbessern?" },
              subheader: { "de-DE": "Tell us more" },
            },
          ],
        },
      ],
    });
  });

  test("filters script-region locale selectors while preserving maps", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        ...baseSurvey.languages,
        {
          default: false,
          enabled: true,
          language: {
            id: "lang_4",
            code: "zh-Hans-CN",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome", zh_hans_cn: "欢迎" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["ZH_hans_cn"] });

    expect(resource).toMatchObject({
      welcomeCard: { headline: { "zh-Hans-CN": "欢迎" } },
    });
  });

  test("filters disabled configured languages for management reads", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: ["fr-FR"] });

    expect(resource).toMatchObject({ welcomeCard: { headline: { "fr-FR": "Bienvenue" } } });
  });

  test("filters multiple requested languages while preserving maps", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: ["en-US", "de-DE"] });

    expect(resource).not.toHaveProperty("language");
    expect(resource).toMatchObject({
      welcomeCard: {
        headline: {
          "en-US": "Welcome",
          "de-DE": "Willkommen",
        },
      },
      blocks: [
        {
          elements: [
            {
              headline: {
                "en-US": "What should we improve?",
                "de-DE": "Was sollen wir verbessern?",
              },
            },
          ],
        },
      ],
    });
  });

  test("filters fields for configured language aliases", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: ["de"] });

    expect(resource).toMatchObject({
      welcomeCard: { headline: { "de-DE": "Willkommen" } },
      blocks: [
        {
          elements: [
            {
              headline: { "de-DE": "Was sollen wir verbessern?" },
            },
          ],
        },
      ],
    });
  });

  test("filters fields for non-locale configured language aliases", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "en-US",
            alias: "english",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["english"] });

    expect(resource.languages).toEqual([{ code: "en-US", default: true, enabled: true, alias: "english" }]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "en-US": "Welcome" } },
    });
  });

  test("trims configured language aliases and omits blank aliases", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "en-US",
            alias: " english ",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          default: false,
          enabled: true,
          language: {
            id: "lang_2",
            code: "de-DE",
            alias: "   ",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Welcome", "de-DE": "Willkommen" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["english"] });

    expect(resource.languages).toEqual([
      { code: "en-US", default: true, enabled: true, alias: "english" },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "en-US": "Welcome" } },
    });
  });

  test("maps known legacy stored language codes and translation keys to emitted response codes", () => {
    const survey = createLegacyHindiSurvey({
      blocks: [
        {
          id: "block_1",
          name: "Intro",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { default: "What should we improve?", hi: "हमें क्या सुधारना चाहिए?" },
              required: true,
            },
          ],
        },
      ],
    });

    const resource = serializeV3SurveyResource(survey, { lang: ["hi-IN"] });

    expect(resource.defaultLanguage).toBe("en-US");
    expect(resource.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "hi-IN", default: false, enabled: true, alias: "hi-in" },
    ]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
      blocks: [
        {
          elements: [
            {
              headline: { "hi-IN": "हमें क्या सुधारना चाहिए?" },
            },
          ],
        },
      ],
    });
  });

  test("filters legacy stored language codes by legacy code and alias", () => {
    const survey = createLegacyHindiSurvey();

    expect(serializeV3SurveyResource(survey, { lang: ["hi"] })).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
    });
    expect(serializeV3SurveyResource(survey, { lang: ["hi-in"] })).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
    });
    expect(serializeV3SurveyResource(survey, { lang: ["HI_in"] })).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
    });
  });

  test("resolves language-only selectors and emits configured language-only map keys", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "vi",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Chào mừng" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["vi"] });

    expect(resource.defaultLanguage).toBe("vi");
    expect(resource.languages).toEqual([{ code: "vi", default: true, enabled: true }]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { vi: "Chào mừng" } },
    });
  });

  test("resolves script-only selectors and emits configured script-only map keys", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "zh-Hans",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "欢迎" },
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(survey, { lang: ["zh_Hans"] });

    expect(resource.defaultLanguage).toBe("zh-Hans");
    expect(resource.languages).toEqual([{ code: "zh-Hans", default: true, enabled: true }]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "zh-Hans": "欢迎" } },
    });
  });

  test("rejects ambiguous language-only selectors", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "en-US",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          default: false,
          enabled: true,
          language: {
            id: "lang_2",
            code: "en-GB",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    } as unknown as TSurvey;

    expect(() => serializeV3SurveyResource(survey, { lang: ["en"] })).toThrow(
      "Language 'en' is ambiguous for this survey. Matching languages: en-US, en-GB"
    );
  });

  test("does not fallback full locale selectors to another configured region", () => {
    const survey = {
      ...baseSurvey,
      languages: [
        {
          default: true,
          enabled: true,
          language: {
            id: "lang_1",
            code: "pt-BR",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
      welcomeCard: {
        enabled: true,
        headline: { default: "Boas-vindas" },
      },
    } as unknown as TSurvey;

    expect(() => serializeV3SurveyResource(survey, { lang: ["pt-PT"] })).toThrow(
      "Language 'pt-PT' is not configured for this survey"
    );
  });

  test("exposes the normalized locale code for unknown language errors", () => {
    try {
      serializeV3SurveyResource(baseSurvey, { lang: ["ES_es"] });
    } catch (error) {
      if (!(error instanceof V3SurveyLanguageError)) {
        throw error;
      }

      expect(error.message).toBe("Language 'es-ES' is not configured for this survey");
      expect(error.normalizedCode).toBe("es-ES");
      return;
    }

    throw new Error("Expected V3SurveyLanguageError");
  });

  test("rejects legacy question-based survey shapes instead of returning an incomplete block resource", () => {
    const survey = {
      ...baseSurvey,
      questions: [{ id: "legacy_question", type: "openText", headline: { default: "Legacy question" } }],
      blocks: [],
    } as unknown as TSurvey;

    expect(() => serializeV3SurveyResource(survey)).toThrow(V3SurveyUnsupportedShapeError);
    expect(() => serializeV3SurveyResource(survey)).toThrow(
      "Legacy question-based surveys are not supported by the v3 survey management API"
    );
  });
});
