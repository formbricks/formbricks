import "server-only";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { type TSegment, type TSegmentUpdateInput, ZSegmentFilters } from "@formbricks/types/segment";
import { forbidOnRefusal, refusalResponse } from "@/app/api/internal/lib/refusal";
import { type TWorkspaceAction, requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { capturePostHogEvent } from "@/lib/posthog";
import { loadNewSegmentInSurvey } from "@/lib/survey/service";
import { getUserVisibleSurveyWhere, resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import {
  getOrganizationIdFromSegmentId,
  getOrganizationIdFromSurveyId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromContactAttributeKeyId,
  getWorkspaceIdFromSegmentId,
  getWorkspaceIdFromSurveyId,
} from "@/lib/utils/helper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getDistinctAttributeValues } from "@/modules/ee/contacts/lib/contact-attributes";
import {
  assertCanTargetWithSegment,
  checkAdvancedTargetingPermission,
} from "@/modules/ee/contacts/segments/lib/access";
import {
  assertAddedSegmentSurveyFiltersVisible,
  assertSegmentSurveyFiltersVisible,
  assertSurveyInteractionSurveyIds,
  assertSurveysInWorkspace,
  checkForRecursiveSegmentFilter,
  restoreHiddenSegmentSurveyIds,
} from "@/modules/ee/contacts/segments/lib/helper";
import {
  cloneSegment,
  createSegment,
  deleteSegment,
  getSegment,
  getSurveyRefsForWorkspace,
  getSurveyWorkspaceIdMap,
  resetSegmentInSurvey,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import type { TSegmentCreateBody, TSegmentUpdateBody } from "../schemas";
import {
  type TSegmentFilterSurveyResource,
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
 */

type TRequestContext = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

const SAME_WORKSPACE_MESSAGE = "Survey and segment are not in the same workspace";

/** The message the server actions refused an invalid filter tree with: its first custom issue. */
const invalidFiltersMessage = (issues: { code: string; message: string }[]) =>
  issues.find((issue) => issue.code === "custom")?.message || "Invalid filters";

/** A service's refusal as its 403 or 422 (see `refusalResponse`); any other error is rethrown. */
export const SEGMENT_TITLE_TAKEN = "A segment with this title already exists in this workspace.";

/**
 * Whether a failed create or rename lost to the workspace's unique title: the service reports the unique-key
 * clash as a generic database error, so the route looks for the other segment holding the title.
 */
const isSegmentTitleTaken = async (
  error: unknown,
  workspaceId: string,
  title: string | undefined,
  exceptSegmentId?: string
): Promise<boolean> =>
  error instanceof DatabaseError &&
  title !== undefined &&
  (await prisma.segment.count({
    where: { workspaceId, title, ...(exceptSegmentId ? { id: { not: exceptSegmentId } } : {}) },
  })) > 0;

const segmentTitleTaken = ({ requestId, instance }: TRequestContext): Response =>
  problemConflict(requestId, SEGMENT_TITLE_TAKEN, instance);

const refusalOrThrow = (error: unknown, { requestId, instance }: TRequestContext): Response => {
  const refused = refusalResponse(error, requestId, instance);
  if (refused) return refused;
  throw error;
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
    await assertSurveyInteractionSurveyIds(
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
    if (await isSegmentTitleTaken(error, workspaceId, body.title)) return segmentTitleTaken(context);
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
 * `PATCH /api/internal/segments/{segmentId}`: change a segment, or connect surveys to it. Every connected
 * survey must be in the segment's workspace (ENG-1920) and visible to the caller; the stored survey ids
 * the caller can't see are kept in its filters; the saved tree is held to the filter bounds and may not
 * refer to the segment itself. Audited as `updated`, from the segment as it was to the segment as saved.
 */
export async function updateSegmentOperation({
  segmentId,
  body,
  ...context
}: TRequestContext & { segmentId: string; body: TSegmentUpdateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromSegmentId(segmentId);
  const workspaceId = await getWorkspaceIdFromSegmentId(segmentId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;
  const { userId } = access;

  // ENG-1920: the surveys are connected by id alone, so every one must belong to the segment's workspace,
  // in one batched lookup; an unknown id is absent from the map and refused the same way.
  if (body.surveys && body.surveys.length > 0) {
    const surveyWorkspaceIdMap = await getSurveyWorkspaceIdMap(body.surveys);
    if (!body.surveys.every((surveyId) => surveyWorkspaceIdMap.get(surveyId) === workspaceId)) {
      return problemUnprocessableContent(requestId, SAME_WORKSPACE_MESSAGE, { instance });
    }
  }

  let oldObject: TSegment;
  let updated: TSegment;
  try {
    const visibleSurveyWhere = await getUserVisibleSurveyWhere(userId, organizationId);
    const isVisibilityScoped = Object.keys(visibleSurveyWhere).length > 0;
    if (body.surveys?.length && isVisibilityScoped) {
      await assertSurveysInWorkspace(body.surveys, workspaceId, visibleSurveyWhere);
    }

    oldObject = await getSegment(segmentId);
    const actor = await resolveSurveyActorContext({ type: "user", id: userId }, organizationId);
    let data: TSegmentUpdateInput = body;
    const { filters } = body;
    if (filters) {
      // Only the ids the caller sent must be visible to them; the stored ones they could not see are put
      // back afterwards, since the editor never held them.
      await assertSurveyInteractionSurveyIds(filters, workspaceId, visibleSurveyWhere);
      // ENG-6870: and the surveys nested segment filters read, where the edit adds them.
      await assertAddedSegmentSurveyFiltersVisible(filters, oldObject.filters, workspaceId, actor, segmentId);
      const merged = isVisibilityScoped
        ? await restoreHiddenSegmentSurveyIds(filters, oldObject.filters, workspaceId, visibleSurveyWhere)
        : filters;

      // The merged tree is what gets stored, so it is the one held to the bounds.
      const parsedFilters = ZSegmentFilters.safeParse(merged);
      if (!parsedFilters.success) {
        throw new InvalidInputError(invalidFiltersMessage(parsedFilters.error.issues));
      }

      await checkForRecursiveSegmentFilter(parsedFilters.data, segmentId);
      data = { ...body, filters: parsedFilters.data };
    }

    // ENG-6870: connecting a survey targets it with the whole stored tree, as attaching one does.
    const connectedSurveyIds = new Set(oldObject.surveys);
    if (body.surveys?.some((surveyId) => !connectedSurveyIds.has(surveyId))) {
      await assertSegmentSurveyFiltersVisible(
        data.filters ?? oldObject.filters,
        workspaceId,
        actor,
        segmentId
      );
    }

    updated = await updateSegment(segmentId, data);
  } catch (error) {
    if (await isSegmentTitleTaken(error, workspaceId, body.title, segmentId))
      return segmentTitleTaken(context);
    return refusalOrThrow(error, context);
  }

  if (auditLog) {
    auditLog.organizationId = organizationId;
    auditLog.targetId = segmentId;
    auditLog.oldObject = oldObject;
    auditLog.newObject = updated;
  }
  return successResponse(serializeSegment(updated), { requestId });
}

/**
 * A survey-segment write: the caller needs write access to the survey's workspace, its budget and the
 * licence, and `survey.write` on the survey; only then must the segment share the survey's workspace (a
 * segment from another one gets the uniform 403, the same as one the caller can't see: the targeting card
 * only offers its own workspace's segments); and sight of every survey the segment's filters read
 * (ENG-6870). Answers with the caller and the survey's organization.
 */
async function requireSurveySegmentWrite(
  context: TRequestContext,
  { surveyId, segmentId }: { surveyId: string; segmentId: string }
): Promise<Response | { userId: string; organizationId: string }> {
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

  if ((await getWorkspaceIdFromSegmentId(segmentId)) !== surveyWorkspaceId) {
    return problemForbidden(requestId, undefined, instance);
  }

  try {
    await assertCanTargetWithSegment(userId, organizationId, segmentId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  if (auditLog) auditLog.organizationId = organizationId;
  return { userId, organizationId };
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
    copy = await cloneSegment(segmentId, surveyId);
  } catch (error) {
    return refusalOrThrow(error, context);
  }

  if (auditLog) auditLog.newObject = copy;
  return successResponse(serializeSegment(copy), { requestId, status: 201 });
}

/**
 * `DELETE /api/internal/segments/{segmentId}`: delete a segment. One still connected to a survey is a 409
 * with the service's reason. Audited as `deleted`, with the segment as it was.
 */
export async function deleteSegmentOperation({
  segmentId,
  ...context
}: TRequestContext & { segmentId: string }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const organizationId = await getOrganizationIdFromSegmentId(segmentId);
  const workspaceId = await getWorkspaceIdFromSegmentId(segmentId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;

  try {
    const existing = await getSegment(segmentId);
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
  const resource: TSurveySegmentResource = { surveyId, segment: serializeSegment(survey.segment) };
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
 * `GET /api/internal/contact-attribute-keys/{contactAttributeKeyId}/values`: the first distinct values an
 * attribute has, for the segment editor's value picker. Read access to the key's workspace and the
 * advanced-targeting licence.
 */
export async function getContactAttributeKeyValuesOperation({
  contactAttributeKeyId,
  ...context
}: TRequestContext & { contactAttributeKeyId: string }): Promise<Response> {
  const workspaceId = await getWorkspaceIdFromContactAttributeKeyId(contactAttributeKeyId);
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.read",
  });
  if (access instanceof Response) return access;

  const values: string[] = await getDistinctAttributeValues(contactAttributeKeyId);
  return successResponse(values, { requestId: context.requestId });
}

/**
 * `GET /api/internal/workspaces/{workspaceId}/segment-filter-surveys`: the workspace's surveys a
 * survey-interaction filter can name, for the segment editor's survey picker: the ones the caller can see
 * (ENG-3282), most recently updated first, bounded. Read access and the advanced-targeting licence.
 */
export async function listSegmentFilterSurveysOperation({
  workspaceId,
  ...context
}: TRequestContext & { workspaceId: string }): Promise<Response> {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);

  const access = await requireSegmentAccess(context, {
    workspaceId,
    organizationId,
    action: "workspace.read",
  });
  if (access instanceof Response) return access;

  const surveys = await getSurveyRefsForWorkspace(
    workspaceId,
    await getUserVisibleSurveyWhere(access.userId, organizationId)
  );
  const resource: TSegmentFilterSurveyResource[] = surveys.map(({ id, name, status }) => ({
    id,
    name,
    status,
  }));
  return successResponse(resource, { requestId: context.requestId });
}
