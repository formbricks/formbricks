"use server";

import "server-only";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationByWorkspaceId } from "../../organization/service";
import { getMembershipByUserIdOrganizationId } from "../service";

export const getMembershipByUserIdOrganizationIdAction = async (workspaceId: string, userId: string) => {
  const organization = await getOrganizationByWorkspaceId(workspaceId);

  if (!organization) {
    throw new ResourceNotFoundError("Organization", null);
  }

  const currentUserMembership = await getMembershipRole(userId, organization.id);

  return currentUserMembership;
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  return membership.role;
};
