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
import type { JSX } from "react";
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
import { translate } from "../templates";
import { replaceQuestionPresetPlaceholders } from "./templates";

export type TQuestion = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const getQuestionTypes = (locale: string): TQuestion[] => [
  {
    id: QuestionId.OpenText,
    label: translate("free_text", locale),
    description: translate("free_text_description", locale),
    icon: MessageSquareTextIcon,
    preset: {
      headline: { default: "" },
      placeholder: { default: translate("free_text_placeholder", locale) },
      longAnswer: true,
      inputType: "text",
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyOpenTextQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: translate("single_select", locale),
    description: translate("single_select_description", locale),
    icon: Rows3Icon,
    preset: {
      headline: { default: "" },
      choices: [
        {
          id: createId(),
          label: { default: "" },
        },
        {
          id: createId(),
          label: { default: "" },
        },
      ],
      shuffleOption: "none",
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceMulti,
    label: translate("multi_select", locale),
    description: translate("multi_select_description", locale),
    icon: ListIcon,
    preset: {
      headline: { default: "" },
      choices: [
        {
          id: createId(),
          label: { default: "" },
        },
        {
          id: createId(),
          label: { default: "" },
        },
        {
          id: createId(),
          label: { default: "" },
        },
      ],
      shuffleOption: "none",
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.PictureSelection,
    label: translate("picture_selection", locale),
    description: translate("picture_selection_description", locale),
    icon: ImageIcon,
    preset: {
      headline: { default: "" },
      allowMulti: true,
      choices: [],
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyPictureSelectionQuestion>,
  },
  {
    id: QuestionId.Rating,
    label: translate("rating", locale),
    description: translate("rating_description", locale),
    icon: StarIcon,
    preset: {
      headline: { default: "" },
      scale: "star",
      range: 5,
      lowerLabel: { default: translate("rating_lower_label", locale) },
      upperLabel: { default: translate("rating_upper_label", locale) },
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyRatingQuestion>,
  },
  {
    id: QuestionId.NPS,
    label: translate("nps", locale),
    description: translate("nps_description", locale),
    icon: PresentationIcon,
    preset: {
      headline: { default: "" },
      lowerLabel: { default: translate("nps_lower_label", locale) },
      upperLabel: { default: translate("nps_upper_label", locale) },
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyNPSQuestion>,
  },
  {
    id: QuestionId.Ranking,
    label: translate("ranking", locale),
    description: translate("ranking_description", locale),
    icon: ListOrderedIcon,
    preset: {
      headline: {
        default: "",
      },
      choices: [
        {
          id: createId(),
          label: { default: "" },
        },
        {
          id: createId(),
          label: { default: "" },
        },
      ],
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyRankingQuestion>,
  },
  {
    id: QuestionId.Matrix,
    label: translate("matrix", locale),
    description: translate("matrix_description", locale),
    icon: Grid3X3Icon,
    preset: {
      headline: {
        default: "",
      },
      rows: [{ default: "" }, { default: "" }],
      columns: [{ default: "" }, { default: "" }],
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyMatrixQuestion>,
  },
  {
    id: QuestionId.CTA,
    label: translate("statement_call_to_action", locale),
    description: translate("cta_description", locale),
    icon: MousePointerClickIcon,
    preset: {
      headline: { default: "" },
      html: {
        default: "",
      },
      buttonLabel: { default: translate("book_interview", locale) },
      buttonExternal: false,
      dismissButtonLabel: { default: translate("skip", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyCTAQuestion>,
  },
  {
    id: QuestionId.Consent,
    label: translate("consent", locale),
    description: translate("consent_description", locale),
    icon: CheckIcon,
    preset: {
      headline: { default: "" },
      html: { default: "" },
      label: { default: "" },
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyConsentQuestion>,
  },
  {
    id: QuestionId.FileUpload,
    label: translate("file_upload", locale),
    description: translate("file_upload_description", locale),
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: { default: "" },
      allowMultipleFiles: false,
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyFileUploadQuestion>,
  },
  {
    id: QuestionId.Date,
    label: translate("date", locale),
    description: translate("date_description", locale),
    icon: CalendarDaysIcon,
    preset: {
      headline: { default: "" },
      format: "M-d-y",
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyDateQuestion>,
  },
  {
    id: QuestionId.Cal,
    label: translate("schedule_a_meeting", locale),
    description: translate("schedule_a_meeting_description", locale),
    icon: PhoneIcon,
    preset: {
      headline: { default: "" },
      calUserName: "rick/get-rick-rolled",
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyCalQuestion>,
  },
  {
    id: QuestionId.Address,
    label: translate("address", locale),
    description: translate("address_description", locale),
    icon: HomeIcon,
    preset: {
      headline: { default: "" },
      addressLine1: { show: true, required: true, placeholder: { default: "Address Line 1" } },
      addressLine2: { show: true, required: true, placeholder: { default: "Address Line 2" } },
      city: { show: true, required: true, placeholder: { default: "City" } },
      state: { show: true, required: true, placeholder: { default: "State" } },
      zip: { show: true, required: true, placeholder: { default: "Zip" } },
      country: { show: true, required: true, placeholder: { default: "Country" } },
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyAddressQuestion>,
  },
  {
    id: QuestionId.ContactInfo,
    label: translate("contact_info", locale),
    description: translate("contact_info_description", locale),
    icon: ContactIcon,
    preset: {
      headline: { default: "" },
      firstName: { show: true, required: true, placeholder: { default: "First Name" } },
      lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
      email: { show: true, required: true, placeholder: { default: "Email" } },
      phone: { show: true, required: true, placeholder: { default: "Phone" } },
      company: { show: true, required: true, placeholder: { default: "Company" } },
      buttonLabel: { default: translate("next", locale) },
      backButtonLabel: { default: translate("back", locale) },
    } as Partial<TSurveyContactInfoQuestion>,
  },
];

export const getCXQuestionTypes = (locale: string) =>
  getQuestionTypes(locale).filter((questionType) => {
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

export const QUESTIONS_ICON_MAP: Record<TSurveyQuestionTypeEnum, JSX.Element> = getQuestionTypes(
  "en-US"
).reduce(
  (prev, curr) => ({
    ...prev,
    [curr.id]: <curr.icon className="h-4 w-4" />,
  }),
  {} as Record<TSurveyQuestionTypeEnum, JSX.Element>
);

export const getQuestionNameMap = (locale: string) =>
  getQuestionTypes(locale).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyQuestionTypeEnum, string>;

export const getQuestionIcon = (type: TSurveyQuestionTypeEnum) => {
  return getQuestionTypes("en-US").find((questionType) => questionType.id === type)?.icon;
};

export const VARIABLES_ICON_MAP = {
  text: <FileType2Icon className="h-4 w-4" />,
  number: <FileDigitIcon className="h-4 w-4" />,
};

export const getCXQuestionNameMap = (locale: string) =>
  getCXQuestionTypes(locale).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyQuestionTypeEnum, string>;

export const universalQuestionPresets = {
  required: true,
};

export const getQuestionDefaults = (id: string, project: any, locale: string) => {
  const questionType = getQuestionTypes(locale).find((questionType) => questionType.id === id);
  return replaceQuestionPresetPlaceholders(questionType?.preset, project);
};

export const getTSurveyQuestionTypeEnumName = (id: string, locale: string) => {
  const questionType = getQuestionTypes(locale).find((questionType) => questionType.id === id);
  return questionType?.label;
};
