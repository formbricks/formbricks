import { describe, expect, test } from "vitest";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getElementsFromSurveyBlocks,
  getSurveyLanguageCode,
  getWebAppLocale,
  isRTL,
  isRTLLanguage,
} from "./utils";

const createMockSurvey = (languages: TSurvey["languages"] = []): TSurvey =>
  ({
    id: "survey-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test",
    type: "link",
    workspaceId: "ws-1",
    createdBy: null,
    status: "draft",
    displayOption: "displayOnce",
    autoClose: null,
    triggers: [],
    recontactDays: null,
    displayLimit: null,
    welcomeCard: {
      enabled: false,
      headline: { default: "Welcome" },
      timeToFinish: false,
      showResponseCount: false,
    },
    questions: [],
    blocks: [],
    endings: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
    styling: null,
    segment: null,
    languages,
    displayPercentage: null,
    isVerifyEmailEnabled: false,
    isSingleResponsePerEmailEnabled: false,
    singleUse: null,
    pin: null,
    workspaceOverwrites: null,
    surveyClosedMessage: null,
    followUps: [],
    delay: 0,
    autoComplete: null,
    showLanguageSwitch: null,
    autoSelectLanguage: null,
    recaptcha: null,
    isBackButtonHidden: false,
    isCaptureIpEnabled: false,
    slug: null,
    metadata: {},
  }) as TSurvey;

describe("getWebAppLocale", () => {
  test("maps language codes and handles defaults", () => {
    expect(getWebAppLocale("en", createMockSurvey())).toBe("en-US");
    expect(getWebAppLocale("de", createMockSurvey())).toBe("de-DE");
    const surveyWithLang = createMockSurvey([
      {
        language: {
          id: "l1",
          code: "de",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: true,
        enabled: true,
      },
    ]);
    expect(getWebAppLocale("default", surveyWithLang)).toBe("de-DE");
    expect(getWebAppLocale("xx", createMockSurvey())).toBe("en-US");
  });

  test("returns en-US when default requested but no default language", () => {
    const surveyNoDefault = createMockSurvey([
      {
        language: {
          id: "l1",
          code: "de",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: false,
        enabled: true,
      },
    ]);
    expect(getWebAppLocale("default", surveyNoDefault)).toBe("en-US");
  });

  test("matches base language code for variants", () => {
    expect(getWebAppLocale("pt-PT", createMockSurvey())).toBe("pt-PT");
    expect(getWebAppLocale("es-MX", createMockSurvey())).toBe("es-ES");
  });
});

describe("getSurveyLanguageCode", () => {
  const language = (code: string, overrides: Partial<TSurvey["languages"][number]> = {}) => ({
    language: {
      id: `lang-${code}`,
      code,
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "p1",
    },
    default: false,
    enabled: true,
    ...overrides,
  });

  test("uses the URL language parameter before browser language auto-selection", () => {
    const survey = {
      ...createMockSurvey([language("en", { default: true }), language("de")]),
      autoSelectLanguage: true,
    };

    expect(getSurveyLanguageCode("de", survey, ["en-US"])).toBe("de");
  });

  test("matches browser language exactly when auto-selection is enabled", () => {
    const survey = {
      ...createMockSurvey([language("en", { default: true }), language("de-DE")]),
      autoSelectLanguage: true,
    };

    expect(getSurveyLanguageCode(undefined, survey, ["de-DE", "en-US"])).toBe("de-DE");
  });

  test("matches browser language by base language when exact variant is unavailable", () => {
    const survey = {
      ...createMockSurvey([language("en", { default: true }), language("es-ES")]),
      autoSelectLanguage: true,
    };

    expect(getSurveyLanguageCode(undefined, survey, ["es-MX", "en-US"])).toBe("es-ES");
  });

  test("uses aliases and ignores disabled languages", () => {
    const survey = {
      ...createMockSurvey([
        language("en", { default: true }),
        language("de", { enabled: false }),
        language("fr-FR", {
          language: {
            id: "lang-fr-FR",
            code: "fr-FR",
            alias: "fr",
            createdAt: new Date(),
            updatedAt: new Date(),
            projectId: "p1",
          },
        }),
      ]),
      autoSelectLanguage: true,
    };

    expect(getSurveyLanguageCode(undefined, survey, ["de-DE", "fr-CA"])).toBe("fr-FR");
  });

  test("falls back to default language when auto-selection is disabled or unmatched", () => {
    const survey = createMockSurvey([language("en", { default: true }), language("de")]);

    expect(getSurveyLanguageCode(undefined, survey, ["de-DE"])).toBe("default");
    expect(getSurveyLanguageCode(undefined, { ...survey, autoSelectLanguage: true }, ["fr-FR"])).toBe(
      "default"
    );
  });
});

describe("isRTL", () => {
  test("detects RTL characters", () => {
    expect(isRTL("مرحبا")).toBe(true);
    expect(isRTL("שלום")).toBe(true);
    expect(isRTL("Hello")).toBe(false);
  });
});

describe("isRTLLanguage", () => {
  const createJsSurvey = (
    languages: TJsWorkspaceStateSurvey["languages"] = [],
    blocks: TSurveyBlock[] = []
  ): TJsWorkspaceStateSurvey =>
    ({
      id: "s1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      type: "link",
      workspaceId: "ws-1",
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        timeToFinish: false,
        showResponseCount: false,
      },
      blocks,
      languages,
    }) as unknown as TJsWorkspaceStateSurvey;

  test("checks language codes when multi-language enabled", () => {
    const survey = createJsSurvey([
      {
        language: {
          id: "l1",
          code: "ar",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: true,
        enabled: true,
      },
    ]);
    expect(isRTLLanguage(survey, "ar")).toBe(true);
    expect(isRTLLanguage(survey, "en")).toBe(false);
  });

  test("checks content when no languages configured", () => {
    const element = {
      id: "q1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "مرحبا" },
      required: false,
    } as unknown as TSurveyElement;
    const block = { id: "b1", name: "Block", elements: [element] } as TSurveyBlock;
    expect(isRTLLanguage(createJsSurvey([], [block]), "default")).toBe(true);
  });

  test("checks welcomeCard headline when enabled and no languages", () => {
    const survey = {
      ...createJsSurvey([], []),
      welcomeCard: { enabled: true, headline: { default: "مرحبا" } },
    } as unknown as TJsWorkspaceStateSurvey;
    expect(isRTLLanguage(survey, "default")).toBe(true);
  });

  test("returns false when no languages and no headlines found", () => {
    const element = { id: "q1", type: TSurveyElementTypeEnum.OpenText, headline: {}, required: false };
    const block = { id: "b1", name: "Block", elements: [element] } as TSurveyBlock;
    expect(isRTLLanguage(createJsSurvey([], [block]), "default")).toBe(false);
  });
});

describe("getElementsFromSurveyBlocks", () => {
  test("extracts elements from blocks", () => {
    const el1 = {
      id: "q1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
    } as unknown as TSurveyElement;
    const el2 = {
      id: "q2",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q2" },
      required: false,
    } as unknown as TSurveyElement;
    const block = { id: "b1", name: "Block", elements: [el1, el2] } as TSurveyBlock;
    const result = getElementsFromSurveyBlocks([block]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("q1");
  });
});
