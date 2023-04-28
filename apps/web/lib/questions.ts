import {
  ArrowRightOnRectangleIcon,
  ChatBubbleBottomCenterTextIcon,
  ListBulletIcon,
  PresentationChartBarIcon,
  QueueListIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";
import { replaceQuestionPresetPlaceholders } from "./templates";

export type QuestionType = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const questionTypes: QuestionType[] = [
  {
    id: "openText",
    label: "Free text",
    description: "A single line of text",
    icon: ChatBubbleBottomCenterTextIcon,
    preset: {
      placeholder: "Type your answer here...",
    },
  },
  {
    id: "multipleChoiceSingle",
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
    },
  },
  {
    id: "multipleChoiceMulti",
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
    },
  },
  {
    id: "nps",
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
    id: "cta",
    label: "Call-to-Action",
    description: "Ask your users to perform an action",
    icon: ArrowRightOnRectangleIcon,
    preset: {
      headline: "You are one of our power users!",
      buttonLabel: "Book interview",
      buttonExternal: false,
      dismissButtonLabel: "Skip",
    },
  },
  {
    id: "rating",
    label: "Rating",
    description: "Ask your users to rate something",
    icon: StarIcon,
    preset: {
      scale: "number",
      range: 5,
      lowerLabel: "Very unsatisfied",
      upperLabel: "Very satisfied",
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

export const getQuestionTypeName = (id: string) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return questionType?.label;
};
