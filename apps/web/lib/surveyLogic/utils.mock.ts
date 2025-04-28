import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const mockSurvey: TJsEnvironmentStateSurvey = {
  id: "cm9gptbhg0000192zceq9ayuc",
  name: "Start from scratch‌‌‍‍‌‍‍‌‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
  type: "link",
  status: "inProgress",
  welcomeCard: {
    html: {
      default: "Thanks for providing your feedback - let's go!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‍‌‌‌‌‌‍‌‍‌‌",
    },
    enabled: false,
    headline: {
      default: "Welcome!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‌‍‌‌",
    },
    buttonLabel: {
      default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‌‌‌‌‌‌‍‌‍‌‌",
    },
    timeToFinish: false,
    showResponseCount: false,
  },
  questions: [
    {
      id: "vjniuob08ggl8dewl0hwed41",
      type: "openText" as TSurveyQuestionTypeEnum.OpenText,
      headline: {
        default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
      },
      required: true,
      charLimit: {},
      inputType: "email",
      longAnswer: false,
      buttonLabel: {
        default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      placeholder: {
        default: "example@email.com",
      },
    },
  ],
  endings: [
    {
      id: "gt1yoaeb5a3istszxqbl08mk",
      type: "endScreen",
      headline: {
        default: "Thank you!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‍‌‌‌‌‌‍‌‍‌‌",
      },
      subheader: {
        default: "We appreciate your feedback.‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      buttonLink: "https://formbricks.com",
      buttonLabel: {
        default: "Create your own Survey‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‌‍‌‌‌‌‌‍‌‍‌‌",
      },
    },
  ],
  hiddenFields: {
    enabled: true,
    fieldIds: [],
  },
  variables: [
    {
      id: "v",
      name: "num",
      type: "number",
      value: 0,
    },
  ],
  displayOption: "displayOnce",
  recontactDays: null,
  displayLimit: null,
  autoClose: null,
  delay: 0,
  displayPercentage: null,
  isBackButtonHidden: false,
  projectOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  languages: [],
  triggers: [],
  segment: null,
};
