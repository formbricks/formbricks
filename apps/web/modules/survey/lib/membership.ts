import { OrganizationRole, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { membershipCache } from "@formbricks/lib/membership/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
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
            console.error(error);
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
