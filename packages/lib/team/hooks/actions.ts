"use server";

import { getServerSession } from "next-auth";
import "server-only";

import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";

import { authOptions } from "../../authOptions";
import { getTeam, getTeamBillingInfo } from "../service";

export const getTeamBillingInfoAction = async (teamId: string) => {
  const session = await getServerSession(authOptions);
  const team = await getTeam(teamId);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!team) {
    throw new ResourceNotFoundError("Team", teamId);
  }

  return await getTeamBillingInfo(teamId);
};
