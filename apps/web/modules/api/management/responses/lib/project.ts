import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";

export const getAllEnvironmentsFromOrganizationId = reactCache(async (organizationId: string) =>
  cache(
    async () => {
      const projects = await prisma.project.findMany({
        where: {
          organizationId,
        },

        select: {
          environments: {
            select: {
              id: true,
            },
          },
        },
      });

      return projects.flatMap((project) => project.environments).map((environment) => environment.id);
    },
    [`management-getAllEnvironmentsFromOrganizationId-${organizationId}`],
    {
      tags: [projectCache.tag.byOrganizationId(organizationId)],
    }
  )()
);
