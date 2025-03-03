import { prisma } from "@formbricks/database";
import { TWeeklySummaryProjectData } from "@formbricks/types/weekly-summary";

export const getProjectsByOrganizationId = async (
  organizationId: string
): Promise<TWeeklySummaryProjectData[]> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await prisma.project.findMany({
    where: {
      organizationId: organizationId,
    },
    select: {
      id: true,
      name: true,
      environments: {
        where: {
          type: "production",
        },
        select: {
          id: true,
          surveys: {
            where: {
              NOT: {
                AND: [
                  { status: "completed" },
                  {
                    responses: {
                      none: {
                        createdAt: {
                          gte: sevenDaysAgo,
                        },
                      },
                    },
                  },
                ],
              },
              status: {
                not: "draft",
              },
            },
            select: {
              id: true,
              name: true,
              questions: true,
              status: true,
              responses: {
                where: {
                  createdAt: {
                    gte: sevenDaysAgo,
                  },
                },
                select: {
                  id: true,
                  createdAt: true,
                  updatedAt: true,
                  finished: true,
                  data: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
              displays: {
                where: {
                  createdAt: {
                    gte: sevenDaysAgo,
                  },
                },
                select: {
                  id: true,
                },
              },
              hiddenFields: true,
            },
          },
          attributeKeys: {
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              name: true,
              description: true,
              type: true,
              environmentId: true,
              key: true,
              isUnique: true,
            },
          },
        },
      },
      organization: {
        select: {
          memberships: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  notificationSettings: true,
                  locale: true,
                },
              },
            },
          },
        },
      },
    },
  });
};
