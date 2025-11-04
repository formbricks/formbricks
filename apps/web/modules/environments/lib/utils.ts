import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, DatabaseError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { validateInputs } from "@/lib/utils/validate";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TEnvironmentAuth, TEnvironmentLayoutData } from "../types/environment-auth";

/**
 * Common utility to fetch environment data and perform authorization checks
 *
 * Usage:
 *   const { environment, project, isReadOnly } = await getEnvironmentAuth(params.environmentId);
 */
export const getEnvironmentAuth = reactCache(async (environmentId: string): Promise<TEnvironmentAuth> => {
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

/**
 * Fetches environment with related project, organization, environments, and current user's membership
 * in a single optimized database query.
 * Returns data with proper types matching TEnvironment, TProject, TOrganization.
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
        projectId: true,
        appSetupCompleted: true,
        // Project via relation (nested select)
        project: {
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
            darkOverlay: true,
            styling: true,
            logo: true,
            // All project environments
            environments: {
              select: {
                id: true,
                type: true,
                createdAt: true,
                updatedAt: true,
                projectId: true,
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
                billing: true,
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

    // Extract and return properly typed data
    return {
      environment: {
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        type: data.type,
        projectId: data.projectId,
        appSetupCompleted: data.appSetupCompleted,
      },
      project: {
        id: data.project.id,
        createdAt: data.project.createdAt,
        updatedAt: data.project.updatedAt,
        name: data.project.name,
        organizationId: data.project.organizationId,
        languages: data.project.languages,
        recontactDays: data.project.recontactDays,
        linkSurveyBranding: data.project.linkSurveyBranding,
        inAppSurveyBranding: data.project.inAppSurveyBranding,
        config: data.project.config,
        placement: data.project.placement,
        clickOutsideClose: data.project.clickOutsideClose,
        darkOverlay: data.project.darkOverlay,
        styling: data.project.styling,
        logo: data.project.logo,
        environments: data.project.environments,
      },
      organization: {
        id: data.project.organization.id,
        createdAt: data.project.organization.createdAt,
        updatedAt: data.project.organization.updatedAt,
        name: data.project.organization.name,
        billing: data.project.organization.billing,
        isAIEnabled: data.project.organization.isAIEnabled,
        whitelabel: data.project.organization.whitelabel,
      },
      environments: data.project.environments,
      membership: data.project.organization.memberships[0] || null, // First (and only) membership or null
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
 * Does NOT fetch switcher data (organizations/projects lists) - those are lazy-loaded.
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

    const { environment, project, organization, environments, membership } = relationData;

    // Validate user's membership was found
    if (!membership) {
      throw new Error(t("common.membership_not_found"));
    }

    // Fetch remaining data in parallel
    const [isAccessControlAllowed, projectPermission, license] = await Promise.all([
      getAccessControlPermission(organization.billing.plan), // No DB query (logic only)
      getProjectPermissionByUserId(userId, environment.projectId), // 1 DB query
      getEnterpriseLicense(), // Externally cached
    ]);

    // Conditional queries for Formbricks Cloud
    let peopleCount = 0;
    let responseCount = 0;
    if (IS_FORMBRICKS_CLOUD) {
      [peopleCount, responseCount] = await Promise.all([
        getMonthlyActiveOrganizationPeopleCount(organization.id),
        getMonthlyOrganizationResponseCount(organization.id),
      ]);
    }

    return {
      session,
      user,
      environment,
      project,
      organization,
      environments,
      membership,
      isAccessControlAllowed,
      projectPermission,
      license,
      peopleCount,
      responseCount,
    };
  }
);
