import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TSurvey as TSurveyListRecord } from "@/modules/survey/list/types/surveys";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyListItem,
  serializeV3SurveyResource,
} from "./serializers";

// ENG-3282: marker off, a session user — every survey reads as workspace-visible, no controls.
const TEST_VISIBILITY = {
  actorContext: { enforced: false, isOrganizationAdmin: false, kind: "user", userId: "user_1" },
  gates: { entitled: false, ready: false },
  ownerName: null,
} as const;

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

const createHindiSurvey = (overrides: Partial<TSurvey> = {}) =>
  ({
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
          code: "hi-IN",
          alias: "hi-in",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome", "hi-IN": "स्वागत है" },
    },
    ...overrides,
  }) as unknown as TSurvey;

describe("serializeV3SurveyResource", () => {
  test("includes distribution and targeting for app surveys", () => {
    const appSurvey = {
      ...baseSurvey,
      type: "app",
      displayOption: "respondMultiple",
      displayPercentage: 25,
      displayLimit: 3,
      recontactDays: 7,
      autoClose: 30,
      autoComplete: 100,
      delay: 5,
      triggers: [{ actionClass: { id: "claa1234567890123456789012", name: "Checkout" } }],
      segment: {
        id: "seg_1",
        filters: [
          {
            id: "f1",
            connector: null,
            resource: {
              id: "r1",
              root: { type: "attribute", contactAttributeKey: "plan" },
              qualifier: { operator: "equals" },
              value: "pro",
            },
          },
        ],
      },
    } as unknown as TSurvey;

    const resource = serializeV3SurveyResource(appSurvey, TEST_VISIBILITY);

    expect(resource.distribution).toEqual({
      displayOption: "respondMultiple",
      displayPercentage: 25,
      displayLimit: 3,
      recontactDays: 7,
      autoClose: 30,
      autoComplete: 100,
      delay: 5,
      triggers: [{ actionClassId: "claa1234567890123456789012" }],
    });
    expect(resource.targeting).toEqual({
      filters: [
        {
          id: "f1",
          connector: null,
          resource: {
            id: "r1",
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "pro",
          },
        },
      ],
    });
  });

  test("omits distribution and targeting for link surveys", () => {
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY);

    expect(resource).not.toHaveProperty("distribution");
    expect(resource).not.toHaveProperty("targeting");
  });

  test("returns multilingual fields using emitted survey language codes", () => {
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY);

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY);

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["en-US"] });

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY);

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
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY, { lang: ["DE_de"] });

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["ZH_hans_cn"] });

    expect(resource).toMatchObject({
      welcomeCard: { headline: { "zh-Hans-CN": "欢迎" } },
    });
  });

  test("filters disabled configured languages for management reads", () => {
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY, { lang: ["fr-FR"] });

    expect(resource).toMatchObject({ welcomeCard: { headline: { "fr-FR": "Bienvenue" } } });
  });

  test("filters multiple requested languages while preserving maps", () => {
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY, { lang: ["en-US", "de-DE"] });

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
    const resource = serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY, { lang: ["de"] });

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["english"] });

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["english"] });

    expect(resource.languages).toEqual([
      { code: "en-US", default: true, enabled: true, alias: "english" },
      { code: "de-DE", default: false, enabled: true },
    ]);
    expect(resource).toMatchObject({
      welcomeCard: { headline: { "en-US": "Welcome" } },
    });
  });

  test("emits canonical language codes and translation keys", () => {
    const survey = createHindiSurvey({
      blocks: [
        {
          id: "block_1",
          name: "Intro",
          elements: [
            {
              id: "satisfaction",
              type: "openText",
              headline: { default: "What should we improve?", "hi-IN": "हमें क्या सुधारना चाहिए?" },
              required: true,
            },
          ],
        },
      ],
    } as unknown as Partial<TSurvey>);

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["hi-IN"] });

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

  test("resolves a survey language by legacy code and alias selectors", () => {
    const survey = createHindiSurvey();

    expect(serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["hi"] })).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
    });
    expect(serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["hi-in"] })).toMatchObject({
      welcomeCard: { headline: { "hi-IN": "स्वागत है" } },
    });
    expect(serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["HI_in"] })).toMatchObject({
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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["vi"] });

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

    const resource = serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["zh_Hans"] });

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

    expect(() => serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["en"] })).toThrow(
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

    expect(() => serializeV3SurveyResource(survey, TEST_VISIBILITY, { lang: ["pt-PT"] })).toThrow(
      "Language 'pt-PT' is not configured for this survey"
    );
  });

  test("exposes the normalized locale code for unknown language errors", () => {
    try {
      serializeV3SurveyResource(baseSurvey, TEST_VISIBILITY, { lang: ["ES_es"] });
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

    expect(() => serializeV3SurveyResource(survey, TEST_VISIBILITY)).toThrow(V3SurveyUnsupportedShapeError);
    expect(() => serializeV3SurveyResource(survey, TEST_VISIBILITY)).toThrow(
      "Legacy question-based surveys are not supported by the v3 survey management API"
    );
  });
});

describe("serializeV3SurveyListItem", () => {
  const baseListSurvey = {
    id: "survey_1",
    name: "Customer onboarding",
    workspaceId: "workspace_1",
    type: "link",
    status: "draft",
    publishOn: null,
    archivedAt: null,
    createdAt: new Date("2026-04-15T10:00:00.000Z"),
    updatedAt: new Date("2026-04-16T10:00:00.000Z"),
    responseCount: 0,
    completedResponseCount: 0,
    singleUse: null,
    visibility: "workspace",
    ownerId: null,
    owner: null,
    visibilityVersion: 0,
    visibilityProjectedVersion: 0,
  } satisfies Omit<TSurveyListRecord, "creator">;

  test("allowlists nested creator fields", () => {
    const survey = {
      ...baseListSurvey,
      creator: {
        name: "Ada",
        email: "ada@example.com",
        id: "user_1",
      },
    } as unknown as TSurveyListRecord;

    expect(serializeV3SurveyListItem(survey, TEST_VISIBILITY).creator).toEqual({ name: "Ada" });
  });

  test("preserves null creator", () => {
    const survey = {
      ...baseListSurvey,
      creator: null,
    } satisfies TSurveyListRecord;

    expect(serializeV3SurveyListItem(survey, TEST_VISIBILITY).creator).toBeNull();
  });

  test("exposes the total and the completed response counts", () => {
    const survey = {
      ...baseListSurvey,
      responseCount: 7,
      completedResponseCount: 4,
      creator: null,
    } satisfies TSurveyListRecord;

    const serialized = serializeV3SurveyListItem(survey, TEST_VISIBILITY);

    expect(serialized.responseCount).toBe(7);
    expect(serialized.completedResponseCount).toBe(4);
  });
});
