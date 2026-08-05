import { TFunction } from "i18next";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { SOURCE_TYPE_PRESET_OPTIONS, type TFeedbackRecordFormValues } from "./types";

export interface ResolvedFeedbackText {
  text: string | null; // translation if usable, else original value_text
  original: string | null;
  isTranslated: boolean; // non-empty translation that differs from the original
  langKey: string | null; // set only when isTranslated
}

// Pick which feedback text to show (ENG-1253): the translation when usable, else the original.
export const resolveFeedbackDisplayText = (
  record: Pick<FeedbackRecordData, "value_text" | "value_text_translated" | "translation_lang_key">
): ResolvedFeedbackText => {
  const original = record.value_text ?? null;
  const translated = record.value_text_translated;
  const hasTranslation =
    typeof translated === "string" && translated.trim().length > 0 && translated !== original;

  return {
    text: hasTranslation ? translated : original,
    original,
    isTranslated: hasTranslation,
    langKey: hasTranslation ? (record.translation_lang_key ?? null) : null,
  };
};

export const getValueFieldByType = (
  fieldType: TFeedbackRecordFormValues["field_type"]
): "value_text" | "value_number" | "value_boolean" | "value_date" => {
  switch (fieldType) {
    case "boolean":
      return "value_boolean";
    case "date":
      return "value_date";
    case "nps":
    case "csat":
    case "ces":
    case "rating":
    case "number":
      return "value_number";
    default:
      return "value_text";
  }
};

export const toLocalDateTimeInput = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const toISOOrUndefined = (dateTimeValue: string | undefined): string | undefined => {
  if (!dateTimeValue) {
    return undefined;
  }

  const parsed = new Date(dateTimeValue);
  if (!Number.isFinite(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
};

export const mapRecordToValues = (record: FeedbackRecordData): TFeedbackRecordFormValues => {
  const metadataEntries = Object.entries(record.metadata ?? {})
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({
      key,
      value: value as string,
    }));

  return {
    id: record.id,
    tenant_id: record.tenant_id,
    submission_id: record.submission_id,
    collected_at: toLocalDateTimeInput(record.collected_at),
    created_at: record.created_at ? toLocalDateTimeInput(record.created_at) : "",
    updated_at: record.updated_at ? toLocalDateTimeInput(record.updated_at) : "",
    source_type: record.source_type,
    source_id: record.source_id ?? "",
    source_name: record.source_name ?? "",
    field_id: record.field_id,
    field_label: record.field_label ?? "",
    field_type: record.field_type,
    field_group_id: record.field_group_id ?? "",
    field_group_label: record.field_group_label ?? "",
    value_text: record.value_text ?? "",
    value_number: record.value_number == null ? "" : String(record.value_number),
    value_boolean: record.value_boolean,
    value_date: record.value_date ? toLocalDateTimeInput(record.value_date) : "",
    language: record.language ?? "",
    user_id: record.user_id ?? "",
    metadataEntries,
  };
};

export const getReadOnlyMetadataEntries = (record: FeedbackRecordData): { key: string; value: string }[] => {
  return Object.entries(record.metadata ?? {})
    .filter(([, value]) => typeof value !== "string")
    .map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
    }));
};

export const parseNumberValue = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isPresetSourceType = (value: string): value is (typeof SOURCE_TYPE_PRESET_OPTIONS)[number] =>
  (SOURCE_TYPE_PRESET_OPTIONS as readonly string[]).includes(value);

// Field types that are acronyms and should render fully upper-cased (e.g. "nps" -> "NPS").
const FIELD_TYPE_ACRONYMS = new Set(["nps", "csat", "ces"]);

// Human-readable field type: acronyms upper-cased, everything else capitalized ("text" -> "Text").
export const formatFieldType = (fieldType: string): string => {
  if (!fieldType) return fieldType;
  if (FIELD_TYPE_ACRONYMS.has(fieldType)) return fieldType.toUpperCase();
  return fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
};

export const formatSourceType = (sourceType: string, t: TFunction): string => {
  switch (sourceType) {
    case "formbricks":
    case "formbricks_survey":
      return t("workspace.unify.formbricks_surveys");
    case "csv":
      return t("workspace.unify.csv_import");
    case "survey":
      return t("workspace.unify.source_type_label_survey");
    case "review":
      return t("workspace.unify.source_type_label_review");
    case "feedback_form":
      return t("workspace.unify.source_type_label_feedback_form");
    case "support":
      return t("workspace.unify.source_type_label_support");
    case "social":
      return t("workspace.unify.source_type_label_social");
    case "interview":
      return t("workspace.unify.source_type_label_interview");
    case "usability_test":
      return t("workspace.unify.source_type_label_usability_test");
    case "nps_campaign":
      return t("workspace.unify.source_type_label_nps_campaign");
    default:
      return sourceType;
  }
};
