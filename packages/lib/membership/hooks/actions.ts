"use server";

import "server-only";

import { authOptions } from "@/authOptions";
import { getMembershipByUserIdTeamId } from "@/service";
import { getTeamByEnvironmentId } from "@/team/service";
import { getServerSession } from "next-auth";

import { AuthenticationError } from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";

export const getMembershipByUserIdTeamIdAction = async (environmentId: string) => {
  const session = await getServerSession(authOptions);
  const team = await getTeamByEnvironmentId(environmentId);
  const user = session?.user as TUser;

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(user.id, team.id);

  if (!currentUserMembership) {
    throw new Error("Membership not found");
  }

  return currentUserMembership?.role;
};
