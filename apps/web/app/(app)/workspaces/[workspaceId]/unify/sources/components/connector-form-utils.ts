import { FEEDBACK_RECORD_FIELDS, TFieldMapping } from "../types";

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
