import { cache } from "@/lib/cache";
import { membershipCache } from "@/lib/membership/cache";
import { validateInputs } from "@/lib/utils/validate";
import { OrganizationRole, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { AuthorizationError, DatabaseError, UnknownError } from "@formbricks/types/errors";

export const getMembershipRoleByUserIdOrganizationId = reactCache(
  async (userId: string, organizationId: string): Promise<OrganizationRole> =>
    cache(
      async () => {
        validateInputs([userId, z.string()], [organizationId, z.string().cuid2()]);

        try {
          const membership = await prisma.membership.findUnique({
            where: {
              userId_organizationId: {
                userId,
                organizationId,
              },
            },
          });

          if (!membership) {
            throw new AuthorizationError("You are not a member of this organization");
          }

          return membership.role;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logger.error(error, "Error fetching membership role by user id and organization id");
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching membership");
        }
      },
      [`survey-getMembershipRoleByUserIdOrganizationId-${userId}-${organizationId}`],
      {
        tags: [membershipCache.tag.byUserId(userId), membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);
