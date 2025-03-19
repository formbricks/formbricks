import { type TEnvironmentStateSurvey } from "@/types/config";

export const mockSurveyId = "tj57w6va6jd634yyt9ekrw98";
export const mockLanguageId = "zngds2ve6ezz055oe91ybu46";
export const mockActionClassId = "y1fy1169ymgql3exgx49lyx9";
export const mockProjectId = "kr6tqhajodm086z7u4claj9y";
export const mockEnvironmentId = "n48a66c01dz05k1297vq06pu";

export const mockSurvey: TEnvironmentStateSurvey = {
  id: mockSurveyId,
  name: "Test Survey",
  welcomeCard: {
    enabled: false,
    timeToFinish: false,
    showResponseCount: false,
    headline: {
      en: "Welcome to our app",
    },
  },
  questions: [],
  variables: [],
  type: "app", // "link" or "app"
  showLanguageSwitch: true,
  endings: [],
  autoClose: 5,
  status: "inProgress", // whatever statuses you use
  recontactDays: 7,
  displayLimit: 1,
  displayOption: "displayMultiple",
  hiddenFields: { enabled: false },
  delay: 5, // e.g. 5s
  projectOverwrites: {},
  languages: [
    {
      // SurveyLanguage fields
      surveyId: mockSurveyId,
      default: true,
      enabled: true,
      languageId: mockLanguageId,
      language: {
        // Language fields
        id: mockLanguageId,
        code: "en",
        alias: "en",
        createdAt: new Date("2025-01-01T10:00:00Z"),
        updatedAt: new Date("2025-01-01T10:00:00Z"),
        projectId: mockProjectId,
      },
    },
  ],
  triggers: [
    {
      actionClass: {
        id: mockActionClassId,
        key: "onboardingTrigger",
        type: "code",
        name: "Manual Trigger",
        createdAt: new Date("2025-01-01T10:00:00Z"),
        updatedAt: new Date("2025-01-01T10:00:00Z"),
        environmentId: mockEnvironmentId,
        description: "Manual Trigger",
        noCodeConfig: {
          elementSelector: { cssSelector: ".btn", innerHtml: "Click me" },
          type: "click",
          urlFilters: [],
        },
      },
    },
  ],
  segment: undefined, // or mock your Segment if needed
  displayPercentage: 100,
  styling: {
    // TSurveyStyling
    overwriteThemeStyling: false,
    brandColor: { light: "#2B6CB0" },
  },
  isBackButtonHidden: false,
};
