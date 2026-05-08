import { TConnectorFieldMappingCreateInput } from "@formbricks/types/connector";
import {
  CSV_HIDDEN_STATIC_MAPPINGS,
  CSV_PROTECTED_TARGET_IDS,
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
