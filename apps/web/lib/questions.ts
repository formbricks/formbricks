import { Bars3BottomLeftIcon, ListBulletIcon } from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";

export type QuestionType = {
  id: string;
  label: string;
  description: string;
  icon: any;
  defaults: any;
};

export const questionTypes: QuestionType[] = [
  {
    id: "openText",
    label: "Open text",
    description: "A single line of text",
    icon: Bars3BottomLeftIcon,
    defaults: {
      placeholder: "Type your answer here...",
    },
  },
  {
    id: "multipleChoiceSingle",
    label: "Multiple Choice Single-Select",
    description: "A single choice from a list of options (radio buttons)",
    icon: ListBulletIcon,
    defaults: {
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
    defaults: {
      choices: [
        { id: createId(), label: "" },
        { id: createId(), label: "" },
      ],
    },
  },
];

export const universalQuestionDefaults = {
  required: true,
};

export const getQuestionDefaults = (id: string) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return questionType?.defaults;
};

export const getQuestionTypeName = (id: string) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return questionType?.label;
};
