import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { Prisma } from "@prisma/client";
import { TProfile, ZProfileUpdateInput } from "@formbricks/types/v1/profile";
import { deleteTeam } from "./team";
import { MembershipRole } from "@prisma/client";
import { cache } from "react";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { TMembership, TMembershipRole, ZMembershipRole } from "@formbricks/types/v1/membership";
import { TProfileUpdateInput } from "@formbricks/types/v1/profile";

const responseSelection = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  onboardingCompleted: true,
};

// function to retrive basic information about a user's profile
export const getProfile = cache(async (userId: string): Promise<TProfile | null> => {
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
});

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

const getAdminMemberships = (memberships: TMembership[]) =>
  memberships.filter((membership) => membership.role === MembershipRole.admin);

// function to update a user's profile
export const updateProfile = async (personId: string, data: TProfileUpdateInput): Promise<TProfile> => {
  validateInputs([personId, ZId], [data, ZProfileUpdateInput]);
  try {
    const updatedProfile = await prisma.user.update({
      where: {
        id: personId,
      },
      data: data,
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
const deleteUser = async (userId: string) => {
  validateInputs([userId, ZId]);
  await prisma.user.delete({
    where: {
      id: userId,
    },
  });
};

// function to delete a user's profile including teams
export const deleteProfile = async (personId: string): Promise<void> => {
  validateInputs([personId, ZId]);
  try {
    const currentUserMemberships = await prisma.membership.findMany({
      where: {
        userId: personId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              select: {
                userId: true,
                role: true,
              },
            },
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

    await deleteUser(personId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
