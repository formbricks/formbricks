import type {
  TFeedbackSourceFieldMappingCreateInput,
  THubFieldType,
} from "@formbricks/types/feedback-source";
import { ZHubFieldType } from "@formbricks/types/feedback-source";
import {
  CSV_HIDDEN_STATIC_MAPPINGS,
  CSV_PROTECTED_TARGET_IDS,
  CSV_REQUIRED_UI_FIELDS,
} from "@/modules/ee/unify-feedback/sources/types";

export const sanitizeCsvFieldMappings = (
  fieldMappings: TFeedbackSourceFieldMappingCreateInput[] | undefined
): TFeedbackSourceFieldMappingCreateInput[] | undefined => {
  if (!fieldMappings?.length) return undefined;

  const userMappings = fieldMappings.filter((mapping) =>
    CSV_PROTECTED_TARGET_IDS.every((id) => mapping.targetFieldId !== id)
  );

  return [...userMappings, ...(CSV_HIDDEN_STATIC_MAPPINGS as TFeedbackSourceFieldMappingCreateInput[])];
};

type TCsvFieldMappingLike = {
  targetFieldId: string;
  sourceFieldId?: string;
  staticValue?: string | null;
};

export interface TCsvMissingMappedSourceColumn {
  sourceFieldId: string;
  targetFieldId: string;
}

export const getMissingCsvMappedSourceColumns = (
  fieldMappings: TCsvFieldMappingLike[] | undefined,
  csvHeaders: Iterable<string>
): TCsvMissingMappedSourceColumn[] => {
  const headerSet = new Set(csvHeaders);
  const missingByPair = new Map<string, TCsvMissingMappedSourceColumn>();

  for (const mapping of fieldMappings ?? []) {
    if (mapping.staticValue?.trim()) continue;
    if (!mapping.sourceFieldId) continue;
    if (headerSet.has(mapping.sourceFieldId)) continue;

    const key = `${mapping.sourceFieldId}->${mapping.targetFieldId}`;
    missingByPair.set(key, {
      sourceFieldId: mapping.sourceFieldId,
      targetFieldId: mapping.targetFieldId,
    });
  }

  return [...missingByPair.values()];
};

export const formatCsvMissingMappedSourceColumns = (missing: TCsvMissingMappedSourceColumn[]): string =>
  missing.map(({ sourceFieldId, targetFieldId }) => `${sourceFieldId} -> ${targetFieldId}`).join(", ");

export const formatCsvMissingMappedSourceColumnNames = (missing: TCsvMissingMappedSourceColumn[]): string =>
  [...new Set(missing.map(({ sourceFieldId }) => sourceFieldId))].join(", ");

export const getMissingRequiredCsvSourceColumns = (
  fieldMappings: TCsvFieldMappingLike[] | undefined,
  csvHeaders: Iterable<string>
): string[] => {
  const headerSet = new Set(csvHeaders);
  const missing = new Set<string>();

  for (const requiredId of CSV_REQUIRED_UI_FIELDS) {
    const mapping = fieldMappings?.find((item) => item.targetFieldId === requiredId);
    if (!mapping?.sourceFieldId || mapping.staticValue?.trim()) continue;
    if (!headerSet.has(mapping.sourceFieldId)) {
      missing.add(mapping.sourceFieldId);
    }
  }

  return [...missing];
};

export const formatMissingRequiredCsvFieldMappingsMessage = (): string =>
  "This saved CSV mapping is incomplete. Edit the CSV mapping and choose a CSV column or fixed value for each required field before importing.";

export const getMissingRequiredCsvFieldMappings = (
  fieldMappings: TCsvFieldMappingLike[] | undefined
): string[] => {
  const missing: string[] = [];

  for (const requiredId of CSV_REQUIRED_UI_FIELDS) {
    const mapping = fieldMappings?.find((item) => item.targetFieldId === requiredId);
    const resolved = Boolean(mapping?.sourceFieldId || mapping?.staticValue?.trim());

    if (!resolved) {
      missing.push(requiredId);
      continue;
    }

    if (
      requiredId === "field_type" &&
      mapping?.staticValue &&
      !ZHubFieldType.safeParse(mapping.staticValue).success
    ) {
      missing.push(requiredId);
    }
  }

  return missing;
};

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export const routeResponseValueTarget = (
  fieldType: THubFieldType
): "value_text" | "value_number" | "value_boolean" | "value_date" => {
  switch (fieldType) {
    case "text":
    case "categorical":
      return "value_text";
    case "number":
    case "nps":
    case "csat":
    case "ces":
    case "rating":
      return "value_number";
    case "boolean":
      return "value_boolean";
    case "date":
      return "value_date";
    default: {
      const _exhaustive: never = fieldType;
      throw new Error(`Unhandled field_type for response_value routing: ${String(_exhaustive)}`);
    }
  }
};
