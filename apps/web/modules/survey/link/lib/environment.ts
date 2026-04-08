import "server-only";
import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationBilling, TOrganizationWhitelabel } from "@formbricks/types/organizations";
import { validateInputs } from "@/lib/utils/validate";

/**
 * @file Data access layer for link surveys - workspace context fetching
 * @module modules/survey/link/lib/environment
 *
 * This module provides optimized data fetching for link survey rendering by combining
 * related queries into a single database call. Uses React cache for automatic request
 * deduplication within the same render cycle.
 */

type TWorkspaceForLinkSurvey = Pick<
  Workspace,
  "id" | "name" | "styling" | "logo" | "linkSurveyBranding" | "customHeadScripts"
>;

export interface TWorkspaceContextForLinkSurvey {
  workspace: TWorkspaceForLinkSurvey;
  organizationId: string;
  organizationBilling: TOrganizationBilling;
  organizationWhitelabel: TOrganizationWhitelabel | null;
}

/**
 * Fetches all workspace-related data needed for link surveys in a single optimized query.
 * Combines workspace, organization, and billing data using Prisma relationships to minimize
 * database round trips.
 *
 * @param workspaceId - The workspace identifier
 * @returns Object containing workspace styling data, organization ID, and billing information
 * @throws ResourceNotFoundError if workspace or organization not found
 * @throws DatabaseError if database query fails
 */
export const getWorkspaceContextForLinkSurvey = reactCache(
  async (workspaceId: string): Promise<TWorkspaceContextForLinkSurvey> => {
    validateInputs([workspaceId, ZId]);

    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          styling: true,
          logo: true,
          linkSurveyBranding: true,
          customHeadScripts: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              billing: {
                select: {
                  stripeCustomerId: true,
                  limits: true,
                  usageCycleAnchor: true,
                  stripe: true,
                },
              },
              whitelabel: true,
            },
          },
        },
      });

      if (!workspace) {
        throw new ResourceNotFoundError("Workspace", workspaceId);
      }

      if (!workspace.organization) {
        throw new ResourceNotFoundError("Organization", null);
      }

      if (!workspace.organization.billing) {
        throw new ResourceNotFoundError("OrganizationBilling", workspace.organization.id);
      }

      return {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          styling: workspace.styling,
          logo: workspace.logo,
          linkSurveyBranding: workspace.linkSurveyBranding,
          customHeadScripts: workspace.customHeadScripts,
        },
        organizationId: workspace.organizationId,
        organizationBilling: {
          stripeCustomerId: workspace.organization.billing.stripeCustomerId,
          limits: workspace.organization.billing.limits as TOrganizationBilling["limits"],
          usageCycleAnchor: workspace.organization.billing.usageCycleAnchor,
          ...(workspace.organization.billing.stripe === null
            ? {}
            : { stripe: workspace.organization.billing.stripe }),
        },
        organizationWhitelabel: workspace.organization.whitelabel ?? null,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
