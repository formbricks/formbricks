import { createId } from "@paralleldrive/cuid2";
import { getDefaultEndingCard } from "@formbricks/lib/templates";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";

export const XMSurveyDefault: TXMTemplate = {
  name: "",
  endings: [getDefaultEndingCard([])],
  questions: [],
  styling: {
    overwriteThemeStyling: true,
  },
};

const NPSSurvey = (): TXMTemplate => {
  return {
    ...XMSurveyDefault,
    name: "NPS Survey",
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: "How likely are you to recommend {{productName}} to a friend or colleague?" },
        required: true,
        lowerLabel: { default: "Not at all likely" },
        upperLabel: { default: "Extremely likely" },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "To help us improve, can you describe the reason(s) for your rating?" },
        required: false,
        inputType: "text",
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Any other comments, feedback, or concerns?" },
        required: false,
        inputType: "text",
      },
    ],
  };
};

const StarRatingSurvey = (): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    ...XMSurveyDefault,
    name: "{{productName}}'s Rating Survey",
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
        headline: { default: "How do you like {{productName}}?" },
        required: true,
        lowerLabel: { default: "Extremely dissatisfied" },
        upperLabel: { default: "Extremely satisfied" },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
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
                target: XMSurveyDefault.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: "Happy to hear 🙏 Please write a review for us!" },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: "Write review" },
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
      },
    ],
  };
};

const CSATSurvey = (): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    ...XMSurveyDefault,
    name: "{{productName}} CSAT",
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
        headline: { default: "How satisfied are you with your {{productName}} experience?" },
        required: true,
        lowerLabel: { default: "Extremely dissatisfied" },
        upperLabel: { default: "Extremely satisfied" },
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
                target: XMSurveyDefault.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
        required: false,
        placeholder: { default: "Type your answer here..." },
        inputType: "text",
      },
      {
        id: reusableQuestionIds[2],
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Ugh, sorry! Is there anything we can do to improve your experience?" },
        required: false,
        placeholder: { default: "Type your answer here..." },
        inputType: "text",
      },
    ],
  };
};

const CESSurvey = (): TXMTemplate => {
  return {
    ...XMSurveyDefault,
    name: "CES Survey",
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.Rating,
        range: 5,
        scale: "number",
        headline: { default: "{{productName}} makes it easy for me to [ADD GOAL]" },
        required: true,
        lowerLabel: { default: "Disagree strongly" },
        upperLabel: { default: "Agree strongly" },
        isColorCodingEnabled: false,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Thanks! How could we make it easier for you to [ADD GOAL]?" },
        required: true,
        placeholder: { default: "Type your answer here..." },
        inputType: "text",
      },
    ],
  };
};

const SmileysRatingSurvey = (): TXMTemplate => {
  const reusableQuestionIds = [createId(), createId(), createId()];

  return {
    ...XMSurveyDefault,
    name: "Smileys Survey",
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
        headline: { default: "How do you like {{productName}}?" },
        required: true,
        lowerLabel: { default: "Not good" },
        upperLabel: { default: "Very satisfied" },
        isColorCodingEnabled: false,
      },
      {
        id: reusableQuestionIds[1],
        html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
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
                target: XMSurveyDefault.endings[0].id,
              },
            ],
          },
        ],
        headline: { default: "Happy to hear 🙏 Please write a review for us!" },
        required: true,
        buttonUrl: "https://formbricks.com/github",
        buttonLabel: { default: "Write review" },
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
      },
    ],
  };
};

const eNPSSurvey = (): TXMTemplate => {
  return {
    ...XMSurveyDefault,
    name: "eNPS Survey",
    questions: [
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.NPS,
        headline: {
          default: "How likely are you to recommend working at this company to a friend or colleague?",
        },
        required: false,
        lowerLabel: { default: "Not at all likely" },
        upperLabel: { default: "Extremely likely" },
        isColorCodingEnabled: true,
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "To help us improve, can you describe the reason(s) for your rating?" },
        required: false,
        inputType: "text",
      },
      {
        id: createId(),
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Any other comments, feedback, or concerns?" },
        required: false,
        inputType: "text",
      },
    ],
  };
};

export const XMTemplates: TXMTemplate[] = [
  NPSSurvey(),
  StarRatingSurvey(),
  CSATSurvey(),
  CESSurvey(),
  SmileysRatingSurvey(),
  eNPSSurvey(),
];
