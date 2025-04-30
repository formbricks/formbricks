import { prisma } from "@formbricks/database";

export const getOrganizationIds = async (): Promise<string[]> => {
  // [UseTusk]

  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
    },
  });
  return organizations.map((organization) => organization.id);
};
