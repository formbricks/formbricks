import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TJsEnvironmentStateActionClass,
  TJsEnvironmentStateSurvey,
  TJsEnvironmentStateWorkspace,
} from "@formbricks/types/js";
import { validateInputs } from "@/lib/utils/validate";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";

/**
 * Optimized data fetcher for environment state
 * Uses a single Prisma query with strategic includes to minimize database calls
 * Critical for performance on high-frequency endpoint serving hundreds of thousands of SDK clients
 */
export interface EnvironmentStateData {
  workspace: {
    id: string;
    appSetupCompleted: boolean;
    workspaceSettings: TJsEnvironmentStateWorkspace;
  };
  surveys: TJsEnvironmentStateSurvey[];
  actionClasses: TJsEnvironmentStateActionClass[];
}

/**
 * Single optimized query that fetches all required data
 * Replaces multiple separate service calls with one efficient database operation
 */
export const getEnvironmentStateData = async (workspaceId: string): Promise<EnvironmentStateData> => {
  validateInputs([workspaceId, ZId]);

  try {
    // Single query that fetches everything needed for environment state
    // Uses strategic includes and selects to minimize data transfer
    const workspaceData = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        appSetupCompleted: true,
        recontactDays: true,
        clickOutsideClose: true,
        overlay: true,
        placement: true,
        inAppSurveyBranding: true,
        styling: true,
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
            blocks: true,
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
                    workspaceId: true,
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
            workspaceOverwrites: true,
          },
        },
      },
    });

    if (!workspaceData) {
      throw new ResourceNotFoundError("workspace", workspaceId);
    }

    // Transform surveys using existing utility
    const transformedSurveys = workspaceData.surveys.map((survey) =>
      transformPrismaSurvey<TJsEnvironmentStateSurvey>(survey)
    );

    return {
      workspace: {
        id: workspaceData.id,
        appSetupCompleted: workspaceData.appSetupCompleted,
        workspaceSettings: {
          id: workspaceData.id,
          recontactDays: workspaceData.recontactDays,
          clickOutsideClose: workspaceData.clickOutsideClose,
          overlay: workspaceData.overlay,
          placement: workspaceData.placement,
          inAppSurveyBranding: workspaceData.inAppSurveyBranding,
          styling: resolveStorageUrlsInObject(workspaceData.styling),
        },
      },
      surveys: resolveStorageUrlsInObject(transformedSurveys),
      actionClasses: workspaceData.actionClasses as TJsEnvironmentStateActionClass[],
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Database error in getEnvironmentStateData");
      throw new DatabaseError(`Database error when fetching environment state for ${workspaceId}`);
    }

    logger.error(error, "Unexpected error in getEnvironmentStateData");
    throw error;
  }
};
