import { Bars4Icon, ListBulletIcon } from "@heroicons/react/24/solid";
import { createId } from "@paralleldrive/cuid2";

export const questionTypes = [
  {
    id: "openText",
    label: "Open text",
    description: "A single line of text",
    icon: Bars4Icon,
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
