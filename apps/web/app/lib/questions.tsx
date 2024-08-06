import { createId } from "@paralleldrive/cuid2";
import {
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckIcon,
  Grid3X3Icon,
  HomeIcon,
  ImageIcon,
  ListIcon,
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
  TSurveyDateQuestion,
  TSurveyFileUploadQuestion,
  TSurveyMatrixQuestion,
  TSurveyMultipleChoiceQuestion,
  TSurveyNPSQuestion,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
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
    description: "Ask for a text-based answer",
    icon: MessageSquareTextIcon,
    preset: {
      headline: { default: "Who let the dogs out?" },
      subheader: { default: "Who? Who? Who?" },
      placeholder: { default: "Type your answer here..." },
      longAnswer: true,
      inputType: "text",
    } as Partial<TSurveyOpenTextQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: "Single-Select",
    description: "A single choice from a list of options (radio buttons)",
    icon: Rows3Icon,
    preset: {
      headline: { default: "What do you do?" },
      subheader: { default: "Can't do both." },
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
    description: "Number of choices from a list of options (checkboxes)",
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
    description: "Ask respondents to select one or more pictures",
    icon: ImageIcon,
    preset: {
      headline: { default: "Which is the cutest puppy?" },
      subheader: { default: "You can also pick both." },
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
    description: "Ask respondents for a rating",
    icon: StarIcon,
    preset: {
      headline: { default: "How would you rate {{productName}}" },
      subheader: { default: "Don't worry, be honest." },
      scale: "star",
      range: 5,
      lowerLabel: { default: "Not good" },
      upperLabel: { default: "Very good" },
    } as Partial<TSurveyRatingQuestion>,
  },
  {
    id: QuestionId.NPS,
    label: "Net Promoter Score (NPS)",
    description: "Rate satisfaction on a 0-10 scale",
    icon: PresentationIcon,
    preset: {
      headline: { default: "How likely are you to recommend {{productName}} to a friend or colleague?" },
      lowerLabel: { default: "Not at all likely" },
      upperLabel: { default: "Extremely likely" },
    } as Partial<TSurveyNPSQuestion>,
  },
  {
    id: QuestionId.CTA,
    label: "Call-to-Action",
    description: "Prompt respondents to perform an action",
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
    description: "Ask respondents for consent",
    icon: CheckIcon,
    preset: {
      headline: { default: "Terms and Conditions" },
      html: { default: "" },
      label: { default: "I agree to the terms and conditions" },
    } as Partial<TSurveyConsentQuestion>,
  },
  {
    id: QuestionId.Date,
    label: "Date",
    description: "Ask your users to select a date",
    icon: CalendarDaysIcon,
    preset: {
      headline: { default: "When is your birthday?" },
      format: "M-d-y",
    } as Partial<TSurveyDateQuestion>,
  },
  {
    id: QuestionId.FileUpload,
    label: "File Upload",
    description: "Allow respondents to upload a file",
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: { default: "File Upload" },
      allowMultipleFiles: false,
    } as Partial<TSurveyFileUploadQuestion>,
  },
  {
    id: QuestionId.Cal,
    label: "Schedule a meeting",
    description: "Allow respondents to schedule a meet",
    icon: PhoneIcon,
    preset: {
      headline: { default: "Schedule a call with me" },
      calUserName: "rick/get-rick-rolled",
    } as Partial<TSurveyCalQuestion>,
  },
  {
    id: QuestionId.Matrix,
    label: "Matrix",
    description: "This is a matrix question",
    icon: Grid3X3Icon,
    preset: {
      headline: { default: "How much do you love these flowers?" },
      subheader: { default: "0: Not at all, 3: Love it" },
      rows: [{ default: "Rose 🌹" }, { default: "Sunflower 🌻" }, { default: "Hibiscus 🌺" }],
      columns: [{ default: "0" }, { default: "1" }, { default: "2" }, { default: "3" }],
    } as Partial<TSurveyMatrixQuestion>,
  },
  {
    id: QuestionId.Address,
    label: "Address",
    description: "Allow respondents to provide their address",
    icon: HomeIcon,
    preset: {
      headline: { default: "Where do you live?" },
      isAddressLine1Required: false,
      isAddressLine2Required: false,
      isCityRequired: false,
      isStateRequired: false,
      isZipRequired: false,
      isCountryRequired: false,
    } as Partial<TSurveyAddressQuestion>,
  },
];

export const QUESTIONS_ICON_MAP = questionTypes.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: <curr.icon className="h-4 w-4" />,
  }),
  {}
);

export const QUESTIONS_NAME_MAP = questionTypes.reduce(
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
