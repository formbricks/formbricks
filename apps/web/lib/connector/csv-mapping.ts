import { TConnectorFieldMappingCreateInput } from "@formbricks/types/connector";

export const sanitizeCsvFieldMappings = (
  fieldMappings: TConnectorFieldMappingCreateInput[] | undefined
): TConnectorFieldMappingCreateInput[] | undefined => {
  if (!fieldMappings?.length) return undefined;

  const userMappings = fieldMappings.filter(
    (mapping) => mapping.targetFieldId !== "tenant_id" && mapping.targetFieldId !== "source_type"
  );

  return [...userMappings, { sourceFieldId: "", targetFieldId: "source_type", staticValue: "csv" }];
};
