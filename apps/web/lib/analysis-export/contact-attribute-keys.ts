import "server-only";
import { prisma } from "@formbricks/database";

/** More attribute columns than this make a file nobody reads; the keys past it are left out. */
const MAX_CONTACT_ATTRIBUTE_COLUMNS = 100;

/**
 * The contact attribute columns of a workspace's Analysis export: its attribute keys that at least one
 * contact carries, so a workspace with no contacts gets no empty columns. The values are read from each
 * response (the attributes it was given with), not from the live contact.
 */
export const getContactAttributeKeys = async (workspaceId: string): Promise<string[]> => {
  const keys = await prisma.contactAttributeKey.findMany({
    where: { workspaceId, attributes: { some: {} } },
    select: { key: true },
    orderBy: { key: "asc" },
    take: MAX_CONTACT_ATTRIBUTE_COLUMNS,
  });
  return keys.map(({ key }) => key);
};
