import { TConnectorFieldMappingCreateInput, ZHubFieldType } from "@formbricks/types/connector";
import {
  CSV_HIDDEN_STATIC_MAPPINGS,
  CSV_PROTECTED_TARGET_IDS,
  CSV_REQUIRED_UI_FIELDS,
} from "@/modules/ee/unify-feedback/sources/types";

export const sanitizeCsvFieldMappings = (
  fieldMappings: TConnectorFieldMappingCreateInput[] | undefined
): TConnectorFieldMappingCreateInput[] | undefined => {
  if (!fieldMappings?.length) return undefined;

  const userMappings = fieldMappings.filter((mapping) =>
    CSV_PROTECTED_TARGET_IDS.every((id) => mapping.targetFieldId !== id)
  );

  return [...userMappings, ...(CSV_HIDDEN_STATIC_MAPPINGS as TConnectorFieldMappingCreateInput[])];
};

type TCsvFieldMappingLike = {
  targetFieldId: string;
  sourceFieldId?: string;
  staticValue?: string | null;
};

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
