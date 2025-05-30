import { createI18nString } from "@/lib/i18n/utils";
import { replaceQuestionPresetPlaceholders } from "@/lib/utils/templates";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
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

export type TQuestion = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const getQuestionTypes = (t: TFnType): TQuestion[] => [
  {
    id: QuestionId.OpenText,
    label: t("templates.free_text"),
    description: t("templates.free_text_description"),
    icon: MessageSquareTextIcon,
    preset: {
      headline: createI18nString("", []),
      placeholder: createI18nString(t("templates.free_text_placeholder"), []),
      longAnswer: true,
      inputType: "text",
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyOpenTextQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceSingle,
    label: t("templates.single_select"),
    description: t("templates.single_select_description"),
    icon: Rows3Icon,
    preset: {
      headline: createI18nString("", []),
      choices: [
        {
          id: createId(),
          label: createI18nString("", []),
        },
        {
          id: createId(),
          label: createI18nString("", []),
        },
      ],
      shuffleOption: "none",
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.MultipleChoiceMulti,
    label: t("templates.multi_select"),
    description: t("templates.multi_select_description"),
    icon: ListIcon,
    preset: {
      headline: createI18nString("", []),
      choices: [
        {
          id: createId(),
          label: createI18nString("", []),
        },
        {
          id: createId(),
          label: createI18nString("", []),
        },
        {
          id: createId(),
          label: createI18nString("", []),
        },
      ],
      shuffleOption: "none",
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyMultipleChoiceQuestion>,
  },
  {
    id: QuestionId.PictureSelection,
    label: t("templates.picture_selection"),
    description: t("templates.picture_selection_description"),
    icon: ImageIcon,
    preset: {
      headline: createI18nString("", []),
      allowMulti: true,
      choices: [],
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyPictureSelectionQuestion>,
  },
  {
    id: QuestionId.Rating,
    label: t("templates.rating"),
    description: t("templates.rating_description"),
    icon: StarIcon,
    preset: {
      headline: createI18nString("", []),
      scale: "star",
      range: 5,
      lowerLabel: createI18nString(t("templates.rating_lower_label"), []),
      upperLabel: createI18nString(t("templates.rating_upper_label"), []),
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyRatingQuestion>,
  },
  {
    id: QuestionId.NPS,
    label: t("templates.nps"),
    description: t("templates.nps_description"),
    icon: PresentationIcon,
    preset: {
      headline: createI18nString("", []),
      lowerLabel: createI18nString(t("templates.nps_lower_label"), []),
      upperLabel: createI18nString(t("templates.nps_upper_label"), []),
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyNPSQuestion>,
  },
  {
    id: QuestionId.Ranking,
    label: t("templates.ranking"),
    description: t("templates.ranking_description"),
    icon: ListOrderedIcon,
    preset: {
      headline: createI18nString("", []),
      choices: [
        {
          id: createId(),
          label: createI18nString("", []),
        },
        {
          id: createId(),
          label: createI18nString("", []),
        },
      ],
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyRankingQuestion>,
  },
  {
    id: QuestionId.Matrix,
    label: t("templates.matrix"),
    description: t("templates.matrix_description"),
    icon: Grid3X3Icon,
    preset: {
      headline: createI18nString("", []),
      rows: [createI18nString("", []), createI18nString("", [])],
      columns: [createI18nString("", []), createI18nString("", [])],
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
      shuffleOption: "none",
    } as Partial<TSurveyMatrixQuestion>,
  },
  {
    id: QuestionId.CTA,
    label: t("templates.statement_call_to_action"),
    description: t("templates.cta_description"),
    icon: MousePointerClickIcon,
    preset: {
      headline: createI18nString("", []),
      html: createI18nString("", []),
      buttonLabel: createI18nString(t("templates.book_interview"), []),
      buttonExternal: false,
      dismissButtonLabel: createI18nString(t("templates.skip"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyCTAQuestion>,
  },
  {
    id: QuestionId.Consent,
    label: t("templates.consent"),
    description: t("templates.consent_description"),
    icon: CheckIcon,
    preset: {
      headline: createI18nString("", []),
      html: createI18nString("", []),
      label: createI18nString("", []),
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyConsentQuestion>,
  },
  {
    id: QuestionId.FileUpload,
    label: t("templates.file_upload"),
    description: t("templates.file_upload_description"),
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: createI18nString("", []),
      allowMultipleFiles: false,
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyFileUploadQuestion>,
  },
  {
    id: QuestionId.Date,
    label: t("templates.date"),
    description: t("templates.date_description"),
    icon: CalendarDaysIcon,
    preset: {
      headline: createI18nString("", []),
      format: "M-d-y",
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyDateQuestion>,
  },
  {
    id: QuestionId.Cal,
    label: t("templates.schedule_a_meeting"),
    description: t("templates.schedule_a_meeting_description"),
    icon: PhoneIcon,
    preset: {
      headline: createI18nString("", []),
      calUserName: "rick/get-rick-rolled",
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyCalQuestion>,
  },
  {
    id: QuestionId.Address,
    label: t("templates.address"),
    description: t("templates.address_description"),
    icon: HomeIcon,
    preset: {
      headline: createI18nString("", []),
      addressLine1: { show: true, required: true, placeholder: { default: "Address Line 1" } },
      addressLine2: { show: true, required: true, placeholder: { default: "Address Line 2" } },
      city: { show: true, required: true, placeholder: { default: "City" } },
      state: { show: true, required: true, placeholder: { default: "State" } },
      zip: { show: true, required: true, placeholder: { default: "Zip" } },
      country: { show: true, required: true, placeholder: { default: "Country" } },
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyAddressQuestion>,
  },
  {
    id: QuestionId.ContactInfo,
    label: t("templates.contact_info"),
    description: t("templates.contact_info_description"),
    icon: ContactIcon,
    preset: {
      headline: createI18nString("", []),
      firstName: { show: true, required: true, placeholder: { default: "First Name" } },
      lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
      email: { show: true, required: true, placeholder: { default: "Email" } },
      phone: { show: true, required: true, placeholder: { default: "Phone" } },
      company: { show: true, required: true, placeholder: { default: "Company" } },
      buttonLabel: createI18nString(t("templates.next"), []),
      backButtonLabel: createI18nString(t("templates.back"), []),
    } as Partial<TSurveyContactInfoQuestion>,
  },
];

export const getCXQuestionTypes = (t: TFnType) =>
  getQuestionTypes(t).filter((questionType) => {
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

export const getQuestionIconMap = (t: TFnType): Record<TSurveyQuestionTypeEnum, JSX.Element> =>
  getQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: <curr.icon className="h-4 w-4" />,
    }),
    {} as Record<TSurveyQuestionTypeEnum, JSX.Element>
  );

export const getQuestionNameMap = (t: TFnType) =>
  getQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyQuestionTypeEnum, string>;

export const getQuestionIcon = (type: TSurveyQuestionTypeEnum, t: TFnType) => {
  return getQuestionTypes(t).find((questionType) => questionType.id === type)?.icon;
};

export const VARIABLES_ICON_MAP = {
  text: <FileType2Icon className="h-4 w-4" />,
  number: <FileDigitIcon className="h-4 w-4" />,
};

export const getCXQuestionNameMap = (t: TFnType) =>
  getCXQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyQuestionTypeEnum, string>;

export const universalQuestionPresets = {
  required: true,
};

export const getQuestionDefaults = (id: string, project: any, t: TFnType) => {
  const questionType = getQuestionTypes(t).find((questionType) => questionType.id === id);
  return replaceQuestionPresetPlaceholders(questionType?.preset, project);
};

export const getTSurveyQuestionTypeEnumName = (id: string, t: TFnType) => {
  const questionType = getQuestionTypes(t).find((questionType) => questionType.id === id);
  return questionType?.label;
};
