import { TFunction } from "i18next";
import { TConnectorType, THubFieldType } from "@formbricks/types/connector";
import { FEEDBACK_RECORD_FIELDS, MAX_CSV_VALUES, TFieldMapping, TSourceField } from "./types";

export type TConnectorOptionId = TConnectorType | "api_ingestion" | "feedback_record_mcp";

export interface TConnectorOption {
  id: TConnectorOptionId;
  name: string;
  description: string;
  disabled: boolean;
  badge?: { text: string; type: "success" | "gray" | "warning" };
}

export const getConnectorOptions = (t: TFunction): TConnectorOption[] => [
  {
    id: "formbricks_survey",
    name: t("workspace.unify.formbricks_surveys"),
    description: t("workspace.unify.source_connect_formbricks_description"),
    disabled: false,
  },
  {
    id: "csv",
    name: t("workspace.unify.csv_import"),
    description: t("workspace.unify.source_connect_csv_description"),
    disabled: false,
  },
  {
    id: "api_ingestion",
    name: t("workspace.unify.api_ingestion"),
    description: t("workspace.unify.api_ingestion_settings_description"),
    disabled: false,
  },
  {
    id: "feedback_record_mcp",
    name: t("workspace.unify.feedback_record_mcp"),
    description: t("workspace.unify.source_connect_feedback_record_mcp_description"),
    disabled: false,
  },
];

export const parseCSVColumnsToFields = (columns: string): TSourceField[] => {
  return columns.split(",").map((col) => {
    const trimmed = col.trim();
    return { id: trimmed, name: trimmed, type: "string", sampleValue: `Sample ${trimmed}` };
  });
};

export interface TEnumValidationError {
  targetFieldName: string;
  invalidEntries: { row: number; value: string }[];
  allowedValues: string[];
}

/**
 * Validates that CSV columns mapped to enum target fields contain only allowed values.
 * Returns an array of validation errors (empty if all valid).
 */
export const validateEnumMappings = (
  mappings: TFieldMapping[],
  csvData: Record<string, string>[]
): TEnumValidationError[] => {
  const errors: TEnumValidationError[] = [];

  for (const mapping of mappings) {
    if (!mapping.sourceFieldId || mapping.staticValue) continue;

    const targetField = FEEDBACK_RECORD_FIELDS.find((f) => f.id === mapping.targetFieldId);
    if (targetField?.type !== "enum" || !targetField?.enumValues) continue;

    const allowedValues = new Set(targetField.enumValues);
    const invalidEntries: { row: number; value: string }[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const value = csvData[i][mapping.sourceFieldId]?.trim();
      if (value && !allowedValues.has(value as THubFieldType)) {
        invalidEntries.push({ row: i + 1, value });
      }
    }

    if (invalidEntries.length > 0) {
      errors.push({
        targetFieldName: targetField.name,
        invalidEntries,
        allowedValues: targetField.enumValues,
      });
    }
  }

  return errors;
};

export const isConnectorNameValid = (name: string): boolean => name.trim().length > 0;

export const areAllRequiredFieldsMapped = (mappings: TFieldMapping[]): boolean => {
  const requiredFieldIds = new Set(
    FEEDBACK_RECORD_FIELDS.filter((field) => field.required).map((field) => field.id)
  );

  for (const mapping of mappings) {
    if (!requiredFieldIds.has(mapping.targetFieldId)) {
      continue;
    }

    if (mapping.sourceFieldId || mapping.staticValue) {
      requiredFieldIds.delete(mapping.targetFieldId);
    }
  }

  return requiredFieldIds.size === 0;
};

export const toggleQuestionId = (currentSelection: string[], questionId: string): string[] => {
  return currentSelection.includes(questionId)
    ? currentSelection.filter((id) => id !== questionId)
    : [...currentSelection, questionId];
};

export const validateCsvFile = (
  file: File,
  t: TFunction
): { valid: true } | { valid: false; error: string } => {
  if (!file.name.endsWith(".csv")) {
    return { valid: false, error: t("workspace.unify.csv_files_only") };
  }
  if (file.type && file.type !== "text/csv" && !file.type.includes("csv")) {
    return { valid: false, error: t("workspace.unify.csv_files_only") };
  }
  if (file.size > MAX_CSV_VALUES.FILE_SIZE) {
    return { valid: false, error: t("workspace.unify.csv_file_too_large") };
  }
  return { valid: true };
};
