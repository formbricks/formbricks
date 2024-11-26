import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TUser, TUserCreateInput, TUserUpdateInput, ZUserUpdateInput } from "@formbricks/types/user";
import { cache } from "../cache";
import { createCustomerIoCustomer } from "../customerio";
import { deleteMembership, updateMembership } from "../membership/service";
import { deleteOrganization } from "../organization/service";
import { validateInputs } from "../utils/validate";
import { userCache } from "./cache";

const responseSelection = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  role: true,
  twoFactorEnabled: true,
  identityProvider: true,
  objective: true,
  notificationSettings: true,
};

// function to retrive basic information about a user's user
export const getUser = reactCache(
  (id: string): Promise<TUser | null> =>
    cache(
      async () => {
        validateInputs([id, ZId]);

        try {
          const user = await prisma.user.findUnique({
            where: {
              id,
            },
            select: responseSelection,
          });

          if (!user) {
            return null;
          }
          return user;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getUser-${id}`],
      {
        tags: [userCache.tag.byId(id)],
      }
    )()
);

export const getUserByEmail = reactCache(
  (email: string): Promise<TUser | null> =>
    cache(
      async () => {
        validateInputs([email, z.string().email()]);

        try {
          const user = await prisma.user.findFirst({
            where: {
              email,
            },
            select: responseSelection,
          });

          return user;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getUserByEmail-${email}`],
      {
        tags: [userCache.tag.byEmail(email)],
      }
    )()
);

const getAdminMemberships = (memberships: TMembership[]): TMembership[] =>
  memberships.filter((membership) => membership.role === "admin");

// function to update a user's user
export const updateUser = async (personId: string, data: TUserUpdateInput): Promise<TUser> => {
  validateInputs([personId, ZId], [data, ZUserUpdateInput.partial()]);

  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: personId,
      },
      data: data,
      select: responseSelection,
    });

    userCache.revalidate({
      email: updatedUser.email,
      id: updatedUser.id,
    });

    return updatedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("User", personId);
    }
    throw error; // Re-throw any other errors
  }
};

const deleteUserById = async (id: string): Promise<TUser> => {
  validateInputs([id, ZId]);

  try {
    const user = await prisma.user.delete({
      where: {
        id,
      },
      select: responseSelection,
    });

    userCache.revalidate({
      email: user.email,
      id,
      count: true,
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const createUser = async (data: TUserCreateInput): Promise<TUser> => {
  validateInputs([data, ZUserUpdateInput]);

  try {
    const user = await prisma.user.create({
      data: data,
      select: responseSelection,
    });

    userCache.revalidate({
      email: user.email,
      id: user.id,
      count: true,
    });

    // send new user customer.io to customer.io
    createCustomerIoCustomer(user);

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DatabaseError("User with this email already exists");
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

// function to delete a user's user including organizations
export const deleteUser = async (id: string): Promise<TUser> => {
  validateInputs([id, ZId]);

  try {
    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId: id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            memberships: true,
          },
        },
      },
    });

    for (const currentUserMembership of currentUserMemberships) {
      const organizationMemberships = currentUserMembership.organization.memberships;
      const role = currentUserMembership.role;
      const organizationId = currentUserMembership.organizationId;

      const organizationAdminMemberships = getAdminMemberships(organizationMemberships);
      const organizationHasAtLeastOneAdmin = organizationAdminMemberships.length > 0;
      const organizationHasOnlyOneMember = organizationMemberships.length === 1;
      const currentUserIsOrganizationOwner = role === "owner";
      await deleteMembership(id, organizationId);

      if (organizationHasOnlyOneMember) {
        await deleteOrganization(organizationId);
      } else if (currentUserIsOrganizationOwner && organizationHasAtLeastOneAdmin) {
        const firstAdmin = organizationAdminMemberships[0];
        await updateMembership(firstAdmin.userId, organizationId, { role: "owner" });
      } else if (currentUserIsOrganizationOwner) {
        await deleteOrganization(organizationId);
      }
    }

    const deletedUser = await deleteUserById(id);

    return deletedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getUsersWithOrganization = async (organizationId: string): Promise<TUser[]> => {
  validateInputs([organizationId, ZId]);

  try {
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId,
          },
        },
      },
      select: responseSelection,
    });

    return users;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const userIdRelatedToApiKey = async (apiKey: string) => {
  validateInputs([apiKey, z.string()]);

  try {
    const userId = await prisma.apiKey.findUnique({
      where: { id: apiKey },
      select: {
        environment: {
          select: {
            people: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });
    return userId;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
