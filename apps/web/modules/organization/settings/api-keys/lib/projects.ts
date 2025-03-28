import { TOrganizationProject } from "@/modules/organization/settings/api-keys/types/api-keys";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { projectCache } from "@formbricks/lib/project/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const getProjectsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationProject[]> =>
    cache(
      async () => {
        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              environments: true,
              name: true,
            },
          });

          console.log("projects query", projects);

          return projects;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getProjectsByOrganizationId-${organizationId}`],
      {
        tags: [projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
