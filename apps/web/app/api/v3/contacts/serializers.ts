import type { Prisma } from "@formbricks/database/prisma";
import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { readAttributeValue } from "@/modules/ee/contacts/lib/attribute-storage";

/** What the list reads per contact: the row plus every attribute value with its key's metadata. */
export const V3_CONTACT_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  attributes: {
    select: {
      value: true,
      valueNumber: true,
      valueDate: true,
      attributeKey: { select: { key: true, name: true, dataType: true } },
    },
  },
} satisfies Prisma.ContactSelect;

export type TV3ContactRow = Prisma.ContactGetPayload<{ select: typeof V3_CONTACT_SELECT }>;

export type TV3ContactAttribute = {
  key: string;
  name: string | null;
  dataType: TContactAttributeDataType;
  /** The value as the Contacts table renders it: number as its decimal string, date as ISO 8601. */
  value: string;
};

/**
 * Public v3 contact. Maps 1:1 onto the Contacts table's `TContactTableData`: `userId`, `email`,
 * `firstName` and `lastName` are lifted out of the attributes for convenience (null when the contact
 * has no value for them), and `attributes` lists every attribute the contact *has* — a key the contact
 * has no row for is absent, which the table renders as an empty cell.
 */
export type TV3ContactResource = {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  attributes: TV3ContactAttribute[];
};

export function serializeV3Contact(row: TV3ContactRow): TV3ContactResource {
  const attributes: TV3ContactAttribute[] = row.attributes
    .map((attribute) => ({
      key: attribute.attributeKey.key,
      name: attribute.attributeKey.name,
      dataType: attribute.attributeKey.dataType,
      value: readAttributeValue(attribute, attribute.attributeKey.dataType),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : Number(a.key > b.key)));

  const valueOf = (key: string): string | null => attributes.find((a) => a.key === key)?.value ?? null;

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userId: valueOf("userId"),
    email: valueOf("email"),
    firstName: valueOf("firstName"),
    lastName: valueOf("lastName"),
    attributes,
  };
}
