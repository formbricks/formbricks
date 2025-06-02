import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TJsEnvironmentState,
  TJsEnvironmentStateActionClass,
  TJsEnvironmentStateProject,
  TJsEnvironmentStateSurvey,
} from "@formbricks/types/js";

/**
 * Optimized data fetcher for environment state
 * Uses a single Prisma query with strategic includes to minimize database calls
 * Critical for performance on high-frequency endpoint serving hundreds of thousands of SDK clients
 */
export interface EnvironmentStateData {
  environment: {
    id: string;
    type: string;
    appSetupCompleted: boolean;
    project: TJsEnvironmentStateProject;
  };
  organization: {
    id: string;
    billing: any;
  };
  surveys: TJsEnvironmentStateSurvey[];
  actionClasses: TJsEnvironmentStateActionClass[];
}

/**
 * Single optimized query that fetches all required data
 * Replaces multiple separate service calls with one efficient database operation
 */
export const getEnvironmentStateData = async (environmentId: string): Promise<EnvironmentStateData> => {
  validateInputs([environmentId, ZId]);

  try {
    // Single query that fetches everything needed for environment state
    // Uses strategic includes and selects to minimize data transfer
    const environmentData = await prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        id: true,
        type: true,
        appSetupCompleted: true,
        // Project data (optimized select)
        project: {
          select: {
            id: true,
            recontactDays: true,
            clickOutsideClose: true,
            darkOverlay: true,
            placement: true,
            inAppSurveyBranding: true,
            styling: true,
            // Organization data (nested select for efficiency)
            organization: {
              select: {
                id: true,
                billing: true,
              },
            },
          },
        },
        // Action classes (optimized for environment state)
        actionClasses: {
          select: {
            id: true,
            type: true,
            name: true,
            key: true,
            noCodeConfig: true,
          },
        },
        // Surveys (optimized for app surveys only)
        surveys: {
          where: {
            type: "app",
            status: "inProgress",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 30, // Limit for performance
          select: {
            id: true,
            welcomeCard: true,
            name: true,
            questions: true,
            variables: true,
            type: true,
            showLanguageSwitch: true,
            languages: {
              select: {
                default: true,
                enabled: true,
                language: {
                  select: {
                    id: true,
                    code: true,
                    alias: true,
                    createdAt: true,
                    updatedAt: true,
                    projectId: true,
                  },
                },
              },
            },
            endings: true,
            autoClose: true,
            styling: true,
            status: true,
            recaptcha: true,
            segment: {
              include: {
                surveys: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            recontactDays: true,
            displayLimit: true,
            displayOption: true,
            hiddenFields: true,
            isBackButtonHidden: true,
            triggers: {
              select: {
                actionClass: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            displayPercentage: true,
            delay: true,
            projectOverwrites: true,
          },
        },
      },
    });

    if (!environmentData) {
      throw new ResourceNotFoundError("environment", environmentId);
    }

    if (!environmentData.project) {
      throw new ResourceNotFoundError("project", null);
    }

    if (!environmentData.project.organization) {
      throw new ResourceNotFoundError("organization", null);
    }

    // Transform surveys using existing utility
    const transformedSurveys = environmentData.surveys.map((survey) =>
      transformPrismaSurvey<TJsEnvironmentStateSurvey>(survey)
    );

    return {
      environment: {
        id: environmentData.id,
        type: environmentData.type,
        appSetupCompleted: environmentData.appSetupCompleted,
        project: {
          id: environmentData.project.id,
          recontactDays: environmentData.project.recontactDays,
          clickOutsideClose: environmentData.project.clickOutsideClose,
          darkOverlay: environmentData.project.darkOverlay,
          placement: environmentData.project.placement,
          inAppSurveyBranding: environmentData.project.inAppSurveyBranding,
          styling: environmentData.project.styling,
        },
      },
      organization: {
        id: environmentData.project.organization.id,
        billing: environmentData.project.organization.billing,
      },
      surveys: transformedSurveys,
      actionClasses: environmentData.actionClasses as TJsEnvironmentStateActionClass[],
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Database error in getEnvironmentStateData");
      throw new DatabaseError(`Database error when fetching environment state for ${environmentId}`);
    }

    logger.error(error, "Unexpected error in getEnvironmentStateData");
    throw error;
  }
};
