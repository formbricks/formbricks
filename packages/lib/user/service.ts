import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TUser, TUserCreateInput, TUserUpdateInput, ZUserUpdateInput } from "@formbricks/types/user";

import { cache } from "../cache";
import { createCustomerIoCustomer } from "../customerio";
import { deleteMembership, updateMembership } from "../membership/service";
import { deleteTeam } from "../team/service";
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
  onboardingCompleted: true,
  twoFactorEnabled: true,
  identityProvider: true,
  objective: true,
  notificationSettings: true,
};

// function to retrive basic information about a user's user
export const getUser = (id: string): Promise<TUser | null> =>
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
  )();

export const getUserByEmail = (email: string): Promise<TUser | null> =>
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
  )();

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

// function to delete a user's user including teams
export const deleteUser = async (id: string): Promise<TUser> => {
  validateInputs([id, ZId]);

  try {
    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId: id,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            memberships: true,
          },
        },
      },
    });

    for (const currentUserMembership of currentUserMemberships) {
      const teamMemberships = currentUserMembership.team.memberships;
      const role = currentUserMembership.role;
      const teamId = currentUserMembership.teamId;

      const teamAdminMemberships = getAdminMemberships(teamMemberships);
      const teamHasAtLeastOneAdmin = teamAdminMemberships.length > 0;
      const teamHasOnlyOneMember = teamMemberships.length === 1;
      const currentUserIsTeamOwner = role === "owner";
      await deleteMembership(id, teamId);

      if (teamHasOnlyOneMember) {
        await deleteTeam(teamId);
      } else if (currentUserIsTeamOwner && teamHasAtLeastOneAdmin) {
        const firstAdmin = teamAdminMemberships[0];
        await updateMembership(firstAdmin.userId, teamId, { role: "owner" });
      } else if (currentUserIsTeamOwner) {
        await deleteTeam(teamId);
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

export const getUsersWithTeam = async (teamId: string): Promise<TUser[]> => {
  validateInputs([teamId, ZId]);

  try {
    const users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            teamId,
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
