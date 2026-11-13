import { createId } from "@paralleldrive/cuid2";
import type { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { createI18nString } from "@/lib/i18n/utils";
import { replaceElementPresetPlaceholders } from "@/lib/utils/templates";

/**
 * What the editor gives a new element of each type: its texts and settings before anyone edits them.
 * Free of JSX and icons, so server code that adds elements (an Excel export imported into its survey,
 * ENG-6809) builds them exactly as the editor's picker does; `getElementTypes` in `elements.tsx` takes
 * its presets from here.
 */
export const getElementPreset = (type: TSurveyElementTypeEnum, t: TFunction): Record<string, unknown> => {
  switch (type) {
    case TSurveyElementTypeEnum.OpenText:
      return {
        headline: createI18nString("", []),
        placeholder: createI18nString(t("templates.free_text_placeholder"), []),
        longAnswer: true,
        inputType: "text",
      };
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return {
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
      };
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return {
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
      };
    case TSurveyElementTypeEnum.PictureSelection:
      return {
        headline: createI18nString("", []),
        allowMulti: true,
        choices: [],
      };
    case TSurveyElementTypeEnum.Rating:
      return {
        headline: createI18nString("", []),
        scale: "star",
        range: 5,
        lowerLabel: createI18nString(t("templates.rating_lower_label"), []),
        upperLabel: createI18nString(t("templates.rating_upper_label"), []),
      };
    case TSurveyElementTypeEnum.NPS:
      return {
        headline: createI18nString("", []),
        lowerLabel: createI18nString(t("templates.nps_lower_label"), []),
        upperLabel: createI18nString(t("templates.nps_upper_label"), []),
      };
    case TSurveyElementTypeEnum.CSAT:
      return {
        headline: createI18nString("", []),
        scale: "smiley",
        range: 5,
        lowerLabel: createI18nString(t("templates.csat_lower_label"), []),
        upperLabel: createI18nString(t("templates.csat_upper_label"), []),
      };
    case TSurveyElementTypeEnum.CES:
      return {
        headline: createI18nString("", []),
        scale: "number",
        range: 5,
        lowerLabel: createI18nString(t("templates.ces_lower_label"), []),
        upperLabel: createI18nString(t("templates.ces_upper_label"), []),
      };
    case TSurveyElementTypeEnum.Ranking:
      return {
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
      };
    case TSurveyElementTypeEnum.Matrix:
      return {
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
      };
    case TSurveyElementTypeEnum.CTA:
      return {
        headline: createI18nString("", []),
        ctaButtonLabel: createI18nString(t("templates.book_interview"), []),
        buttonUrl: "",
        buttonExternal: true,
        required: false,
      };
    case TSurveyElementTypeEnum.Consent:
      return {
        headline: createI18nString("", []),
        label: createI18nString("", []),
      };
    case TSurveyElementTypeEnum.FileUpload:
      return {
        headline: createI18nString("", []),
        allowMultipleFiles: false,
      };
    case TSurveyElementTypeEnum.Signature:
      return {
        headline: createI18nString("", []),
        required: true,
        allowTypedSignature: true,
      };
    case TSurveyElementTypeEnum.Date:
      return {
        headline: createI18nString("", []),
        format: "M-d-y",
      };
    case TSurveyElementTypeEnum.Cal:
      return {
        headline: createI18nString("", []),
        calUserName: "rick/get-rick-rolled",
      };
    case TSurveyElementTypeEnum.Address:
      return {
        headline: createI18nString("", []),
        addressLine1: { show: true, required: true, placeholder: { default: "Address Line 1" } },
        addressLine2: { show: true, required: true, placeholder: { default: "Address Line 2" } },
        city: { show: true, required: true, placeholder: { default: "City" } },
        state: { show: true, required: true, placeholder: { default: "State" } },
        zip: { show: true, required: true, placeholder: { default: "Zip" } },
        country: { show: true, required: true, placeholder: { default: "Country" } },
      };
    case TSurveyElementTypeEnum.ContactInfo:
      return {
        headline: createI18nString("", []),
        firstName: { show: true, required: true, placeholder: { default: "First Name" } },
        lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
        email: { show: true, required: true, placeholder: { default: "Email" } },
        phone: { show: true, required: true, placeholder: { default: "Phone" } },
        company: { show: true, required: true, placeholder: { default: "Company" } },
      };
  }
};

export const universalElementPresets = {
  required: false,
};

/** A new element of `type`'s preset, with the workspace's name filled into its placeholders. */
export const getElementDefaults = (type: string, workspace: any, t: TFunction) =>
  replaceElementPresetPlaceholders(getElementPreset(type as TSurveyElementTypeEnum, t) as never, workspace);
