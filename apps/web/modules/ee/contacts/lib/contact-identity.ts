import type { ContactOrderByWithRelationInput } from "@formbricks/database/prisma";

/**
 * How CSV upload and the v2 contact writes find an existing contact. A directory's matching key is also
 * the name of the attribute key that identifies a contact in it: `email`, or `externalId` (spec
 * decision 11). Contacts are found through their attribute rows; nothing in the database makes the value
 * unique, so one value can match several contacts (decision 5).
 */

type TContactWithAttributeValues = {
  attributes: { attributeKey: { key: string }; value: string }[];
};

/** Read contacts in this order so that the first contact of a group is the oldest one. */
export const CONTACTS_OLDEST_FIRST: ContactOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

/** Contacts by the value of their `identityKey` attribute, each group in the order it was read. */
export const groupContactsByIdentity = <T extends TContactWithAttributeValues>(
  contacts: T[],
  identityKey: string
): Map<string, T[]> => {
  const groups = new Map<string, T[]>();

  for (const contact of contacts) {
    const identityValue = contact.attributes.find((attr) => attr.attributeKey.key === identityKey)?.value;
    if (!identityValue) continue;

    const group = groups.get(identityValue);
    if (group) {
      group.push(contact);
    } else {
      groups.set(identityValue, [contact]);
    }
  }

  return groups;
};

/**
 * The contact a CSV or bulk row updates when its identity value matches (spec decision 5): the one whose
 * `userId` equals the row's, otherwise the oldest. The other matches are left alone. `matches` must be
 * oldest first.
 */
export const pickContactForRow = <T extends TContactWithAttributeValues>(
  matches: T[],
  rowUserId: string | undefined
): T | undefined => {
  if (rowUserId) {
    const sameUserId = matches.find((contact) =>
      contact.attributes.some((attr) => attr.attributeKey.key === "userId" && attr.value === rowUserId)
    );
    if (sameUserId) return sameUserId;
  }

  return matches[0];
};
