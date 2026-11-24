import "server-only";
import { InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { type TSegment, type TSegmentUpdateInput, ZSegmentFilters } from "@formbricks/types/segment";
import { forbidOnRefusal, refusalResponse } from "@/app/api/internal/lib/refusal";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { type TWorkspaceAction, requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { loadNewSegmentInSurvey } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere, resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import {
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getDistinctAttributeValues } from "@/modules/ee/contacts/lib/contact-attributes";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  ContactDirectoryMissingError,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import {
  assertCanTargetWithSegment,
  checkAdvancedTargetingPermission,
} from "@/modules/ee/contacts/segments/lib/access";
import {
  assertAddedSegmentSurveyFiltersVisible,
  assertAddedSurveyInteractionSurveyIds,
  assertNewSegmentSurveyInteractionSurveyIds,
  assertSegmentSurveyFiltersVisible,
  assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter,
  restoreHiddenSegmentSurveyIds,
} from "@/modules/ee/contacts/segments/lib/helper";
import { SEGMENT_TITLE_TAKEN_ERROR_MESSAGE } from "@/modules/ee/contacts/segments/lib/segment-errors";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getOtherWorkspaceSurveyIds,
  getSegmentInWorkspace,
  getSurveyRefsForWorkspace,
  getSurveyWorkspaceIdMap,
  resetSegmentInSurvey,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import type { TSegmentCreateBody, TSegmentUpdateBody } from "../schemas";
import {
  type TSegmentFilterSurveysResource,
  type TSurveySegmentResource,
  serializeSegment,
} from "../serializers";

/**
 * Segments, for the segments page and the survey editor's targeting card, with the checks of the server
 * actions they replace, in their order: write (or read) access to the workspace, the workspace's
 * state-mutation budget for a write, then the advanced-targeting licence (403 with its reason). A survey a
 * write targets also needs `survey.write` (ENG-3282), and every survey the segment's filters read must be
 * visible to the caller (ENG-6870). The services' refusals answer 422 with their reason (filters that read a
 * survey the caller can't see, a survey from another workspace, a recursive filter), and a segment or
 * survey that is gone the uniform 403.
 *
 * A segment belongs to its contact directory and every workspace on it may use it (decision 24): a shared
 * one, or a private one of the workspace's own surveys. So the workspace always comes from the request (the
 * page's, or the survey's), never from the segment, whose own `workspaceId` only records where it was made.
 * A segment the workspace can't use answers the uniform 403, the same as one that doesn't exist.
 */

const SAME_WORKSPACE_MESSAGE = "Survey and segment are not in the same workspace";

/** The message the server actions refused an invalid filter tree with: its first custom issue. */
const invalidFiltersMessage = (issues: { code: string; message: string }[]) =>
  issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";

/** A service's refusal as its 403 or 422 (see `refusalResponse`); any other error is rethrown. */
export const SEGMENT_TITLE_TAKEN = "A segment with this title already exists in this workspace.";

/**
 * Whether a failed create or rename lost to the workspace's unique title, which the service refuses with
 * its own message. A conflict with existing state, so a 409 rather than the 422 of other invalid input.
 */
const isSegmentTitleTaken = (error: unknown): boolean =>
  error instanceof InvalidInputError && error.message === SEGMENT_TITLE_TAKEN_ERROR_MESSAGE;

const segmentTitleTaken = ({ requestId, instance }: TRequestContext): Response =>
  problemConflict(requestId, SEGMENT_TITLE_TAKEN, instance);

const refusalOrThrow = (error: unknown, { requestId, instance }: TRequestContext): Response => {
  // A workspace with no contact directory has no segments: 403 with the reason, as the caller was authorized.
  if (error instanceof ContactDirectoryMissingError)
    return problemForbidden(requestId, error.message, instance);
  const refused = refusalResponse(error, requestId, instance);
  if (refused) return refused;
  throw error;
};

/**
 * The segment as the caller's workspace may see it: a shared segment can target surveys of every workspace on
 * its directory, and the ids of another workspace's surveys never leave the server.
 */
const scopeSegmentToWorkspace = async (segment: TSegment, workspaceId: string): Promise<TSegment> => {
  if (segment.surveys.length === 0) return segment;
  const surveyWorkspaceIdMap = await getSurveyWorkspaceIdMap(segment.surveys);
  return {
    ...segment,
    surveys: segment.surveys.filter((surveyId) => surveyWorkspaceIdMap.get(surveyId) === workspaceId),
  };
};

/**
 * Authorize `action` on the workspace, charge its state-mutation budget for a write, then check the
 * advanced-targeting licence ("Advanced targeting is not allowed for this organization", or the uniform 403
 * for an organization that is gone).
 */
async function requireSegmentAccess(
  context: TRequestContext,
  {
    workspaceId,
    organizationId,
    action,
  }: { workspaceId: string; organizationId: string; action: TWorkspaceAction }
): Promise<Response | { userId: string }> {
  const { authentication, requestId, instance } = context;
  const access = await requireWorkspaceActionAccess({
    authentication,
    workspaceId,
    action,
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  if (action === "workspace.write") {
    const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, {
      requestId,
      instance,
    });
    if (limited) return limited;
  }

  const notLicensed = await forbidOnRefusal(
    () => checkAdvancedTargetingPermission(organizationId),
    requestId,
    instance
  );
  if (notLicensed) return notLicensed;

  return { userId: access.userId };
}

/** `survey.write` on one survey a segment write targets (ENG-3282): the uniform 403 without it. */
const requireSurveyWrite = async (
  userId: string,
  surveyId: string,
  { requestId, instance }: TRequestContext
) =>
  (await can({ type: "user", id: userId }, "survey.write", { type: "survey", id: surveyId }))
    ? null
    : problemForbidden(requestId, undefined, instance);

/**
 * `POST /api/internal/segments`: create a segment, optionally for one survey (the survey editor's private
 * segment, or "save as new segment"). Audited as `created`, captured in PostHog as `segment_created`.
 */
export async function createSegmentOperation({
  body,
  ...context
}: TRequestContext & { body: TSegmentCreateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const { workspaceId } = body;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  // Compared only once the caller may write to both: before, a caller with no access learned whether the
  // two ids share a workspace from the 422.
  if (body.surveyId) {
    const refused = await requireSurveyWrite(userId, body.surveyId, context);
    if (refused) return refused;
    if ((await getWorkspaceIdFromSurveyId(body.surveyId)) !== workspaceId) {
      return problemUnprocessableContent(requestId, SAME_WORKSPACE_MESSAGE, { instance });
    }
  }

  let segment: TSegment;
  try {
    // As for an edit, a survey id copied from a segment the workspace reaches may name another workspace's
    // survey on the directory ("Save as new segment"); every other id must be the caller's to see.
    await assertNewSegmentSurveyInteractionSurveyIds(
      body.filters,
      workspaceId,
      await getUserVisibleSurveyWhere(userId, organizationId)
    );
    // ENG-6870: and the surveys nested segment filters read.
    await assertSegmentSurveyFiltersVisible(
      body.filters,
      workspaceId,
      await resolveSurveyActorContext({ type: "user", id: userId }, organizationId)
    );

    segment = await createSegment({ ...body, surveyId: body.surveyId ?? "" });
  } catch (error) {
    if (isSegmentTitleTaken(error)) return segmentTitleTaken(context);
    return refusalOrThrow(error, context);
  }

  if (auditLog) {
    auditLog.targetId = segment.id;
    auditLog.newObject = segment;
  }

  capturePostHogEvent(
    userId,
    "segment_created",
    { organization_id: organizationId, workspace_id: workspaceId, is_private: body.isPrivate ?? false },
    { organizationId, workspaceId }
  );

  return successResponse(serializeSegment(segment), { requestId, status: 201 });
}

/**
 * `PATCH /api/internal/segments/{segmentId}?workspaceId=`: change a segment the workspace can use, or connect
 * surveys to it. A survey the edit connects must be in the caller's workspace (ENG-1920) and visible to the
 * caller; the ones already connected stay (a shared segment can target another workspace's survey). Only the
 * survey ids the edit adds to the filters must be the caller's to see; the stored ones stay. The saved tree
 * is held to the filter bounds and may not refer to the segment itself. Audited as `updated`, from the
 * segment as it was to the segment as saved.
 */
export async function updateSegmentOperation({
  segmentId,
  workspaceId,
  body,
  ...context
}: TRequestContext & {
  segmentId: string;
  workspaceId: string;
  body: TSegmentUpdateBody;
}): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  let oldObject: TSegment;
  try {
    oldObject = await getSegmentInWorkspace(segmentId, workspaceId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  // ENG-1920: the surveys are connected by id alone, so a survey the segment is not on yet must belong to
  // the caller's workspace — otherwise a caller could re-point another tenant's survey to their segment, or
  // a survey of another workspace on the directory they cannot write. One batched lookup; an unknown id is
  // absent from the map and refused the same way.
  const connectedSurveyIds = new Set(oldObject.surveys);
  const addedSurveyIds = (body.surveys ?? []).filter((surveyId) => !connectedSurveyIds.has(surveyId));
  if (addedSurveyIds.length > 0) {
    const surveyWorkspaceIdMap = await getSurveyWorkspaceIdMap(addedSurveyIds);
    if (!addedSurveyIds.every((surveyId) => surveyWorkspaceIdMap.get(surveyId) === workspaceId)) {
      return problemUnprocessableContent(requestId, SAME_WORKSPACE_MESSAGE, { instance });
    }
  }

  let updated: TSegment;
  try {
    const visibleSurveyWhere = await getUserVisibleSurveyWhere(userId, organizationId);
    const isVisibilityScoped = Object.keys(visibleSurveyWhere).length > 0;
    if (addedSurveyIds.length > 0 && isVisibilityScoped) {
      await assertSurveysInWorkspace(addedSurveyIds, workspaceId, visibleSurveyWhere);
    }

    const actor = await resolveSurveyActorContext({ type: "user", id: userId }, organizationId);
    const data: TSegmentUpdateInput = body.filters
      ? {
          ...body,
          filters: await prepareEditedFilters(body.filters, oldObject, {
            segmentId,
            workspaceId,
            actor,
            visibleSurveyWhere,
          }),
        }
      : body;

    // ENG-6870: connecting a survey targets it with the whole stored tree, as attaching one does.
    if (addedSurveyIds.length > 0) {
      await assertSegmentSurveyFiltersVisible(
        data.filters ?? oldObject.filters,
        workspaceId,
        actor,
        segmentId
      );
    }

    updated = await updateSegment(segmentId, data);
  } catch (error) {
    if (isSegmentTitleTaken(error)) return segmentTitleTaken(context);
    return refusalOrThrow(error, context);
  }

  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = segmentId;
    auditLog.oldObject = oldObject;
    auditLog.newObject = updated;
  }
  return successResponse(serializeSegment(await scopeSegmentToWorkspace(updated, workspaceId)), {
    requestId,
  });
}

/**
 * The filter tree an edit stores. Only the ids the caller added must be surveys of their workspace they can
 * see; the stored ones stay (a shared segment can name another workspace's survey), and the stored ones they
 * could not see are put back afterwards, since the editor never held them. The merged tree is what gets
 * stored, so it is the one held to the bounds and checked for recursion.
 */
async function prepareEditedFilters(
  filters: NonNullable<TSegmentUpdateBody["filters"]>,
  oldObject: TSegment,
  {
    segmentId,
    workspaceId,
    actor,
    visibleSurveyWhere,
  }: {
    segmentId: string;
    workspaceId: string;
    actor: Awaited<ReturnType<typeof resolveSurveyActorContext>>;
    visibleSurveyWhere: Awaited<ReturnType<typeof getUserVisibleSurveyWhere>>;
  }
): Promise<TSegment["filters"]> {
  await assertAddedSurveyInteractionSurveyIds(filters, oldObject.filters, workspaceId, visibleSurveyWhere);
  // ENG-6870: and the surveys nested segment filters read, where the edit adds them.
  await assertAddedSegmentSurveyFiltersVisible(filters, oldObject.filters, workspaceId, actor, segmentId);
  const merged =
    Object.keys(visibleSurveyWhere).length > 0
      ? await restoreHiddenSegmentSurveyIds(filters, oldObject.filters, workspaceId, visibleSurveyWhere)
      : filters;

  const parsedFilters = ZSegmentFilters.safeParse(merged);
  if (!parsedFilters.success) {
    throw new InvalidInputError(invalidFiltersMessage(parsedFilters.error.issues));
  }
  await checkForRecursiveSegmentFilter(parsedFilters.data, segmentId);
  return parsedFilters.data;
}

/**
 * A survey-segment write: the caller needs write access to the survey's workspace, its budget and the
 * licence, and `survey.write` on the survey; only then must the survey's workspace be able to use the
 * segment (one of its contact directory, decision 24; any other gets the uniform 403, the same as one the
 * caller can't see); and sight of every survey the segment's filters read (ENG-6870). Answers with the
 * caller, the survey's organization and its workspace.
 */
async function requireSurveySegmentWrite(
  context: TRequestContext,
  { surveyId, segmentId }: { surveyId: string; segmentId: string }
): Promise<Response | { userId: string; organizationId: string; workspaceId: string }> {
  const { requestId, instance, auditLog } = context;
  const surveyWorkspaceId = await getWorkspaceIdFromSurveyId(surveyId);
  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const access = await requireSegmentAccess(context, {
    workspaceId: surveyWorkspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  const surveyRefused = await requireSurveyWrite(userId, surveyId, context);
  if (surveyRefused) return surveyRefused;

  try {
    const segment = await getSegmentInWorkspace(segmentId, surveyWorkspaceId);
    await assertCanTargetWithSegment(userId, organizationId, segment, surveyWorkspaceId);
  } catch (error) {
    // No directory: no segment of it to use, the same 403 as one the caller can't see.
    if (error instanceof ContactDirectoryMissingError)
      return problemForbidden(requestId, undefined, instance);
    return refusalOrThrow(error, context);
  }

  if (auditLog) auditLog.organizationId = organizationId;
  return { userId, organizationId, workspaceId: surveyWorkspaceId };
}

/**
 * `POST /api/internal/segments/{segmentId}/copies`: copy a segment and attach the copy to a survey ("Clone
 * & edit" in the targeting card). Audited as `created`, on the segment copied, with the copy.
 */
export async function copySegmentOperation({
  segmentId,
  surveyId,
  ...context
}: TRequestContext & { segmentId: string; surveyId: string }): Promise<Response> {
  const { requestId, auditLog } = context;
  const access = await requireSurveySegmentWrite(context, { surveyId, segmentId });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.targetId = segmentId;

  let copy: TSegment;
  try {
    copy = await cloneSegment(segmentId, surveyId, access.workspaceId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  if (auditLog) auditLog.newObject = copy;
  return successResponse(serializeSegment(copy), { requestId, status: 201 });
}

/**
 * `DELETE /api/internal/segments/{segmentId}?workspaceId=`: delete a segment the workspace can use. One still
 * connected to a survey is a 409 with the service's reason. Audited as `deleted`, with the segment as it was.
 */
export async function deleteSegmentOperation({
  segmentId,
  workspaceId,
  ...context
}: TRequestContext & { segmentId: string; workspaceId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;

  try {
    const existing = await getSegmentInWorkspace(segmentId, workspaceId);
    if (auditLog) {
      auditLog.targetId = segmentId;
      auditLog.oldObject = existing;
      auditLog.organizationId = organizationId;
    }
    await deleteSegment(segmentId);
  } catch (error) {
    // "Cannot delete a segment that is associated with a survey".
    if (error instanceof OperationNotAllowedError) return problemConflict(requestId, error.message, instance);
    return refusalOrThrow(error, context);
  }

  return noContentResponse({ requestId });
}

/**
 * `PUT /api/internal/surveys/{surveyId}/segment`: make a survey target a saved segment ("Load segment" in the
 * targeting card); the survey's own private segment is dropped. Audited as an update of the survey, with
 * the survey as saved.
 */
export async function attachSurveySegmentOperation({
  surveyId,
  segmentId,
  ...context
}: TRequestContext & { surveyId: string; segmentId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const access = await requireSurveySegmentWrite(context, { surveyId, segmentId });
  if (access instanceof Response) return access;

  if (auditLog) auditLog.targetId = surveyId;

  let survey: Awaited<ReturnType<typeof loadNewSegmentInSurvey>>;
  try {
    survey = await loadNewSegmentInSurvey(surveyId, segmentId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  if (auditLog) auditLog.newObject = survey;
  // The survey keeps the segment just connected; none would mean it was changed meanwhile.
  if (!survey.segment) return problemForbidden(requestId, undefined, instance);
  const resource: TSurveySegmentResource = {
    surveyId,
    segment: serializeSegment(await scopeSegmentToWorkspace(survey.segment, access.workspaceId)),
  };
  return successResponse(resource, { requestId });
}

/**
 * `POST /api/internal/surveys/{surveyId}/segment/resets`: give the survey back its own private segment with
 * no filters ("Reset all filters" in the targeting card). Audited as an update of that segment.
 */
export async function resetSurveySegmentOperation({
  surveyId,
  ...context
}: TRequestContext & { surveyId: string }): Promise<Response> {
  const { requestId, auditLog } = context;
  const organizationId = await getOrganizationIdFromSurveyId(surveyId);
  const workspaceId = await getWorkspaceIdFromSurveyId(surveyId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;

  const surveyRefused = await requireSurveyWrite(access.userId, surveyId, context);
  if (surveyRefused) return surveyRefused;

  if (auditLog) auditLog.organizationId = organizationId;

  let segment: TSegment;
  try {
    segment = await resetSegmentInSurvey(surveyId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  if (auditLog) {
    auditLog.newObject = segment;
    auditLog.targetId = segment.id;
  }
  const resource: TSurveySegmentResource = { surveyId, segment: serializeSegment(segment) };
  return successResponse(resource, { requestId });
}

/**
 * `GET /api/internal/contact-attribute-keys/{contactAttributeKeyId}/values?workspaceId=`: the first distinct
 * values an attribute has among the contacts of the workspace's directory, for the segment editor's value
 * picker. A key belongs to the directory and records only the workspace it was made from (none for a
 * directory's default keys), so the caller names the workspace they act from: read access to it and the
 * advanced-targeting licence. A key of another directory has no values here.
 */
export async function getContactAttributeKeyValuesOperation({
  contactAttributeKeyId,
  workspaceId,
  ...context
}: TRequestContext & { contactAttributeKeyId: string; workspaceId: string }): Promise<Response> {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.read",
  });
  if (access instanceof Response) return access;

  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (!directory) {
    return problemForbidden(context.requestId, CONTACT_DIRECTORY_MISSING_MESSAGE, context.instance);
  }

  const values: string[] = await getDistinctAttributeValues(contactAttributeKeyId, directory.id);
  return successResponse(values, { requestId: context.requestId });
}

/**
 * `GET /api/internal/workspaces/{workspaceId}/segment-filter-surveys`: the workspace's surveys a
 * survey-interaction filter can name, for the segment editor's survey picker: the ones the caller can see
 * (ENG-3282), most recently updated first, bounded. Also which of `surveyIds` (the ids the filter already
 * names) are surveys of another workspace on the directory, so the picker shows them as such (decision 24);
 * ids only, as the caller may not see those surveys. Read access and the advanced-targeting licence.
 */
export async function listSegmentFilterSurveysOperation({
  workspaceId,
  surveyIds,
  ...context
}: TRequestContext & { workspaceId: string; surveyIds: string[] }): Promise<Response> {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.read",
  });
  if (access instanceof Response) return access;

  const [surveys, otherWorkspaceSurveyIds] = await Promise.all([
    getSurveyRefsForWorkspace(workspaceId, await getUserVisibleSurveyWhere(access.userId, organizationId)),
    getOtherWorkspaceSurveyIds(workspaceId, surveyIds),
  ]);
  const resource: TSegmentFilterSurveysResource = {
    surveys: surveys.map(({ id, name, status }) => ({ id, name, status })),
    otherWorkspaceSurveyIds,
  };
  return successResponse(resource, { requestId: context.requestId });
}
