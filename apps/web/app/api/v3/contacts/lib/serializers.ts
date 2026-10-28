import { transformPrismaContact } from "@/modules/ee/contacts/lib/utils";
import type { TContactRow } from "./service";

/** The public contact shape: attributes flattened to `{ key: value }`, read back from their typed columns. */
export const serializeV3Contact = (row: TContactRow) => {
  const contact = transformPrismaContact(row);

  return {
    id: contact.id,
    workspaceId: contact.workspaceId,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    attributes: contact.attributes,
  };
};
