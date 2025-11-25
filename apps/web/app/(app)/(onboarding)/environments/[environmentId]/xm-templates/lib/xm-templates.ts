import { createId } from "@paralleldrive/cuid2";
import { TFunction } from "i18next";
import { logger } from "@formbricks/logger";
import { TXMTemplate } from "@formbricks/types/templates";
import {
  buildBlock,
  buildCTAElement,
  buildNPSElement,
  buildOpenTextElement,
  buildRatingElement,
  createBlockJumpLogic,
} from "@/app/lib/survey-block-builder";
import { getDefaultEndingCard } from "@/app/lib/survey-builder";

export const getXMSurveyDefault = (t: TFunction): TXMTemplate => {
  try {
    return {
      name: "",
      endings: [getDefaultEndingCard([], t)],
      blocks: [],
      styling: {
        overwriteThemeStyling: true,
      },
    };
  } catch (error) {
    logger.error(error, "Failed to create default XM survey template");
    throw error; // Re-throw after logging
  }
};

const npsSurvey = (t: TFunction): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.nps_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildNPSElement({
            headline: t("templates.nps_survey_question_1_headline"),
            required: true,
            lowerLabel: t("templates.nps_survey_question_1_lower_label"),
            upperLabel: t("templates.nps_survey_question_1_upper_label"),
            isColorCodingEnabled: true,
          }),
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildOpenTextElement({
            headline: t("templates.nps_survey_question_2_headline"),
            required: false,
            inputType: "text",
          }),
        ],
        t,
      }),
      buildBlock({
        name: "Block 3",
        elements: [
          buildOpenTextElement({
            headline: t("templates.nps_survey_question_3_headline"),
            required: false,
            inputType: "text",
          }),
        ],
        t,
      }),
    ],
  };
};

const starRatingSurvey = (t: TFunction): TXMTemplate => {
  const reusableElementIds = [createId(), createId(), createId()];
  const block3Id = createId(); // Pre-generate Block 3 ID for logic reference
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.star_rating_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildRatingElement({
            id: reusableElementIds[0],
            range: 5,
            scale: "number",
            headline: t("templates.star_rating_survey_question_1_headline"),
            required: true,
            lowerLabel: t("templates.star_rating_survey_question_1_lower_label"),
            upperLabel: t("templates.star_rating_survey_question_1_upper_label"),
          }),
        ],
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
                    value: reusableElementIds[0],
                    type: "element",
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
                objective: "jumpToBlock",
                target: block3Id,
              },
            ],
          },
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildCTAElement({
            id: reusableElementIds[1],
            subheader: t("templates.star_rating_survey_question_2_html"),
            headline: t("templates.star_rating_survey_question_2_headline"),
            required: false,
            buttonUrl: "https://formbricks.com/github",
            buttonExternal: true,
            ctaButtonLabel: t("templates.star_rating_survey_question_2_button_label"),
          }),
        ],
        logic: [createBlockJumpLogic(reusableElementIds[1], defaultSurvey.endings[0].id, "isClicked")],
        t,
      }),
      buildBlock({
        id: block3Id,
        name: "Block 3",
        elements: [
          buildOpenTextElement({
            id: reusableElementIds[2],
            headline: t("templates.star_rating_survey_question_3_headline"),
            required: true,
            subheader: t("templates.star_rating_survey_question_3_subheader"),
            placeholder: t("templates.star_rating_survey_question_3_placeholder"),
            inputType: "text",
          }),
        ],
        buttonLabel: t("templates.star_rating_survey_question_3_button_label"),
        t,
      }),
    ],
  };
};

const csatSurvey = (t: TFunction): TXMTemplate => {
  const reusableElementIds = [createId(), createId(), createId()];
  const block3Id = createId(); // Pre-generate Block 3 ID for logic reference
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.csat_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildRatingElement({
            id: reusableElementIds[0],
            range: 5,
            scale: "smiley",
            headline: t("templates.csat_survey_question_1_headline"),
            required: true,
            lowerLabel: t("templates.csat_survey_question_1_lower_label"),
            upperLabel: t("templates.csat_survey_question_1_upper_label"),
          }),
        ],
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
                    value: reusableElementIds[0],
                    type: "element",
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
                objective: "jumpToBlock",
                target: block3Id,
              },
            ],
          },
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildOpenTextElement({
            id: reusableElementIds[1],
            headline: t("templates.csat_survey_question_2_headline"),
            required: false,
            placeholder: t("templates.csat_survey_question_2_placeholder"),
            inputType: "text",
          }),
        ],
        logic: [createBlockJumpLogic(reusableElementIds[1], defaultSurvey.endings[0].id, "isSubmitted")],
        t,
      }),
      buildBlock({
        id: block3Id,
        name: "Block 3",
        elements: [
          buildOpenTextElement({
            id: reusableElementIds[2],
            headline: t("templates.csat_survey_question_3_headline"),
            required: false,
            placeholder: t("templates.csat_survey_question_3_placeholder"),
            inputType: "text",
          }),
        ],
        t,
      }),
    ],
  };
};

const cessSurvey = (t: TFunction): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.cess_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildRatingElement({
            range: 5,
            scale: "number",
            headline: t("templates.cess_survey_question_1_headline"),
            required: true,
            lowerLabel: t("templates.cess_survey_question_1_lower_label"),
            upperLabel: t("templates.cess_survey_question_1_upper_label"),
          }),
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildOpenTextElement({
            headline: t("templates.cess_survey_question_2_headline"),
            required: true,
            placeholder: t("templates.cess_survey_question_2_placeholder"),
            inputType: "text",
          }),
        ],
        t,
      }),
    ],
  };
};

const smileysRatingSurvey = (t: TFunction): TXMTemplate => {
  const reusableElementIds = [createId(), createId(), createId()];
  const block3Id = createId(); // Pre-generate Block 3 ID for logic reference
  const defaultSurvey = getXMSurveyDefault(t);

  return {
    ...defaultSurvey,
    name: t("templates.smileys_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildRatingElement({
            id: reusableElementIds[0],
            range: 5,
            scale: "smiley",
            headline: t("templates.smileys_survey_question_1_headline"),
            required: true,
            lowerLabel: t("templates.smileys_survey_question_1_lower_label"),
            upperLabel: t("templates.smileys_survey_question_1_upper_label"),
          }),
        ],
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
                    value: reusableElementIds[0],
                    type: "element",
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
                objective: "jumpToBlock",
                target: block3Id,
              },
            ],
          },
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildCTAElement({
            id: reusableElementIds[1],
            subheader: t("templates.smileys_survey_question_2_html"),
            headline: t("templates.smileys_survey_question_2_headline"),
            required: false,
            buttonUrl: "https://formbricks.com/github",
            buttonExternal: true,
            ctaButtonLabel: t("templates.smileys_survey_question_2_button_label"),
          }),
        ],
        logic: [createBlockJumpLogic(reusableElementIds[1], defaultSurvey.endings[0].id, "isClicked")],
        t,
      }),
      buildBlock({
        id: block3Id,
        name: "Block 3",
        elements: [
          buildOpenTextElement({
            id: reusableElementIds[2],
            headline: t("templates.smileys_survey_question_3_headline"),
            required: true,
            subheader: t("templates.smileys_survey_question_3_subheader"),
            placeholder: t("templates.smileys_survey_question_3_placeholder"),
            inputType: "text",
          }),
        ],
        buttonLabel: t("templates.smileys_survey_question_3_button_label"),
        t,
      }),
    ],
  };
};

const enpsSurvey = (t: TFunction): TXMTemplate => {
  return {
    ...getXMSurveyDefault(t),
    name: t("templates.enps_survey_name"),
    blocks: [
      buildBlock({
        name: "Block 1",
        elements: [
          buildNPSElement({
            headline: t("templates.enps_survey_question_1_headline"),
            required: false,
            lowerLabel: t("templates.enps_survey_question_1_lower_label"),
            upperLabel: t("templates.enps_survey_question_1_upper_label"),
            isColorCodingEnabled: true,
          }),
        ],
        t,
      }),
      buildBlock({
        name: "Block 2",
        elements: [
          buildOpenTextElement({
            headline: t("templates.enps_survey_question_2_headline"),
            required: false,
            inputType: "text",
          }),
        ],
        t,
      }),
      buildBlock({
        name: "Block 3",
        elements: [
          buildOpenTextElement({
            headline: t("templates.enps_survey_question_3_headline"),
            required: false,
            inputType: "text",
          }),
        ],
        t,
      }),
    ],
  };
};

export const getXMTemplates = (t: TFunction): TXMTemplate[] => {
  try {
    return [
      npsSurvey(t),
      starRatingSurvey(t),
      csatSurvey(t),
      cessSurvey(t),
      smileysRatingSurvey(t),
      enpsSurvey(t),
    ];
  } catch (error) {
    logger.error(error, "Unable to load XM templates, returning empty array");
    return []; // Return an empty array or handle as needed
  }
};
