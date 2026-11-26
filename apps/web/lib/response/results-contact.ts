import type { Prisma } from "@formbricks/database/prisma";
import type { TResponseContact } from "@formbricks/types/responses";

/** The contact columns the app's results read, with the directory that tells whether it is still reached. */
export const resultsContactSelection = {
  id: true,
  directoryId: true,
  attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
} satisfies Prisma.ContactSelect;

type TResultsContactRow = {
  id: string;
  directoryId: string | null;
  attributes: { attributeKey: { key: string }; value: string }[];
};

/**
 * Whether the workspace still reaches a contact: the contact sits in the workspace's current contact
 * directory. A workspace with no directory reaches no contact.
 */
export const isContactReachable = (
  contactDirectoryId: string | null,
  workspaceDirectoryId: string | null
): boolean => workspaceDirectoryId !== null && contactDirectoryId === workspaceDirectoryId;

/**
 * A response's contact as the app's results show it. A response keeps its contact after the workspace
 * leaves the contact's directory (ADR 0061). When the workspace no longer reaches the contact (it sits in
 * another directory, or the workspace has none) only its id is kept, marked unavailable: its current
 * attributes, the userId among them, belong to a directory the workspace has left.
 */
export const toResultsResponseContact = (
  contact: TResultsContactRow | null,
  workspaceDirectoryId: string | null
): TResponseContact | null => {
  if (!contact) return null;
  if (!isContactReachable(contact.directoryId, workspaceDirectoryId)) {
    return { id: contact.id, unavailable: true };
  }
  return {
    id: contact.id,
    userId: contact.attributes.find((attribute) => attribute.attributeKey.key === "userId")?.value,
  };
};
