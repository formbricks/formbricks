import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import {
  TSurvey,
  TSurveyEndScreenCard,
  TSurveyHiddenFields,
  TSurveyLanguage,
  TSurveyOpenTextQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyWelcomeCard,
} from "@formbricks/types/surveys/types";
import { TTemplate } from "@formbricks/types/templates";

export const getDefaultEndingCard = (languages: TSurveyLanguage[], t: TFnType): TSurveyEndScreenCard => {
  const languageCodes = extractLanguageCodes(languages);
  return {
    id: createId(),
    type: "endScreen",
    headline: createI18nString(t("templates.default_ending_card_headline"), languageCodes),
    subheader: createI18nString(t("templates.default_ending_card_subheader"), languageCodes),
    buttonLabel: createI18nString(t("templates.default_ending_card_button_label"), languageCodes),
    buttonLink: window ? window.location.origin : "",
  };
};

const hiddenFieldsDefault: TSurveyHiddenFields = {
  enabled: true,
  fieldIds: [],
};

export const getDefaultWelcomeCard = (t: TFnType): TSurveyWelcomeCard => {
  return {
    enabled: false,
    headline: { default: t("templates.default_welcome_card_headline") },
    html: { default: t("templates.default_welcome_card_html") },
    buttonLabel: { default: t("templates.default_welcome_card_button_label") },
    timeToFinish: false,
    showResponseCount: false,
  };
};

export const getDefaultSurveyPreset = (t: TFnType): TTemplate["preset"] => {
  return {
    name: "New Survey",
    welcomeCard: getDefaultWelcomeCard(t),
    endings: [getDefaultEndingCard([], t)],
    hiddenFields: hiddenFieldsDefault,
    questions: [],
  };
};

const cartAbandonmentSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.card_abandonment_survey"),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website", "link"],
    description: t("templates.card_abandonment_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.card_abandonment_survey"),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: t("templates.card_abandonment_survey_question_1_html"),
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
          headline: { default: t("templates.card_abandonment_survey_question_1_headline") },
          required: false,
          buttonLabel: { default: t("templates.card_abandonment_survey_question_1_button_label") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.card_abandonment_survey_question_1_dismiss_button_label"),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.card_abandonment_survey_question_2_headline") },
          subheader: { default: t("templates.card_abandonment_survey_question_2_subheader") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_2_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_2_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_2_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.card_abandonment_survey_question_2_choice_6") },
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
            default: t("templates.card_abandonment_survey_question_3_headline"),
          },
          required: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.card_abandonment_survey_question_4_headline") },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: t("templates.card_abandonment_survey_question_4_lower_label") },
          upperLabel: { default: t("templates.card_abandonment_survey_question_4_upper_label") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: t("templates.card_abandonment_survey_question_5_headline"),
          },
          subheader: { default: t("templates.card_abandonment_survey_question_5_subheader") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_5_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_5_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_5_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_5_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.card_abandonment_survey_question_5_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.card_abandonment_survey_question_5_choice_6") },
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
          headline: { default: t("templates.card_abandonment_survey_question_6_headline") },
          required: false,
          label: { default: t("templates.card_abandonment_survey_question_6_label") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.card_abandonment_survey_question_7_headline") },
          required: true,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: "example@email.com" },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.card_abandonment_survey_question_8_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const siteAbandonmentSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.site_abandonment_survey"),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["app", "website"],
    description: t("templates.site_abandonment_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.site_abandonment_survey"),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: t("templates.site_abandonment_survey_question_1_html"),
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
          headline: { default: t("templates.site_abandonment_survey_question_2_headline") },
          required: false,
          buttonLabel: { default: t("templates.site_abandonment_survey_question_2_button_label") },
          backButtonLabel: { default: t("templates.back") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.site_abandonment_survey_question_2_dismiss_button_label"),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.site_abandonment_survey_question_3_headline") },
          subheader: { default: t("templates.site_abandonment_survey_question_3_subheader") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_3_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_3_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_3_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_3_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_3_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.site_abandonment_survey_question_3_choice_6") },
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
            default: t("templates.site_abandonment_survey_question_4_headline"),
          },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.site_abandonment_survey_question_5_headline") },
          required: true,
          scale: "number",
          range: 5,
          lowerLabel: { default: t("templates.site_abandonment_survey_question_5_lower_label") },
          upperLabel: { default: t("templates.site_abandonment_survey_question_5_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: t("templates.site_abandonment_survey_question_6_headline"),
          },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          subheader: { default: t("templates.site_abandonment_survey_question_6_subheader") },
          required: true,
          choices: [
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_6_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_6_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_6_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_6_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.site_abandonment_survey_question_6_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.site_abandonment_survey_question_6_choice_6") },
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
          headline: { default: t("templates.site_abandonment_survey_question_7_headline") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          required: false,
          label: { default: t("templates.site_abandonment_survey_question_7_label") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.site_abandonment_survey_question_8_headline") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.site_abandonment_survey_question_9_headline") },
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
          required: false,
          inputType: "text",
        },
      ],
    },
  };
};

const productMarketFitSuperhuman = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.product_market_fit_superhuman"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: t("templates.product_market_fit_superhuman_description"),
    preset: {
      ...localSurvey,
      name: t("templates.product_market_fit_superhuman"),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: t("templates.product_market_fit_superhuman_question_1_html"),
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
          headline: { default: t("templates.product_market_fit_superhuman_question_1_headline") },
          required: false,
          buttonLabel: {
            default: t("templates.product_market_fit_superhuman_question_1_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.product_market_fit_superhuman_question_1_dismiss_button_label"),
          },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.product_market_fit_superhuman_question_2_headline") },
          subheader: { default: t("templates.product_market_fit_superhuman_question_2_subheader") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_2_choice_3") },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.product_market_fit_superhuman_question_3_headline") },
          subheader: { default: t("templates.product_market_fit_superhuman_question_3_subheader") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_3_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_3_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_3_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_3_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_superhuman_question_3_choice_5") },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.product_market_fit_superhuman_question_4_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.product_market_fit_superhuman_question_5_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          inputType: "text",
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.product_market_fit_superhuman_question_6_headline") },
          subheader: { default: t("templates.product_market_fit_superhuman_question_6_subheader") },
          required: true,
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
          inputType: "text",
        },
      ],
    },
  };
};

const onboardingSegmentation = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.onboarding_segmentation"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: t("templates.onboarding_segmentation_description"),
    preset: {
      ...localSurvey,
      name: t("templates.onboarding_segmentation"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.onboarding_segmentation_question_1_headline") },
          subheader: { default: t("templates.onboarding_segmentation_question_1_subheader") },
          required: true,
          shuffleOption: "none",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          choices: [
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_1_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_1_choice_5") },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.onboarding_segmentation_question_2_headline") },
          subheader: { default: t("templates.onboarding_segmentation_question_2_subheader") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_2_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_2_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_2_choice_5") },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.onboarding_segmentation_question_3_headline") },
          subheader: { default: t("templates.onboarding_segmentation_question_3_subheader") },
          required: true,
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_3_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_3_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_3_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_3_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.onboarding_segmentation_question_3_choice_5") },
            },
          ],
        },
      ],
    },
  };
};

const churnSurvey = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.churn_survey"),
    role: "sales",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: t("templates.churn_survey_description"),
    preset: {
      ...localSurvey,
      name: "Churn Survey",
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
              label: { default: t("templates.churn_survey_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.churn_survey_question_1_choice_2") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.churn_survey_question_1_choice_3") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.churn_survey_question_1_choice_4") },
            },
            {
              id: reusableOptionIds[4],
              label: { default: t("templates.churn_survey_question_1_choice_5") },
            },
          ],
          headline: { default: t("templates.churn_survey_question_1_headline") },
          required: true,
          subheader: { default: t("templates.churn_survey_question_1_subheader") },
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
          headline: { default: t("templates.churn_survey_question_2_headline") },
          backButtonLabel: { default: t("templates.back") },
          required: true,
          buttonLabel: { default: t("templates.churn_survey_question_2_button_label") },
          inputType: "text",
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: t("templates.churn_survey_question_3_html"),
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
          headline: { default: t("templates.churn_survey_question_3_headline") },
          required: true,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: t("templates.churn_survey_question_3_button_label") },
          buttonExternal: true,
          backButtonLabel: { default: t("templates.back") },
          dismissButtonLabel: { default: t("templates.churn_survey_question_3_dismiss_button_label") },
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
          headline: { default: t("templates.churn_survey_question_4_headline") },
          required: true,
          inputType: "text",
        },
        {
          id: reusableQuestionIds[4],
          html: {
            default: t("templates.churn_survey_question_5_html"),
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
          headline: { default: t("templates.churn_survey_question_5_headline") },
          required: true,
          buttonUrl: "mailto:ceo@company.com",
          buttonLabel: { default: t("templates.churn_survey_question_5_button_label") },
          buttonExternal: true,
          dismissButtonLabel: { default: t("templates.churn_survey_question_5_dismiss_button_label") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const earnedAdvocacyScore = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.earned_advocacy_score_name"),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: t("templates.earned_advocacy_score_description"),
    preset: {
      ...localSurvey,
      name: t("templates.earned_advocacy_score_name"),
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
              label: { default: t("templates.earned_advocacy_score_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.earned_advocacy_score_question_1_choice_2") },
            },
          ],
          headline: { default: t("templates.earned_advocacy_score_question_1_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.earned_advocacy_score_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.earned_advocacy_score_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.earned_advocacy_score_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.earned_advocacy_score_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
              label: { default: t("templates.earned_advocacy_score_question_4_choice_1") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.earned_advocacy_score_question_4_choice_2") },
            },
          ],
          headline: { default: t("templates.earned_advocacy_score_question_4_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.earned_advocacy_score_question_5_headline") },
          required: true,
          placeholder: { default: t("templates.earned_advocacy_score_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const improveTrialConversion = (t: TFnType): TTemplate => {
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
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.improve_trial_conversion_name"),
    role: "sales",
    industries: ["saas"],
    channels: ["link", "app"],
    description: t("templates.improve_trial_conversion_description"),
    preset: {
      ...localSurvey,
      name: t("templates.improve_trial_conversion_name"),
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
              label: { default: t("templates.improve_trial_conversion_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.improve_trial_conversion_question_1_choice_2") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.improve_trial_conversion_question_1_choice_3") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.improve_trial_conversion_question_1_choice_4") },
            },
            {
              id: reusableOptionIds[4],
              label: { default: t("templates.improve_trial_conversion_question_1_choice_5") },
            },
          ],
          headline: { default: t("templates.improve_trial_conversion_question_1_headline") },
          required: true,
          subheader: { default: t("templates.improve_trial_conversion_question_1_subheader") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_trial_conversion_question_2_headline") },
          required: true,
          buttonLabel: { default: t("templates.improve_trial_conversion_question_2_button_label") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_trial_conversion_question_2_headline") },
          required: true,
          buttonLabel: { default: t("templates.improve_trial_conversion_question_2_button_label") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default: t("templates.improve_trial_conversion_question_4_html"),
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
          headline: { default: t("templates.improve_trial_conversion_question_4_headline") },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: t("templates.improve_trial_conversion_question_4_button_label") },
          buttonExternal: true,
          dismissButtonLabel: {
            default: t("templates.improve_trial_conversion_question_4_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_trial_conversion_question_5_headline") },
          required: true,
          subheader: { default: t("templates.improve_trial_conversion_question_5_subheader") },
          buttonLabel: { default: t("templates.improve_trial_conversion_question_5_button_label") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_trial_conversion_question_6_headline") },
          required: false,
          subheader: { default: t("templates.improve_trial_conversion_question_6_subheader") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const reviewPrompt = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: t("templates.review_prompt_name"),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link", "app"],
    description: t("templates.review_prompt_description"),
    preset: {
      ...localSurvey,
      name: t("templates.review_prompt_name"),
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
          headline: { default: t("templates.review_prompt_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.review_prompt_question_1_lower_label") },
          upperLabel: { default: t("templates.review_prompt_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[1],
          html: { default: t("templates.review_prompt_question_2_html") },
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
          headline: { default: t("templates.review_prompt_question_2_headline") },
          required: true,
          buttonUrl: "https://formbricks.com/github",
          buttonLabel: { default: t("templates.review_prompt_question_2_button_label") },
          buttonExternal: true,
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.review_prompt_question_3_headline") },
          required: true,
          subheader: { default: t("templates.review_prompt_question_3_subheader") },
          buttonLabel: { default: t("templates.review_prompt_question_3_button_label") },
          placeholder: { default: t("templates.review_prompt_question_3_placeholder") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const interviewPrompt = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.interview_prompt_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.interview_prompt_description"),
    preset: {
      ...localSurvey,
      name: t("templates.interview_prompt_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: t("templates.interview_prompt_question_1_headline") },
          html: { default: t("templates.interview_prompt_question_1_html") },
          buttonLabel: { default: t("templates.interview_prompt_question_1_button_label") },
          buttonUrl: "https://cal.com/johannes",
          buttonExternal: true,
          required: false,
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const improveActivationRate = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.improve_activation_rate_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: t("templates.improve_activation_rate_description"),
    preset: {
      ...localSurvey,
      name: t("templates.improve_activation_rate_name"),
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
              label: { default: t("templates.improve_activation_rate_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.improve_activation_rate_question_1_choice_2") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.improve_activation_rate_question_1_choice_3") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.improve_activation_rate_question_1_choice_4") },
            },
            {
              id: reusableOptionIds[4],
              label: { default: t("templates.improve_activation_rate_question_1_choice_5") },
            },
          ],
          headline: {
            default: t("templates.improve_activation_rate_question_1_headline"),
          },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_activation_rate_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.improve_activation_rate_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_activation_rate_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.improve_activation_rate_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_activation_rate_question_4_headline") },
          required: true,
          placeholder: { default: t("templates.improve_activation_rate_question_4_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_activation_rate_question_5_headline") },
          required: true,
          placeholder: { default: t("templates.improve_activation_rate_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [],
          headline: { default: t("templates.improve_activation_rate_question_6_headline") },
          required: false,
          subheader: { default: t("templates.improve_activation_rate_question_6_subheader") },
          placeholder: { default: t("templates.improve_activation_rate_question_6_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const employeeSatisfaction = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.employee_satisfaction_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link"],
    description: t("templates.employee_satisfaction_description"),
    preset: {
      ...localSurvey,
      name: t("templates.employee_satisfaction_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "star",
          headline: { default: t("templates.employee_satisfaction_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.employee_satisfaction_question_1_lower_label") },
          upperLabel: { default: t("templates.employee_satisfaction_question_1_upper_label") },
          isColorCodingEnabled: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_2_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_2_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_2_choice_5") },
            },
          ],
          headline: { default: t("templates.employee_satisfaction_question_2_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.employee_satisfaction_question_3_headline") },
          required: false,
          placeholder: { default: t("templates.employee_satisfaction_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: t("templates.employee_satisfaction_question_5_headline") },
          required: true,
          lowerLabel: { default: t("templates.employee_satisfaction_question_5_lower_label") },
          upperLabel: { default: t("templates.employee_satisfaction_question_5_upper_label") },
          isColorCodingEnabled: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.employee_satisfaction_question_6_headline") },
          required: false,
          placeholder: { default: t("templates.employee_satisfaction_question_6_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_7_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_7_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_7_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_7_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.employee_satisfaction_question_7_choice_5") },
            },
          ],
          headline: { default: t("templates.employee_satisfaction_question_7_headline") },
          required: true,
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const uncoverStrengthsAndWeaknesses = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.uncover_strengths_and_weaknesses_name"),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: t("templates.uncover_strengths_and_weaknesses_description"),
    preset: {
      ...localSurvey,
      name: t("templates.uncover_strengths_and_weaknesses_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_1_choice_4") },
            },
            {
              id: "other",
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_1_choice_5") },
            },
          ],
          headline: { default: t("templates.uncover_strengths_and_weaknesses_question_1_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_2_choice_3") },
            },
            {
              id: "other",
              label: { default: t("templates.uncover_strengths_and_weaknesses_question_2_choice_4") },
            },
          ],
          headline: { default: t("templates.uncover_strengths_and_weaknesses_question_2_headline") },
          required: true,
          subheader: { default: t("templates.uncover_strengths_and_weaknesses_question_2_subheader") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.uncover_strengths_and_weaknesses_question_3_headline") },
          required: false,
          subheader: { default: t("templates.uncover_strengths_and_weaknesses_question_3_subheader") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const productMarketFitShort = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.product_market_fit_short_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: t("templates.product_market_fit_short_description"),
    preset: {
      ...localSurvey,
      name: t("templates.product_market_fit_short_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.product_market_fit_short_question_1_headline") },
          subheader: { default: t("templates.product_market_fit_short_question_1_subheader") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_short_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_short_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.product_market_fit_short_question_1_choice_3") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.product_market_fit_short_question_2_headline") },
          subheader: { default: t("templates.product_market_fit_short_question_2_subheader") },
          required: true,
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const marketAttribution = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.market_attribution_name"),
    role: "marketing",
    industries: ["saas", "eCommerce"],
    channels: ["website", "app", "link"],
    description: t("templates.market_attribution_description"),
    preset: {
      ...localSurvey,
      name: t("templates.market_attribution_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.market_attribution_question_1_headline") },
          subheader: { default: t("templates.market_attribution_question_1_subheader") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.market_attribution_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_attribution_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_attribution_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_attribution_question_1_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_attribution_question_1_choice_5") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const changingSubscriptionExperience = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.changing_subscription_experience_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.changing_subscription_experience_description"),
    preset: {
      ...localSurvey,
      name: t("templates.changing_subscription_experience_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.changing_subscription_experience_question_1_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_1_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_1_choice_5") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.changing_subscription_experience_question_2_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.changing_subscription_experience_question_2_choice_3") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const identifyCustomerGoals = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.identify_customer_goals_name"),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["app", "website"],
    description: t("templates.identify_customer_goals_description"),
    preset: {
      ...localSurvey,
      name: t("templates.identify_customer_goals_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: "What's your primary goal for using $[projectName]?" },
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
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const featureChaser = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.feature_chaser_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.feature_chaser_description"),
    preset: {
      ...localSurvey,
      name: t("templates.feature_chaser_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: t("templates.feature_chaser_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.feature_chaser_question_1_lower_label") },
          upperLabel: { default: t("templates.feature_chaser_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            { id: createId(), label: { default: t("templates.feature_chaser_question_2_choice_1") } },
            { id: createId(), label: { default: t("templates.feature_chaser_question_2_choice_2") } },
            { id: createId(), label: { default: t("templates.feature_chaser_question_2_choice_3") } },
            { id: createId(), label: { default: t("templates.feature_chaser_question_2_choice_4") } },
          ],
          headline: { default: t("templates.feature_chaser_question_2_headline") },
          required: true,
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const fakeDoorFollowUp = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.fake_door_follow_up_name"),
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: t("templates.fake_door_follow_up_description"),
    preset: {
      ...localSurvey,
      name: t("templates.fake_door_follow_up_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.fake_door_follow_up_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.fake_door_follow_up_question_1_lower_label") },
          upperLabel: { default: t("templates.fake_door_follow_up_question_1_upper_label") },
          range: 5,
          scale: "number",
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: { default: t("templates.fake_door_follow_up_question_2_headline") },
          required: false,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.fake_door_follow_up_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.fake_door_follow_up_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.fake_door_follow_up_question_2_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.fake_door_follow_up_question_2_choice_4") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const feedbackBox = (t: TFnType): TTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId()];
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.feedback_box_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.feedback_box_description"),
    preset: {
      ...localSurvey,
      name: t("templates.feedback_box_name"),
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
              label: { default: t("templates.feedback_box_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.feedback_box_question_1_choice_2") },
            },
          ],
          headline: { default: t("templates.feedback_box_question_1_headline") },
          required: true,
          subheader: { default: t("templates.feedback_box_question_1_subheader") },
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.feedback_box_question_2_headline") },
          required: true,
          subheader: { default: t("templates.feedback_box_question_2_subheader") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: t("templates.feedback_box_question_3_html"),
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
          headline: { default: t("templates.feedback_box_question_3_headline") },
          required: false,
          buttonLabel: { default: t("templates.feedback_box_question_3_button_label") },
          buttonExternal: false,
          dismissButtonLabel: { default: t("templates.feedback_box_question_3_dismiss_button_label") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.feedback_box_question_4_headline") },
          required: true,
          subheader: { default: t("templates.feedback_box_question_4_subheader") },
          buttonLabel: { default: t("templates.feedback_box_question_4_button_label") },
          placeholder: { default: t("templates.feedback_box_question_4_placeholder") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const integrationSetupSurvey = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    name: t("templates.integration_setup_survey_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.integration_setup_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.integration_setup_survey_name"),
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
          headline: { default: t("templates.integration_setup_survey_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.integration_setup_survey_question_1_lower_label") },
          upperLabel: { default: t("templates.integration_setup_survey_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.integration_setup_survey_question_2_headline") },
          required: false,
          placeholder: { default: t("templates.integration_setup_survey_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.integration_setup_survey_question_3_headline") },
          required: false,
          subheader: { default: t("templates.integration_setup_survey_question_3_subheader") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const newIntegrationSurvey = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.new_integration_survey_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.new_integration_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.new_integration_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.new_integration_survey_question_1_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.new_integration_survey_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.new_integration_survey_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.new_integration_survey_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.new_integration_survey_question_1_choice_4") },
            },
            {
              id: "other",
              label: { default: t("templates.new_integration_survey_question_1_choice_5") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const docsFeedback = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.docs_feedback_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website", "link"],
    description: t("templates.docs_feedback_description"),
    preset: {
      ...localSurvey,
      name: t("templates.docs_feedback_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.docs_feedback_question_1_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.docs_feedback_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.docs_feedback_question_1_choice_2") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.docs_feedback_question_2_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.docs_feedback_question_3_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const nps = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.nps_name"),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: t("templates.nps_description"),
    preset: {
      ...localSurvey,
      name: t("templates.nps_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: t("templates.nps_question_1_headline") },
          required: false,
          lowerLabel: { default: t("templates.nps_question_1_lower_label") },
          upperLabel: { default: t("templates.nps_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.nps_question_2_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const customerSatisfactionScore = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
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
    name: t("templates.csat_name"),
    role: "customerSuccess",
    industries: ["saas", "eCommerce", "other"],
    channels: ["app", "link", "website"],
    description: t("templates.csat_description"),
    preset: {
      ...localSurvey,
      name: t("templates.csat_name"),
      questions: [
        {
          id: reusableQuestionIds[0],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 10,
          scale: "number",
          headline: {
            default: t("templates.csat_question_1_headline"),
          },
          required: true,
          lowerLabel: { default: t("templates.csat_question_1_lower_label") },
          upperLabel: { default: t("templates.csat_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[1],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_2_headline") },
          subheader: { default: t("templates.csat_question_2_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_2_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_2_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_2_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_2_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_2_choice_5") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: t("templates.csat_question_3_headline"),
          },
          subheader: { default: t("templates.csat_question_3_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_3_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_5") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_6") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_7") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_8") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_9") } },
            { id: createId(), label: { default: t("templates.csat_question_3_choice_10") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_4_headline") },
          subheader: { default: t("templates.csat_question_4_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_4_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_4_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_4_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_4_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_4_choice_5") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_5_headline") },
          subheader: { default: t("templates.csat_question_5_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_5_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_5_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_5_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_5_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_5_choice_5") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_6_headline") },
          subheader: { default: t("templates.csat_question_6_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_6_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_6_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_6_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_6_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_6_choice_5") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_7_headline") },
          subheader: { default: t("templates.csat_question_7_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_7_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_7_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_7_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_7_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_7_choice_5") } },
            { id: createId(), label: { default: t("templates.csat_question_7_choice_6") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_8_headline") },
          subheader: { default: t("templates.csat_question_8_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_8_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_8_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_8_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_8_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_8_choice_5") } },
            { id: createId(), label: { default: t("templates.csat_question_8_choice_6") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[8],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.csat_question_9_headline") },
          subheader: { default: t("templates.csat_question_9_subheader") },
          required: true,
          choices: [
            { id: createId(), label: { default: t("templates.csat_question_9_choice_1") } },
            { id: createId(), label: { default: t("templates.csat_question_9_choice_2") } },
            { id: createId(), label: { default: t("templates.csat_question_9_choice_3") } },
            { id: createId(), label: { default: t("templates.csat_question_9_choice_4") } },
            { id: createId(), label: { default: t("templates.csat_question_9_choice_5") } },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[9],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.csat_question_10_headline") },
          required: false,
          placeholder: { default: t("templates.csat_question_10_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const collectFeedback = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
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
    name: t("templates.collect_feedback_name"),
    role: "productManager",
    industries: ["other", "eCommerce"],
    channels: ["website", "link"],
    description: t("templates.collect_feedback_description"),
    preset: {
      ...localSurvey,
      name: t("templates.collect_feedback_name"),
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
          headline: { default: t("templates.collect_feedback_question_1_headline") },
          subheader: { default: t("templates.collect_feedback_question_1_subheader") },
          required: true,
          lowerLabel: { default: t("templates.collect_feedback_question_1_lower_label") },
          upperLabel: { default: t("templates.collect_feedback_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.collect_feedback_question_2_headline") },
          required: true,
          longAnswer: true,
          placeholder: { default: t("templates.collect_feedback_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.collect_feedback_question_3_headline") },
          required: true,
          longAnswer: true,
          placeholder: { default: t("templates.collect_feedback_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[3],
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "smiley",
          headline: { default: t("templates.collect_feedback_question_4_headline") },
          required: true,
          lowerLabel: { default: t("templates.collect_feedback_question_4_lower_label") },
          upperLabel: { default: t("templates.collect_feedback_question_4_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.collect_feedback_question_5_headline") },
          required: false,
          longAnswer: true,
          placeholder: { default: t("templates.collect_feedback_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          choices: [
            { id: createId(), label: { default: t("templates.collect_feedback_question_6_choice_1") } },
            { id: createId(), label: { default: t("templates.collect_feedback_question_6_choice_2") } },
            { id: createId(), label: { default: t("templates.collect_feedback_question_6_choice_3") } },
            { id: createId(), label: { default: t("templates.collect_feedback_question_6_choice_4") } },
            { id: "other", label: { default: t("templates.collect_feedback_question_6_choice_5") } },
          ],
          headline: { default: t("templates.collect_feedback_question_6_headline") },
          required: true,
          shuffleOption: "none",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.collect_feedback_question_7_headline") },
          required: false,
          inputType: "email",
          longAnswer: false,
          placeholder: { default: t("templates.collect_feedback_question_7_placeholder") },
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const identifyUpsellOpportunities = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.identify_upsell_opportunities_name"),
    role: "sales",
    industries: ["saas"],
    channels: ["app", "link"],
    description: t("templates.identify_upsell_opportunities_description"),
    preset: {
      ...localSurvey,
      name: t("templates.identify_upsell_opportunities_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.identify_upsell_opportunities_question_1_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.identify_upsell_opportunities_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.identify_upsell_opportunities_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.identify_upsell_opportunities_question_1_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.identify_upsell_opportunities_question_1_choice_4") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const prioritizeFeatures = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.prioritize_features_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.prioritize_features_description"),
    preset: {
      ...localSurvey,
      name: t("templates.prioritize_features_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_1_choice_3") },
            },
            { id: "other", label: { default: t("templates.prioritize_features_question_1_choice_4") } },
          ],
          headline: { default: t("templates.prioritize_features_question_1_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          logic: [],
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.prioritize_features_question_2_choice_3") },
            },
          ],
          headline: { default: t("templates.prioritize_features_question_2_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.prioritize_features_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.prioritize_features_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const gaugeFeatureSatisfaction = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.gauge_feature_satisfaction_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.gauge_feature_satisfaction_description"),
    preset: {
      ...localSurvey,
      name: t("templates.gauge_feature_satisfaction_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.gauge_feature_satisfaction_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.gauge_feature_satisfaction_question_1_lower_label") },
          upperLabel: { default: t("templates.gauge_feature_satisfaction_question_1_upper_label") },
          scale: "number",
          range: 5,
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.gauge_feature_satisfaction_question_2_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
      endings: [getDefaultEndingCard([], t)],
      hiddenFields: hiddenFieldsDefault,
    },
  };
};

const marketSiteClarity = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.market_site_clarity_name"),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: t("templates.market_site_clarity_description"),
    preset: {
      ...localSurvey,
      name: t("templates.market_site_clarity_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.market_site_clarity_question_1_headline") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.market_site_clarity_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_site_clarity_question_1_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.market_site_clarity_question_1_choice_3") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.market_site_clarity_question_2_headline") },
          required: false,
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: t("templates.market_site_clarity_question_3_headline") },
          required: false,
          buttonLabel: { default: t("templates.market_site_clarity_question_3_button_label") },
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonExternal: true,
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const customerEffortScore = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.customer_effort_score_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app"],
    description: t("templates.customer_effort_score_description"),
    preset: {
      ...localSurvey,
      name: t("templates.customer_effort_score_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: t("templates.customer_effort_score_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.customer_effort_score_question_1_lower_label") },
          upperLabel: { default: t("templates.customer_effort_score_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.customer_effort_score_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.customer_effort_score_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const careerDevelopmentSurvey = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.career_development_survey_name"),
    role: "productManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.career_development_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.career_development_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.career_development_survey_question_1_headline"),
          },
          lowerLabel: { default: t("templates.career_development_survey_question_1_lower_label") },
          upperLabel: { default: t("templates.career_development_survey_question_1_upper_label") },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.career_development_survey_question_2_headline"),
          },
          lowerLabel: { default: t("templates.career_development_survey_question_2_lower_label") },
          upperLabel: { default: t("templates.career_development_survey_question_2_upper_label") },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.career_development_survey_question_3_headline"),
          },
          lowerLabel: { default: t("templates.career_development_survey_question_3_lower_label") },
          upperLabel: { default: t("templates.career_development_survey_question_3_upper_label") },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.career_development_survey_question_4_headline"),
          },
          lowerLabel: { default: t("templates.career_development_survey_question_4_lower_label") },
          upperLabel: { default: t("templates.career_development_survey_question_4_upper_label") },
          required: true,
          isColorCodingEnabled: false,
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.career_development_survey_question_5_headline") },
          subheader: { default: t("templates.career_development_survey_question_5_subheader") },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_5_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_5_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_5_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_5_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_5_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.career_development_survey_question_5_choice_6") },
            },
          ],
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: { default: t("templates.career_development_survey_question_6_headline") },
          subheader: { default: t("templates.career_development_survey_question_6_subheader") },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_6_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_6_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_6_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_6_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.career_development_survey_question_6_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.career_development_survey_question_6_choice_6") },
            },
          ],
        },
      ],
    },
  };
};

const professionalDevelopmentSurvey = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.professional_development_survey_name"),
    role: "productManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.professional_development_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.professional_development_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: {
            default: t("templates.professional_development_survey_question_1_headline"),
          },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_1_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_1_choice_2") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },

        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: t("templates.professional_development_survey_question_2_headline"),
          },
          subheader: { default: t("templates.professional_development_survey_question_2_subheader") },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_2_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_2_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_2_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_2_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_2_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.professional_development_survey_question_2_choice_6") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          headline: {
            default: t("templates.professional_development_survey_question_3_headline"),
          },
          required: true,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_3_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_3_choice_2") },
            },
          ],
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.professional_development_survey_question_4_headline"),
          },
          lowerLabel: {
            default: t("templates.professional_development_survey_question_4_lower_label"),
          },
          upperLabel: {
            default: t("templates.professional_development_survey_question_4_upper_label"),
          },
          required: true,
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          headline: {
            default: t("templates.professional_development_survey_question_5_headline"),
          },
          required: true,
          shuffleOption: "exceptLast",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_5_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_5_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_5_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_5_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.professional_development_survey_question_5_choice_5") },
            },
            {
              id: "other",
              label: { default: t("templates.professional_development_survey_question_5_choice_6") },
            },
          ],
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const rateCheckoutExperience = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.rate_checkout_experience_name"),
    role: "productManager",
    industries: ["eCommerce"],
    channels: ["website", "app"],
    description: t("templates.rate_checkout_experience_description"),
    preset: {
      ...localSurvey,
      name: t("templates.rate_checkout_experience_name"),
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
          headline: { default: t("templates.rate_checkout_experience_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.rate_checkout_experience_question_1_lower_label") },
          upperLabel: { default: t("templates.rate_checkout_experience_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.rate_checkout_experience_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.rate_checkout_experience_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.rate_checkout_experience_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.rate_checkout_experience_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const measureSearchExperience = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.measure_search_experience_name"),
    role: "productManager",
    industries: ["saas", "eCommerce"],
    channels: ["app", "website"],
    description: t("templates.measure_search_experience_description"),
    preset: {
      ...localSurvey,
      name: t("templates.measure_search_experience_name"),
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
          headline: { default: t("templates.measure_search_experience_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.measure_search_experience_question_1_lower_label") },
          upperLabel: { default: t("templates.measure_search_experience_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.measure_search_experience_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.measure_search_experience_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.measure_search_experience_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.measure_search_experience_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const evaluateContentQuality = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.evaluate_content_quality_name"),
    role: "marketing",
    industries: ["other"],
    channels: ["website"],
    description: t("templates.evaluate_content_quality_description"),
    preset: {
      ...localSurvey,
      name: t("templates.evaluate_content_quality_name"),
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
          headline: { default: t("templates.evaluate_content_quality_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.evaluate_content_quality_question_1_lower_label") },
          upperLabel: { default: t("templates.evaluate_content_quality_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.evaluate_content_quality_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.evaluate_content_quality_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.evaluate_content_quality_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.evaluate_content_quality_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const measureTaskAccomplishment = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId()];
  const reusableOptionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.measure_task_accomplishment_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "website"],
    description: t("templates.measure_task_accomplishment_description"),
    preset: {
      ...localSurvey,
      name: t("templates.measure_task_accomplishment_name"),
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
              label: { default: t("templates.measure_task_accomplishment_question_1_option_1_label") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.measure_task_accomplishment_question_1_option_2_label") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.measure_task_accomplishment_question_1_option_3_label") },
            },
          ],
          headline: { default: t("templates.measure_task_accomplishment_question_1_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.measure_task_accomplishment_question_2_headline") },
          required: false,
          lowerLabel: { default: t("templates.measure_task_accomplishment_question_2_lower_label") },
          upperLabel: { default: t("templates.measure_task_accomplishment_question_2_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.measure_task_accomplishment_question_3_headline") },
          required: false,
          placeholder: { default: t("templates.measure_task_accomplishment_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.measure_task_accomplishment_question_4_headline") },
          required: false,
          buttonLabel: { default: t("templates.measure_task_accomplishment_question_4_button_label") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[4],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.measure_task_accomplishment_question_5_headline") },
          required: true,
          buttonLabel: { default: t("templates.measure_task_accomplishment_question_5_button_label") },
          placeholder: { default: t("templates.measure_task_accomplishment_question_5_placeholder") },
          inputType: "text",
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const identifySignUpBarriers = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
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
  const reusableOptionIds = [createId(), createId(), createId(), createId(), createId()];

  return {
    name: t("templates.identify_sign_up_barriers_name"),
    role: "marketing",
    industries: ["saas", "eCommerce", "other"],
    channels: ["website"],
    description: t("templates.identify_sign_up_barriers_description"),
    preset: {
      ...localSurvey,
      name: t("templates.identify_sign_up_barriers_with_project_name"),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: t("templates.identify_sign_up_barriers_question_1_html"),
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
          headline: { default: t("templates.identify_sign_up_barriers_question_1_headline") },
          required: false,
          buttonLabel: { default: t("templates.identify_sign_up_barriers_question_1_button_label") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.identify_sign_up_barriers_question_1_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.identify_sign_up_barriers_question_2_headline") },
          required: true,
          lowerLabel: { default: t("templates.identify_sign_up_barriers_question_2_lower_label") },
          upperLabel: { default: t("templates.identify_sign_up_barriers_question_2_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
              label: { default: t("templates.identify_sign_up_barriers_question_3_choice_1_label") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.identify_sign_up_barriers_question_3_choice_2_label") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.identify_sign_up_barriers_question_3_choice_3_label") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.identify_sign_up_barriers_question_3_choice_4_label") },
            },
            {
              id: reusableOptionIds[4],
              label: { default: t("templates.identify_sign_up_barriers_question_3_choice_5_label") },
            },
          ],
          headline: { default: t("templates.identify_sign_up_barriers_question_3_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.identify_sign_up_barriers_question_4_headline") },
          required: true,
          placeholder: { default: t("templates.identify_sign_up_barriers_question_4_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.identify_sign_up_barriers_question_5_headline") },
          required: true,
          placeholder: { default: t("templates.identify_sign_up_barriers_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.identify_sign_up_barriers_question_6_headline") },
          required: true,
          placeholder: { default: t("templates.identify_sign_up_barriers_question_6_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.identify_sign_up_barriers_question_7_headline") },
          required: true,
          placeholder: { default: t("templates.identify_sign_up_barriers_question_7_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.identify_sign_up_barriers_question_8_headline") },
          required: true,
          placeholder: { default: t("templates.identify_sign_up_barriers_question_8_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[8],
          html: {
            default: t("templates.identify_sign_up_barriers_question_9_html"),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: t("templates.identify_sign_up_barriers_question_9_headline") },
          required: false,
          buttonUrl: "https://app.formbricks.com/auth/signup",
          buttonLabel: { default: t("templates.identify_sign_up_barriers_question_9_button_label") },
          buttonExternal: true,
          dismissButtonLabel: {
            default: t("templates.identify_sign_up_barriers_question_9_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const buildProductRoadmap = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.build_product_roadmap_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["app", "link"],
    description: t("templates.build_product_roadmap_description"),
    preset: {
      ...localSurvey,
      name: t("templates.build_product_roadmap_name_with_project_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: {
            default: t("templates.build_product_roadmap_question_1_headline"),
          },
          required: true,
          lowerLabel: { default: t("templates.build_product_roadmap_question_1_lower_label") },
          upperLabel: { default: t("templates.build_product_roadmap_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.build_product_roadmap_question_2_headline"),
          },
          required: true,
          placeholder: { default: t("templates.build_product_roadmap_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const understandPurchaseIntention = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.understand_purchase_intention_name"),
    role: "sales",
    industries: ["eCommerce"],
    channels: ["website", "link", "app"],
    description: t("templates.understand_purchase_intention_description"),
    preset: {
      ...localSurvey,
      name: t("templates.understand_purchase_intention_name"),
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
          headline: { default: t("templates.understand_purchase_intention_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.understand_purchase_intention_question_1_lower_label") },
          upperLabel: { default: t("templates.understand_purchase_intention_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.understand_purchase_intention_question_2_headline") },
          required: false,
          placeholder: { default: t("templates.understand_purchase_intention_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.understand_purchase_intention_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.understand_purchase_intention_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const improveNewsletterContent = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId()];
  return {
    name: t("templates.improve_newsletter_content_name"),
    role: "marketing",
    industries: ["eCommerce", "saas", "other"],
    channels: ["link"],
    description: t("templates.improve_newsletter_content_description"),
    preset: {
      ...localSurvey,
      name: t("templates.improve_newsletter_content_name"),
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
          headline: { default: t("templates.improve_newsletter_content_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.improve_newsletter_content_question_1_lower_label") },
          upperLabel: { default: t("templates.improve_newsletter_content_question_1_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.improve_newsletter_content_question_2_headline") },
          required: false,
          placeholder: { default: t("templates.improve_newsletter_content_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[2],
          html: {
            default: t("templates.improve_newsletter_content_question_3_html"),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: t("templates.improve_newsletter_content_question_3_headline") },
          required: false,
          buttonUrl: "https://formbricks.com",
          buttonLabel: { default: t("templates.improve_newsletter_content_question_3_button_label") },
          buttonExternal: true,
          dismissButtonLabel: {
            default: t("templates.improve_newsletter_content_question_3_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const evaluateAProductIdea = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
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
    name: t("templates.evaluate_a_product_idea_name"),
    role: "productManager",
    industries: ["saas", "other"],
    channels: ["link", "app"],
    description: t("templates.evaluate_a_product_idea_description"),
    preset: {
      ...localSurvey,
      name: t("templates.evaluate_a_product_idea_name"),
      questions: [
        {
          id: reusableQuestionIds[0],
          html: {
            default: t("templates.evaluate_a_product_idea_question_1_html"),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: {
            default: t("templates.evaluate_a_product_idea_question_1_headline"),
          },
          required: true,
          buttonLabel: { default: t("templates.evaluate_a_product_idea_question_1_button_label") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.evaluate_a_product_idea_question_1_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.evaluate_a_product_idea_question_2_headline") },
          required: true,
          lowerLabel: { default: t("templates.evaluate_a_product_idea_question_2_lower_label") },
          upperLabel: { default: t("templates.evaluate_a_product_idea_question_2_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },

        {
          id: reusableQuestionIds[2],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.evaluate_a_product_idea_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.evaluate_a_product_idea_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[3],
          html: {
            default: t("templates.evaluate_a_product_idea_question_4_html"),
          },
          type: TSurveyQuestionTypeEnum.CTA,
          headline: { default: t("templates.evaluate_a_product_idea_question_4_headline") },
          required: true,
          buttonLabel: { default: t("templates.evaluate_a_product_idea_question_4_button_label") },
          buttonExternal: false,
          dismissButtonLabel: {
            default: t("templates.evaluate_a_product_idea_question_4_dismiss_button_label"),
          },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.evaluate_a_product_idea_question_5_headline") },
          required: true,
          lowerLabel: { default: t("templates.evaluate_a_product_idea_question_5_lower_label") },
          upperLabel: { default: t("templates.evaluate_a_product_idea_question_5_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.evaluate_a_product_idea_question_6_headline") },
          required: true,
          placeholder: { default: t("templates.evaluate_a_product_idea_question_6_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[6],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.evaluate_a_product_idea_question_7_headline") },
          required: true,
          placeholder: { default: t("templates.evaluate_a_product_idea_question_7_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[7],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.evaluate_a_product_idea_question_8_headline") },
          required: false,
          placeholder: { default: t("templates.evaluate_a_product_idea_question_8_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const understandLowEngagement = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  const reusableQuestionIds = [createId(), createId(), createId(), createId(), createId(), createId()];

  const reusableOptionIds = [createId(), createId(), createId(), createId()];
  return {
    name: t("templates.understand_low_engagement_name"),
    role: "productManager",
    industries: ["saas"],
    channels: ["link"],
    description: t("templates.understand_low_engagement_description"),
    preset: {
      ...localSurvey,
      name: t("templates.understand_low_engagement_name"),
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
              label: { default: t("templates.understand_low_engagement_question_1_choice_1") },
            },
            {
              id: reusableOptionIds[1],
              label: { default: t("templates.understand_low_engagement_question_1_choice_2") },
            },
            {
              id: reusableOptionIds[2],
              label: { default: t("templates.understand_low_engagement_question_1_choice_3") },
            },
            {
              id: reusableOptionIds[3],
              label: { default: t("templates.understand_low_engagement_question_1_choice_4") },
            },
            {
              id: "other",
              label: { default: t("templates.understand_low_engagement_question_1_choice_5") },
            },
          ],
          headline: { default: t("templates.understand_low_engagement_question_1_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.understand_low_engagement_question_2_headline") },
          required: true,
          placeholder: { default: t("templates.understand_low_engagement_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.understand_low_engagement_question_3_headline") },
          required: true,
          placeholder: { default: t("templates.understand_low_engagement_question_3_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.understand_low_engagement_question_4_headline") },
          required: true,
          placeholder: { default: t("templates.understand_low_engagement_question_4_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
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
          headline: { default: t("templates.understand_low_engagement_question_5_headline") },
          required: true,
          placeholder: { default: t("templates.understand_low_engagement_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: reusableQuestionIds[5],
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          logic: [],
          headline: { default: t("templates.understand_low_engagement_question_6_headline") },
          required: false,
          placeholder: { default: t("templates.understand_low_engagement_question_6_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const employeeWellBeing = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.employee_well_being_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.employee_well_being_description"),
    preset: {
      ...localSurvey,
      name: t("templates.employee_well_being_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.employee_well_being_question_1_headline") },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.employee_well_being_question_1_lower_label"),
          },
          upperLabel: {
            default: t("templates.employee_well_being_question_1_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.employee_well_being_question_2_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.employee_well_being_question_2_lower_label"),
          },
          upperLabel: {
            default: t("templates.employee_well_being_question_2_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: { default: t("templates.employee_well_being_question_3_headline") },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.employee_well_being_question_3_lower_label"),
          },
          upperLabel: {
            default: t("templates.employee_well_being_question_3_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.employee_well_being_question_4_headline") },
          required: false,
          placeholder: { default: t("templates.employee_well_being_question_4_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const longTermRetentionCheckIn = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.long_term_retention_check_in_name"),
    role: "peopleManager",
    industries: ["saas", "other"],
    channels: ["app", "link"],
    description: t("templates.long_term_retention_check_in_description"),
    preset: {
      ...localSurvey,
      name: t("templates.long_term_retention_check_in_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "star",
          headline: { default: t("templates.long_term_retention_check_in_question_1_headline") },
          required: true,
          lowerLabel: { default: t("templates.long_term_retention_check_in_question_1_lower_label") },
          upperLabel: { default: t("templates.long_term_retention_check_in_question_1_upper_label") },
          isColorCodingEnabled: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.long_term_retention_check_in_question_2_headline") },
          required: false,
          placeholder: { default: t("templates.long_term_retention_check_in_question_2_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_3_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_3_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_3_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_3_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_3_choice_5") },
            },
          ],
          headline: {
            default: t("templates.long_term_retention_check_in_question_3_headline"),
          },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "number",
          headline: { default: t("templates.long_term_retention_check_in_question_4_headline") },
          required: true,
          lowerLabel: { default: t("templates.long_term_retention_check_in_question_4_lower_label") },
          upperLabel: { default: t("templates.long_term_retention_check_in_question_4_upper_label") },
          isColorCodingEnabled: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.long_term_retention_check_in_question_5_headline"),
          },
          required: false,
          placeholder: { default: t("templates.long_term_retention_check_in_question_5_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.NPS,
          headline: { default: t("templates.long_term_retention_check_in_question_6_headline") },
          required: false,
          lowerLabel: { default: t("templates.long_term_retention_check_in_question_6_lower_label") },
          upperLabel: { default: t("templates.long_term_retention_check_in_question_6_upper_label") },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
          shuffleOption: "none",
          choices: [
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_7_choice_1") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_7_choice_2") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_7_choice_3") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_7_choice_4") },
            },
            {
              id: createId(),
              label: { default: t("templates.long_term_retention_check_in_question_7_choice_5") },
            },
          ],
          headline: { default: t("templates.long_term_retention_check_in_question_7_headline") },
          required: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.long_term_retention_check_in_question_8_headline") },
          required: false,
          placeholder: { default: t("templates.long_term_retention_check_in_question_8_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          range: 5,
          scale: "smiley",
          headline: { default: t("templates.long_term_retention_check_in_question_9_headline") },
          required: true,
          lowerLabel: { default: t("templates.long_term_retention_check_in_question_9_lower_label") },
          upperLabel: { default: t("templates.long_term_retention_check_in_question_9_upper_label") },
          isColorCodingEnabled: true,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: { default: t("templates.long_term_retention_check_in_question_10_headline") },
          required: false,
          placeholder: { default: t("templates.long_term_retention_check_in_question_10_placeholder") },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const professionalDevelopmentGrowth = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.professional_development_growth_survey_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.professional_development_growth_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.professional_development_growth_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.professional_development_growth_survey_question_1_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.professional_development_growth_survey_question_1_lower_label"),
          },
          upperLabel: {
            default: t("templates.professional_development_growth_survey_question_1_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.professional_development_growth_survey_question_2_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.professional_development_growth_survey_question_2_lower_label"),
          },
          upperLabel: {
            default: t("templates.professional_development_growth_survey_question_2_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.professional_development_growth_survey_question_3_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.professional_development_growth_survey_question_3_lower_label"),
          },
          upperLabel: {
            default: t("templates.professional_development_growth_survey_question_3_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.professional_development_growth_survey_question_4_headline"),
          },
          required: false,
          placeholder: {
            default: t("templates.professional_development_growth_survey_question_4_placeholder"),
          },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const recognitionAndReward = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.recognition_and_reward_survey_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.recognition_and_reward_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.recognition_and_reward_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.recognition_and_reward_survey_question_1_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.recognition_and_reward_survey_question_1_lower_label"),
          },
          upperLabel: {
            default: t("templates.recognition_and_reward_survey_question_1_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.recognition_and_reward_survey_question_2_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.recognition_and_reward_survey_question_2_lower_label"),
          },
          upperLabel: {
            default: t("templates.recognition_and_reward_survey_question_2_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.recognition_and_reward_survey_question_3_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.recognition_and_reward_survey_question_3_lower_label"),
          },
          upperLabel: {
            default: t("templates.recognition_and_reward_survey_question_3_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.recognition_and_reward_survey_question_4_headline"),
          },
          required: false,
          placeholder: {
            default: t("templates.recognition_and_reward_survey_question_4_placeholder"),
          },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const alignmentAndEngagement = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.alignment_and_engagement_survey_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.alignment_and_engagement_survey_description"),
    preset: {
      ...localSurvey,
      name: "Alignment and Engagement with Company Vision",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.alignment_and_engagement_survey_question_1_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.alignment_and_engagement_survey_question_1_lower_label"),
          },
          upperLabel: {
            default: t("templates.alignment_and_engagement_survey_question_1_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.alignment_and_engagement_survey_question_2_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.alignment_and_engagement_survey_question_2_lower_label"),
          },
          upperLabel: {
            default: t("templates.alignment_and_engagement_survey_question_2_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.alignment_and_engagement_survey_question_3_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.alignment_and_engagement_survey_question_3_lower_label"),
          },
          upperLabel: {
            default: t("templates.alignment_and_engagement_survey_question_3_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.alignment_and_engagement_survey_question_4_headline"),
          },
          required: false,
          placeholder: {
            default: t("templates.alignment_and_engagement_survey_question_4_placeholder"),
          },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

const supportiveWorkCulture = (t: TFnType): TTemplate => {
  const localSurvey = getDefaultSurveyPreset(t);
  return {
    name: t("templates.supportive_work_culture_survey_name"),
    role: "peopleManager",
    industries: ["saas", "eCommerce", "other"],
    channels: ["link"],
    description: t("templates.supportive_work_culture_survey_description"),
    preset: {
      ...localSurvey,
      name: t("templates.supportive_work_culture_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.supportive_work_culture_survey_question_1_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.supportive_work_culture_survey_question_1_lower_label"),
          },
          upperLabel: {
            default: t("templates.supportive_work_culture_survey_question_1_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.supportive_work_culture_survey_question_2_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.supportive_work_culture_survey_question_2_lower_label"),
          },
          upperLabel: {
            default: t("templates.supportive_work_culture_survey_question_2_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.Rating,
          headline: {
            default: t("templates.supportive_work_culture_survey_question_3_headline"),
          },
          required: true,
          scale: "number",
          range: 10,
          lowerLabel: {
            default: t("templates.supportive_work_culture_survey_question_3_lower_label"),
          },
          upperLabel: {
            default: t("templates.supportive_work_culture_survey_question_3_upper_label"),
          },
          isColorCodingEnabled: false,
          buttonLabel: { default: t("templates.next") },
          backButtonLabel: { default: t("templates.back") },
        },
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          charLimit: {
            enabled: false,
          },
          headline: {
            default: t("templates.supportive_work_culture_survey_question_4_headline"),
          },
          required: false,
          placeholder: {
            default: t("templates.supportive_work_culture_survey_question_4_placeholder"),
          },
          inputType: "text",
          buttonLabel: { default: t("templates.finish") },
          backButtonLabel: { default: t("templates.back") },
        },
      ],
    },
  };
};

export const templates = (t: TFnType): TTemplate[] => [
  cartAbandonmentSurvey(t),
  siteAbandonmentSurvey(t),
  productMarketFitSuperhuman(t),
  onboardingSegmentation(t),
  churnSurvey(t),
  earnedAdvocacyScore(t),
  improveTrialConversion(t),
  reviewPrompt(t),
  interviewPrompt(t),
  improveActivationRate(t),
  uncoverStrengthsAndWeaknesses(t),
  productMarketFitShort(t),
  marketAttribution(t),
  changingSubscriptionExperience(t),
  identifyCustomerGoals(t),
  featureChaser(t),
  fakeDoorFollowUp(t),
  feedbackBox(t),
  integrationSetupSurvey(t),
  newIntegrationSurvey(t),
  docsFeedback(t),
  nps(t),
  customerSatisfactionScore(t),
  collectFeedback(t),
  identifyUpsellOpportunities(t),
  prioritizeFeatures(t),
  gaugeFeatureSatisfaction(t),
  marketSiteClarity(t),
  customerEffortScore(t),
  rateCheckoutExperience(t),
  measureSearchExperience(t),
  evaluateContentQuality(t),
  measureTaskAccomplishment(t),
  identifySignUpBarriers(t),
  buildProductRoadmap(t),
  understandPurchaseIntention(t),
  improveNewsletterContent(t),
  evaluateAProductIdea(t),
  understandLowEngagement(t),
  employeeSatisfaction(t),
  employeeWellBeing(t),
  longTermRetentionCheckIn(t),
  supportiveWorkCulture(t),
  alignmentAndEngagement(t),
  recognitionAndReward(t),
  professionalDevelopmentGrowth(t),
  professionalDevelopmentSurvey(t),
  careerDevelopmentSurvey(t),
];

export const customSurveyTemplate = (t: TFnType): TTemplate => {
  return {
    name: t("templates.custom_survey_name"),
    description: t("templates.custom_survey_description"),
    preset: {
      ...getDefaultSurveyPreset(t),
      name: t("templates.custom_survey_name"),
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: t("templates.custom_survey_question_1_headline") },
          placeholder: { default: t("templates.custom_survey_question_1_placeholder") },
          buttonLabel: { default: t("templates.next") },
          required: true,
          inputType: "text",
          charLimit: {
            enabled: false,
          },
        } as TSurveyOpenTextQuestion,
      ],
    },
  };
};

export const previewSurvey = (projectName: string, t: TFnType) => {
  return {
    id: "cltxxaa6x0000g8hacxdxejeu",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: t("templates.preview_survey_name"),
    type: "link",
    environmentId: "cltwumfcz0009echxg02fh7oa",
    createdBy: "cltwumfbz0000echxysz6ptvq",
    status: "inProgress",
    welcomeCard: {
      html: {
        default: t("templates.preview_survey_welcome_card_html"),
      },
      enabled: false,
      headline: {
        default: t("templates.preview_survey_welcome_card_headline"),
      },
      timeToFinish: false,
      showResponseCount: false,
    },
    styling: null,
    segment: null,
    questions: [
      {
        id: "lbdxozwikh838yc6a8vbwuju",
        type: "rating",
        range: 5,
        scale: "star",
        isDraft: true,
        headline: {
          default: t("templates.preview_survey_question_1_headline", { projectName }),
        },
        required: true,
        subheader: {
          default: t("templates.preview_survey_question_1_subheader"),
        },
        lowerLabel: {
          default: t("templates.preview_survey_question_1_lower_label"),
        },
        upperLabel: {
          default: t("templates.preview_survey_question_1_upper_label"),
        },
      },
      {
        id: "rjpu42ps6dzirsn9ds6eydgt",
        type: "multipleChoiceSingle",
        choices: [
          {
            id: "x6wty2s72v7vd538aadpurqx",
            label: {
              default: t("templates.preview_survey_question_2_choice_1_label"),
            },
          },
          {
            id: "fbcj4530t2n357ymjp2h28d6",
            label: {
              default: t("templates.preview_survey_question_2_choice_2_label"),
            },
          },
        ],
        isDraft: true,
        headline: {
          default: t("templates.preview_survey_question_2_headline"),
        },
        backButtonLabel: {
          default: t("templates.preview_survey_question_2_back_button_label"),
        },
        required: true,
        shuffleOption: "none",
      },
    ],
    endings: [
      {
        id: "cltyqp5ng000108l9dmxw6nde",
        type: "endScreen",
        headline: { default: t("templates.preview_survey_ending_card_headline") },
        subheader: { default: t("templates.preview_survey_ending_card_description") },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: [],
    },
    variables: [],
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    runOnDate: null,
    closeOnDate: null,
    delay: 0,
    displayPercentage: null,
    autoComplete: 50,
    isVerifyEmailEnabled: true,
    isSingleResponsePerEmailEnabled: true,
    redirectUrl: null,
    projectOverwrites: null,
    surveyClosedMessage: null,
    singleUse: {
      enabled: false,
      isEncrypted: true,
    },
    pin: null,
    resultShareKey: null,
    languages: [],
    triggers: [],
    showLanguageSwitch: false,
    followUps: [],
    isBackButtonHidden: false,
    description: "Demo Survey",
    reward: {
      enableReward: false,
    },
  } as TSurvey;
};
