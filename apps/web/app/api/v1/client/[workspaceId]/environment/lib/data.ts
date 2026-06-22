import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TJsWorkspaceStateActionClass,
  TJsWorkspaceStateSurvey,
  TJsWorkspaceStateWorkspaceSetting,
} from "@formbricks/types/js";
import { validateInputs } from "@/lib/utils/validate";
import { resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";

/**
 * Optimized data fetcher for environment state
 * Uses a single Prisma query with strategic includes to minimize database calls
 * Critical for performance on high-frequency endpoint serving hundreds of thousands of SDK clients
 */
export interface WorkspaceStateData {
  workspace: {
    id: string;
    appSetupCompleted: boolean;
    workspaceSettings: TJsWorkspaceStateWorkspaceSetting;
  };
  surveys: TJsWorkspaceStateSurvey[];
  actionClasses: TJsWorkspaceStateActionClass[];
}

/**
 * Single optimized query that fetches all required data
 * Replaces multiple separate service calls with one efficient database operation
 */
export const getWorkspaceStateData = async (workspaceId: string): Promise<WorkspaceStateData> => {
  validateInputs([workspaceId, ZId]);

  try {
    // Single query that fetches everything needed for environment state
    // Uses strategic includes and selects to minimize data transfer
    const workspaceData = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        legacyEnvironmentId: true,
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
            // `name` deliberately not selected — internal label not needed by the
            // SDK and replaced with a fixed placeholder below so older SDKs that
            // decoded `Survey.name` as a required field keep working.
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
            // Only need to know if any filters exist so we can compute
            // `hasFilters`. Real filter values, segment title/description, and
            // surveys-list relation are never exposed to clients.
            segment: {
              select: {
                id: true,
                filters: true,
              },
            },
            recontactDays: true,
            displayLimit: true,
            displayOption: true,
            hiddenFields: true,
            isBackButtonHidden: true,
            isAutoProgressingEnabled: true,
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

    // Backwards-compat response shape for SDKs from before PR #7931. Those
    // clients decoded `survey.name` and the full `segment` object as required
    // fields, so the response must still carry that shape — but every field
    // that could leak sensitive targeting data is replaced with a placeholder.
    // The actual segment-membership check happens server-side (segment IDs in
    // POST /user); SDKs only inspect `filters.length` / `hasFilters` locally.
    //
    // `environmentId` mirrors `legacyEnvironmentId ?? workspace.id`, matching
    // the `/me` endpoints' pattern so migrated workspaces keep returning the
    // original env ID older clients persisted.
    const legacyOrCurrentId = workspaceData.legacyEnvironmentId ?? workspaceData.id;
    const placeholderDate = new Date(0);
    const placeholderFilter = {
      id: "placeholder",
      connector: null,
      resource: {
        id: "placeholder",
        root: { type: "device", deviceType: "phone" },
        value: "deprecated",
        qualifier: { operator: "equals" },
      },
    };

    const transformedSurveys = workspaceData.surveys.map((survey) => {
      const realHasFilters =
        Array.isArray(survey.segment?.filters) && (survey.segment.filters as unknown[]).length > 0;

      const sanitizedSegment = survey.segment
        ? {
            id: survey.segment.id,
            title: "[deprecated] segment title omitted from public API - will be removed soon",
            description: null,
            isPrivate: true,
            filters: realHasFilters ? [placeholderFilter] : [],
            environmentId: legacyOrCurrentId,
            workspaceId: legacyOrCurrentId,
            createdAt: placeholderDate,
            updatedAt: placeholderDate,
            surveys: [],
            hasFilters: realHasFilters,
          }
        : null;

      const { segment: _segment, ...surveyWithoutSegment } = survey;

      // Older SDKs (e.g. Android ≤ v1.2.0) decode `language.projectId` as a
      // required field. The column was renamed to `workspaceId` in v5, so
      // mirror its value under `projectId` to keep those clients deserializing.
      const languagesWithProjectId = surveyWithoutSegment.languages?.map((sl) => ({
        ...sl,
        language: { ...sl.language, projectId: sl.language.workspaceId },
      }));

      const transformed = transformPrismaSurvey<TJsWorkspaceStateSurvey>({
        ...surveyWithoutSegment,
        languages: languagesWithProjectId,
        segment: null,
      });

      return {
        ...transformed,
        name: "[deprecated] survey name omitted from public API - will be removed soon",
        segment: sanitizedSegment,
      };
    });

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
      // The runtime shape carries extra back-compat fields (placeholder
      // segment, `hasFilters`, mirrored `environmentId`) that aren't part of
      // the modern `TJsWorkspaceStateSurvey`. Cast through unknown — this is
      // intentional and only this endpoint's response widens the type.
      surveys: resolveStorageUrlsInObject(transformedSurveys) as unknown as TJsWorkspaceStateSurvey[],
      actionClasses: workspaceData.actionClasses,
    };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Database error in getWorkspaceStateData");
      throw new DatabaseError(`Database error when fetching environment state for ${workspaceId}`);
    }

    logger.error(error, "Unexpected error in getWorkspaceStateData");
    throw error;
  }
};
