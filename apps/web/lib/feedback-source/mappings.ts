import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  THubFieldType,
  TFeedbackSourceFormbricksMapping,
  getHubFieldTypeFromElementType,
} from "@formbricks/types/feedback-source";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
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

/**
 * Result of reconciling stored feedback-source mappings against the current survey state.
 *
 * The caller applies these deltas to keep the mapping rows in sync.
 */
export type TFeedbackSourceReconciliation = {
  /** Mapping elements whose elementId no longer exists in the survey. */
  toDelete: string[];
  /** Mapping elements that still exist but whose hubFieldType has changed. */
  toUpdate: { elementId: string; hubFieldType: THubFieldType }[];
};

/**
 * Diff stored feedback-source formbricksMappings against the current survey blocks and produce a
 * minimal reconciliation delta.
 *
 * - Elements removed from the survey → `toDelete`
 * - Elements whose type changed (and therefore hubFieldType is stale) → `toUpdate`
 * - Unchanged elements → left alone
 *
 * This is a **pure** function that works from the caller-supplied survey blocks so it can run
 * inside or outside a transaction; it does not read the database.
 */
export const reconcileMappingsAgainstSurvey = (
  storedMappings: Pick<TFeedbackSourceFormbricksMapping, "elementId" | "hubFieldType">[],
  blocks: TSurveyBlock[]
): TFeedbackSourceReconciliation => {
  const elements = getElementsFromBlocks(blocks);
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  const toDelete: string[] = [];
  const toUpdate: { elementId: string; hubFieldType: THubFieldType }[] = [];

  for (const mapping of storedMappings) {
    const element = elementMap.get(mapping.elementId);
    if (!element) {
      toDelete.push(mapping.elementId);
      continue;
    }

    const currentHubFieldType = getHubFieldTypeFromElementType(element.type);
    if (currentHubFieldType && currentHubFieldType !== mapping.hubFieldType) {
      toUpdate.push({ elementId: mapping.elementId, hubFieldType: currentHubFieldType });
    }
  }

  return { toDelete, toUpdate };
};
