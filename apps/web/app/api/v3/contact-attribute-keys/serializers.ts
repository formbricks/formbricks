import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";

/**
 * Public v3 contact-attribute-key shape. Exposes what an agent needs to author targeting filters:
 * the `key` (used as `targeting.filters[].root.contactAttributeKey`) and the `dataType` (which hints
 * the valid operators — number/date attributes support arithmetic/date operators) — plus what the
 * Attributes table renders (`createdAt`, `updatedAt`) and `isUnique`. `workspaceId` stays out of the
 * contract: it is the request's own scope.
 */
export type TV3ContactAttributeKeyResource = {
  id: string;
  key: string;
  name: string | null;
  description: string | null;
  type: TContactAttributeKey["type"];
  dataType: TContactAttributeKey["dataType"];
  isUnique: boolean;
  createdAt: string;
  updatedAt: string;
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
    isUnique: attributeKey.isUnique,
    createdAt: attributeKey.createdAt.toISOString(),
    updatedAt: attributeKey.updatedAt.toISOString(),
  };
}
