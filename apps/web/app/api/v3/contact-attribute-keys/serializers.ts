import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

/**
 * Public v3 contact-attribute-key shape. Exposes what an agent needs to author targeting filters:
 * the `key` (used as `targeting.filters[].root.contactAttributeKey`) and the `dataType` (which hints
 * the valid operators — number/date attributes support arithmetic/date operators). Internal fields
 * (`isUnique`, `workspaceId`, timestamps) stay out of the contract.
 */
export type TV3ContactAttributeKeyResource = {
  id: string;
  key: string;
  name: string | null;
  description: string | null;
  type: TContactAttributeKey["type"];
  dataType: TContactAttributeKey["dataType"];
};

export function serializeV3ContactAttributeKey(
  attributeKey: TContactAttributeKey
): TV3ContactAttributeKeyResource {
  return {
    id: attributeKey.id,
    key: attributeKey.key,
    name: attributeKey.name,
    description: attributeKey.description,
    type: attributeKey.type,
    dataType: attributeKey.dataType,
  };
}
