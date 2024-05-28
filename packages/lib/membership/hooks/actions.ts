"use server";

import "server-only";

import { getServerSession } from "next-auth";

import { AuthenticationError } from "@formbricks/types/errors";
import { TUser } from "@formbricks/types/user";

import { authOptions } from "../../authOptions";
import { getOrganizationByEnvironmentId } from "../../organization/service";
import { getMembershipByUserIdOrganizationId } from "../service";

export const getMembershipByUserIdOrganizationIdAction = async (environmentId: string) => {
  const session = await getServerSession(authOptions);
  const organization = await getOrganizationByEnvironmentId(environmentId);
  const user = session?.user as TUser;

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(user.id, organization.id);

  if (!currentUserMembership) {
    throw new Error("Membership not found");
  }

  return currentUserMembership?.role;
};
