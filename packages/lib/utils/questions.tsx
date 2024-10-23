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
import { translate } from "templates";
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

export const getQuestionTypes = (locale: string): TQuestion[] => [
  {
    id: QuestionId.OpenText,
    label: translate("free_text", locale),
    description: translate("free_text_description", locale),
    icon: MessageSquareTextIcon,
    preset: {
      headline: { default: translate("free_text_headline", locale) },
      placeholder: { default: translate("free_text_placeholder", locale) },
      longAnswer: true,
      inputType: "text",
    } as Partial<TSurveyOpenTextQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: translate("single_select", locale),
    description: translate("single_select_description", locale),
    icon: Rows3Icon,
    preset: {
      headline: { default: translate("single_select_headline", locale) },
      choices: [
        {
          id: createId(),
          label: { default: translate("single_select_option_1", locale) },
        },
        {
          id: createId(),
          label: { default: translate("single_select_option_2", locale) },
        },
      ],
      shuffleOption: "none",
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceMulti,
    label: translate("multi_select", locale),
    description: translate("multi_select_description", locale),
    icon: ListIcon,
    preset: {
      headline: { default: translate("multi_select_headline", locale) },
      choices: [
        {
          id: createId(),
          label: { default: translate("multi_select_option_1", locale) },
        },
        {
          id: createId(),
          label: { default: translate("multi_select_option_2", locale) },
        },
        {
          id: createId(),
          label: { default: translate("multi_select_option_3", locale) },
        },
      ],
      shuffleOption: "none",
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.PictureSelection,
    label: translate("picture_selection", locale),
    description: translate("picture_selection_description", locale),
    icon: ImageIcon,
    preset: {
      headline: { default: translate("picture_selection_headline", locale) },
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
    label: translate("rating", locale),
    description: translate("rating_description", locale),
    icon: StarIcon,
    preset: {
      headline: { default: translate("rating_headline", locale) },
      scale: "star",
      range: 5,
      lowerLabel: { default: translate("rating_lower_label", locale) },
      upperLabel: { default: translate("rating_upper_label", locale) },
    } as Partial<TSurveyRatingQuestion>,
  },
  {
    id: QuestionId.NPS,
    label: translate("nps", locale),
    description: translate("nps_description", locale),
    icon: PresentationIcon,
    preset: {
      headline: { default: translate("nps_headline", locale) },
      lowerLabel: { default: translate("nps_lower_label", locale) },
      upperLabel: { default: translate("nps_upper_label", locale) },
    } as Partial<TSurveyNPSQuestion>,
  },
  {
    id: QuestionId.Ranking,
    label: translate("ranking", locale),
    description: translate("ranking_description", locale),
    icon: ListOrderedIcon,
    preset: {
      headline: {
        default: translate("ranking_headline", locale),
      },
      choices: [
        {
          id: createId(),
          label: { default: translate("ranking_option_1", locale) },
        },
        {
          id: createId(),
          label: { default: translate("ranking_option_2", locale) },
        },
        {
          id: createId(),
          label: { default: translate("ranking_option_3", locale) },
        },
        {
          id: createId(),
          label: { default: translate("ranking_option_4", locale) },
        },
        {
          id: createId(),
          label: { default: translate("ranking_option_5", locale) },
        },
      ],
    } as Partial<TSurveyRankingQuestion>,
  },
  {
    id: QuestionId.Matrix,
    label: translate("matrix", locale),
    description: translate("matrix_description", locale),
    icon: Grid3X3Icon,
    preset: {
      headline: {
        default: translate("matrix_headline", locale),
      },
      rows: [
        { default: translate("matrix_row_1", locale) },
        { default: translate("matrix_row_2", locale) },
        { default: translate("matrix_row_3", locale) },
      ],
      columns: [
        { default: translate("matrix_column_1", locale) },
        { default: translate("matrix_column_2", locale) },
        { default: translate("matrix_column_3", locale) },
        { default: translate("matrix_column_4", locale) },
      ],
    } as Partial<TSurveyMatrixQuestion>,
  },
  {
    id: QuestionId.CTA,
    label: translate("statement_call_to_action", locale),
    description: translate("cta_description", locale),
    icon: MousePointerClickIcon,
    preset: {
      headline: { default: translate("cta_headline", locale) },
      html: {
        default: translate("cta_html", locale),
      },
      buttonLabel: { default: translate("book_interview", locale) },
      buttonExternal: false,
      dismissButtonLabel: { default: translate("skip", locale) },
    } as Partial<TSurveyCTAQuestion>,
  },
  {
    id: QuestionId.Consent,
    label: translate("consent", locale),
    description: translate("consent_description", locale),
    icon: CheckIcon,
    preset: {
      headline: { default: translate("consent_headline", locale) },
      html: { default: "" },
      label: { default: translate("consent_label", locale) },
    } as Partial<TSurveyConsentQuestion>,
  },
  {
    id: QuestionId.FileUpload,
    label: translate("file_upload", locale),
    description: translate("file_upload_description", locale),
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: { default: translate("file_upload_headline", locale) },
      allowMultipleFiles: false,
    } as Partial<TSurveyFileUploadQuestion>,
  },
  {
    id: QuestionId.Date,
    label: translate("date", locale),
    description: translate("date_description", locale),
    icon: CalendarDaysIcon,
    preset: {
      headline: { default: translate("date_headline", locale) },
      format: "M-d-y",
    } as Partial<TSurveyDateQuestion>,
  },
  {
    id: QuestionId.Cal,
    label: translate("schedule_a_meeting", locale),
    description: translate("schedule_a_meeting_description", locale),
    icon: PhoneIcon,
    preset: {
      headline: { default: translate("schedule_a_meeting_headline", locale) },
      calUserName: "rick/get-rick-rolled",
    } as Partial<TSurveyCalQuestion>,
  },
  {
    id: QuestionId.Address,
    label: translate("address", locale),
    description: translate("address_description", locale),
    icon: HomeIcon,
    preset: {
      headline: { default: translate("address_headline", locale) },
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
    label: translate("contact_info", locale),
    description: translate("contact_info_description", locale),
    icon: ContactIcon,
    preset: {
      headline: { default: translate("contact_info_headline", locale) },
      firstName: { show: true, required: true },
      lastName: { show: true, required: true },
      email: { show: true, required: true },
      phone: { show: true, required: true },
      company: { show: true, required: true },
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

export const getQuestionDefaults = (id: string, product: any, locale: string) => {
  const questionType = getQuestionTypes(locale).find((questionType) => questionType.id === id);
  return replaceQuestionPresetPlaceholders(questionType?.preset, product);
};

export const getTSurveyQuestionTypeEnumName = (id: string, locale: string) => {
  const questionType = getQuestionTypes(locale).find((questionType) => questionType.id === id);
  return questionType?.label;
};
