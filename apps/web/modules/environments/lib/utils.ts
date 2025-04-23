import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { TEnvironmentAuth } from "../types/environment-auth";

/**
 * Common utility to fetch environment data and perform authorization checks
 *
 * Usage:
 *   const { environment, project, isReadOnly } = await getEnvironmentAuth(params.environmentId);
 */
export const getEnvironmentAuth = cache(async (environmentId: string): Promise<TEnvironmentAuth> => {
  const t = await getTranslate();

  // Perform all fetches in parallel
  const [environment, project, session, organization] = await Promise.all([
    getEnvironment(environmentId),
    getProjectByEnvironmentId(environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!project) {
    throw new Error(t("common.project_not_found"));
  }

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

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

  const isReadOnly = false;

  return {
    environment,
    project,
    organization,
    session,
    currentUserMembership,
    isMember,
    isOwner,
    isManager,
    isBilling,
    hasReadAccess: true,
    hasReadWriteAccess: true,
    hasManageAccess: true,
    isReadOnly,
  };
});
