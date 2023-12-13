"use server";

import { getServerSession } from "next-auth";
import "server-only";

import { AuthenticationError } from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";

import { authOptions } from "../../authOptions";
import { getTeamByEnvironmentId } from "../../team/service";
import { getMembershipByUserIdTeamId } from "../service";

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
