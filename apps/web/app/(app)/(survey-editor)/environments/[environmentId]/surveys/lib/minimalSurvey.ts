import { getDefaultEndingCard, welcomeCardDefault } from "@formbricks/lib/templates";
import { TSurvey } from "@formbricks/types/surveys/types";

export const minimalSurvey: TSurvey = {
  id: "someUniqueId1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Minimal Survey",
  type: "app",
  environmentId: "someEnvId1",
  createdBy: null,
  status: "draft",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: welcomeCardDefault,
  questions: [],
  endings: [getDefaultEndingCard([])],
  hiddenFields: {
    enabled: false,
  },
  delay: 0, // No delay
  displayPercentage: null,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  surveyClosedMessage: {
    enabled: false,
  },
  productOverwrites: null,
  singleUse: null,
  styling: null,
  resultShareKey: null,
  segment: null,
  languages: [],
  showLanguageSwitch: false,
  isVerifyEmailEnabled: false,
  variables: [],
};
