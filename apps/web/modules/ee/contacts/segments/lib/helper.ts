import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/types/errors";
import { TBaseFilters, TSegmentSurveyInteractionFilter } from "@formbricks/types/segment";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";

/**
 * Checks if a segment filter contains a recursive reference to itself
 * @param filters - The filters to check for recursive references
 * @param segmentId - The ID of the segment being checked
 * @throws {InvalidInputError} When a recursive segment filter is detected
 */
export const checkForRecursiveSegmentFilter = async (filters: TBaseFilters, segmentId: string) => {
  for (const filter of filters) {
    const { resource } = filter;
    if (isResourceFilter(resource)) {
      if (resource.root.type === "segment") {
        const { segmentId: segmentIdFromRoot } = resource.root;

        if (segmentIdFromRoot === segmentId) {
          throw new InvalidInputError("Recursive segment filter is not allowed");
        }

        const segment = await getSegment(segmentIdFromRoot);

        if (segment) {
          // recurse into this segment and check for recursive filters:
          const segmentFilters = segment.filters;

          if (segmentFilters) {
            await checkForRecursiveSegmentFilter(segmentFilters, segmentId);
          }
        }
      }
    } else {
      await checkForRecursiveSegmentFilter(resource, segmentId);
    }
  }
};

/**
 * Collects all surveyIds referenced by "specific" scope survey-interaction filters in the (nested)
 * filter tree. Filters scoped to "any" survey contribute no ids.
 */
export const collectSurveyIdsFromSegmentFilters = (filters: TBaseFilters): string[] => {
  const surveyIds: string[] = [];

  for (const filter of filters) {
    const { resource } = filter;
    if (isResourceFilter(resource)) {
      if (resource.root.type === "surveyInteraction") {
        const { value } = resource as TSegmentSurveyInteractionFilter;
        if (value.surveyScope === "specific") {
          surveyIds.push(...value.surveyIds);
        }
      }
    } else {
      surveyIds.push(...collectSurveyIdsFromSegmentFilters(resource));
    }
  }

  return surveyIds;
};

/**
 * Ensures every survey referenced by a "specific" survey-interaction filter belongs to the given
 * workspace. This is the tenancy guard for interaction filters — the runtime evaluation query is
 * already workspace-scoped, but we reject unknown/foreign ids at write time to avoid persisting
 * dead references.
 * @throws {InvalidInputError} When a referenced survey is not found in the workspace
 */
export const assertSurveyInteractionSurveyIds = async (filters: TBaseFilters, workspaceId: string) => {
  const surveyIds = Array.from(new Set(collectSurveyIdsFromSegmentFilters(filters)));

  if (surveyIds.length === 0) {
    return;
  }

  const foundSurveys = await prisma.survey.findMany({
    where: { id: { in: surveyIds }, workspaceId },
    select: { id: true },
  });

  const foundIds = new Set(foundSurveys.map((survey) => survey.id));
  const missingId = surveyIds.find((id) => !foundIds.has(id));

  if (missingId) {
    throw new InvalidInputError(`Survey not found in workspace: ${missingId}`);
  }
};
