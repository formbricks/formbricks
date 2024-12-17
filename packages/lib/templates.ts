import { createId } from "@paralleldrive/cuid2";
import {
  TSurveyEndScreenCard,
  TSurveyHiddenFields,
  TSurveyLanguage,
  TSurveyOpenTextQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";
import { createI18nString, extractLanguageCodes } from "./i18n/utils";

const messageCache: Record<string, any> = {};
const defaultLocale = "en-US";

const getMessages = (locale: string) => {
  if (!messageCache[locale]) {
    messageCache[locale] = require(`./messages/${locale}.json`);
  }
  return messageCache[locale];
};

export const translate = (text: string, locale: string, replacements?: Record<string, string>) => {
  const messages = getMessages(locale ?? defaultLocale);
  let translatedText = messages.templates[text];

  if (replacements) {
    Object.entries(replacements).forEach(([key, value]) => {
      translatedText = translatedText.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    });
  }

  return translatedText;
};

export const getDefaultEndingCard = (languages: TSurveyLanguage[], locale: string): TSurveyEndScreenCard => {
  const languageCodes = extractLanguageCodes(languages);
  return {
    id: createId(),
    type: "endScreen",
    headline: createI18nString(translate("default_ending_card_headline", locale), languageCodes),
    subheader: createI18nString(translate("default_ending_card_subheader", locale), languageCodes),
    buttonLabel: createI18nString(translate("default_ending_card_button_label", locale), languageCodes),
    buttonLink: "https://formbricks.com",
  };
};

const hiddenFieldsDefault: TSurveyHiddenFields = {
  enabled: true,
  fieldIds: [],
};

export const getDefaultWelcomeCard = (locale: string): TSurveyWelcomeCard => {
  return {
    enabled: false,
    headline: { default: translate("default_welcome_card_headline", locale) },
    html: { default: translate("default_welcome_card_html", locale) },
    buttonLabel: { default: translate("default_welcome_card_button_label", locale) },
    timeToFinish: false,
    showResponseCount: false,
  };
};

export const getDefaultSurveyPreset = (locale: string): TTemplate["preset"] => {
  return {
    name: "New Survey",
    welcomeCard: getDefaultWelcomeCard(locale),
    endings: [getDefaultEndingCard([], locale)],
    hiddenFields: hiddenFieldsDefault,
    questions: [],
  };
};

const cartAbandonmentSurvey = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("card_abandonment_survey", locale),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website", "link"],
    description: translate("card_abandonment_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("card_abandonment_survey", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: translate("card_abandonment_survey_question_1_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("card_abandonment_survey_question_1_headline", locale) },
          required: false,
          buttonLabel: { default: translate("card_abandonment_survey_question_1_button_label", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("card_abandonment_survey_question_1_dismiss_button_label", locale),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("card_abandonment_survey_question_2_headline", locale) },
          subheader: { default: translate("card_abandonment_survey_question_2_subheader", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_2_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_2_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_2_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("card_abandonment_survey_question_2_choice_6", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("card_abandonment_survey_question_3_headline", locale),
          },
          required: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("card_abandonment_survey_question_4_headline", locale) },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: translate("card_abandonment_survey_question_4_lower_label", locale) },
          upperLabel: { default: translate("card_abandonment_survey_question_4_upper_label", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: translate("card_abandonment_survey_question_5_headline", locale),
          },
          subheader: { default: translate("card_abandonment_survey_question_5_subheader", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_5_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_5_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_5_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_5_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("card_abandonment_survey_question_5_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("card_abandonment_survey_question_5_choice_6", locale) },
            },
          ],
        },
        {
          id: reusableQuestionIds[1],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          type: TSurveyQuestionTypeEnum.Consent,
          headline: { default: translate("card_abandonment_survey_question_6_headline", locale) },
          required: false,
          label: { default: translate("card_abandonment_survey_question_6_label", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("card_abandonment_survey_question_7_headline", locale) },
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("card_abandonment_survey_question_8_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const siteAbandonmentSurvey = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("site_abandonment_survey", locale),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website"],
    description: translate("site_abandonment_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("site_abandonment_survey", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: translate("site_abandonment_survey_question_1_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("site_abandonment_survey_question_2_headline", locale) },
          required: false,
          buttonLabel: { default: translate("site_abandonment_survey_question_2_button_label", locale) },
          backButtonLabel: { default: translate("back", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("site_abandonment_survey_question_2_dismiss_button_label", locale),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("site_abandonment_survey_question_3_headline", locale) },
          subheader: { default: translate("site_abandonment_survey_question_3_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_3_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_3_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_3_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_3_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_3_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("site_abandonment_survey_question_3_choice_6", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("site_abandonment_survey_question_4_headline", locale),
          },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("site_abandonment_survey_question_5_headline", locale) },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: translate("site_abandonment_survey_question_5_lower_label", locale) },
          upperLabel: { default: translate("site_abandonment_survey_question_5_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: translate("site_abandonment_survey_question_6_headline", locale),
          },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          subheader: { default: translate("site_abandonment_survey_question_6_subheader", locale) },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_6_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_6_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_6_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_6_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("site_abandonment_survey_question_6_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("site_abandonment_survey_question_6_choice_6", locale) },
            },
          ],
        },
        {
          id: reusableQuestionIds[1],
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          type: TSurveyQuestionTypeEnum.Consent,
          headline: { default: translate("site_abandonment_survey_question_7_headline", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: false,
          label: { default: translate("site_abandonment_survey_question_7_label", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("site_abandonment_survey_question_8_headline", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("site_abandonment_survey_question_9_headline", locale) },
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const productMarketFitSuperhuman = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("product_market_fit_superhuman", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: translate("product_market_fit_superhuman_description", locale),
    preset: {
      ...localSurvey,
      name: translate("product_market_fit_superhuman", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: translate("product_market_fit_superhuman_question_1_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("product_market_fit_superhuman_question_1_headline", locale) },
          required: false,
          buttonLabel: {
            default: translate("product_market_fit_superhuman_question_1_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("product_market_fit_superhuman_question_1_dismiss_button_label", locale),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("product_market_fit_superhuman_question_2_headline", locale) },
          subheader: { default: translate("product_market_fit_superhuman_question_2_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_2_choice_3", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("product_market_fit_superhuman_question_3_headline", locale) },
          subheader: { default: translate("product_market_fit_superhuman_question_3_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_3_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_3_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_3_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_3_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_superhuman_question_3_choice_5", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("product_market_fit_superhuman_question_4_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("product_market_fit_superhuman_question_5_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("product_market_fit_superhuman_question_6_headline", locale) },
          subheader: { default: translate("product_market_fit_superhuman_question_6_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
          inputType: "text",
        },
      ],
    },
  };
};

const onboardingSegmentation = (locale: string): TTemplate => {
  return {
    name: translate("onboarding_segmentation", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: translate("onboarding_segmentation_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("onboarding_segmentation", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("onboarding_segmentation_question_1_headline", locale) },
          subheader: { default: translate("onboarding_segmentation_question_1_subheader", locale) },
          required: true,
          shuffleOption: "none",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          choices: [
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_1_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_1_choice_5", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("onboarding_segmentation_question_2_headline", locale) },
          subheader: { default: translate("onboarding_segmentation_question_2_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_2_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_2_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_2_choice_5", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("onboarding_segmentation_question_3_headline", locale) },
          subheader: { default: translate("onboarding_segmentation_question_3_subheader", locale) },
          required: true,
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_3_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_3_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_3_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_3_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("onboarding_segmentation_question_3_choice_5", locale) },
            },
          ],
        },
      ],
    },
  };
};

const churnSurvey = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("churn_survey", locale),
    role: "sales",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: translate("churn_survey_description", locale),
    preset: {
      ...localSurvey,
      name: "Churn Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("churn_survey_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("churn_survey_question_1_choice_2", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("churn_survey_question_1_choice_3", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("churn_survey_question_1_choice_4", locale) },
            },
            {
              id: reusableOptionIds[4],
              label: { default: translate("churn_survey_question_1_choice_5", locale) },
            },
          ],
          headline: { default: translate("churn_survey_question_1_headline", locale) },
          required: true,
          subheader: { default: translate("churn_survey_question_1_subheader", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("churn_survey_question_2_headline", locale) },
          backButtonLabel: { default: translate("back", locale) },
          required: true,
          buttonLabel: { default: translate("churn_survey_question_2_button_label", locale) },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: translate("churn_survey_question_3_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("churn_survey_question_3_headline", locale) },
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: translate("churn_survey_question_3_button_label", locale) },
          buttonExternal: true,
          backButtonLabel: { default: translate("back", locale) },
          dismissButtonLabel: { default: translate("churn_survey_question_3_dismiss_button_label", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("churn_survey_question_4_headline", locale) },
          required: true,
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          html: {
            default: translate("churn_survey_question_5_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("churn_survey_question_5_headline", locale) },
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: { default: translate("churn_survey_question_5_button_label", locale) },
          buttonExternal: true,
          dismissButtonLabel: { default: translate("churn_survey_question_5_dismiss_button_label", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const earnedAdvocacyScore = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("earned_advocacy_score_name", locale),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: translate("earned_advocacy_score_description", locale),
    preset: {
      ...localSurvey,
      name: translate("earned_advocacy_score_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          shuffleOption: "none",
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("earned_advocacy_score_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("earned_advocacy_score_question_1_choice_2", locale) },
            },
          ],
          headline: { default: translate("earned_advocacy_score_question_1_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          headline: { default: translate("earned_advocacy_score_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("earned_advocacy_score_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("earned_advocacy_score_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("earned_advocacy_score_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          shuffleOption: "none",
          choices: [
            {
              id: reusableOptionIds[2],
              label: { default: translate("earned_advocacy_score_question_4_choice_1", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("earned_advocacy_score_question_4_choice_2", locale) },
            },
          ],
          headline: { default: translate("earned_advocacy_score_question_4_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("earned_advocacy_score_question_5_headline", locale) },
          required: true,
          placeholder: { default: translate("earned_advocacy_score_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const improveTrialConversion = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("improve_trial_conversion_name", locale),
    role: "sales",
    industries: ["saas"],
    channels: ["link", "app"],
    description: translate("improve_trial_conversion_description", locale),
    preset: {
      ...localSurvey,
      name: translate("improve_trial_conversion_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("improve_trial_conversion_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("improve_trial_conversion_question_1_choice_2", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("improve_trial_conversion_question_1_choice_3", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("improve_trial_conversion_question_1_choice_4", locale) },
            },
            {
              id: reusableOptionIds[4],
              label: { default: translate("improve_trial_conversion_question_1_choice_5", locale) },
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_1_headline", locale) },
          required: true,
          subheader: { default: translate("improve_trial_conversion_question_1_subheader", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_2_headline", locale) },
          required: true,
          buttonLabel: { default: translate("improve_trial_conversion_question_2_button_label", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_2_headline", locale) },
          required: true,
          buttonLabel: { default: translate("improve_trial_conversion_question_2_button_label", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default: translate("improve_trial_conversion_question_4_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_4_headline", locale) },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: translate("improve_trial_conversion_question_4_button_label", locale) },
          buttonExternal: true,
          dismissButtonLabel: {
            default: translate("improve_trial_conversion_question_4_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_5_headline", locale) },
          required: true,
          subheader: { default: translate("improve_trial_conversion_question_5_subheader", locale) },
          buttonLabel: { default: translate("improve_trial_conversion_question_5_button_label", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_trial_conversion_question_6_headline", locale) },
          required: false,
          subheader: { default: translate("improve_trial_conversion_question_6_subheader", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const reviewPrompt = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: translate("review_prompt_name", locale),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link", "app"],
    description: translate("review_prompt_description", locale),
    preset: {
      ...localSurvey,
      name: translate("review_prompt_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "star",
          headline: { default: translate("review_prompt_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("review_prompt_question_1_lower_label", locale) },
          upperLabel: { default: translate("review_prompt_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          html: { default: translate("review_prompt_question_2_html", locale) },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("review_prompt_question_2_headline", locale) },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: translate("review_prompt_question_2_button_label", locale) },
          buttonExternal: true,
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("review_prompt_question_3_headline", locale) },
          required: true,
          subheader: { default: translate("review_prompt_question_3_subheader", locale) },
          buttonLabel: { default: translate("review_prompt_question_3_button_label", locale) },
          placeholder: { default: translate("review_prompt_question_3_placeholder", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const interviewPrompt = (locale: string): TTemplate => {
  return {
    name: translate("interview_prompt_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("interview_prompt_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("interview_prompt_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: translate("interview_prompt_question_1_headline", locale) },
          html: { default: translate("interview_prompt_question_1_html", locale) },
          buttonLabel: { default: translate("interview_prompt_question_1_button_label", locale) },
          buttonUrl: "https://cal.com/johannes",
          buttonExternal: true,
          required: false,
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const improveActivationRate = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("improve_activation_rate_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: translate("improve_activation_rate_description", locale),
    preset: {
      ...localSurvey,
      name: translate("improve_activation_rate_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("improve_activation_rate_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("improve_activation_rate_question_1_choice_2", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("improve_activation_rate_question_1_choice_3", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("improve_activation_rate_question_1_choice_4", locale) },
            },
            {
              id: reusableOptionIds[4],
              label: { default: translate("improve_activation_rate_question_1_choice_5", locale) },
            },
          ],
          headline: {
            default: translate("improve_activation_rate_question_1_headline", locale),
          },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_activation_rate_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("improve_activation_rate_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_activation_rate_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("improve_activation_rate_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_activation_rate_question_4_headline", locale) },
          required: true,
          placeholder: { default: translate("improve_activation_rate_question_4_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_activation_rate_question_5_headline", locale) },
          required: true,
          placeholder: { default: translate("improve_activation_rate_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [],
          headline: { default: translate("improve_activation_rate_question_6_headline", locale) },
          required: false,
          subheader: { default: translate("improve_activation_rate_question_6_subheader", locale) },
          placeholder: { default: translate("improve_activation_rate_question_6_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const employeeSatisfaction = (locale: string): TTemplate => {
  return {
    name: translate("employee_satisfaction_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: translate("employee_satisfaction_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("employee_satisfaction_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "star",
          headline: { default: translate("employee_satisfaction_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("employee_satisfaction_question_1_lower_label", locale) },
          upperLabel: { default: translate("employee_satisfaction_question_1_upper_label", locale) },
          isColorCodingEnabled: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_2_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_2_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_2_choice_5", locale) },
            },
          ],
          headline: { default: translate("employee_satisfaction_question_2_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("employee_satisfaction_question_3_headline", locale) },
          required: false,
          placeholder: { default: translate("employee_satisfaction_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_4_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_4_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_4_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_4_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_4_choice_5", locale) },
            },
          ],
          headline: { default: translate("employee_satisfaction_question_4_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: translate("employee_satisfaction_question_5_headline", locale) },
          required: true,
          lowerLabel: { default: translate("employee_satisfaction_question_5_lower_label", locale) },
          upperLabel: { default: translate("employee_satisfaction_question_5_upper_label", locale) },
          isColorCodingEnabled: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("employee_satisfaction_question_6_headline", locale) },
          required: false,
          placeholder: { default: translate("employee_satisfaction_question_6_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_7_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_7_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_7_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_7_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("employee_satisfaction_question_7_choice_5", locale) },
            },
          ],
          headline: { default: translate("employee_satisfaction_question_7_headline", locale) },
          required: true,
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const uncoverStrengthsAndWeaknesses = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("uncover_strengths_and_weaknesses_name", locale),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: translate("uncover_strengths_and_weaknesses_description", locale),
    preset: {
      ...localSurvey,
      name: translate("uncover_strengths_and_weaknesses_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_1_choice_4", locale) },
            },
            {
              id: "other",
              label: { default: translate("uncover_strengths_and_weaknesses_question_1_choice_5", locale) },
            },
          ],
          headline: { default: translate("uncover_strengths_and_weaknesses_question_1_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("uncover_strengths_and_weaknesses_question_2_choice_3", locale) },
            },
            {
              id: "other",
              label: { default: translate("uncover_strengths_and_weaknesses_question_2_choice_4", locale) },
            },
          ],
          headline: { default: translate("uncover_strengths_and_weaknesses_question_2_headline", locale) },
          required: true,
          subheader: { default: translate("uncover_strengths_and_weaknesses_question_2_subheader", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("uncover_strengths_and_weaknesses_question_3_headline", locale) },
          required: false,
          subheader: { default: translate("uncover_strengths_and_weaknesses_question_3_subheader", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const productMarketFitShort = (locale: string): TTemplate => {
  return {
    name: translate("product_market_fit_short_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: translate("product_market_fit_short_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("product_market_fit_short_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("product_market_fit_short_question_1_headline", locale) },
          subheader: { default: translate("product_market_fit_short_question_1_subheader", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("product_market_fit_short_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_short_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("product_market_fit_short_question_1_choice_3", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("product_market_fit_short_question_2_headline", locale) },
          subheader: { default: translate("product_market_fit_short_question_2_subheader", locale) },
          required: true,
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const marketAttribution = (locale: string): TTemplate => {
  return {
    name: translate("market_attribution_name", locale),
    role: "marketing",
    industries: ["saas", "eCommerce"],
    channels: ["website", "app", "link"],
    description: translate("market_attribution_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("market_attribution_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("market_attribution_question_1_headline", locale) },
          subheader: { default: translate("market_attribution_question_1_subheader", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("market_attribution_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_attribution_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_attribution_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_attribution_question_1_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_attribution_question_1_choice_5", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const changingSubscriptionExperience = (locale: string): TTemplate => {
  return {
    name: translate("changing_subscription_experience_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("changing_subscription_experience_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("changing_subscription_experience_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("changing_subscription_experience_question_1_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_1_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_1_choice_5", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("changing_subscription_experience_question_2_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("changing_subscription_experience_question_2_choice_3", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const identifyCustomerGoals = (locale: string): TTemplate => {
  return {
    name: translate("identify_customer_goals_name", locale),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "website"],
    description: translate("identify_customer_goals_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("identify_customer_goals_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What's your primary goal for using {{projectName}}?" },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: "Understand my user base deeply" },
            },
            {
              id: createId(),
              label: { default: "Identify upselling opportunities" },
            },
            {
              id: createId(),
              label: { default: "Build the best possible product" },
            },
            {
              id: createId(),
              label: { default: "Rule the world to make everyone breakfast brussels sprouts." },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const featureChaser = (locale: string): TTemplate => {
  return {
    name: translate("feature_chaser_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("feature_chaser_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("feature_chaser_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: translate("feature_chaser_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("feature_chaser_question_1_lower_label", locale) },
          upperLabel: { default: translate("feature_chaser_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: translate("feature_chaser_question_2_choice_1", locale) } },
            { id: createId(), label: { default: translate("feature_chaser_question_2_choice_2", locale) } },
            { id: createId(), label: { default: translate("feature_chaser_question_2_choice_3", locale) } },
            { id: createId(), label: { default: translate("feature_chaser_question_2_choice_4", locale) } },
          ],
          headline: { default: translate("feature_chaser_question_2_headline", locale) },
          required: true,
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const fakeDoorFollowUp = (locale: string): TTemplate => {
  return {
    name: translate("fake_door_follow_up_name", locale),
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: translate("fake_door_follow_up_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("fake_door_follow_up_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("fake_door_follow_up_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("fake_door_follow_up_question_1_lower_label", locale) },
          upperLabel: { default: translate("fake_door_follow_up_question_1_upper_label", locale) },
          range: 5,
          scale: "number",
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: { default: translate("fake_door_follow_up_question_2_headline", locale) },
          required: false,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("fake_door_follow_up_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("fake_door_follow_up_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("fake_door_follow_up_question_2_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("fake_door_follow_up_question_2_choice_4", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const feedbackBox = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("feedback_box_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("feedback_box_description", locale),
    preset: {
      ...localSurvey,
      name: translate("feedback_box_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",

          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("feedback_box_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("feedback_box_question_1_choice_2", locale) },
            },
          ],
          headline: { default: translate("feedback_box_question_1_headline", locale) },
          required: true,
          subheader: { default: translate("feedback_box_question_1_subheader", locale) },
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          headline: { default: translate("feedback_box_question_2_headline", locale) },
          required: true,
          subheader: { default: translate("feedback_box_question_2_subheader", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: translate("feedback_box_question_3_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isClicked",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("feedback_box_question_3_headline", locale) },
          required: false,
          buttonLabel: { default: translate("feedback_box_question_3_button_label", locale) },
          buttonExternal: false,
          dismissButtonLabel: { default: translate("feedback_box_question_3_dismiss_button_label", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("feedback_box_question_4_headline", locale) },
          required: true,
          subheader: { default: translate("feedback_box_question_4_subheader", locale) },
          buttonLabel: { default: translate("feedback_box_question_4_button_label", locale) },
          placeholder: { default: translate("feedback_box_question_4_placeholder", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const integrationSetupSurvey = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: translate("integration_setup_survey_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("integration_setup_survey_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("integration_setup_survey_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("integration_setup_survey_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("integration_setup_survey_question_1_lower_label", locale) },
          upperLabel: { default: translate("integration_setup_survey_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("integration_setup_survey_question_2_headline", locale) },
          required: false,
          placeholder: { default: translate("integration_setup_survey_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("integration_setup_survey_question_3_headline", locale) },
          required: false,
          subheader: { default: translate("integration_setup_survey_question_3_subheader", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const newIntegrationSurvey = (locale: string): TTemplate => {
  return {
    name: translate("new_integration_survey_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("new_integration_survey_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("new_integration_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("new_integration_survey_question_1_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("new_integration_survey_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("new_integration_survey_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("new_integration_survey_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("new_integration_survey_question_1_choice_4", locale) },
            },
            {
              id: "other",
              label: { default: translate("new_integration_survey_question_1_choice_5", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const docsFeedback = (locale: string): TTemplate => {
  return {
    name: translate("docs_feedback_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website", "link"],
    description: translate("docs_feedback_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("docs_feedback_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("docs_feedback_question_1_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("docs_feedback_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("docs_feedback_question_1_choice_2", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("docs_feedback_question_2_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("docs_feedback_question_3_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const NPS = (locale: string): TTemplate => {
  return {
    name: translate("nps_name", locale),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: translate("nps_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("nps_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: translate("nps_question_1_headline", locale) },
          required: false,
          lowerLabel: { default: translate("nps_question_1_lower_label", locale) },
          upperLabel: { default: translate("nps_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("nps_question_2_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const customerSatisfactionScore = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: translate("csat_name", locale),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: translate("csat_description", locale),
    preset: {
      ...localSurvey,
      name: translate("csat_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 10,
          scale: "number",
          headline: {
            default: translate("csat_question_1_headline", locale),
          },
          required: true,
          lowerLabel: { default: translate("csat_question_1_lower_label", locale) },
          upperLabel: { default: translate("csat_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_2_headline", locale) },
          subheader: { default: translate("csat_question_2_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_2_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_2_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_2_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_2_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_2_choice_5", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: translate("csat_question_3_headline", locale),
          },
          subheader: { default: translate("csat_question_3_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_3_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_5", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_6", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_7", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_8", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_9", locale) } },
            { id: createId(), label: { default: translate("csat_question_3_choice_10", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_4_headline", locale) },
          subheader: { default: translate("csat_question_4_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_4_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_4_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_4_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_4_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_4_choice_5", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_5_headline", locale) },
          subheader: { default: translate("csat_question_5_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_5_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_5_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_5_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_5_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_5_choice_5", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_6_headline", locale) },
          subheader: { default: translate("csat_question_6_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_6_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_6_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_6_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_6_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_6_choice_5", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_7_headline", locale) },
          subheader: { default: translate("csat_question_7_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_7_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_7_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_7_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_7_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_7_choice_5", locale) } },
            { id: createId(), label: { default: translate("csat_question_7_choice_6", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_8_headline", locale) },
          subheader: { default: translate("csat_question_8_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_8_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_8_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_8_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_8_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_8_choice_5", locale) } },
            { id: createId(), label: { default: translate("csat_question_8_choice_6", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[8],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("csat_question_9_headline", locale) },
          subheader: { default: translate("csat_question_9_subheader", locale) },
          required: true,
          choices: [
            { id: createId(), label: { default: translate("csat_question_9_choice_1", locale) } },
            { id: createId(), label: { default: translate("csat_question_9_choice_2", locale) } },
            { id: createId(), label: { default: translate("csat_question_9_choice_3", locale) } },
            { id: createId(), label: { default: translate("csat_question_9_choice_4", locale) } },
            { id: createId(), label: { default: translate("csat_question_9_choice_5", locale) } },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[9],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("csat_question_10_headline", locale) },
          required: false,
          placeholder: { default: translate("csat_question_10_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const collectFeedback = (locale: string): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: translate("collect_feedback_name", locale),
    role: "productManager",
    industries: ["other", "eCommerce"],
    channels: ["website", "link"],
    description: translate("collect_feedback_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("collect_feedback_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "star",
          headline: { default: translate("csat_question_1_headline", locale) },
          required: true,
          subheader: { default: translate("csat_question_1_subheader", locale) },
          lowerLabel: { default: translate("csat_question_1_lower_label", locale) },
          upperLabel: { default: translate("csat_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          headline: { default: translate("collect_feedback_question_2_headline", locale) },
          required: true,
          longAnswer: true,
          placeholder: { default: translate("collect_feedback_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("collect_feedback_question_3_headline", locale) },
          required: true,
          longAnswer: true,
          placeholder: { default: translate("collect_feedback_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "smiley",
          headline: { default: translate("collect_feedback_question_4_headline", locale) },
          required: true,
          lowerLabel: { default: translate("collect_feedback_question_4_lower_label", locale) },
          upperLabel: { default: translate("collect_feedback_question_4_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("collect_feedback_question_5_headline", locale) },
          required: false,
          longAnswer: true,
          placeholder: { default: translate("collect_feedback_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: { default: translate("collect_feedback_question_6_choice_1", locale) } },
            { id: createId(), label: { default: translate("collect_feedback_question_6_choice_2", locale) } },
            { id: createId(), label: { default: translate("collect_feedback_question_6_choice_3", locale) } },
            { id: createId(), label: { default: translate("collect_feedback_question_6_choice_4", locale) } },
            { id: "other", label: { default: translate("collect_feedback_question_6_choice_5", locale) } },
          ],
          headline: { default: translate("collect_feedback_question_6_headline", locale) },
          required: true,
          shuffleOption: "none",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("collect_feedback_question_7_headline", locale) },
          required: false,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: translate("collect_feedback_question_7_placeholder", locale) },
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const identifyUpsellOpportunities = (locale: string): TTemplate => {
  return {
    name: translate("identify_upsell_opportunities_name", locale),
    role: "sales",
    industries: ["saas"],
    channels: ["app", "link"],
    description: translate("identify_upsell_opportunities_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("identify_upsell_opportunities_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("identify_upsell_opportunities_question_1_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("identify_upsell_opportunities_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("identify_upsell_opportunities_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("identify_upsell_opportunities_question_1_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("identify_upsell_opportunities_question_1_choice_4", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const prioritizeFeatures = (locale: string): TTemplate => {
  return {
    name: translate("prioritize_features_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("prioritize_features_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("prioritize_features_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_1_choice_3", locale) },
            },
            { id: "other", label: { default: translate("prioritize_features_question_1_choice_4", locale) } },
          ],
          headline: { default: translate("prioritize_features_question_1_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("prioritize_features_question_2_choice_3", locale) },
            },
          ],
          headline: { default: translate("prioritize_features_question_2_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("prioritize_features_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("prioritize_features_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const gaugeFeatureSatisfaction = (locale: string): TTemplate => {
  return {
    name: translate("gauge_feature_satisfaction_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("gauge_feature_satisfaction_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("gauge_feature_satisfaction_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("gauge_feature_satisfaction_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("gauge_feature_satisfaction_question_1_lower_label", locale) },
          upperLabel: { default: translate("gauge_feature_satisfaction_question_1_upper_label", locale) },
          scale: "number",
          range: 5,
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("gauge_feature_satisfaction_question_2_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
      endings: [getDefaultEndingCard([], locale)],
      hiddenFields: hiddenFieldsDefault,
    },
  };
};

const marketSiteClarity = (locale: string): TTemplate => {
  return {
    name: translate("market_site_clarity_name", locale),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: translate("market_site_clarity_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("market_site_clarity_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("market_site_clarity_question_1_headline", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("market_site_clarity_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_site_clarity_question_1_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("market_site_clarity_question_1_choice_3", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("market_site_clarity_question_2_headline", locale) },
          required: false,
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: translate("market_site_clarity_question_3_headline", locale) },
          required: false,
          buttonLabel: { default: translate("market_site_clarity_question_3_button_label", locale) },
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonExternal: true,
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const customerEffortScore = (locale: string): TTemplate => {
  return {
    name: translate("customer_effort_score_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: translate("customer_effort_score_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("customer_effort_score_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: translate("customer_effort_score_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("customer_effort_score_question_1_lower_label", locale) },
          upperLabel: { default: translate("customer_effort_score_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("customer_effort_score_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("customer_effort_score_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const careerDevelopmentSurvey = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("career_development_survey_name", locale),
    role: "productManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("career_development_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("career_development_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("career_development_survey_question_1_headline", locale),
          },
          lowerLabel: { default: translate("career_development_survey_question_1_lower_label", locale) },
          upperLabel: { default: translate("career_development_survey_question_1_upper_label", locale) },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("career_development_survey_question_2_headline", locale),
          },
          lowerLabel: { default: translate("career_development_survey_question_2_lower_label", locale) },
          upperLabel: { default: translate("career_development_survey_question_2_upper_label", locale) },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("career_development_survey_question_3_headline", locale),
          },
          lowerLabel: { default: translate("career_development_survey_question_3_lower_label", locale) },
          upperLabel: { default: translate("career_development_survey_question_3_upper_label", locale) },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("career_development_survey_question_4_headline", locale),
          },
          lowerLabel: { default: translate("career_development_survey_question_4_lower_label", locale) },
          upperLabel: { default: translate("career_development_survey_question_4_upper_label", locale) },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("career_development_survey_question_5_headline", locale) },
          subheader: { default: translate("career_development_survey_question_5_subheader", locale) },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_5_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_5_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_5_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_5_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_5_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("career_development_survey_question_5_choice_6", locale) },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: translate("career_development_survey_question_6_headline", locale) },
          subheader: { default: translate("career_development_survey_question_6_subheader", locale) },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_6_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_6_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_6_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_6_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("career_development_survey_question_6_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("career_development_survey_question_6_choice_6", locale) },
            },
          ],
        },
      ],
    },
  };
};

const professionalDevelopmentSurvey = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("professional_development_survey_name", locale),
    role: "productManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("professional_development_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("professional_development_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: {
            default: translate("professional_development_survey_question_1_headline", locale),
          },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_1_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_1_choice_2", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },

        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: translate("professional_development_survey_question_2_headline", locale),
          },
          subheader: { default: translate("professional_development_survey_question_2_subheader", locale) },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_2_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_2_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_2_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_2_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_2_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("professional_development_survey_question_2_choice_6", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: {
            default: translate("professional_development_survey_question_3_headline", locale),
          },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_3_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_3_choice_2", locale) },
            },
          ],
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("professional_development_survey_question_4_headline", locale),
          },
          lowerLabel: {
            default: translate("professional_development_survey_question_4_lower_label", locale),
          },
          upperLabel: {
            default: translate("professional_development_survey_question_4_upper_label", locale),
          },
          required: true,
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: translate("professional_development_survey_question_5_headline", locale),
          },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_5_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_5_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_5_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_5_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("professional_development_survey_question_5_choice_5", locale) },
            },
            {
              id: "other",
              label: { default: translate("professional_development_survey_question_5_choice_6", locale) },
            },
          ],
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const rateCheckoutExperience = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("rate_checkout_experience_name", locale),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["website", "app"],
    description: translate("rate_checkout_experience_description", locale),
    preset: {
      ...localSurvey,
      name: translate("rate_checkout_experience_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("rate_checkout_experience_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("rate_checkout_experience_question_1_lower_label", locale) },
          upperLabel: { default: translate("rate_checkout_experience_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("rate_checkout_experience_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("rate_checkout_experience_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("rate_checkout_experience_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("rate_checkout_experience_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const measureSearchExperience = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("measure_search_experience_name", locale),
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: translate("measure_search_experience_description", locale),
    preset: {
      ...localSurvey,
      name: translate("measure_search_experience_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("measure_search_experience_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("measure_search_experience_question_1_lower_label", locale) },
          upperLabel: { default: translate("measure_search_experience_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("measure_search_experience_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("measure_search_experience_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("measure_search_experience_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("measure_search_experience_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const evaluateContentQuality = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("evaluate_content_quality_name", locale),
    role: "marketing",
    industries: ["other"],
    channels: ["website"],
    description: translate("evaluate_content_quality_description", locale),
    preset: {
      ...localSurvey,
      name: translate("evaluate_content_quality_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("evaluate_content_quality_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("evaluate_content_quality_question_1_lower_label", locale) },
          upperLabel: { default: translate("evaluate_content_quality_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("evaluate_content_quality_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("evaluate_content_quality_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("evaluate_content_quality_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("evaluate_content_quality_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const measureTaskAccomplishment = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("measure_task_accomplishment_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website"],
    description: translate("measure_task_accomplishment_description", locale),
    preset: {
      ...localSurvey,
      name: translate("measure_task_accomplishment_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("measure_task_accomplishment_question_1_option_1_label", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("measure_task_accomplishment_question_1_option_2_label", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("measure_task_accomplishment_question_1_option_3_label", locale) },
            },
          ],
          headline: { default: translate("measure_task_accomplishment_question_1_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("measure_task_accomplishment_question_2_headline", locale) },
          required: false,
          lowerLabel: { default: translate("measure_task_accomplishment_question_2_lower_label", locale) },
          upperLabel: { default: translate("measure_task_accomplishment_question_2_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("measure_task_accomplishment_question_3_headline", locale) },
          required: false,
          placeholder: { default: translate("measure_task_accomplishment_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("measure_task_accomplishment_question_4_headline", locale) },
          required: false,
          buttonLabel: { default: translate("measure_task_accomplishment_question_4_button_label", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("measure_task_accomplishment_question_5_headline", locale) },
          required: true,
          buttonLabel: { default: translate("measure_task_accomplishment_question_5_button_label", locale) },
          placeholder: { default: translate("measure_task_accomplishment_question_5_placeholder", locale) },
          inputType: "text",
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const identifySignUpBarriers = (locale: string): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  const localSurvey = getDefaultSurveyPreset(locale);
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return {
    name: translate("identify_sign_up_barriers_name", locale),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: translate("identify_sign_up_barriers_description", locale),
    preset: {
      ...localSurvey,
      name: translate("identify_sign_up_barriers_with_project_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: translate("identify_sign_up_barriers_question_1_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_1_headline", locale) },
          required: false,
          buttonLabel: { default: translate("identify_sign_up_barriers_question_1_button_label", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("identify_sign_up_barriers_question_1_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("identify_sign_up_barriers_question_2_headline", locale) },
          required: true,
          lowerLabel: { default: translate("identify_sign_up_barriers_question_2_lower_label", locale) },
          upperLabel: { default: translate("identify_sign_up_barriers_question_2_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[6],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[4],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[7],
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("identify_sign_up_barriers_question_3_choice_1_label", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("identify_sign_up_barriers_question_3_choice_2_label", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("identify_sign_up_barriers_question_3_choice_3_label", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("identify_sign_up_barriers_question_3_choice_4_label", locale) },
            },
            {
              id: reusableOptionIds[4],
              label: { default: translate("identify_sign_up_barriers_question_3_choice_5_label", locale) },
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_3_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_4_headline", locale) },
          required: true,
          placeholder: { default: translate("identify_sign_up_barriers_question_4_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_5_headline", locale) },
          required: true,
          placeholder: { default: translate("identify_sign_up_barriers_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_6_headline", locale) },
          required: true,
          placeholder: { default: translate("identify_sign_up_barriers_question_6_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[6],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[8],
                },
              ],
            },
          ],
          headline: { default: translate("identify_sign_up_barriers_question_7_headline", locale) },
          required: true,
          placeholder: { default: translate("identify_sign_up_barriers_question_7_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("identify_sign_up_barriers_question_8_headline", locale) },
          required: true,
          placeholder: { default: translate("identify_sign_up_barriers_question_8_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[8],
          html: {
            default: translate("identify_sign_up_barriers_question_9_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: translate("identify_sign_up_barriers_question_9_headline", locale) },
          required: false,
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonLabel: { default: translate("identify_sign_up_barriers_question_9_button_label", locale) },
          buttonExternal: true,
          dismissButtonLabel: {
            default: translate("identify_sign_up_barriers_question_9_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const buildProductRoadmap = (locale: string): TTemplate => {
  return {
    name: translate("build_product_roadmap_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: translate("build_product_roadmap_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("build_product_roadmap_name_with_project_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: translate("build_product_roadmap_question_1_headline", locale),
          },
          required: true,
          lowerLabel: { default: translate("build_product_roadmap_question_1_lower_label", locale) },
          upperLabel: { default: translate("build_product_roadmap_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("build_product_roadmap_question_2_headline", locale),
          },
          required: true,
          placeholder: { default: translate("build_product_roadmap_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const understandPurchaseIntention = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("understand_purchase_intention_name", locale),
    role: "sales",
    industries: ["eCommerce"],
    channels: ["website", "link", "app"],
    description: translate("understand_purchase_intention_description", locale),
    preset: {
      ...localSurvey,
      name: translate("understand_purchase_intention_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 2,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("understand_purchase_intention_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("understand_purchase_intention_question_1_lower_label", locale) },
          upperLabel: { default: translate("understand_purchase_intention_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("understand_purchase_intention_question_2_headline", locale) },
          required: false,
          placeholder: { default: translate("understand_purchase_intention_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("understand_purchase_intention_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("understand_purchase_intention_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const improveNewsletterContent = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("improve_newsletter_content_name", locale),
    role: "marketing",
    industries: ["eCommerce", "saas", "other"],
    channels: ["link"],
    description: translate("improve_newsletter_content_description", locale),
    preset: {
      ...localSurvey,
      name: translate("improve_newsletter_content_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "isLessThan",
                    rightOperand: {
                      type: "static",
                      value: 5,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
          ],
          range: 5,
          scale: "smiley",
          headline: { default: translate("improve_newsletter_content_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("improve_newsletter_content_question_1_lower_label", locale) },
          upperLabel: { default: translate("improve_newsletter_content_question_1_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "or",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSkipped",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("improve_newsletter_content_question_2_headline", locale) },
          required: false,
          placeholder: { default: translate("improve_newsletter_content_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: translate("improve_newsletter_content_question_3_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: translate("improve_newsletter_content_question_3_headline", locale) },
          required: false,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: translate("improve_newsletter_content_question_3_button_label", locale) },
          buttonExternal: true,
          dismissButtonLabel: {
            default: translate("improve_newsletter_content_question_3_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const evaluateAProductIdea = (locale: string): TTemplate => {
  const reusableQuestionIds = [
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
    createId(),
  ];
  return {
    name: translate("evaluate_a_product_idea_name", locale),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["link", "app"],
    description: translate("evaluate_a_product_idea_description", locale),
    preset: {
      ...getDefaultSurveyPreset(locale),
      name: translate("evaluate_a_product_idea_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: translate("evaluate_a_product_idea_question_1_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: {
            default: translate("evaluate_a_product_idea_question_1_headline", locale),
          },
          required: true,
          buttonLabel: { default: translate("evaluate_a_product_idea_question_1_button_label", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("evaluate_a_product_idea_question_1_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("evaluate_a_product_idea_question_2_headline", locale) },
          required: true,
          lowerLabel: { default: translate("evaluate_a_product_idea_question_2_lower_label", locale) },
          upperLabel: { default: translate("evaluate_a_product_idea_question_2_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },

        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("evaluate_a_product_idea_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("evaluate_a_product_idea_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default: translate("evaluate_a_product_idea_question_4_html", locale),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: translate("evaluate_a_product_idea_question_4_headline", locale) },
          required: true,
          buttonLabel: { default: translate("evaluate_a_product_idea_question_4_button_label", locale) },
          buttonExternal: false,
          dismissButtonLabel: {
            default: translate("evaluate_a_product_idea_question_4_dismiss_button_label", locale),
          },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.Rating,
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isLessThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 3,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isGreaterThanOrEqual",
                    rightOperand: {
                      type: "static",
                      value: 4,
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[6],
                },
              ],
            },
          ],
          range: 5,
          scale: "number",
          headline: { default: translate("evaluate_a_product_idea_question_5_headline", locale) },
          required: true,
          lowerLabel: { default: translate("evaluate_a_product_idea_question_5_lower_label", locale) },
          upperLabel: { default: translate("evaluate_a_product_idea_question_5_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[5],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[7],
                },
              ],
            },
          ],
          headline: { default: translate("evaluate_a_product_idea_question_6_headline", locale) },
          required: true,
          placeholder: { default: translate("evaluate_a_product_idea_question_6_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("evaluate_a_product_idea_question_7_headline", locale) },
          required: true,
          placeholder: { default: translate("evaluate_a_product_idea_question_7_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("evaluate_a_product_idea_question_8_headline", locale) },
          required: false,
          placeholder: { default: translate("evaluate_a_product_idea_question_8_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const understandLowEngagement = (locale: string): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];

  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("understand_low_engagement_name", locale),
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: translate("understand_low_engagement_description", locale),
    preset: {
      ...localSurvey,
      name: translate("understand_low_engagement_name", locale),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[0],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[1],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[1],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[2],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[2],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[3],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: reusableOptionIds[3],
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[4],
                },
              ],
            },
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[0],
                      type: "question",
                    },
                    operator: "equals",
                    rightOperand: {
                      type: "static",
                      value: "other",
                    },
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: reusableQuestionIds[5],
                },
              ],
            },
          ],
          choices: [
            {
              id: reusableOptionIds[0],
              label: { default: translate("understand_low_engagement_question_1_choice_1", locale) },
            },
            {
              id: reusableOptionIds[1],
              label: { default: translate("understand_low_engagement_question_1_choice_2", locale) },
            },
            {
              id: reusableOptionIds[2],
              label: { default: translate("understand_low_engagement_question_1_choice_3", locale) },
            },
            {
              id: reusableOptionIds[3],
              label: { default: translate("understand_low_engagement_question_1_choice_4", locale) },
            },
            {
              id: "other",
              label: { default: translate("understand_low_engagement_question_1_choice_5", locale) },
            },
          ],
          headline: { default: translate("understand_low_engagement_question_1_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[1],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("understand_low_engagement_question_2_headline", locale) },
          required: true,
          placeholder: { default: translate("understand_low_engagement_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[2],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("understand_low_engagement_question_3_headline", locale) },
          required: true,
          placeholder: { default: translate("understand_low_engagement_question_3_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[3],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("understand_low_engagement_question_4_headline", locale) },
          required: true,
          placeholder: { default: translate("understand_low_engagement_question_4_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [
            {
              id: createId(),
              conditions: {
                id: createId(),
                connector: "and",
                conditions: [
                  {
                    id: createId(),
                    leftOperand: {
                      value: reusableQuestionIds[4],
                      type: "question",
                    },
                    operator: "isSubmitted",
                  },
                ],
              },
              actions: [
                {
                  id: createId(),
                  objective: "jumpToQuestion",
                  target: localSurvey.endings[0].id,
                },
              ],
            },
          ],
          headline: { default: translate("understand_low_engagement_question_5_headline", locale) },
          required: true,
          placeholder: { default: translate("understand_low_engagement_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [],
          headline: { default: translate("understand_low_engagement_question_6_headline", locale) },
          required: false,
          placeholder: { default: translate("understand_low_engagement_question_6_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const employeeWellBeing = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("employee_well_being_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("employee_well_being_description", locale),
    preset: {
      ...localSurvey,
      name: translate("employee_well_being_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("employee_well_being_question_1_headline", locale) },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("employee_well_being_question_1_lower_label", locale),
          },
          upperLabel: {
            default: translate("employee_well_being_question_1_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("employee_well_being_question_2_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("employee_well_being_question_2_lower_label", locale),
          },
          upperLabel: {
            default: translate("employee_well_being_question_2_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: translate("employee_well_being_question_3_headline", locale) },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("employee_well_being_question_3_lower_label", locale),
          },
          upperLabel: {
            default: translate("employee_well_being_question_3_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("employee_well_being_question_4_headline", locale) },
          required: false,
          placeholder: { default: translate("employee_well_being_question_4_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const longTermRetentionCheckIn = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("long_term_retention_check_in_name", locale),
    role: "peopleManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: translate("long_term_retention_check_in_description", locale),
    preset: {
      ...localSurvey,
      name: translate("long_term_retention_check_in_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "star",
          headline: { default: translate("long_term_retention_check_in_question_1_headline", locale) },
          required: true,
          lowerLabel: { default: translate("long_term_retention_check_in_question_1_lower_label", locale) },
          upperLabel: { default: translate("long_term_retention_check_in_question_1_upper_label", locale) },
          isColorCodingEnabled: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("long_term_retention_check_in_question_2_headline", locale) },
          required: false,
          placeholder: { default: translate("long_term_retention_check_in_question_2_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_3_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_3_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_3_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_3_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_3_choice_5", locale) },
            },
          ],
          headline: {
            default: translate("long_term_retention_check_in_question_3_headline", locale),
          },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: translate("long_term_retention_check_in_question_4_headline", locale) },
          required: true,
          lowerLabel: { default: translate("long_term_retention_check_in_question_4_lower_label", locale) },
          upperLabel: { default: translate("long_term_retention_check_in_question_4_upper_label", locale) },
          isColorCodingEnabled: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("long_term_retention_check_in_question_5_headline", locale),
          },
          required: false,
          placeholder: { default: translate("long_term_retention_check_in_question_5_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: translate("long_term_retention_check_in_question_6_headline", locale) },
          required: false,
          lowerLabel: { default: translate("long_term_retention_check_in_question_6_lower_label", locale) },
          upperLabel: { default: translate("long_term_retention_check_in_question_6_upper_label", locale) },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_7_choice_1", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_7_choice_2", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_7_choice_3", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_7_choice_4", locale) },
            },
            {
              id: createId(),
              label: { default: translate("long_term_retention_check_in_question_7_choice_5", locale) },
            },
          ],
          headline: { default: translate("long_term_retention_check_in_question_7_headline", locale) },
          required: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("long_term_retention_check_in_question_8_headline", locale) },
          required: false,
          placeholder: { default: translate("long_term_retention_check_in_question_8_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "smiley",
          headline: { default: translate("long_term_retention_check_in_question_9_headline", locale) },
          required: true,
          lowerLabel: { default: translate("long_term_retention_check_in_question_9_lower_label", locale) },
          upperLabel: { default: translate("long_term_retention_check_in_question_9_upper_label", locale) },
          isColorCodingEnabled: true,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: translate("long_term_retention_check_in_question_10_headline", locale) },
          required: false,
          placeholder: { default: translate("long_term_retention_check_in_question_10_placeholder", locale) },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const professionalDevelopmentGrowth = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("professional_development_growth_survey_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("professional_development_growth_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("professional_development_growth_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("professional_development_growth_survey_question_1_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("professional_development_growth_survey_question_1_lower_label", locale),
          },
          upperLabel: {
            default: translate("professional_development_growth_survey_question_1_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("professional_development_growth_survey_question_2_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("professional_development_growth_survey_question_2_lower_label", locale),
          },
          upperLabel: {
            default: translate("professional_development_growth_survey_question_2_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("professional_development_growth_survey_question_3_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("professional_development_growth_survey_question_3_lower_label", locale),
          },
          upperLabel: {
            default: translate("professional_development_growth_survey_question_3_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("professional_development_growth_survey_question_4_headline", locale),
          },
          required: false,
          placeholder: {
            default: translate("professional_development_growth_survey_question_4_placeholder", locale),
          },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const recognitionAndReward = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("recognition_and_reward_survey_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("recognition_and_reward_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("recognition_and_reward_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("recognition_and_reward_survey_question_1_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("recognition_and_reward_survey_question_1_lower_label", locale),
          },
          upperLabel: {
            default: translate("recognition_and_reward_survey_question_1_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("recognition_and_reward_survey_question_2_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("recognition_and_reward_survey_question_2_lower_label", locale),
          },
          upperLabel: {
            default: translate("recognition_and_reward_survey_question_2_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("recognition_and_reward_survey_question_3_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("recognition_and_reward_survey_question_3_lower_label", locale),
          },
          upperLabel: {
            default: translate("recognition_and_reward_survey_question_3_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("recognition_and_reward_survey_question_4_headline", locale),
          },
          required: false,
          placeholder: {
            default: translate("recognition_and_reward_survey_question_4_placeholder", locale),
          },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const alignmentAndEngagement = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("alignment_and_engagement_survey_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("alignment_and_engagement_survey_description", locale),
    preset: {
      ...localSurvey,
      name: "Alignment and Engagement with Company Vision",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("alignment_and_engagement_survey_question_1_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("alignment_and_engagement_survey_question_1_lower_label", locale),
          },
          upperLabel: {
            default: translate("alignment_and_engagement_survey_question_1_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("alignment_and_engagement_survey_question_2_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("alignment_and_engagement_survey_question_2_lower_label", locale),
          },
          upperLabel: {
            default: translate("alignment_and_engagement_survey_question_2_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("alignment_and_engagement_survey_question_3_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("alignment_and_engagement_survey_question_3_lower_label", locale),
          },
          upperLabel: {
            default: translate("alignment_and_engagement_survey_question_3_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("alignment_and_engagement_survey_question_4_headline", locale),
          },
          required: false,
          placeholder: {
            default: translate("alignment_and_engagement_survey_question_4_placeholder", locale),
          },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

const supportiveWorkCulture = (locale: string): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(locale);
  return {
    name: translate("supportive_work_culture_survey_name", locale),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: translate("supportive_work_culture_survey_description", locale),
    preset: {
      ...localSurvey,
      name: translate("supportive_work_culture_survey_name", locale),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("supportive_work_culture_survey_question_1_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("supportive_work_culture_survey_question_1_lower_label", locale),
          },
          upperLabel: {
            default: translate("supportive_work_culture_survey_question_1_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("supportive_work_culture_survey_question_2_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("supportive_work_culture_survey_question_2_lower_label", locale),
          },
          upperLabel: {
            default: translate("supportive_work_culture_survey_question_2_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: translate("supportive_work_culture_survey_question_3_headline", locale),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: translate("supportive_work_culture_survey_question_3_lower_label", locale),
          },
          upperLabel: {
            default: translate("supportive_work_culture_survey_question_3_upper_label", locale),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: translate("next", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: translate("supportive_work_culture_survey_question_4_headline", locale),
          },
          required: false,
          placeholder: {
            default: translate("supportive_work_culture_survey_question_4_placeholder", locale),
          },
          inputType: "text",
          buttonLabel: { default: translate("finish", locale) },
          backButtonLabel: { default: translate("back", locale) },
        },
      ],
    },
  };
};

export const templates = (locale = defaultLocale): TTemplate[] => [
  cartAbandonmentSurvey(locale),
  siteAbandonmentSurvey(locale),
  productMarketFitSuperhuman(locale),
  onboardingSegmentation(locale),
  churnSurvey(locale),
  earnedAdvocacyScore(locale),
  improveTrialConversion(locale),
  reviewPrompt(locale),
  interviewPrompt(locale),
  improveActivationRate(locale),
  uncoverStrengthsAndWeaknesses(locale),
  productMarketFitShort(locale),
  marketAttribution(locale),
  changingSubscriptionExperience(locale),
  identifyCustomerGoals(locale),
  featureChaser(locale),
  fakeDoorFollowUp(locale),
  feedbackBox(locale),
  integrationSetupSurvey(locale),
  newIntegrationSurvey(locale),
  docsFeedback(locale),
  NPS(locale),
  customerSatisfactionScore(locale),
  collectFeedback(locale),
  identifyUpsellOpportunities(locale),
  prioritizeFeatures(locale),
  gaugeFeatureSatisfaction(locale),
  marketSiteClarity(locale),
  customerEffortScore(locale),
  rateCheckoutExperience(locale),
  measureSearchExperience(locale),
  evaluateContentQuality(locale),
  measureTaskAccomplishment(locale),
  identifySignUpBarriers(locale),
  buildProductRoadmap(locale),
  understandPurchaseIntention(locale),
  improveNewsletterContent(locale),
  evaluateAProductIdea(locale),
  understandLowEngagement(locale),
  employeeSatisfaction(locale),
  employeeWellBeing(locale),
  longTermRetentionCheckIn(locale),
  supportiveWorkCulture(locale),
  alignmentAndEngagement(locale),
  recognitionAndReward(locale),
  professionalDevelopmentGrowth(locale),
  professionalDevelopmentSurvey(locale),
  careerDevelopmentSurvey(locale),
];

export const getCustomSurveyTemplate = (locale: string): TTemplate => ({
  name: translate("custom_survey_name", locale),
  description: translate("custom_survey_description", locale),
  preset: {
    ...getDefaultSurveyPreset(locale),
    name: translate("custom_survey_name", locale),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("custom_survey_question_1_headline", locale) },
        placeholder: { default: translate("custom_survey_question_1_placeholder", locale) },
        buttonLabel: { default: translate("next", locale) },
        required: true,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      } as TSurveyOpenTextQuestion,
    ],
  },
});
