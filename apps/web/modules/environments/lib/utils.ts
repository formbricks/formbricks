import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { validateInputs } from "@/lib/utils/validate";
import { getWorkspaceByEnvironmentId } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TEnvironmentAuth, TEnvironmentLayoutData } from "../types/environment-auth";

/**
 * Common utility to fetch environment data and perform authorization checks
 *
 * Usage:
 *   const { environment, workspace, isReadOnly } = await getEnvironmentAuth(params.environmentId);
 */
export const getEnvironmentAuth = reactCache(async (environmentId: string): Promise<TEnvironmentAuth> => {
  const t = await getTranslate();

  // Perform all fetches in parallel
  const [environment, workspace, session, organization] = await Promise.all([
    getEnvironment(environmentId),
    getWorkspaceByEnvironmentId(environmentId),
    getServerSession(authOptions),
    getOrganizationByEnvironmentId(environmentId),
  ]);

  if (!workspace) {
    throw new Error(t("common.workspace_not_found"));
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
    throw new AuthorizationError(t("common.membership_not_found"));
  }

  const { isMember, isOwner, isManager, isBilling } = getAccessFlags(currentUserMembership?.role);

  const workspacePermission = await getWorkspacePermissionByUserId(session.user.id, workspace.id);

  const { hasReadAccess, hasReadWriteAccess, hasManageAccess } = getTeamPermissionFlags(workspacePermission);

  const isReadOnly = isMember && hasReadAccess;

  return {
    environment,
    workspace,
    organization,
    session,
    currentUserMembership,
    workspacePermission,
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

/**
 * Fetches environment with related workspace, organization, environments, and current user's membership
 * in a single optimized database query.
 * Returns data with proper types matching TEnvironment, TWorkspace, TOrganization.
 *
 * Note: Validation is handled by parent function (getEnvironmentLayoutData)
 */
export const getEnvironmentWithRelations = reactCache(async (environmentId: string, userId: string) => {
  try {
    const data = await prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        // Environment fields
        id: true,
        createdAt: true,
        updatedAt: true,
        type: true,
        workspaceId: true,
        appSetupCompleted: true,
        // Workspace via relation (nested select)
        workspace: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            name: true,
            organizationId: true,
            languages: true,
            recontactDays: true,
            linkSurveyBranding: true,
            inAppSurveyBranding: true,
            config: true,
            placement: true,
            clickOutsideClose: true,
            overlay: true,
            styling: true,
            logo: true,
            customHeadScripts: true,
            // All workspace environments
            environments: {
              select: {
                id: true,
                type: true,
                createdAt: true,
                updatedAt: true,
                workspaceId: true,
                appSetupCompleted: true,
              },
            },
            // Organization via relation
            organization: {
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                name: true,
                billing: {
                  select: {
                    stripeCustomerId: true,
                    limits: true,
                    usageCycleAnchor: true,
                    stripe: true,
                  },
                },
                isAIEnabled: true,
                whitelabel: true,
                // Current user's membership only (filtered at DB level)
                memberships: {
                  where: {
                    userId: userId,
                  },
                  select: {
                    userId: true,
                    organizationId: true,
                    accepted: true,
                    role: true,
                  },
                  take: 1, // Only need one result
                },
              },
            },
          },
        },
      },
    });

    if (!data) return null;

    if (!data.workspace.organization.billing) {
      throw new ResourceNotFoundError("OrganizationBilling", data.workspace.organization.id);
    }

    // Extract and return properly typed data
    return {
      environment: {
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        type: data.type,
        workspaceId: data.workspaceId,
        appSetupCompleted: data.appSetupCompleted,
      },
      workspace: {
        id: data.workspace.id,
        createdAt: data.workspace.createdAt,
        updatedAt: data.workspace.updatedAt,
        name: data.workspace.name,
        organizationId: data.workspace.organizationId,
        languages: data.workspace.languages,
        recontactDays: data.workspace.recontactDays,
        linkSurveyBranding: data.workspace.linkSurveyBranding,
        inAppSurveyBranding: data.workspace.inAppSurveyBranding,
        config: data.workspace.config,
        placement: data.workspace.placement,
        clickOutsideClose: data.workspace.clickOutsideClose,
        overlay: data.workspace.overlay,
        styling: data.workspace.styling,
        logo: data.workspace.logo,
        customHeadScripts: data.workspace.customHeadScripts,
        environments: data.workspace.environments,
      },
      organization: {
        id: data.workspace.organization.id,
        createdAt: data.workspace.organization.createdAt,
        updatedAt: data.workspace.organization.updatedAt,
        name: data.workspace.organization.name,
        billing: data.workspace.organization.billing,
        isAIEnabled: data.workspace.organization.isAIEnabled,
        whitelabel: data.workspace.organization.whitelabel,
      },
      environments: data.workspace.environments,
      membership: data.workspace.organization.memberships[0] || null, // First (and only) membership or null
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting environment with relations");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Fetches all data required for environment layout rendering.
 * Consolidates multiple queries and eliminates duplicates.
 * Does NOT fetch switcher data (organizations/workspaces lists) - those are lazy-loaded.
 *
 * Note: userId is included in cache key to make it explicit that results are user-specific,
 * even though React.cache() is per-request and doesn't leak across users.
 */
export const getEnvironmentLayoutData = reactCache(
  async (environmentId: string, userId: string): Promise<TEnvironmentLayoutData> => {
    validateInputs([environmentId, ZId]);
    validateInputs([userId, ZId]);

    const t = await getTranslate();
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      throw new Error(t("common.session_not_found"));
    }

    // Verify userId matches session (safety check)
    if (session.user.id !== userId) {
      throw new Error("User ID mismatch with session");
    }

    // Get user first (lightweight query needed for subsequent checks)
    const user = await getUser(userId); // 1 DB query
    if (!user) {
      throw new Error(t("common.user_not_found"));
    }

    // Authorization check before expensive data fetching
    const hasAccess = await hasUserEnvironmentAccess(userId, environmentId);
    if (!hasAccess) {
      throw new AuthorizationError(t("common.not_authorized"));
    }

    const relationData = await getEnvironmentWithRelations(environmentId, userId);
    if (!relationData) {
      throw new Error(t("common.environment_not_found"));
    }

    const { environment, workspace, organization, environments, membership } = relationData;

    // Validate user's membership was found
    if (!membership) {
      throw new AuthorizationError(t("common.membership_not_found"));
    }

    // Fetch remaining data in parallel
    const [isAccessControlAllowed, workspacePermission, license] = await Promise.all([
      getAccessControlPermission(organization.id),
      getWorkspacePermissionByUserId(userId, environment.workspaceId), // 1 DB query
      getEnterpriseLicense(), // Externally cached
    ]);

    // Conditional queries for Formbricks Cloud
    let responseCount = 0;
    if (IS_FORMBRICKS_CLOUD) {
      responseCount = await getMonthlyOrganizationResponseCount(organization.id);
    }

    return {
      session,
      user,
      environment,
      workspace,
      organization,
      environments,
      membership,
      isAccessControlAllowed,
      workspacePermission,
      license,
      responseCount,
    };
  }
);
