import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { cache } from "react";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
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

  const projectPermission = await getProjectPermissionByUserId(session.user.id, project.id);

  const { hasReadAccess, hasReadWriteAccess, hasManageAccess } = getTeamPermissionFlags(projectPermission);

  const isReadOnly = isMember && hasReadAccess;

  return {
    environment,
    project,
    organization,
    session,
    currentUserMembership,
    projectPermission,
    isMember,
    isOwner,
    isManager,
    isBilling,
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
    isReadOnly,
  };
});

export const environmentIdLayoutChecks = async (environmentId: string) => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { t, session: null, user: null, organization: null };
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return { t, session, user: null, organization: null };
  }

  const hasAccess = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const organization = await getOrganizationByEnvironmentId(environmentId);
  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  return { t, session, user, organization };
};
