import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { THubFieldType, getHubFieldTypeFromElementType } from "@formbricks/types/feedback-source";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import type { TMappingsInput } from "./service";

const resolveSurveyMappings = async (
  surveyId: string,
  elementIds: string[],
  workspaceId: string
): Promise<{ surveyId: string; elementId: string; hubFieldType: THubFieldType }[]> => {
  const survey = await getSurvey(surveyId);
  // Mapping rows are written with the feedback source's workspaceId, and the composite FK
  // (surveyId, workspaceId) → Survey(id, workspaceId) already makes a survey from another workspace
  // impossible to persist. Reject it here so the caller gets a clean not-found instead of a raw
  // Prisma FK error, and so the app-level check matches the workspace the caller was authorized on
  // rather than the whole organization. Not-found rather than unauthorized: the response must not
  // confirm that a foreign survey id exists.
  if (survey?.workspaceId !== workspaceId) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const elements = getElementsFromBlocks(survey.blocks);
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  return elementIds.flatMap((elementId) => {
    const element = elementMap.get(elementId);
    if (!element) {
      logger.warn(
        { surveyId, elementId },
        "Skipping unknown elementId when building feedbackSource mappings"
      );
      return [];
    }

    const hubFieldType = getHubFieldTypeFromElementType(element.type);
    if (!hubFieldType) {
      logger.warn(
        { surveyId, elementId, elementType: element.type },
        "Skipping unmappable element type when building feedbackSource mappings"
      );
      return [];
    }

    return [{ surveyId, elementId, hubFieldType }];
  });
};

/**
 * Builds the Formbricks-survey mapping input for a feedback source, and is the single place that
 * binds the mapped surveys to the workspace the caller was authorized on. Every survey must live in
 * `workspaceId`; unknown elements and element types with no Hub field are skipped with a warning.
 */
export const resolveFormbricksMappingsInput = async (
  entries: { surveyId: string; elementIds: string[] }[],
  workspaceId: string
): Promise<TMappingsInput> => {
  const allMappings = await Promise.all(
    entries.map(({ surveyId, elementIds }) => resolveSurveyMappings(surveyId, elementIds, workspaceId))
  );
  const flattenedMappings = allMappings.flat();
  if (flattenedMappings.length === 0) {
    throw new InvalidInputError("No supported survey questions selected for feedbackSource mapping");
  }

  return { type: "formbricks_survey", mappings: flattenedMappings };
};
