import { redirect } from "next/navigation";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import {
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ResourceNotFoundError,
} from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getMonthlyOrganizationResponseCount, getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { validateInputs } from "@/lib/utils/validate";
import { hasUserWorkspaceAccess } from "@/lib/workspace/auth";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { getSession } from "@/modules/auth/lib/session";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
import { TWorkspaceAuth, TWorkspaceLayoutData } from "@/modules/workspaces/types/workspace-auth";

/**
 * Resolves a workspace and returns the caller's authorization context for it.
 *
 * This helper is self-contained: it enforces workspace-level access itself rather
 * than relying on the route layout to gate, so it is safe to reuse from any page or
 * route. Billing-role members are redirected to billing/enterprise screens; any org
 * member without a WorkspaceTeam grant (and who is not an owner/manager) is rejected
 * with an AuthorizationError instead of being silently admitted as a writer.
 */
export const getWorkspaceAuth = reactCache(async (workspaceId: string): Promise<TWorkspaceAuth> => {
  const t = await getTranslate();

  const [workspace, session] = await Promise.all([getWorkspace(workspaceId), getSession()]);

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

  // Billing-role members are scoped to billing/enterprise screens only. They must never reach
  // workspace product data (contacts PII, survey summaries/responses, dashboards). This is the
  // single choke point every product page flows through, so gating here closes all of them at
  // once and keeps this helper aligned with hasUserWorkspaceAccessForAction, which already denies
  // billing. Individual pages that also guard billing inline remain correct (defense in depth).
  if (isBilling) {
    redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  // Enforce workspace access here instead of delegating to the route layout, so
  // getWorkspaceAuth is safe to reuse anywhere. An org member with no WorkspaceTeam
  // grant for this workspace has no access and must be rejected — not silently
  // treated as a writer. Runs alongside the permission lookup to avoid extra latency.
  const [hasWorkspaceAccess, workspacePermission] = await Promise.all([
    hasUserWorkspaceAccess(session.user.id, workspace.id),
    getWorkspacePermissionByUserId(session.user.id, workspace.id),
  ]);

  if (!hasWorkspaceAccess) {
    throw new AuthorizationError(t("common.not_authorized"));
  }

  const { hasReadAccess, hasReadWriteAccess, hasManageAccess } = getTeamPermissionFlags(workspacePermission);

  // Fail safe: a member is read-only unless they hold an explicit write or manage
  // grant. Deriving from the *absence* of write access (rather than the presence of
  // an exact "read" grant) means a member with no resolved permission is treated as
  // the most restricted, never mislabeled as a writer.
  const isReadOnly = isMember && !hasReadWriteAccess && !hasManageAccess;

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
  const session = await getSession();

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
    const session = await getSession();

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

    const [isAccessControlAllowed, workspacePermission, license] = await Promise.all([
      getAccessControlPermission(organization.id),
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
      organization: {
        ...organization,
        billing: {
          ...organization.billing,
          stripe: organization.billing.stripe ?? undefined,
        },
      },
      membership,
      isAccessControlAllowed,
      workspacePermission,
      license,
      responseCount,
    };
  }
);
