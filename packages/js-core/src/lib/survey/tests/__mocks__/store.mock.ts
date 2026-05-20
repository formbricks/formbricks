import type { TWorkspaceStateSurvey } from "@/types/config";

export const mockSurveyId = "jgocyoxk9uifo6u381qahmes";

export const mockSurvey: TWorkspaceStateSurvey = {
  id: mockSurveyId,
  welcomeCard: {
    enabled: false,
    timeToFinish: false,
    showResponseCount: false,
    headline: { en: "Welcome" },
  },
  questions: [],
  variables: [],
  type: "app",
  showLanguageSwitch: false,
  endings: [],
  autoClose: null,
  status: "inProgress",
  recontactDays: null,
  displayLimit: null,
  displayOption: "displayMultiple",
  hiddenFields: { enabled: false },
  delay: 0,
  workspaceOverwrites: {},
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  recaptcha: { enabled: false, threshold: 0.5 },
  languages: [],
  triggers: [],
  displayPercentage: 100,
};

export const createMockSurvey = (id = mockSurveyId): TWorkspaceStateSurvey => ({
  ...mockSurvey,
  id,
});
