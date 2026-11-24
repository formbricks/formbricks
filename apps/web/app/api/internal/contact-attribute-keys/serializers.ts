import type {
  TContactAttributeDataType,
  TContactAttributeKey,
  TContactAttributeKeyType,
} from "@formbricks/types/contact-attribute-key";

/** A contact attribute key, as the attributes page creates and edits it. */
export type TContactAttributeKeyResource = {
  id: string;
  workspaceId: string;
  key: string;
  name: string | null;
  description: string | null;
  type: TContactAttributeKeyType;
  dataType: TContactAttributeDataType;
  isUnique: boolean;
  createdAt: string;
  updatedAt: string;
};

export const serializeContactAttributeKey = (key: TContactAttributeKey): TContactAttributeKeyResource => ({
  id: key.id,
  workspaceId: key.workspaceId,
  key: key.key,
  name: key.name,
  description: key.description,
  type: key.type,
  dataType: key.dataType,
  isUnique: key.isUnique,
  createdAt: key.createdAt.toISOString(),
  updatedAt: key.updatedAt.toISOString(),
});
