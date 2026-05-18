import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { V3SurveyLanguageError, serializeV3SurveyResource } from "./serializers";

const baseSurvey = {
  id: "survey_1",
  workspaceId: "workspace_1",
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T11:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  status: "draft",
  metadata: { cx: "enterprise" },
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
    expect((resource.welcomeCard as any).headline).toEqual({
      "en-US": "Welcome",
      "de-DE": "Willkommen",
      "fr-FR": "Bienvenue",
    });
    expect((resource.blocks as any)[0].elements[0].headline).toEqual({
      "en-US": "What should we improve?",
      "de-DE": "Was sollen wir verbessern?",
    });
  });

  test("localizes fields for case-insensitive underscore language selectors", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: "DE_de" });

    expect(resource.language).toBe("de-DE");
    expect((resource.welcomeCard as any).headline).toBe("Willkommen");
    expect((resource.blocks as any)[0].elements[0].headline).toBe("Was sollen wir verbessern?");
    expect((resource.blocks as any)[0].elements[0].subheader).toBe("Tell us more");
  });

  test("resolves language-only selectors against configured survey languages", () => {
    const resource = serializeV3SurveyResource(baseSurvey, { lang: "de" });

    expect(resource.language).toBe("de-DE");
    expect((resource.welcomeCard as any).headline).toBe("Willkommen");
  });

  test("rejects disabled language selectors", () => {
    expect(() => serializeV3SurveyResource(baseSurvey, { lang: "fr" })).toThrow(V3SurveyLanguageError);
    expect(() => serializeV3SurveyResource(baseSurvey, { lang: "fr" })).toThrow(
      "Language 'fr-FR' is disabled for this survey"
    );
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
            code: "pt-BR",
            alias: "br",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          default: false,
          enabled: true,
          language: {
            id: "lang_2",
            code: "pt-PT",
            alias: "pt",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    } as unknown as TSurvey;

    expect(() => serializeV3SurveyResource(survey, { lang: "pt" })).toThrow(
      "Language 'pt' is ambiguous for this survey; use one of pt-BR, pt-PT"
    );
  });
});
