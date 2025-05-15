import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganization } from "@/lib/organization/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { TOrganizationAuth } from "../types/organization-auth";

/**
 * Common utility to fetch organization data and perform authorization checks
 *
 * Usage:
 *   const { session, organization, ... } = await getOrganizationAuth(params.organizationId);
 */
export const getOrganizationAuth = cache(async (organizationId: string): Promise<TOrganizationAuth> => {
  const t = await getTranslate();

  // Perform all fetches in parallel
  const [session, organization] = await Promise.all([
    getServerSession(authOptions),
    getOrganization(organizationId),
  ]);

  if (!session) {
    throw new Error(t("common.session_not_found"));
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  if (!currentUserMembership) {
    throw new Error(t("common.membership_not_found"));
  }

  const { isMember, isOwner, isManager, isBilling } = getAccessFlags(currentUserMembership?.role);

  return {
    organization,
    session,
    currentUserMembership,
    isMember,
    isOwner,
    isManager,
    isBilling,
  };
});
