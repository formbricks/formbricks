import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
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
 * filter tree. Filters scoped to "any" survey contribute no ids (they only read workspace-visible
 * surveys), and nested segment filters are not followed: `segmentFiltersReadHiddenSurvey` does (ENG-6870).
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

/**
 * Every survey id the tree's `specific` survey-interaction filters name, at any depth and through nested
 * segment filters, the way evaluation resolves them (`buildSegmentFilterWhereClause`): a segment is
 * followed once, and a missing one or another workspace's reads nothing.
 */
const collectReachableSurveyIds = async (
  filters: TBaseFilters,
  workspaceId: string,
  surveyIds: Set<string>,
  visitedSegmentIds: Set<string>
): Promise<void> => {
  // Draft saves skip filter validation (`updateSurveyDraft`), so every node is read defensively: a
  // half-built one names no survey.
  if (!Array.isArray(filters)) return;
  for (const filter of filters) {
    const resource = filter?.resource;
    if (!resource) continue;
    if (Array.isArray(resource)) {
      await collectReachableSurveyIds(resource, workspaceId, surveyIds, visitedSegmentIds);
      continue;
    }
    if (!isResourceFilter(resource)) continue;

    if (resource.root?.type === "surveyInteraction") {
      const { value } = resource as Partial<TSegmentSurveyInteractionFilter>;
      // `any` scope only reads workspace-visible surveys (see `survey-interaction.ts`).
      if (value?.surveyScope !== "specific" || !Array.isArray(value.surveyIds)) continue;
      for (const surveyId of value.surveyIds) if (typeof surveyId === "string") surveyIds.add(surveyId);
      continue;
    }

    if (resource.root?.type !== "segment") continue;

    const { segmentId } = resource.root;
    if (typeof segmentId !== "string" || visitedSegmentIds.has(segmentId)) continue;
    visitedSegmentIds.add(segmentId);

    let nested: Awaited<ReturnType<typeof getSegment>>;
    try {
      nested = await getSegment(segmentId);
    } catch (error) {
      // A dangling or malformed reference matches nobody and reads no survey.
      if (error instanceof ResourceNotFoundError || error instanceof ValidationError) continue;
      throw error;
    }
    if (nested.workspaceId !== workspaceId) continue;

    await collectReachableSurveyIds(nested.filters, workspaceId, surveyIds, visitedSegmentIds);
  }
};

const findHiddenSurvey = (where: Prisma.SurveyWhereInput) =>
  prisma.survey.findFirst({ where, select: { id: true } });

/** `collectReachableSurveyIds` from the top of a tree. */
const getReachableSurveyIds = async (
  filters: TBaseFilters,
  workspaceId: string,
  segmentId?: string
): Promise<Set<string>> => {
  const reachable = new Set<string>();
  await collectReachableSurveyIds(filters, workspaceId, reachable, new Set(segmentId ? [segmentId] : []));
  return reachable;
};

/** Whether any of `surveyIds` is a survey of `workspaceId` that `buildHiddenSurveyWhere` hides from `actor`. */
const anySurveyHiddenFrom = async (
  surveyIds: ReadonlyArray<string>,
  workspaceId: string,
  hiddenSurveyWhere: Prisma.SurveyWhereInput
): Promise<boolean> => {
  for (let i = 0; i < surveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
    const batch = surveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
    // Sequential on purpose: the first hidden survey decides, and no further query runs.
    const batchWhere: Prisma.SurveyWhereInput = { id: { in: batch }, workspaceId, AND: [hiddenSurveyWhere] };
    if (await findHiddenSurvey(batchWhere)) return true; // NOSONAR
  }
  return false;
};

/**
 * ENG-6870: whether evaluating `filters` would tell `actor` who saw, started or completed a survey hidden
 * from them — that is, whether any survey the tree names, directly or through nested segment filters, is
 * one `buildHiddenSurveyWhere` hides from `actor`. Listing a segment's contacts, or targeting a survey
 * whose responses the actor reads, is only allowed when it is not.
 *
 * An organization owner or manager sees every survey and costs no query. Otherwise it is the nested
 * segment lookups (which `getSegment`'s request cache shares with the evaluation that follows) and one
 * query per batch of ids.
 *
 * @param segmentId - the segment whose filters these are, if saved, so a self-reference is not followed
 */
export const segmentFiltersReadHiddenSurvey = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<boolean> => {
  const hiddenSurveyWhere = buildHiddenSurveyWhere(actor);
  if (!hiddenSurveyWhere) return false;
  const reachable = await getReachableSurveyIds(filters, workspaceId, segmentId);
  return anySurveyHiddenFrom([...reachable], workspaceId, hiddenSurveyWhere);
};

export const SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE =
  "Segment filters reference a survey you don't have access to";

/**
 * `segmentFiltersReadHiddenSurvey` for a write: a caller may only save, attach or copy survey-interaction
 * filters they could evaluate themselves.
 * @throws {InvalidInputError} When the filters read a survey hidden from the caller
 */
export const assertSegmentSurveyFiltersVisible = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<void> => {
  if (await segmentFiltersReadHiddenSurvey(filters, workspaceId, actor, segmentId)) {
    throw new InvalidInputError(SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE);
  }
};

/** The survey ids `filters` reads that `storedFilters` did not, nested segments followed in both. */
export const getAddedSegmentSurveyIds = async (
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  workspaceId: string,
  segmentId?: string
): Promise<string[]> => {
  const [next, stored] = await Promise.all([
    getReachableSurveyIds(filters, workspaceId, segmentId),
    getReachableSurveyIds(storedFilters, workspaceId, segmentId),
  ]);
  return [...next].filter((surveyId) => !stored.has(surveyId));
};

/**
 * `assertSegmentSurveyFiltersVisible` for an edit of a tree that is already stored: only the surveys the
 * edit adds — named directly or through a nested segment it adds — must be visible to the caller. A
 * survey the stored tree already read stays, as `restoreHiddenSegmentSurveyIds` keeps it: the caller did
 * not add it, and refusing it would stop them editing anything else in a segment an administrator wrote.
 * @throws {InvalidInputError} When the edit adds a survey hidden from the caller
 */
export const assertAddedSegmentSurveyFiltersVisible = async (
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<void> => {
  const hiddenSurveyWhere = buildHiddenSurveyWhere(actor);
  if (!hiddenSurveyWhere) return;
  const added = await getAddedSegmentSurveyIds(filters, storedFilters, workspaceId, segmentId);
  if (await anySurveyHiddenFrom(added, workspaceId, hiddenSurveyWhere)) {
    throw new InvalidInputError(SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE);
  }
};
