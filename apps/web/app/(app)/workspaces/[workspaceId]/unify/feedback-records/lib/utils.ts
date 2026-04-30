import { TFunction } from "i18next";
import { v7 as uuidv7 } from "uuid";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { SOURCE_TYPE_PRESET_OPTIONS, type TFeedbackRecordFormValues } from "./types";

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

export const getCreateDefaults = (workspaceId: string): TFeedbackRecordFormValues => {
  const now = new Date();

  return {
    id: "",
    tenant_id: workspaceId,
    submission_id: uuidv7(),
    collected_at: toLocalDateTimeInput(now.toISOString()),
    created_at: "",
    updated_at: "",
    source_type: "survey",
    source_id: "",
    source_name: "",
    field_id: "",
    field_label: "",
    field_type: "text",
    field_group_id: "",
    field_group_label: "",
    value_text: "",
    value_number: "",
    value_boolean: undefined,
    value_date: "",
    language: "",
    user_identifier: "",
    metadataEntries: [],
  };
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
    user_identifier: record.user_identifier ?? "",
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
