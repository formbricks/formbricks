import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { TMembership, TMembershipRole, ZMembershipRole } from "@formbricks/types/v1/memberships";
import {
  TProfile,
  TProfileCreateInput,
  TProfileUpdateInput,
  ZProfileUpdateInput,
} from "@formbricks/types/v1/profile";
import { MembershipRole, Prisma } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";
import { validateInputs } from "../utils/validate";
import { deleteTeam } from "../team/service";
import { z } from "zod";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

const responseSelection = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  onboardingCompleted: true,
};

export const getProfileCacheTag = (userId: string): string => `profiles-${userId}`;
export const getProfileByEmailCacheTag = (email: string): string => `profiles-${email}`;

// function to retrive basic information about a user's profile
export const getProfile = async (userId: string): Promise<TProfile | null> =>
  unstable_cache(
    async () => {
      validateInputs([userId, ZId]);
      try {
        const profile = await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: responseSelection,
        });

        if (!profile) {
          return null;
        }

        return profile;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`profiles-${userId}`],
    {
      tags: [getProfileByEmailCacheTag(userId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getProfileByEmail = async (email: string): Promise<TProfile | null> =>
  unstable_cache(
    async () => {
      validateInputs([email, z.string().email()]);
      try {
        const profile = await prisma.user.findFirst({
          where: {
            email,
          },
          select: responseSelection,
        });

        if (!profile) {
          return null;
        }

        return profile;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError("Database operation failed");
        }

        throw error;
      }
    },
    [`profiles-${email}`],
    {
      tags: [getProfileCacheTag(email)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

const updateUserMembership = async (teamId: string, userId: string, role: TMembershipRole) => {
  validateInputs([teamId, ZId], [userId, ZId], [role, ZMembershipRole]);
  await prisma.membership.update({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
    data: {
      role,
    },
  });
};

const getAdminMemberships = (memberships: TMembership[]): TMembership[] =>
  memberships.filter((membership) => membership.role === MembershipRole.admin);

// function to update a user's profile
export const updateProfile = async (
  personId: string,
  data: Partial<TProfileUpdateInput>
): Promise<TProfile> => {
  validateInputs([personId, ZId], [data, ZProfileUpdateInput.partial()]);
  try {
    const updatedProfile = await prisma.user.update({
      where: {
        id: personId,
      },
      data: data,
      select: responseSelection,
    });

    revalidateTag(getProfileByEmailCacheTag(updatedProfile.email));
    revalidateTag(getProfileCacheTag(personId));

    return updatedProfile;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Profile", personId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};

const deleteUser = async (userId: string): Promise<TProfile> => {
  validateInputs([userId, ZId]);
  const profile = await prisma.user.delete({
    where: {
      id: userId,
    },
    select: responseSelection,
  });
  revalidateTag(getProfileByEmailCacheTag(profile.email));
  revalidateTag(getProfileCacheTag(userId));

  return profile;
};

export const createProfile = async (data: TProfileCreateInput): Promise<TProfile> => {
  validateInputs([data, ZProfileUpdateInput]);
  const profile = await prisma.user.create({
    data: data,
    select: responseSelection,
  });

  revalidateTag(getProfileByEmailCacheTag(profile.email));
  revalidateTag(getProfileCacheTag(profile.id));

  return profile;
};

// function to delete a user's profile including teams
export const deleteProfile = async (userId: string): Promise<void> => {
  validateInputs([userId, ZId]);
  try {
    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId: userId,
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
      const currentUserIsTeamOwner = role === MembershipRole.owner;

      if (teamHasOnlyOneMember) {
        await deleteTeam(teamId);
      } else if (currentUserIsTeamOwner && teamHasAtLeastOneAdmin) {
        const firstAdmin = teamAdminMemberships[0];
        await updateUserMembership(teamId, firstAdmin.userId, MembershipRole.owner);
      } else if (currentUserIsTeamOwner) {
        await deleteTeam(teamId);
      }
    }

    revalidateTag(getProfileCacheTag(userId));
    await deleteUser(userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
