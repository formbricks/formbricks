import { Bars3BottomLeftIcon, ChartPieIcon, ListBulletIcon } from "@heroicons/react/24/solid";
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
    label: "Open text",
    description: "A single line of text",
    icon: Bars3BottomLeftIcon,
    preset: {
      placeholder: "Type your answer here...",
    },
  },
  {
    id: "multipleChoiceSingle",
    label: "Multiple Choice Single-Select",
    description: "A single choice from a list of options (radio buttons)",
    icon: ListBulletIcon,
    preset: {
      choices: [
        { id: createId(), label: "" },
        { id: createId(), label: "" },
      ],
    },
  },
  {
    id: "multipleChoiceMulti",
    label: "Multiple Choice Multi-Select",
    description: "Number of choices from a list of options (checkboxes)",
    icon: ListBulletIcon,
    preset: {
      choices: [
        { id: createId(), label: "" },
        { id: createId(), label: "" },
      ],
    },
  },
  {
    id: "nps",
    label: "Net Promoter Score (NPS)",
    description: "Rate satisfaction on a 0-10 scale",
    icon: ChartPieIcon,
    preset: {
      headline: "How likely are you to recommend {{productName}} to a friend or colleague?",
      lowerLabel: "Not at all likely",
      upperLabel: "Extremely likely",
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
