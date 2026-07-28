import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZString } from "@formbricks/types/common";
import { DatabaseError, UnknownError } from "@formbricks/types/errors";
import { TMembership, ZMembership } from "@formbricks/types/memberships";
import { reconcileOrganizationMembership } from "../authzed/organization-membership";
import { validateInputs } from "../utils/validate";

type TMembershipDbClient = PrismaClient | Prisma.TransactionClient;

type TDeferredMembershipProjection = Readonly<{
  projection: "deferred";
  transaction: Prisma.TransactionClient;
}>;

const getDbClient = (tx?: Prisma.TransactionClient): TMembershipDbClient => tx ?? prisma;

const getMembershipByUserIdOrganizationIdUncached = async (
  userId: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<TMembership | null> => {
  validateInputs([userId, ZString], [organizationId, ZString]);

  try {
    const membership = await getDbClient(tx).membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) return null;

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting membership by user id and organization id");
      throw new DatabaseError(error.message);
    }

    throw new UnknownError("Error while fetching membership");
  }
};

const getMembershipByUserIdOrganizationIdCached = reactCache(async (userId: string, organizationId: string) =>
  getMembershipByUserIdOrganizationIdUncached(userId, organizationId)
);

export const getMembershipByUserIdOrganizationId = async (
  userId: string,
  organizationId: string,
  tx?: Prisma.TransactionClient
): Promise<TMembership | null> => {
  if (tx) {
    return getMembershipByUserIdOrganizationIdUncached(userId, organizationId, tx);
  }

  return getMembershipByUserIdOrganizationIdCached(userId, organizationId);
};

export const createMembership = async (
  organizationId: string,
  userId: string,
  data: Partial<TMembership>,
  options?: TDeferredMembershipProjection
): Promise<TMembership> => {
  validateInputs([organizationId, ZString], [userId, ZString], [data, ZMembership.partial()]);

  let membership: TMembership;

  try {
    const prismaClient = getDbClient(options?.transaction);
    const existingMembership = await prismaClient.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (existingMembership && existingMembership.role === data.role) {
      membership = existingMembership;
    } else if (!existingMembership) {
      membership = await prismaClient.membership.create({
        data: {
          userId,
          organizationId,
          accepted: data.accepted,
          role: data.role as TMembership["role"],
        },
      });
    } else {
      membership = await prismaClient.membership.update({
        where: {
          userId_organizationId: {
            userId,
            organizationId,
          },
        },
        data: {
          accepted: data.accepted,
          role: data.role as TMembership["role"],
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }

  // Transactional callers must project only after their outer transaction commits. Non-transactional
  // callers reconcile even on an idempotent retry so a repeated source mutation can heal SpiceDB.
  if (!options) {
    await reconcileOrganizationMembership(organizationId, userId);
  }

  return membership;
};
