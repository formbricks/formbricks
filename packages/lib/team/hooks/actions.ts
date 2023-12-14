"use server";

import "server-only";

import { authOptions } from "@/authOptions";
import { getServerSession } from "next-auth";

import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";

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
