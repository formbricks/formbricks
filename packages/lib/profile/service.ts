import "server-only";

import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import {
  TProfile,
  TProfileCreateInput,
  TProfileUpdateInput,
  ZProfileUpdateInput,
} from "@formbricks/types/profile";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { deleteTeam } from "../team/service";
import { validateInputs } from "../utils/validate";
import { profileCache } from "./cache";
import { updateMembership } from "../membership/service";

const responseSelection = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  onboardingCompleted: true,
  twoFactorEnabled: true,
  identityProvider: true,
  objective: true,
};

// function to retrive basic information about a user's profile
export const getProfile = async (id: string): Promise<TProfile | null> =>
  unstable_cache(
    async () => {
      validateInputs([id, ZId]);

      try {
        const profile = await prisma.user.findUnique({
          where: {
            id,
          },
          select: responseSelection,
        });

        if (!profile) {
          return null;
        }

        return profile;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getProfile-${id}`],
    {
      tags: [profileCache.tag.byId(id)],
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
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getProfileByEmail-${email}`],
    {
      tags: [profileCache.tag.byEmail(email)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

const getAdminMemberships = (memberships: TMembership[]): TMembership[] =>
  memberships.filter((membership) => membership.role === "admin");

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

    profileCache.revalidate({
      email: updatedProfile.email,
      id: updatedProfile.id,
    });

    return updatedProfile;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Profile", personId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};

const deleteUser = async (id: string): Promise<TProfile> => {
  validateInputs([id, ZId]);

  const profile = await prisma.user.delete({
    where: {
      id,
    },
    select: responseSelection,
  });

  profileCache.revalidate({
    email: profile.email,
    id,
  });

  return profile;
};

export const createProfile = async (data: TProfileCreateInput): Promise<TProfile> => {
  validateInputs([data, ZProfileUpdateInput]);

  const profile = await prisma.user.create({
    data: data,
    select: responseSelection,
  });

  profileCache.revalidate({
    email: profile.email,
    id: profile.id,
  });

  return profile;
};

// function to delete a user's profile including teams
export const deleteProfile = async (userId: string): Promise<TProfile> => {
  validateInputs([userId, ZId]);

  try {
    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId,
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

      if (teamHasOnlyOneMember) {
        await deleteTeam(teamId);
      } else if (currentUserIsTeamOwner && teamHasAtLeastOneAdmin) {
        const firstAdmin = teamAdminMemberships[0];
        await updateMembership(firstAdmin.userId, teamId, { role: "owner" });
      } else if (currentUserIsTeamOwner) {
        await deleteTeam(teamId);
      }
    }

    const deletedProfile = await deleteUser(userId);

    return deletedProfile;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
