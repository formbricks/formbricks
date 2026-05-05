import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getMonthlyOrganizationResponseCount, getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { validateInputs } from "@/lib/utils/validate";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import {
  getAccessControlPermission,
  getIsDashboardsEnabled,
  getIsFeedbackDirectoriesEnabled,
  getIsUnifyFeedbackEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TWorkspaceAuth, TWorkspaceLayoutData } from "@/modules/workspaces/types/workspace-auth";

/**
 * Workspace-scoped equivalent of getEnvironmentAuth.
 * Accepts a workspaceId, resolves the production environment automatically,
 * and performs the same authorization checks as getEnvironmentAuth.
 */
export const getWorkspaceAuth = reactCache(async (workspaceId: string): Promise<TWorkspaceAuth> => {
  const t = await getTranslate();

  const [workspace, session] = await Promise.all([getWorkspace(workspaceId), getServerSession(authOptions)]);

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), workspaceId);
  }

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const organization = await getOrganization(workspace.organizationId);

  if (!organization) {
    throw new ResourceNotFoundError(t("common.organization"), null);
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session.user.id, organization.id);
  if (!currentUserMembership) {
    throw new AuthorizationError(t("common.membership_not_found"));
  }

  const { isMember, isOwner, isManager, isBilling } = getAccessFlags(currentUserMembership.role);

  const workspacePermission = await getWorkspacePermissionByUserId(session.user.id, workspace.id);

  const { hasReadAccess, hasReadWriteAccess, hasManageAccess } = getTeamPermissionFlags(workspacePermission);

  const isReadOnly = isMember && hasReadAccess;

  return {
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

/**
 * Lightweight layout checks for workspace routes (survey editor, onboarding).
 */
export const workspaceIdLayoutChecks = async (workspaceId: string) => {
  const t = await getTranslate();
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { t, session: null, user: null, organization: null };
  }

  const user = await getUser(session.user.id);
  if (!user) {
    return { t, session, user: null, organization: null };
  }

  const hasAccess = await hasUserWorkspaceAccess(session.user.id, workspaceId);
  if (!hasAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
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
          isAISmartToolsEnabled: true,
          isAIDataAnalysisEnabled: true,
          whitelabel: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new ResourceNotFoundError(t("common.workspace"), workspaceId);
  }

  return { t, session, user, organization: workspace.organization };
};

/**
 * Fetches workspace with related data in a single optimized database query.
 */
export const getWorkspaceWithRelations = reactCache(async (workspaceId: string, userId: string) => {
  try {
    const data = await prisma.workspace.findUnique({
      where: { id: workspaceId },
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
        appSetupCompleted: true,
        styling: true,
        logo: true,
        customHeadScripts: true,
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
            isAISmartToolsEnabled: true,
            isAIDataAnalysisEnabled: true,
            whitelabel: true,
            memberships: {
              where: { userId },
              select: {
                userId: true,
                organizationId: true,
                accepted: true,
                role: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!data) return null;

    if (!data.organization.billing) {
      throw new ResourceNotFoundError("OrganizationBilling", data.organization.id);
    }

    return {
      workspace: {
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        name: data.name,
        organizationId: data.organizationId,
        languages: data.languages,
        recontactDays: data.recontactDays,
        linkSurveyBranding: data.linkSurveyBranding,
        inAppSurveyBranding: data.inAppSurveyBranding,
        config: data.config,
        placement: data.placement,
        clickOutsideClose: data.clickOutsideClose,
        overlay: data.overlay,
        styling: data.styling,
        logo: data.logo,
        customHeadScripts: data.customHeadScripts,
        appSetupCompleted: data.appSetupCompleted,
      },
      organization: {
        id: data.organization.id,
        createdAt: data.organization.createdAt,
        updatedAt: data.organization.updatedAt,
        name: data.organization.name,
        billing: data.organization.billing,
        isAISmartToolsEnabled: data.organization.isAISmartToolsEnabled,
        isAIDataAnalysisEnabled: data.organization.isAIDataAnalysisEnabled,
        whitelabel: data.organization.whitelabel,
      },
      membership: data.organization.memberships[0] || null,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting workspace with relations");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Fetches all data required for workspace layout rendering.
 * Resolves the production environment automatically.
 */
export const getWorkspaceLayoutData = reactCache(
  async (workspaceId: string, userId: string): Promise<TWorkspaceLayoutData> => {
    validateInputs([workspaceId, ZId]);
    validateInputs([userId, ZId]);

    const t = await getTranslate();
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      throw new AuthenticationError(t("common.not_authenticated"));
    }

    if (session.user.id !== userId) {
      throw new AuthenticationError("User ID mismatch with session");
    }

    const user = await getUser(userId);
    if (!user) {
      throw new AuthenticationError(t("common.not_authenticated"));
    }

    const hasAccess = await hasUserWorkspaceAccess(userId, workspaceId);
    if (!hasAccess) {
      throw new AuthorizationError(t("common.not_authorized"));
    }

    const relationData = await getWorkspaceWithRelations(workspaceId, userId);
    if (!relationData) {
      throw new ResourceNotFoundError(t("common.workspace"), workspaceId);
    }

    const { workspace, organization, membership } = relationData;

    if (!membership) {
      throw new AuthorizationError(t("common.membership_not_found"));
    }

    const [
      isAccessControlAllowed,
      isUnifyFeedbackAllowed,
      isFeedbackDirectoriesAllowed,
      isDashboardsAllowed,
      workspacePermission,
      license,
    ] = await Promise.all([
      getAccessControlPermission(organization.id),
      getIsUnifyFeedbackEnabled(organization.id),
      getIsFeedbackDirectoriesEnabled(organization.id),
      getIsDashboardsEnabled(organization.id),
      getWorkspacePermissionByUserId(userId, workspace.id),
      getEnterpriseLicense(),
    ]);

    let responseCount = 0;
    if (IS_FORMBRICKS_CLOUD) {
      responseCount = await getMonthlyOrganizationResponseCount(organization.id);
    }

    return {
      session,
      user,
      workspace,
      organization,
      membership,
      isAccessControlAllowed,
      isUnifyFeedbackAllowed,
      isFeedbackDirectoriesAllowed,
      isDashboardsAllowed,
      workspacePermission,
      license,
      responseCount,
    };
  }
);
