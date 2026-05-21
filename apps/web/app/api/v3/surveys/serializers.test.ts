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

describe("serializeV3SurveyResource", () => {
  test("returns canonical multilingual fields using real locale codes", () => {
    const resource = serializeV3SurveyResource(baseSurvey);

    expect(resource.defaultLanguage).toBe("en-US");
    expect(resource).not.toHaveProperty("language");
    expect(resource.languages).toEqual([
      { code: "en-US", default: true, enabled: true },
      { code: "de-DE", default: false, enabled: true },
      { code: "fr-FR", default: false, enabled: false },
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

  test("rejects language-only selectors", () => {
    expect(() => serializeV3SurveyResource(baseSurvey, { lang: ["de"] })).toThrow(
      "Language 'de' is not a valid locale code"
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
