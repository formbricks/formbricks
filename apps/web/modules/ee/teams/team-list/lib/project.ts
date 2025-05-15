import "server-only";
import { cache } from "@/lib/cache";
import { projectCache } from "@/lib/project/cache";
import { validateInputs } from "@/lib/utils/validate";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getProjectsByOrganizationId = reactCache(
  async (organizationId: string): Promise<TOrganizationProject[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString]);

        try {
          const projects = await prisma.project.findMany({
            where: {
              organizationId,
            },
            select: {
              id: true,
              name: true,
            },
          });

          return projects.map((project) => ({
            id: project.id,
            name: project.name,
          }));
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error fetching projects by organization id");
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching projects");
        }
      },
      [`getProjectsByOrganizationId-${organizationId}`],
      {
        tags: [projectCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
