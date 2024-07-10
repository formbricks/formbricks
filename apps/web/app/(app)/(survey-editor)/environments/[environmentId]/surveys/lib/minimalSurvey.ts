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
  welcomeCard: {
    enabled: false,
    headline: { default: "Welcome!" },
    html: { default: "Thanks for providing your feedback - let's go!" },
    timeToFinish: false,
    showResponseCount: false,
  },
  questions: [],
  endings: [
    {
      enabled: false,
      type: "endScreen",
      id: "end:1",
      headline: { default: "Thank you!" },
      subheader: { default: "We appreciate your feedback." },
      buttonLabel: { default: "Create your own Survey" },
    },
  ],
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
};
