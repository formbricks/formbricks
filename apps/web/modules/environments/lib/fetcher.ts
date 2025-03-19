import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { getTranslate } from "@/tolgee/server";
import { Session, getServerSession } from "next-auth";
import { cache } from "react";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";

export type EnvironmentAuth = {
  environment: TEnvironment;
  project: TProject;
  organization: TOrganization;
  session: Session;
  currentUserMembership: TMembership;
  projectPermission: TTeamPermission | null;
  isMember: boolean;
  isOwner: boolean;
  isManager: boolean;
  isBilling: boolean;
  hasReadAccess: boolean;
  hasReadWriteAccess: boolean;
  hasManageAccess: boolean;
  isReadOnly: boolean;
};

/**
 * Common utility to fetch environment data and perform authorization checks
 *
 * Usage:
 *   const { environment, project, isReadOnly } = await getEnvironmentAuth(params.environmentId);
 */
export const getEnvironmentAuth = cache(async (environmentId: string): Promise<EnvironmentAuth> => {
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
