"use server";

import "server-only";

import { getServerSession } from "next-auth";

import { AuthenticationError, ResourceNotFoundError } from "@formbricks/types/errors";

import { authOptions } from "../../authOptions";
import { getOrganization, getOrganizationBillingInfo } from "../service";

export const getOrganizationBillingInfoAction = async (organizationId: string) => {
  const session = await getServerSession(authOptions);
  const organization = await getOrganization(organizationId);

  if (!session) {
    throw new AuthenticationError("Not authenticated");
  }

  if (!organization) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  return await getOrganizationBillingInfo(organizationId);
};
