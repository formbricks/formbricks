import * as nextHeaders from "next/headers";
import { describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { appLanguages } from "@/lib/i18n/utils";
import { findMatchingLocale, getWebAppLocale } from "./locale";

// Mock the Next.js headers function
vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("locale", () => {
  test("returns DEFAULT_LOCALE when Accept-Language header is missing", async () => {
    // Set up the mock to return null for accept-language header
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns exact match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES
    const testLocale = AVAILABLE_LOCALES[0];

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue(`${testLocale},fr-FR,de-DE`),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(testLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns normalized match when available", async () => {
    // Assuming we have 'en-US' in AVAILABLE_LOCALES but not 'en-GB'
    const availableLocale = AVAILABLE_LOCALES.find((locale) => locale.startsWith("en-"));

    if (!availableLocale) {
      // Skip this test if no English locale is available
      return;
    }

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("en-US,fr-FR,de-DE"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(availableLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("returns DEFAULT_LOCALE when no match is found", async () => {
    // Use a locale that should not exist in AVAILABLE_LOCALES
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("xx-XX,yy-YY"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(DEFAULT_LOCALE);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("handles multiple potential matches correctly", async () => {
    // If we have multiple locales for the same language, it should return the first match
    const germanLocale = AVAILABLE_LOCALES.find((locale) => locale.toLowerCase().startsWith("de"));

    if (!germanLocale) {
      // Skip this test if no German locale is available
      return;
    }

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("de-DE,en-US,fr-FR"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe(germanLocale);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("Swedish locale (sv-SE) is available and selectable", async () => {
    // Verify sv-SE is in AVAILABLE_LOCALES
    expect(AVAILABLE_LOCALES).toContain("sv-SE");

    // Verify Swedish has a language entry with proper label
    const swedishLanguage = appLanguages.find((lang) => lang.code === "sv-SE");
    expect(swedishLanguage).toBeDefined();
    expect(swedishLanguage?.label["en-US"]).toBe("Swedish");

    // Verify the locale can be matched from Accept-Language header
    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockReturnValue("sv-SE,en-US"),
    } as any);

    const result = await findMatchingLocale();

    expect(result).toBe("sv-SE");
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  describe("getWebAppLocale", () => {
    const createMockSurvey = (languages: TSurvey["languages"] = []): TSurvey => {
      return {
        id: "survey-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Survey",
        type: "link",
        environmentId: "env-1",
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
        projectOverwrites: null,
        surveyClosedMessage: null,
        followUps: [],
        delay: 0,
        autoComplete: null,
        showLanguageSwitch: null,
        recaptcha: null,
        isBackButtonHidden: false,
        isCaptureIpEnabled: false,
        slug: null,
        metadata: {},
      } as TSurvey;
    };

    test("maps language codes to web app locales", () => {
      const survey = createMockSurvey();
      expect(getWebAppLocale("en", survey)).toBe("en-US");
      expect(getWebAppLocale("de", survey)).toBe("de-DE");
      expect(getWebAppLocale("pt-BR", survey)).toBe("pt-BR");
    });

    test("handles 'default' languageCode by finding default language in survey", () => {
      const survey = createMockSurvey([
        {
          language: {
            id: "lang1",
            code: "de",
            alias: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            projectId: "proj1",
          },
          default: true,
          enabled: true,
        },
      ]);

      expect(getWebAppLocale("default", survey)).toBe("de-DE");
    });

    test("falls back to en-US when language is not supported", () => {
      const survey = createMockSurvey();
      expect(getWebAppLocale("default", survey)).toBe("en-US");
      expect(getWebAppLocale("xx", survey)).toBe("en-US");
    });
  });
});
