import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { THubFieldType } from "@formbricks/types/feedback-source";
import { getSurvey } from "@/lib/survey/service";
import type { TMappingsInput } from "./service";
import { getSupportedHubFieldTypes } from "./survey-elements";

type TResolvedSurveyMappings = {
  mappings: { surveyId: string; elementId: string; hubFieldType: THubFieldType }[];
  /**
   * Whether the selection covered every element of this survey that could be mapped. This is the one
   * moment the full candidate set is known, so it is where the source's `elementScope` is decided —
   * afterwards a survey that has gained a question is indistinguishable from one whose questions were
   * deliberately excluded.
   */
  coversEverySupportedElement: boolean;
};

const resolveSurveyMappings = async (
  surveyId: string,
  elementIds: string[],
  workspaceId: string
): Promise<TResolvedSurveyMappings> => {
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

  const supportedHubFieldTypes = getSupportedHubFieldTypes(survey.blocks);

  const mappings = elementIds.flatMap((elementId) => {
    const hubFieldType = supportedHubFieldTypes.get(elementId);
    if (!hubFieldType) {
      // Either the element does not exist on this survey, or its type has no Hub field. Both are
      // caller mistakes rather than failures, so they are skipped with a warning as before.
      logger.warn(
        { surveyId, elementId },
        "Skipping unknown or unmappable elementId when building feedbackSource mappings"
      );
      return [];
    }

    return [{ surveyId, elementId, hubFieldType }];
  });

  const selected = new Set(mappings.map((m) => m.elementId));
  const coversEverySupportedElement = [...supportedHubFieldTypes.keys()].every((elementId) =>
    selected.has(elementId)
  );

  return { mappings, coversEverySupportedElement };
};

/**
 * Builds the Formbricks-survey mapping input for a feedback source, and is the single place that
 * binds the mapped surveys to the workspace the caller was authorized on. Every survey must live in
 * `workspaceId`; unknown elements and element types with no Hub field are skipped with a warning.
 *
 * Also decides the source's `elementScope`, which later tells reconciliation whether a question added
 * to one of these surveys should be mapped automatically. It is derived here rather than accepted from
 * the caller so it can never disagree with the mapping rows it describes.
 */
export const resolveFormbricksMappingsInput = async (
  entries: { surveyId: string; elementIds: string[] }[],
  workspaceId: string
): Promise<TMappingsInput> => {
  const resolved = await Promise.all(
    entries.map(({ surveyId, elementIds }) => resolveSurveyMappings(surveyId, elementIds, workspaceId))
  );
  const flattenedMappings = resolved.flatMap(({ mappings }) => mappings);
  if (flattenedMappings.length === 0) {
    throw new InvalidInputError("No supported survey questions selected for feedbackSource mapping");
  }

  // "all" only when nothing mappable was left out of any mapped survey. A source that maps several
  // surveys carries one scope for all of them, matching where the column lives; ENG-2341 tracks
  // whether a source should map more than one survey at all.
  const elementScope = resolved.every(({ coversEverySupportedElement }) => coversEverySupportedElement)
    ? "all"
    : "specific";

  return { type: "formbricks_survey", mappings: flattenedMappings, elementScope };
};
