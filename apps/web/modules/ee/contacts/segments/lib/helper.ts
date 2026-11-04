import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TBaseFilters, TSegmentSurveyInteractionFilter } from "@formbricks/types/segment";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { andVisibleSurveys, buildHiddenSurveyWhere } from "@/lib/survey/visibility/predicate";
import {
  collectSegmentFilterSurveyIds,
  restoreHiddenSurveyIds,
} from "@/modules/ee/contacts/segments/lib/filter-survey-ids";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import {
  SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE,
  isResourceFilter,
} from "@/modules/ee/contacts/segments/lib/utils";

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
 * filter tree. Filters scoped to "any" survey contribute no ids, and nested segment filters are not
 * followed: `findSegmentSurveyFilterViolation` covers both (ENG-6870).
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
 * Ensures every id in `surveyIds` is a survey of `workspaceId` that `visibleSurveyWhere` admits (the
 * caller's visibility predicate, `getUserVisibleSurveyWhere`), in bounded batches — one query per
 * batch, never one per survey. A caller that has already passed `workspace.write` on that workspace and
 * is admitted here holds `survey.write` on each of them: the predicate admits a workspace-visible survey,
 * the owner's own restricted or pending one, or any survey for an organization owner/manager — the three
 * arms of `survey#write` (ENG-3282). An id it does not admit is rejected exactly like an unknown one.
 * @throws {InvalidInputError} When a survey is not found in the workspace or not visible to the caller
 */
const findSurveysInWorkspace = (
  surveyIds: ReadonlyArray<string>,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
) =>
  prisma.survey.findMany({
    where: { id: { in: [...surveyIds] }, workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
    select: { id: true },
  });

export const assertSurveysInWorkspace = async (
  surveyIds: ReadonlyArray<string>,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput = {}
) => {
  const uniqueIds = Array.from(new Set(surveyIds));

  for (let i = 0; i < uniqueIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
    // Sequential on purpose: the first missing id rejects before any further query runs.
    const foundSurveys = await findSurveysInWorkspace(batch, workspaceId, visibleSurveyWhere); // NOSONAR

    const foundIds = new Set(foundSurveys.map((survey) => survey.id));
    const missingId = batch.find((id) => !foundIds.has(id));

    if (missingId) {
      throw new InvalidInputError(`Survey not found in workspace: ${missingId}`);
    }
  }
};

/**
 * Ensures every survey referenced by a "specific" survey-interaction filter belongs to the given
 * workspace. This is the tenancy guard for interaction filters — the runtime evaluation query is
 * already workspace-scoped, but we reject unknown/foreign ids at write time to avoid persisting
 * dead references. The deduplicated ids are looked up in bounded batches, sequentially: each batch
 * is checked before the next query runs, so the first missing id (in collection order) still
 * rejects, and no further queries are issued after a rejection. Callers pass ZSegmentFilters-parsed
 * trees, so the total is already capped (MAX_SEGMENT_SURVEY_INTERACTION_IDS_PER_TREE — a handful of
 * batches at most); the chunking is defense in depth for each query's parameter payload and for any
 * future caller that skips the parse.
 * @throws {InvalidInputError} When a referenced survey is not found in the workspace
 */
export const assertSurveyInteractionSurveyIds = (
  filters: TBaseFilters,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput = {}
) => assertSurveysInWorkspace(collectSurveyIdsFromSegmentFilters(filters), workspaceId, visibleSurveyWhere);

/**
 * `filters` as saved, with the stored survey ids this caller may not see put back into the filters
 * they came from (see `restoreHiddenSurveyIds`). One query over the stored tree's ids.
 */
export const restoreHiddenSegmentSurveyIds = async (
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<TBaseFilters> => {
  const storedIds = [...new Set(collectSegmentFilterSurveyIds(storedFilters))];
  if (storedIds.length === 0) return filters;
  const visible = await prisma.survey.findMany({
    where: { AND: [{ workspaceId, id: { in: storedIds } }, visibleSurveyWhere] },
    select: { id: true },
  });
  return restoreHiddenSurveyIds(filters, storedFilters, new Set(visible.map((survey) => survey.id)));
};

/** What a filter tree's survey-interaction filters read, once its nested segment filters are followed. */
type TSegmentSurveyReach = { surveyIds: Set<string>; anySurvey: boolean };

const collectSegmentSurveyReach = async (
  filters: TBaseFilters,
  workspaceId: string,
  reach: TSegmentSurveyReach,
  visitedSegmentIds: Set<string>
): Promise<void> => {
  for (const { resource } of filters) {
    if (!isResourceFilter(resource)) {
      await collectSegmentSurveyReach(resource, workspaceId, reach, visitedSegmentIds);
      continue;
    }

    if (resource.root.type === "surveyInteraction") {
      const { value } = resource as TSegmentSurveyInteractionFilter;
      if (value.surveyScope === "any") reach.anySurvey = true;
      else for (const surveyId of value.surveyIds) reach.surveyIds.add(surveyId);
      continue;
    }

    if (resource.root.type !== "segment") continue;

    const { segmentId } = resource.root;
    if (visitedSegmentIds.has(segmentId)) continue;
    visitedSegmentIds.add(segmentId);

    let nested: Awaited<ReturnType<typeof getSegment>>;
    try {
      nested = await getSegment(segmentId);
    } catch (error) {
      // A dangling reference matches nobody and reads no survey.
      if (error instanceof ResourceNotFoundError) continue;
      throw error;
    }

    // Evaluation ignores another workspace's segment (`buildSegmentFilterWhereClause`), so its filters
    // read nothing here either.
    if (nested.workspaceId !== workspaceId) continue;

    await collectSegmentSurveyReach(nested.filters, workspaceId, reach, visitedSegmentIds);
  }
};

const findHiddenSurvey = (where: Prisma.SurveyWhereInput) =>
  prisma.survey.findFirst({ where, select: { id: true } });

/**
 * Why a caller may not evaluate a filter tree, if they may not:
 * - `hiddenSurvey`: a survey-interaction filter names a survey hidden from the caller;
 * - `anySurveyWithHiddenSurveys`: a filter is scoped to `any` survey while the workspace holds a survey
 *   hidden from the caller.
 */
export type TSegmentSurveyFilterViolation = "hiddenSurvey" | "anySurveyWithHiddenSurveys";

/**
 * ENG-6870: a survey-interaction filter reads who saw, started or completed a survey, so evaluating one
 * for a caller tells them that about every survey it reads. The caller must therefore see every survey
 * the tree reads: each `specific` id, at any depth and through nested segment filters, and for an
 * `any`-scoped filter every survey in the workspace. Returns the first violation, or `null` when the
 * caller may evaluate the tree.
 *
 * Applies `buildHiddenSurveyWhere`, so an organization owner or manager, or a workspace without hidden
 * surveys, never pays more than the nested-segment lookups (which `getSegment`'s request cache shares
 * with the evaluation that follows). Otherwise it is one query for `any`, or one per batch of ids.
 *
 * @param segmentId - the segment whose filters these are, if saved, so a self-reference is not followed
 */
export const findSegmentSurveyFilterViolation = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<TSegmentSurveyFilterViolation | null> => {
  const hiddenSurveyWhere = buildHiddenSurveyWhere(actor);
  if (!hiddenSurveyWhere) return null;

  const reach: TSegmentSurveyReach = { surveyIds: new Set(), anySurvey: false };
  await collectSegmentSurveyReach(filters, workspaceId, reach, new Set(segmentId ? [segmentId] : []));

  if (reach.anySurvey) {
    // With no hidden survey in the workspace, no `specific` id can name one either.
    const hiddenSurvey = await findHiddenSurvey({ workspaceId, AND: [hiddenSurveyWhere] });
    return hiddenSurvey ? "anySurveyWithHiddenSurveys" : null;
  }

  const surveyIds = [...reach.surveyIds];
  for (let i = 0; i < surveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
    const batch = surveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
    // Sequential on purpose: the first hidden survey decides, and no further query runs.
    const batchWhere: Prisma.SurveyWhereInput = { id: { in: batch }, workspaceId, AND: [hiddenSurveyWhere] };
    if (await findHiddenSurvey(batchWhere)) return "hiddenSurvey"; // NOSONAR
  }

  return null;
};

const SEGMENT_SURVEY_FILTER_VIOLATION_MESSAGES: Record<TSegmentSurveyFilterViolation, string> = {
  hiddenSurvey: "Segment filters reference a survey you don't have access to",
  anySurveyWithHiddenSurveys:
    "Filtering on any survey requires access to every survey in this workspace; pick specific surveys instead",
};

/**
 * `findSegmentSurveyFilterViolation` for a write: a caller may only save survey-interaction filters they
 * could evaluate themselves.
 * @throws {InvalidInputError} When the caller may not evaluate the filters
 */
export const assertSegmentSurveyFiltersVisible = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<void> => {
  const violation = await findSegmentSurveyFilterViolation(filters, workspaceId, actor, segmentId);
  if (violation) throw new InvalidInputError(SEGMENT_SURVEY_FILTER_VIOLATION_MESSAGES[violation]);
};
