import { describe, expect, test } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getWebAppLocale } from "./utils";

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
