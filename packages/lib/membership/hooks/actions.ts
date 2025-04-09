"use server";

import "server-only";
import { AuthorizationError } from "@formbricks/types/errors";
import { getOrganizationByEnvironmentId } from "../../organization/service";
import { getMembershipByUserIdOrganizationId } from "../service";

export const getMembershipByUserIdOrganizationIdAction = async (environmentId: string, userId: string) => {
  const organization = await getOrganizationByEnvironmentId(environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipRole(userId, organization.id);

  return currentUserMembership;
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized membership");
  }

  return membership.role;
};
