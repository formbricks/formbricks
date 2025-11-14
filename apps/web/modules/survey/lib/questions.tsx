import { createId } from "@paralleldrive/cuid2";
import { TFunction } from "i18next";
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
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { createI18nString } from "@/lib/i18n/utils";
import { replaceElementPresetPlaceholders } from "@/lib/utils/templates";

export type TQuestion = {
  id: string;
  label: string;
  description: string;
  icon: any;
  preset: any;
};

export const getQuestionTypes = (t: TFunction): TQuestion[] => [
  {
    id: TSurveyElementTypeEnum.OpenText,
    label: t("templates.free_text"),
    description: t("templates.free_text_description"),
    icon: MessageSquareTextIcon,
    preset: {
      headline: createI18nString("", []),
      placeholder: createI18nString(t("templates.free_text_placeholder"), []),
      longAnswer: true,
      inputType: "text",
    },
  },
  {
    id: TSurveyElementTypeEnum.MultipleChoiceSingle,
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
    },
  },
  {
    id: TSurveyElementTypeEnum.MultipleChoiceMulti,
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
    },
  },
  {
    id: TSurveyElementTypeEnum.PictureSelection,
    label: t("templates.picture_selection"),
    description: t("templates.picture_selection_description"),
    icon: ImageIcon,
    preset: {
      headline: createI18nString("", []),
      allowMulti: true,
      choices: [],
    },
  },
  {
    id: TSurveyElementTypeEnum.Rating,
    label: t("templates.rating"),
    description: t("templates.rating_description"),
    icon: StarIcon,
    preset: {
      headline: createI18nString("", []),
      scale: "star",
      range: 5,
      lowerLabel: createI18nString(t("templates.rating_lower_label"), []),
      upperLabel: createI18nString(t("templates.rating_upper_label"), []),
    },
  },
  {
    id: TSurveyElementTypeEnum.NPS,
    label: t("templates.nps"),
    description: t("templates.nps_description"),
    icon: PresentationIcon,
    preset: {
      headline: createI18nString("", []),
      lowerLabel: createI18nString(t("templates.nps_lower_label"), []),
      upperLabel: createI18nString(t("templates.nps_upper_label"), []),
    },
  },
  {
    id: TSurveyElementTypeEnum.Ranking,
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
    },
  },
  {
    id: TSurveyElementTypeEnum.Matrix,
    label: t("templates.matrix"),
    description: t("templates.matrix_description"),
    icon: Grid3X3Icon,
    preset: {
      headline: createI18nString("", []),
      rows: [
        { id: createId(), label: createI18nString("", []) },
        { id: createId(), label: createI18nString("", []) },
      ],
      columns: [
        { id: createId(), label: createI18nString("", []) },
        { id: createId(), label: createI18nString("", []) },
      ],
      shuffleOption: "none",
    },
  },
  {
    id: TSurveyElementTypeEnum.CTA,
    label: t("templates.statement_call_to_action"),
    description: t("templates.cta_description"),
    icon: MousePointerClickIcon,
    preset: {
      headline: createI18nString("", []),
      subheader: createI18nString("", []),
      ctaButtonLabel: createI18nString(t("templates.book_interview"), []),
      buttonUrl: "",
    },
  },
  {
    id: TSurveyElementTypeEnum.Consent,
    label: t("templates.consent"),
    description: t("templates.consent_description"),
    icon: CheckIcon,
    preset: {
      headline: createI18nString("", []),
      subheader: createI18nString("", []),
      label: createI18nString("", []),
    },
  },
  {
    id: TSurveyElementTypeEnum.FileUpload,
    label: t("templates.file_upload"),
    description: t("templates.file_upload_description"),
    icon: ArrowUpFromLineIcon,
    preset: {
      headline: createI18nString("", []),
      allowMultipleFiles: false,
    },
  },
  {
    id: TSurveyElementTypeEnum.Date,
    label: t("templates.date"),
    description: t("templates.date_description"),
    icon: CalendarDaysIcon,
    preset: {
      headline: createI18nString("", []),
      format: "M-d-y",
    },
  },
  {
    id: TSurveyElementTypeEnum.Cal,
    label: t("templates.schedule_a_meeting"),
    description: t("templates.schedule_a_meeting_description"),
    icon: PhoneIcon,
    preset: {
      headline: createI18nString("", []),
      calUserName: "rick/get-rick-rolled",
    },
  },
  {
    id: TSurveyElementTypeEnum.Address,
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
    },
  },
  {
    id: TSurveyElementTypeEnum.ContactInfo,
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
    },
  },
];

export const getCXQuestionTypes = (t: TFunction) =>
  getQuestionTypes(t).filter((questionType) => {
    return [
      TSurveyElementTypeEnum.OpenText,
      TSurveyElementTypeEnum.MultipleChoiceSingle,
      TSurveyElementTypeEnum.MultipleChoiceMulti,
      TSurveyElementTypeEnum.Rating,
      TSurveyElementTypeEnum.NPS,
      TSurveyElementTypeEnum.Consent,
      TSurveyElementTypeEnum.CTA,
    ].includes(questionType.id as TSurveyElementTypeEnum);
  });

export const getQuestionIconMap = (t: TFunction): Record<TSurveyElementTypeEnum, JSX.Element> =>
  getQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: <curr.icon className="h-4 w-4" />,
    }),
    {} as Record<TSurveyElementTypeEnum, JSX.Element>
  );

export const getQuestionNameMap = (t: TFunction) =>
  getQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyElementTypeEnum, string>;

export const getQuestionIcon = (type: TSurveyElementTypeEnum, t: TFunction) => {
  return getQuestionTypes(t).find((questionType) => questionType.id === type)?.icon;
};

export const VARIABLES_ICON_MAP = {
  text: <FileType2Icon className="h-4 w-4" />,
  number: <FileDigitIcon className="h-4 w-4" />,
};

export const getCXQuestionNameMap = (t: TFunction) =>
  getCXQuestionTypes(t).reduce(
    (prev, curr) => ({
      ...prev,
      [curr.id]: curr.label,
    }),
    {}
  ) as Record<TSurveyElementTypeEnum, string>;

export const universalQuestionPresets = {
  required: false,
};

export const getQuestionDefaults = (id: string, project: any, t: TFunction) => {
  const questionType = getQuestionTypes(t).find((questionType) => questionType.id === id);
  return replaceElementPresetPlaceholders(questionType?.preset, project);
};

export const getTSurveyQuestionTypeEnumName = (id: string, t: TFunction) => {
  const questionType = getQuestionTypes(t).find((questionType) => questionType.id === id);
  return questionType?.label;
};
