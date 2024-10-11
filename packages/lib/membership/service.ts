import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import {
  TMember,
  TMembership,
  TMembershipUpdateInput,
  ZMembership,
  ZMembershipUpdateInput,
} from "@formbricks/types/memberships";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { organizationCache } from "../organization/cache";
import { validateInputs } from "../utils/validate";
import { membershipCache } from "./cache";

export const getMembersByOrganizationId = reactCache(
  (organizationId: string, page?: number): Promise<TMember[]> =>
    cache(
      async () => {
        validateInputs([organizationId, ZString], [page, ZOptionalNumber]);

        try {
          const membersData = await prisma.membership.findMany({
            where: { organizationId },
            select: {
              user: {
                select: {
                  name: true,
                  email: true,
                },
              },
              userId: true,
              accepted: true,
              role: true,
            },
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });

          const members = membersData.map((member) => {
            return {
              name: member.user?.name || "",
              email: member.user?.email || "",
              userId: member.userId,
              accepted: member.accepted,
              role: member.role,
            };
          });

          return members;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching members");
        }
      },
      [`getMembersByOrganizationId-${organizationId}-${page}`],
      {
        tags: [membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getMembershipByUserIdOrganizationId = reactCache(
  (userId: string, organizationId: string): Promise<TMembership | null> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [organizationId, ZString]);

        try {
          const membership = await prisma.membership.findUnique({
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
            console.error(error);
            throw new DatabaseError(error.message);
          }

          throw new UnknownError("Error while fetching membership");
        }
      },
      [`getMembershipByUserIdOrganizationId-${userId}-${organizationId}`],
      {
        tags: [membershipCache.tag.byUserId(userId), membershipCache.tag.byOrganizationId(organizationId)],
      }
    )()
);

export const getMembershipsByUserId = reactCache(
  (userId: string, page?: number): Promise<TMembership[]> =>
    cache(
      async () => {
        validateInputs([userId, ZString], [page, ZOptionalNumber]);

        try {
          const memberships = await prisma.membership.findMany({
            where: {
              userId,
            },
            take: page ? ITEMS_PER_PAGE : undefined,
            skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          });

          return memberships;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getMembershipsByUserId-${userId}-${page}`],
      {
        tags: [membershipCache.tag.byUserId(userId)],
      }
    )()
);

export const createMembership = async (
  organizationId: string,
  userId: string,
  data: Partial<TMembership>
): Promise<TMembership> => {
  validateInputs([organizationId, ZString], [userId, ZString], [data, ZMembership.partial()]);

  try {
    const membership = await prisma.membership.create({
      data: {
        userId,
        organizationId,
        accepted: data.accepted,
        role: data.role as TMembership["role"],
      },
    });
    organizationCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateMembership = async (
  userId: string,
  organizationId: string,
  data: TMembershipUpdateInput
): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString], [data, ZMembershipUpdateInput]);

  try {
    const membership = await prisma.membership.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      data,
    });

    organizationCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    return membership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Membership", `userId: ${userId}, organizationId: ${organizationId}`);
    }

    throw error;
  }
};

export const deleteMembership = async (userId: string, organizationId: string): Promise<TMembership> => {
  validateInputs([userId, ZString], [organizationId, ZString]);

  try {
    const deletedMembership = await prisma.membership.delete({
      where: {
        userId_organizationId: {
          organizationId,
          userId,
        },
      },
    });

    organizationCache.revalidate({
      userId,
    });

    membershipCache.revalidate({
      userId,
      organizationId,
    });

    return deletedMembership;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const transferOwnership = async (
  currentOwnerId: string,
  newOwnerId: string,
  organizationId: string
): Promise<TMembership[]> => {
  validateInputs([currentOwnerId, ZString], [newOwnerId, ZString], [organizationId, ZString]);

  try {
    const memberships = await prisma.$transaction([
      prisma.membership.update({
        where: {
          userId_organizationId: {
            organizationId,
            userId: currentOwnerId,
          },
        },
        data: {
          role: "admin",
        },
      }),
      prisma.membership.update({
        where: {
          userId_organizationId: {
            organizationId,
            userId: newOwnerId,
          },
        },
        data: {
          role: "owner",
        },
      }),
    ]);

    memberships.forEach((membership) => {
      organizationCache.revalidate({
        userId: membership.userId,
      });

      membershipCache.revalidate({
        userId: membership.userId,
        organizationId: membership.organizationId,
      });
    });

    return memberships;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    const message = error instanceof Error ? error.message : "";
    throw new UnknownError(`Error while transfering ownership: ${message}`);
  }
};
