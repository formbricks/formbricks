"use server";

import "server-only";
import { getServerSession } from "next-auth";
import { AuthenticationError, AuthorizationError } from "@formbricks/types/errors";
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

  const currentUserMembership = await getMembershipRole(user.id, organization.id);

  return currentUserMembership;
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  return membership.role;
};
