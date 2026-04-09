import "server-only";
import { Prisma, Workspace } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationBilling, TOrganizationWhitelabel } from "@formbricks/types/organizations";
import { validateInputs } from "@/lib/utils/validate";

/**
 * @file Data access layer for link surveys - optimized environment context fetching
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

export interface TEnvironmentContextForLinkSurvey {
  workspace: TWorkspaceForLinkSurvey;
  organizationId: string;
  organizationBilling: TOrganizationBilling;
  organizationWhitelabel: TOrganizationWhitelabel | null;
}

/**
 * Fetches all environment-related data needed for link surveys in a single optimized query.
 * Combines workspace, organization, and billing data using Prisma relationships to minimize
 * database round trips.
 *
 * This function is specifically optimized for link survey rendering and only fetches the
 * fields required for that use case. Other parts of the application may need different
 * field combinations and should use their own specialized functions.
 *
 * @param environmentId - The environment identifier
 * @returns Object containing workspace styling data, organization ID, and billing information
 * @throws ResourceNotFoundError if environment, workspace, or organization not found
 * @throws DatabaseError if database query fails
 *
 * @example
 * ```typescript
 * // In server components, function is automatically cached per request
 * const { workspace, organizationId, organizationBilling } =
 *   await getEnvironmentContextForLinkSurvey(survey.environmentId);
 * ```
 */
export const getEnvironmentContextForLinkSurvey = reactCache(
  async (environmentId: string): Promise<TEnvironmentContextForLinkSurvey> => {
    validateInputs([environmentId, ZId]);

    try {
      const environment = await prisma.environment.findUnique({
        where: { id: environmentId },
        select: {
          workspace: {
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
          },
        },
      });

      // Fail early pattern: validate data before proceeding
      if (!environment?.workspace) {
        throw new ResourceNotFoundError("Workspace", null);
      }

      if (!environment.workspace.organization) {
        throw new ResourceNotFoundError("Organization", null);
      }

      if (!environment.workspace.organization.billing) {
        throw new ResourceNotFoundError("OrganizationBilling", environment.workspace.organization.id);
      }

      // Return structured, typed data
      return {
        workspace: {
          id: environment.workspace.id,
          name: environment.workspace.name,
          styling: environment.workspace.styling,
          logo: environment.workspace.logo,
          linkSurveyBranding: environment.workspace.linkSurveyBranding,
          customHeadScripts: environment.workspace.customHeadScripts,
        },
        organizationId: environment.workspace.organizationId,
        organizationBilling: {
          stripeCustomerId: environment.workspace.organization.billing.stripeCustomerId,
          limits: environment.workspace.organization.billing.limits as TOrganizationBilling["limits"],
          usageCycleAnchor: environment.workspace.organization.billing.usageCycleAnchor,
          ...(environment.workspace.organization.billing.stripe === null
            ? {}
            : { stripe: environment.workspace.organization.billing.stripe }),
        },
        organizationWhitelabel: environment.workspace.organization.whitelabel ?? null,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
