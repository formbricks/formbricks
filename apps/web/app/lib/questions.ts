import {
  CursorArrowRippleIcon,
  ChatBubbleBottomCenterTextIcon,
  ListBulletIcon,
  PresentationChartBarIcon,
  QueueListIcon,
  StarIcon,
  CheckIcon,
  PhotoIcon,
} from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";
import { replaceQuestionPresetPlaceholders } from "./templates";
import { TSurveyQuestionType as QuestionId } from "@formbricks/types/surveys";

export type TSurveyQuestionType = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const questionTypes: TSurveyQuestionType[] = [
  {
    id: QuestionId.PictureSelection,
    label: "Picture Selection",
    description: "Select one or more pictures",
    icon: PhotoIcon,
    preset: {
      headline: "",
      allowMulti: true,
      choices: [],
    },
  },
  {
    id: QuestionId.OpenText,
    label: "Free text",
    description: "A single line of text",
    icon: ChatBubbleBottomCenterTextIcon,
    preset: {
      headline: "Who let the dogs out?",
      subheader: "Who? Who? Who?",
      placeholder: "Type your answer here...",
      longAnswer: true,
    },
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: "Single-Select",
    description: "A single choice from a list of options (radio buttons)",
    icon: QueueListIcon,
    preset: {
      headline: "What do you do?",
      subheader: "Can't do both.",
      choices: [
        { id: createId(), label: "Eat the cake 🍰" },
        { id: createId(), label: "Have the cake 🎂" },
      ],
      shuffleOption: "none",
    },
  },
  {
    id: QuestionId.MultipleChoiceMulti,
    label: "Multi-Select",
    description: "Number of choices from a list of options (checkboxes)",
    icon: ListBulletIcon,
    preset: {
      headline: "What's important on vacay?",
      choices: [
        { id: createId(), label: "Sun ☀️" },
        { id: createId(), label: "Ocean 🌊" },
        { id: createId(), label: "Palms 🌴" },
      ],
      shuffleOption: "none",
    },
  },
  {
    id: QuestionId.NPS,
    label: "Net Promoter Score® (NPS)",
    description: "Rate satisfaction on a 0-10 scale",
    icon: PresentationChartBarIcon,
    preset: {
      headline: "How likely are you to recommend {{productName}} to a friend or colleague?",
      lowerLabel: "Not at all likely",
      upperLabel: "Extremely likely",
    },
  },
  {
    id: QuestionId.CTA,
    label: "Call-to-Action",
    description: "Ask your users to perform an action",
    icon: CursorArrowRippleIcon,
    preset: {
      headline: "You are one of our power users!",
      buttonLabel: "Book interview",
      buttonExternal: false,
      dismissButtonLabel: "Skip",
    },
  },
  {
    id: QuestionId.Rating,
    label: "Rating",
    description: "Ask your users to rate something",
    icon: StarIcon,
    preset: {
      headline: "How would you rate {{productName}}",
      subheader: "Don't worry, be honest.",
      scale: "star",
      range: 5,
      lowerLabel: "Not good",
      upperLabel: "Very good",
    },
  },
  {
    id: QuestionId.Consent,
    label: "Consent",
    description: "Ask your users to accept something",
    icon: CheckIcon,
    preset: {
      headline: "Terms and Conditions",
      label: "I agree to the terms and conditions",
      dismissButtonLabel: "Skip",
    },
  },
];

export const universalQuestionPresets = {
  required: true,
};

export const getQuestionDefaults = (id: string, product: any) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return replaceQuestionPresetPlaceholders(questionType?.preset, product);
};

export const getTSurveyQuestionTypeName = (id: string) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return questionType?.label;
};
