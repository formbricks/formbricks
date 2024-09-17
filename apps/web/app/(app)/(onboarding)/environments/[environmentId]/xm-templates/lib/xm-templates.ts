import { createId } from "@paralleldrive/cuid2";
import { getDefaultEndingCard } from "@formbricks/lib/templates";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TXMTemplate } from "@formbricks/types/templates";

export const XMSurveyDefault: TXMTemplate = {
  name: "",
  endings: [getDefaultEndingCard([])],
  questions: [],
};

const NPSSurvey: TXMTemplate = {
  ...XMSurveyDefault,
  name: "NPS Survey",
  questions: [
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend {{productName}} to a friend or colleague?" },
      required: false,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
      isColorCodingEnabled: false,
    },
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "What made you give that rating?" },
      required: false,
      inputType: "text",
    },
  ],
};

const StarRatingSurvey: TXMTemplate = {
  ...XMSurveyDefault,
  name: "{{productName}}'s rating survey",
  questions: [
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.Rating,
      logic: [{ value: 3, condition: "lessEqual", destination: "tk9wpw2gxgb8fa6pbpp3qq5l" }],
      range: 5,
      scale: "star",
      headline: { default: "How do you like {{productName}}?" },
      required: true,
      lowerLabel: { default: "Not good" },
      upperLabel: { default: "Very satisfied" },
      isColorCodingEnabled: false,
    },
    {
      id: createId(),
      html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
      type: TSurveyQuestionTypeEnum.CTA,
      logic: [{ condition: "clicked", destination: XMSurveyDefault.endings[0].id }],
      headline: { default: "Happy to hear 🙏 Please write a review for us!" },
      required: true,
      buttonUrl: "https://formbricks.com/github",
      buttonLabel: { default: "Write review" },
      buttonExternal: true,
    },
    {
      id: "tk9wpw2gxgb8fa6pbpp3qq5l",
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

const CSATSurvey: TXMTemplate = {
  ...XMSurveyDefault,
  name: "{{productName}} CSAT",
  questions: [
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.Rating,
      logic: [{ value: 3, condition: "lessEqual", destination: "vyo4mkw4ln95ts4ya7qp2tth" }],
      range: 5,
      scale: "smiley",
      headline: { default: "How satisfied are you with your {{productName}} experience?" },
      required: true,
      lowerLabel: { default: "Not satisfied" },
      upperLabel: { default: "Very satisfied" },
      isColorCodingEnabled: false,
    },
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.OpenText,
      logic: [{ condition: "submitted", destination: XMSurveyDefault.endings[0].id }],
      headline: { default: "Lovely! Is there anything we can do to improve your experience?" },
      required: false,
      placeholder: { default: "Type your answer here..." },
      inputType: "text",
    },
    {
      id: "vyo4mkw4ln95ts4ya7qp2tth",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Ugh, sorry! Is there anything we can do to improve your experience?" },
      required: false,
      placeholder: { default: "Type your answer here..." },
      inputType: "text",
    },
  ],
};

const CESSurvey: TXMTemplate = {
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

const SmileysRatingSurvey: TXMTemplate = {
  ...XMSurveyDefault,
  name: "Smileys Survey",
  questions: [
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.Rating,
      logic: [{ value: 3, condition: "lessEqual", destination: "tk9wpw2gxgb8fa6pbpp3qq5l" }],
      range: 5,
      scale: "smiley",
      headline: { default: "How do you like {{productName}}?" },
      required: true,
      lowerLabel: { default: "Not good" },
      upperLabel: { default: "Very satisfied" },
      isColorCodingEnabled: false,
    },
    {
      id: createId(),
      html: { default: '<p class="fb-editor-paragraph" dir="ltr"><span>This helps us a lot.</span></p>' },
      type: TSurveyQuestionTypeEnum.CTA,
      logic: [{ condition: "clicked", destination: XMSurveyDefault.endings[0].id }],
      headline: { default: "Happy to hear 🙏 Please write a review for us!" },
      required: true,
      buttonUrl: "https://formbricks.com/github",
      buttonLabel: { default: "Write review" },
      buttonExternal: true,
    },
    {
      id: "tk9wpw2gxgb8fa6pbpp3qq5l",
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

const eNPSSurvey: TXMTemplate = {
  ...XMSurveyDefault,
  name: "eNPS Survey",
  questions: [
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "How likely are you to recommend {{productName}} to other employees?" },
      required: false,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
      isColorCodingEnabled: false,
    },
    {
      id: createId(),
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "What made you give that rating?" },
      required: false,
      inputType: "text",
    },
  ],
};

export const XMTemplates: TXMTemplate[] = [
  NPSSurvey,
  StarRatingSurvey,
  CSATSurvey,
  CESSurvey,
  SmileysRatingSurvey,
  eNPSSurvey,
];
