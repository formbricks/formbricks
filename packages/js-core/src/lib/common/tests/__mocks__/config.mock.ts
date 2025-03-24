import type { TConfig } from "@/types/config";

// ids
export const mockEnvironmentId = "ggskhsue85p2xrxrc7x3qagg";
export const mockProjectId = "f5kptre0saxmltl7ram364qt";
export const mockLanguageId = "n4ts6u7wy5lbn4q3jovikqot";
export const mockSurveyId = "lz5m554yqh1i3moa3y230wei";
export const mockActionClassId = "wypzu5qw7adgy66vq8s77tso";

export const mockConfig: TConfig = {
  environmentId: mockEnvironmentId,
  appUrl: "https://myapp.example",
  environment: {
    expiresAt: "2999-12-31T23:59:59Z",
    data: {
      surveys: [
        {
          id: mockSurveyId,
          name: "Onboarding Survey",
          welcomeCard: null,
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
          hiddenFields: [],
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
                createdAt: "2025-01-01T10:00:00Z",
                updatedAt: "2025-01-01T10:00:00Z",
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
                createdAt: "2025-01-01T10:00:00Z",
                updatedAt: "2025-01-01T10:00:00Z",
                environmentId: mockEnvironmentId,
                description: "Manual Trigger",
                noCodeConfig: {},
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
        },
      ],
      actionClasses: [
        {
          id: mockActionClassId,
          key: "onboardingTrigger",
          type: "code",
          name: "Manual Trigger",
          noCodeConfig: {},
        },
      ],
      project: {
        id: mockProjectId,
        recontactDays: 14,
        clickOutsideClose: true,
        darkOverlay: false,
        placement: "bottomRight",
        inAppSurveyBranding: true,
        styling: {
          // TProjectStyling
          allowStyleOverwrite: true,
          brandColor: { light: "#319795" },
        },
      },
    },
  },
  user: {
    expiresAt: null,
    data: {
      userId: "user_abc",
      segments: ["beta-testers"],
      displays: [
        {
          surveyId: mockSurveyId,
          createdAt: "2025-01-01T10:00:00Z",
        },
      ],
      responses: [mockSurveyId],
      lastDisplayAt: "2025-01-02T15:00:00Z",
      language: "en",
    },
  },
  filteredSurveys: [], // fill if you'd like to pre-filter any surveys
  attributes: {
    plan: "premium",
    region: "US",
  },
  status: {
    value: "success",
    expiresAt: null,
  },
} as unknown as TConfig;
