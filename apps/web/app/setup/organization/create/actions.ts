"use server";

import { Organization } from "@prisma/client";
import { getServerSession } from "next-auth";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { gethasNoOrganizations } from "@formbricks/lib/instance/service";
import { createMembership } from "@formbricks/lib/membership/service";
import { createOrganization } from "@formbricks/lib/organization/service";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";

export const createOrganizationAction = async (organizationName: string): Promise<Organization> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const hasNoOrganizations = await gethasNoOrganizations();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();

  if (!hasNoOrganizations && !isMultiOrgEnabled) {
    throw new OperationNotAllowedError("This action can only be performed on a fresh instance.");
  }

  const newOrganization = await createOrganization({
    name: organizationName,
  });

  await createMembership(newOrganization.id, session.user.id, {
    role: "owner",
    accepted: true,
  });

  return newOrganization;
};
