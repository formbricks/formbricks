import { createId } from "@paralleldrive/cuid2";
import {
  ArrowUpFromLine,
  CalendarDaysIcon,
  CheckIcon,
  ImageIcon,
  ListIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";

import { TSurveyQuestionType as QuestionId } from "@formbricks/types/surveys";

import { replaceQuestionPresetPlaceholders } from "./templates";

export type TSurveyQuestionType = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const questionTypes: TSurveyQuestionType[] = [
  {
    id: QuestionId.OpenText,
    label: "Free text",
    description: "Ask for a text-based answer",
    icon: MessageSquareTextIcon,
    preset: {
      headline: "Who let the dogs out?",
      subheader: "Who? Who? Who?",
      placeholder: "Type your answer here...",
      longAnswer: true,
      inputType: "text",
    },
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: "Single-Select",
    description: "A single choice from a list of options (radio buttons)",
    icon: Rows3Icon,
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
    icon: ListIcon,
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
    id: QuestionId.PictureSelection,
    label: "Picture Selection",
    description: "Ask respondents to select one or more pictures",
    icon: ImageIcon,
    preset: {
      headline: "Which is the cutest puppy?",
      subheader: "You can also pick both.",
      allowMulti: true,
      choices: [
        {
          id: createId(),
          imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-1-small.jpg",
        },
        {
          id: createId(),
          imageUrl: "https://formbricks-cdn.s3.eu-central-1.amazonaws.com/puppy-2-small.jpg",
        },
      ],
    },
  },
  {
    id: QuestionId.Rating,
    label: "Rating",
    description: "Ask respondents for a rating",
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
    id: QuestionId.NPS,
    label: "Net Promoter Score (NPS)",
    description: "Rate satisfaction on a 0-10 scale",
    icon: PresentationIcon,
    preset: {
      headline: "How likely are you to recommend {{productName}} to a friend or colleague?",
      lowerLabel: "Not at all likely",
      upperLabel: "Extremely likely",
    },
  },
  {
    id: QuestionId.CTA,
    label: "Call-to-Action",
    description: "Prompt respondents to perform an action",
    icon: MousePointerClickIcon,
    preset: {
      headline: "You are one of our power users!",
      buttonLabel: "Book interview",
      buttonExternal: false,
      dismissButtonLabel: "Skip",
    },
  },
  {
    id: QuestionId.Consent,
    label: "Consent",
    description: "Ask respondents for consent",
    icon: CheckIcon,
    preset: {
      headline: "Terms and Conditions",
      label: "I agree to the terms and conditions",
      dismissButtonLabel: "Skip",
    },
  },
  {
    id: QuestionId.Date,
    label: "Date",
    description: "Ask your users to select a date",
    icon: CalendarDaysIcon,
    preset: {
      headline: "When is your birthday?",
      format: "M-d-y",
    },
  },
  {
    id: QuestionId.FileUpload,
    label: "File Upload",
    description: "Allow respondents to upload a file",
    icon: ArrowUpFromLine,
    preset: {
      headline: "File Upload",
      allowMultipleFiles: false,
    },
  },
  {
    id: QuestionId.Cal,
    label: "Schedule a meeting",
    description: "Allow respondents to schedule a meet",
    icon: PhoneIcon,
    preset: {
      headline: "Schedule a call with me",
      buttonLabel: "Skip",
      calUserName: "rick/get-rick-rolled",
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
