import "server-only";
import { Prisma, Project } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { validateInputs } from "@/lib/utils/validate";

/**
 * @file Data access layer for link surveys - optimized environment context fetching
 * @module modules/survey/link/lib/environment
 *
 * This module provides optimized data fetching for link survey rendering by combining
 * related queries into a single database call. Uses React cache for automatic request
 * deduplication within the same render cycle.
 */

type TProjectForLinkSurvey = Pick<Project, "id" | "name" | "styling" | "logo" | "linkSurveyBranding">;

export interface TEnvironmentContextForLinkSurvey {
  project: TProjectForLinkSurvey;
  organizationId: string;
  organizationBilling: TOrganizationBilling;
}

/**
 * Fetches all environment-related data needed for link surveys in a single optimized query.
 * Combines project, organization, and billing data using Prisma relationships to minimize
 * database round trips.
 *
 * This function is specifically optimized for link survey rendering and only fetches the
 * fields required for that use case. Other parts of the application may need different
 * field combinations and should use their own specialized functions.
 *
 * @param environmentId - The environment identifier
 * @returns Object containing project styling data, organization ID, and billing information
 * @throws ResourceNotFoundError if environment, project, or organization not found
 * @throws DatabaseError if database query fails
 *
 * @example
 * ```typescript
 * // In server components, function is automatically cached per request
 * const { project, organizationId, organizationBilling } =
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
          project: {
            select: {
              id: true,
              name: true,
              styling: true,
              logo: true,
              linkSurveyBranding: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  billing: true,
                },
              },
            },
          },
        },
      });

      // Fail early pattern: validate data before proceeding
      if (!environment?.project) {
        throw new ResourceNotFoundError("Project", null);
      }

      if (!environment.project.organization) {
        throw new ResourceNotFoundError("Organization", null);
      }

      // Return structured, typed data
      return {
        project: {
          id: environment.project.id,
          name: environment.project.name,
          styling: environment.project.styling,
          logo: environment.project.logo,
          linkSurveyBranding: environment.project.linkSurveyBranding,
        },
        organizationId: environment.project.organizationId,
        organizationBilling: environment.project.organization.billing as TOrganizationBilling,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);
