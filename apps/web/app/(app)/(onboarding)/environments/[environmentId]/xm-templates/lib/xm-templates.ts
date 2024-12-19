import { createId } from "@paralleldrive/cuid2";
import { getDefaultEndingCard, translate } from "@formbricks/lib/templates";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";

function validateLocale(locale: string): boolean {
  // Add logic to validate the locale, e.g., check against a list of supported locales
  return typeof locale === "string" && locale.length > 0;
}

function logError(error: Error, context: string) {
  console.error(`Error in ${context}:`, error);
}

export const getXMSurveyDefault = (locale: string): TXMTemplate => {
  try {
    if (!validateLocale(locale)) {
      throw new Error("Invalid locale");
    }
    return {
      name: "",
      endings: [getDefaultEndingCard([], locale)],
      questions: [],
      styling: {
        overwriteThemeStyling: true,
      },
    };
  } catch (error) {
    logError(error, "getXMSurveyDefault");
    throw error; // Re-throw after logging
  }
};

const NPSSurvey = (locale: string): TXMTemplate => {
  return {
    ...getXMSurveyDefault(locale),
    name: translate("nps_survey_name", locale),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: translate("nps_survey_question_1_headline", locale) },
        required: true,
        lowerLabel: { default: translate("nps_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("nps_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("nps_survey_question_2_headline", locale) },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("nps_survey_question_3_headline", locale) },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const StarRatingSurvey = (locale: string): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(locale);

  return {
    ...defaultSurvey,
    name: translate("star_rating_survey_name", locale),
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
        scale: "number",
        headline: { default: translate("star_rating_survey_question_1_headline", locale) },
        required: true,
        lowerLabel: { default: translate("star_rating_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("star_rating_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: translate("star_rating_survey_question_2_html", locale) },
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
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: translate("star_rating_survey_question_2_headline", locale) },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: translate("star_rating_survey_question_2_button_label", locale) },
        buttonExternal: true,
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Sorry to hear! What is ONE thing we can do better?" },
        required: true,
        subheader: { default: "Help us improve your experience." },
        buttonLabel: { default: "Send" },
        placeholder: { default: "Type your answer here..." },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const CSATSurvey = (locale: string): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(locale);

  return {
    ...defaultSurvey,
    name: translate("csat_survey_name", locale),
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
        scale: "smiley",
        headline: { default: translate("csat_survey_question_1_headline", locale) },
        required: true,
        lowerLabel: { default: translate("csat_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("csat_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        type: TSurveyQuestionTypeEnum.OpenText,
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
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: translate("csat_survey_question_2_headline", locale) },
        required: false,
        placeholder: { default: translate("csat_survey_question_2_placeholder", locale) },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("csat_survey_question_3_headline", locale) },
        required: false,
        placeholder: { default: translate("csat_survey_question_3_placeholder", locale) },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const CESSurvey = (locale: string): TXMTemplate => {
  return {
    ...getXMSurveyDefault(locale),
    name: translate("cess_survey_name", locale),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.Rating,
        range: 5,
        scale: "number",
        headline: { default: translate("cess_survey_question_1_headline", locale) },
        required: true,
        lowerLabel: { default: translate("cess_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("cess_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: false,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("cess_survey_question_2_headline", locale) },
        required: true,
        placeholder: { default: translate("cess_survey_question_2_placeholder", locale) },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const SmileysRatingSurvey = (locale: string): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];
  const defaultSurvey = getXMSurveyDefault(locale);

  return {
    ...defaultSurvey,
    name: translate("smileys_survey_name", locale),
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
        scale: "smiley",
        headline: { default: translate("smileys_survey_question_1_headline", locale) },
        required: true,
        lowerLabel: { default: translate("smileys_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("smileys_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: translate("smileys_survey_question_2_html", locale) },
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
                target: defaultSurvey.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: translate("smileys_survey_question_2_headline", locale) },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: translate("smileys_survey_question_2_button_label", locale) },
        buttonExternal: true,
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("smileys_survey_question_3_headline", locale) },
        required: true,
        subheader: { default: translate("smileys_survey_question_3_subheader", locale) },
        buttonLabel: { default: translate("smileys_survey_question_3_button_label", locale) },
        placeholder: { default: translate("smileys_survey_question_3_placeholder", locale) },
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

const eNPSSurvey = (locale: string): TXMTemplate => {
  return {
    ...getXMSurveyDefault(locale),
    name: translate("enps_survey_name", locale),
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: {
          default: translate("enps_survey_question_1_headline", locale),
        },
        required: false,
        lowerLabel: { default: translate("enps_survey_question_1_lower_label", locale) },
        upperLabel: { default: translate("enps_survey_question_1_upper_label", locale) },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("enps_survey_question_2_headline", locale) },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: translate("enps_survey_question_3_headline", locale) },
        required: false,
        inputType: "text",
        charLimit: {
          enabled: false,
        },
      },
    ],
  };
};

export const getXMTemplates = (locale: string): TXMTemplate[] => {
  try {
    if (!validateLocale(locale)) {
      throw new Error("Invalid locale");
    }
    return [
      NPSSurvey(locale),
      StarRatingSurvey(locale),
      CSATSurvey(locale),
      CESSurvey(locale),
      SmileysRatingSurvey(locale),
      eNPSSurvey(locale),
    ];
  } catch (error) {
    logError(error, "getXMTemplates");
    return []; // Return an empty array or handle as needed
  }
};
