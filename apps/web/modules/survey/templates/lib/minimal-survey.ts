import { getDefaultEndingCard, getDefaultWelcomeCard } from "@/app/lib/templates";
import { TFnType } from "@tolgee/react";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getMinimalSurvey = (t: TFnType): TSurvey => ({
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
  welcomeCard: getDefaultWelcomeCard(t),
  questions: [],
  endings: [getDefaultEndingCard([], t)],
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
  projectOverwrites: null,
  singleUse: null,
  styling: null,
  resultShareKey: null,
  segment: null,
  languages: [],
  showLanguageSwitch: false,
  isVerifyEmailEnabled: false,
  isSingleResponsePerEmailEnabled: false,
  variables: [],
  followUps: [],
  isBackButtonHidden: false,
});
