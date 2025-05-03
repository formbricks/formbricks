import { prisma } from "@formbricks/database";

export const getOrganizationIds = async (): Promise<string[]> => {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
    },
  });
  return organizations.map((organization) => organization.id);
};
