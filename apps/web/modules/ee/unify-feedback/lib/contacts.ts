import { prisma } from "@formbricks/database";

/**
 * Resolves external user identifiers (a feedback record's `user_id`) to Formbricks contact ids
 * within a workspace. Runs a single deduped query — the `userId` contact attribute is unique per
 * workspace — so callers can resolve a whole page of records at once instead of per record.
 *
 * @returns a map of `user_id` -> `contact.id` for the ids that matched an existing contact.
 */
export const getContactIdsByUserIds = async (
  workspaceId: string,
  userIds: string[]
): Promise<Record<string, string>> => {
  const uniqueUserIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (uniqueUserIds.length === 0) return {};

  const attributes = await prisma.contactAttribute.findMany({
    where: {
      attributeKey: { key: "userId", workspaceId },
      value: { in: uniqueUserIds },
    },
    select: { value: true, contactId: true },
  });

  return Object.fromEntries(
    attributes.map((attribute: { value: string; contactId: string }) => [
      attribute.value,
      attribute.contactId,
    ])
  );
};
