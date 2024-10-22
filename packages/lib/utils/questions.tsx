import { createId } from "@paralleldrive/cuid2";
import {
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckIcon,
  ContactIcon,
  FileDigitIcon,
  FileType2Icon,
  Grid3X3Icon,
  HomeIcon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";
import {
  TSurveyQuestionTypeEnum as QuestionId,
  TSurveyAddressQuestion,
  TSurveyCTAQuestion,
  TSurveyCalQuestion,
  TSurveyConsentQuestion,
  TSurveyContactInfoQuestion,
  TSurveyDateQuestion,
  TSurveyFileUploadQuestion,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRankingQuestion,
  TSurveyRatingQuestion,
} from "@formbricks/types/surveys/types";
import { replaceQuestionPresetPlaceholders } from "./templates";

export type TQuestion = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const questionTypes: TQuestion[] = [
  {
    id: QuestionId.OpenText,
    label: "Free text",
    description: "Collect open-ended feedback",
    icon: MessageSquareTextIcon,
    preset: {
      headline: { default: "Who let the dogs out?" },
      placeholder: { default: "Type your answer here..." },
      longAnswer: true,
      inputType: "text",
    } as Partial<TSurveyOpenTextQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: "Single-Select",
    description: "Offer a list of options (choose one)",
    icon: Rows3Icon,
    preset: {
      headline: { default: "What do you do?" },
      choices: [
        { id: createId(), label: { default: "Eat the cake 🍰" } },
        { id: createId(), label: { default: "Have the cake 🎂" } },
      ],
      shuffleOption: "none",
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceMulti,
    label: "Multi-Select",
    description: "Offer a list of options (choose multiple)",
    icon: ListIcon,
    preset: {
      headline: { default: "What's important on vacay?" },
      choices: [
        { id: createId(), label: { default: "Sun ☀️" } },
        { id: createId(), label: { default: "Ocean 🌊" } },
        { id: createId(), label: { default: "Palms 🌴" } },
      ],
      shuffleOption: "none",
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.PictureSelection,
    label: "Picture Selection",
    description: "Ask respondents to choose one or more images",
    icon: ImageIcon,
    preset: {
      headline: { default: "Which is the cutest puppy?" },
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
    } as Partial<TSurveyPictureSelectionQuestion>,
  },
  {
    id: QuestionId.Rating,
    label: "Rating",
    description: "Ask respondents for a rating (stars, smileys, numbers)",
    icon: StarIcon,
    preset: {
      headline: { default: "How would you rate {{productName}}" },
      scale: "star",
      range: 5,
      lowerLabel: { default: "Not good" },
      upperLabel: { default: "Very good" },
    } as Partial<TSurveyRatingQuestion>,
  },
  {
    id: QuestionId.NPS,
    label: "Net Promoter Score (NPS)",
    description: "Measure Net-Promoter-Score (0-10)",
    icon: PresentationIcon,
    preset: {
      headline: { default: "How likely are you to recommend {{productName}} to a friend or colleague?" },
      lowerLabel: { default: "Not at all likely" },
      upperLabel: { default: "Extremely likely" },
    } as Partial<TSurveyNPSQuestion>,
  },
  {
    id: QuestionId.Ranking,
    label: "Ranking",
    description: "Ask respondents to order items by preference or importance",
    icon: ListOrderedIcon,
    preset: {
      headline: { default: "What is most important for you in life?" },
      choices: [
        { id: createId(), label: { default: "Work" } },
        { id: createId(), label: { default: "Money" } },
        { id: createId(), label: { default: "Travel" } },
        { id: createId(), label: { default: "Family" } },
        { id: createId(), label: { default: "Friends" } },
      ],
    } as Partial<TSurveyRankingQuestion>,
  },
  {
    id: QuestionId.Matrix,
    label: "Matrix",
    description: "Create a grid to rate multiple items on the same set of criteria",
    icon: Grid3X3Icon,
    preset: {
      headline: { default: "How much do you love these flowers?" },
      rows: [{ default: "Roses" }, { default: "Trees" }, { default: "Ocean" }],
      columns: [{ default: "0" }, { default: "1" }, { default: "2" }, { default: "3" }],
    } as Partial<TSurveyMatrixQuestion>,
  },
  {
    id: QuestionId.CTA,
    label: "Statement (Call to Action)",
    description: "Display information and prompt users to take a specific action",
    icon: MousePointerClickIcon,
    preset: {
      headline: { default: "You are one of our power users!" },
      html: {
        default:
          '<p class="fb-editor-paragraph" dir="ltr"><span>We would love to understand your user experience better. Sharing your insight helps a lot.</span></p>',
      },
      buttonLabel: { default: "Book interview" },
      buttonExternal: false,
      dismissButtonLabel: { default: "Skip" },
    } as Partial<TSurveyCTAQuestion>,
  },
  {
    id: QuestionId.Consent,
    label: "Consent",
    description: "Ask to agree to terms, conditions, or data usage",
    icon: CheckIcon,
    preset: {
      headline: { default: "Terms and Conditions" },
      html: { default: "" },
      label: { default: "I agree to the terms and conditions" },
    } as Partial<TSurveyConsentQuestion>,
  },
  {
    id: QuestionId.FileUpload,
    label: "File Upload",
    description: "Enable respondents to upload documents, images, or other files",
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: { default: "File Upload" },
      allowMultipleFiles: false,
    } as Partial<TSurveyFileUploadQuestion>,
  },
  {
    id: QuestionId.Date,
    label: "Date",
    description: "Ask for a date selection",
    icon: CalendarDaysIcon,
    preset: {
      headline: { default: "When is your birthday?" },
      format: "M-d-y",
    } as Partial<TSurveyDateQuestion>,
  },
  {
    id: QuestionId.Cal,
    label: "Schedule a meeting",
    description: "Ask respondents to book a time slot for meetings or calls",
    icon: PhoneIcon,
    preset: {
      headline: { default: "Schedule a call with me" },
      calUserName: "rick/get-rick-rolled",
    } as Partial<TSurveyCalQuestion>,
  },
  {
    id: QuestionId.Address,
    label: "Address",
    description: "Ask for a mailing address",
    icon: HomeIcon,
    preset: {
      headline: { default: "Where do you live?" },
      addressLine1: { show: true, required: true },
      addressLine2: { show: true, required: true },
      city: { show: true, required: true },
      state: { show: true, required: true },
      zip: { show: true, required: true },
      country: { show: true, required: true },
    } as Partial<TSurveyAddressQuestion>,
  },
  {
    id: QuestionId.ContactInfo,
    label: "Contact Info",
    description: "Ask for name, surname, email, phone number and company jointly",
    icon: ContactIcon,
    preset: {
      headline: { default: "Contact Info" },
      firstName: { show: true, required: true },
      lastName: { show: true, required: true },
      email: { show: true, required: true },
      phone: { show: true, required: true },
      company: { show: true, required: true },
    } as Partial<TSurveyContactInfoQuestion>,
  },
];

export const CXQuestionTypes = questionTypes.filter((questionType) => {
  return [
    TSurveyQuestionTypeEnum.OpenText,
    TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    TSurveyQuestionTypeEnum.MultipleChoiceMulti,
    TSurveyQuestionTypeEnum.Rating,
    TSurveyQuestionTypeEnum.NPS,
    TSurveyQuestionTypeEnum.Consent,
    TSurveyQuestionTypeEnum.CTA,
  ].includes(questionType.id as TSurveyQuestionTypeEnum);
});

export const QUESTIONS_ICON_MAP: Record<TSurveyQuestionTypeEnum, JSX.Element> = questionTypes.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: <curr.icon className="h-4 w-4" />,
  }),
  {} as Record<TSurveyQuestionTypeEnum, JSX.Element>
);

export const QUESTIONS_NAME_MAP = questionTypes.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: curr.label,
  }),
  {}
) as Record<TSurveyQuestionTypeEnum, string>;

export const VARIABLES_ICON_MAP = {
  text: <FileType2Icon className="h-4 w-4" />,
  number: <FileDigitIcon className="h-4 w-4" />,
};

export const CX_QUESTIONS_NAME_MAP = CXQuestionTypes.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: curr.label,
  }),
  {}
) as Record<TSurveyQuestionTypeEnum, string>;

export const universalQuestionPresets = {
  required: true,
};

export const getQuestionDefaults = (id: string, product: any) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return replaceQuestionPresetPlaceholders(questionType?.preset, product);
};

export const getTSurveyQuestionTypeEnumName = (id: string) => {
  const questionType = questionTypes.find((questionType) => questionType.id === id);
  return questionType?.label;
};
