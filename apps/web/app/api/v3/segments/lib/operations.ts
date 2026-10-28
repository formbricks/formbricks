import "server-only";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TBaseFilters } from "@formbricks/types/segment";
import { requireV3ContactsAccess } from "@/app/api/v3/contacts/lib/access";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { computeFilterFingerprint, decodeKeysetCursor } from "@/app/api/v3/lib/keyset-cursor";
import {
  createdResponse,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { resolveV3ResponsesActorContext } from "@/app/api/v3/responses/lib/visibility";
import { V3SurveyReferenceValidationError } from "@/app/api/v3/surveys/reference-validation";
import { assertV3SurveyTargetingFilterReferences } from "@/app/api/v3/surveys/targeting";
import { buildVisibleSurveyWhere } from "@/lib/survey/visibility/predicate";
import { checkForRecursiveSegmentFilter } from "@/modules/ee/contacts/segments/lib/helper";
import {
  createSegment,
  deleteSegment,
  getSegment,
  updateSegment,
} from "@/modules/ee/contacts/segments/lib/segments";
import type { TV3CreateSegmentBody, TV3PatchSegmentBody, TV3SegmentListQuery } from "./schemas";
import { serializeV3Segment, serializeV3SegmentListItem } from "./serializers";
import {
  SEGMENT_LIST_KIND,
  SEGMENT_LIST_SORT,
  findSegmentIdByTitle,
  getSegmentSurveyRefs,
  listSegmentRows,
} from "./service";

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TMutationParams = TBaseParams & { auditLog?: TV3AuditLog };

const TITLE_TAKEN = "A segment with this title already exists in the workspace";

const guarded = async (params: TBaseParams, operation: string, run: () => Promise<Response>) => {
  try {
    return await run();
  } catch (err) {
    return mapV3ThrownError(err, {
      log: logger.withContext({ requestId: params.requestId }),
      requestId: params.requestId,
      instance: params.instance,
      operation,
    });
  }
};

/** An unknown segment, a private one and another tenant's all answer this, so ids cannot be probed. */
const forbiddenResource = ({ requestId, instance }: TBaseParams) =>
  problemForbidden(requestId, "You are not authorized to access this resource", instance);

/**
 * The segment, only when it is a reusable one. `getSegment` throws for an unknown id, which
 * `mapV3ThrownError` renders as the same 403.
 */
async function loadReusableSegment(segmentId: string) {
  const segment = await getSegment(segmentId);
  return segment.isPrivate ? null : segment;
}

const visibleSurveysFor = async (authentication: TV3Authentication, organizationId: string) =>
  buildVisibleSurveyWhere(await resolveV3ResponsesActorContext(authentication, organizationId));

/**
 * Filters must point at things that exist in this workspace: attribute keys, other segments, surveys the
 * caller can see, a known device. The survey API validates targeting the same way, and the problem
 * document names the offending node (`filters.0.resource...`).
 */
async function validateFilters(
  params: TBaseParams,
  workspaceId: string,
  filters: TBaseFilters,
  visibleSurveyWhere: Awaited<ReturnType<typeof visibleSurveysFor>>,
  segmentId?: string
): Promise<Response | null> {
  const { requestId, instance } = params;

  try {
    await assertV3SurveyTargetingFilterReferences(workspaceId, filters, visibleSurveyWhere);
    if (segmentId) await checkForRecursiveSegmentFilter(filters, segmentId);
  } catch (err) {
    if (err instanceof V3SurveyReferenceValidationError) {
      return problemUnprocessableContent(requestId, "Segment filters contain invalid references", {
        instance,
        invalid_params: err.invalidParams.map((param) => ({
          ...param,
          name: param.name.replace(/^targeting\.filters/, "filters"),
        })),
      });
    }
    if (err instanceof InvalidInputError) {
      return problemUnprocessableContent(requestId, err.message, {
        instance,
        invalid_params: [{ name: "filters", reason: err.message }],
      });
    }
    throw err;
  }

  return null;
}

export function listV3Segments(params: TBaseParams & { query: TV3SegmentListQuery }): Promise<Response> {
  const { authentication, query, requestId, instance } = params;

  return guarded(params, "segments.list", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: query.workspaceId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    const fingerprint = computeFilterFingerprint({ workspaceId: access.workspaceId });

    let cursor = null;
    if (query.cursor) {
      try {
        cursor = decodeKeysetCursor(query.cursor, {
          kind: SEGMENT_LIST_KIND,
          sortBy: SEGMENT_LIST_SORT,
          fp: fingerprint,
        });
      } catch (err) {
        if (!(err instanceof InvalidInputError)) throw err;
        return problemBadRequest(requestId, err.message, {
          instance,
          invalid_params: [{ name: "cursor", reason: err.message }],
        });
      }
    }

    const { page, nextCursor } = await listSegmentRows({
      workspaceId: access.workspaceId,
      limit: query.limit,
      cursor,
      fingerprint,
    });

    return successListResponse(
      page.map(serializeV3SegmentListItem),
      { limit: query.limit, nextCursor },
      { requestId }
    );
  });
}

export function getV3Segment(params: TBaseParams & { segmentId: string }): Promise<Response> {
  const { authentication, segmentId, requestId, instance } = params;

  return guarded(params, "segments.get", async () => {
    const segment = await loadReusableSegment(segmentId);
    if (!segment) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: segment.workspaceId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    const surveys = await getSegmentSurveyRefs(
      segment.id,
      access.workspaceId,
      await visibleSurveysFor(authentication, access.organizationId)
    );

    return successResponse(serializeV3Segment(segment, surveys), { requestId });
  });
}

export function createV3Segment(params: TMutationParams & { body: TV3CreateSegmentBody }): Promise<Response> {
  const { authentication, body, auditLog, requestId, instance } = params;

  return guarded(params, "segments.create", async () => {
    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: body.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) auditLog.organizationId = access.organizationId;

    if (await findSegmentIdByTitle(access.workspaceId, body.title)) {
      return problemConflict(requestId, TITLE_TAKEN, instance);
    }

    const invalid = await validateFilters(
      params,
      access.workspaceId,
      body.filters,
      await visibleSurveysFor(authentication, access.organizationId)
    );
    if (invalid) return invalid;

    // `surveyId: ""` and `isPrivate: false` are what the Segments page sends: a reusable segment that is
    // not yet attached to any survey.
    const created = await createSegment({
      workspaceId: access.workspaceId,
      title: body.title,
      description: body.description,
      isPrivate: false,
      filters: body.filters,
      surveyId: "",
    });

    const data = serializeV3Segment(created, []);
    if (auditLog) {
      auditLog.targetId = created.id;
      auditLog.newObject = data;
    }

    return createdResponse(data, { location: `/api/v3/segments/${created.id}`, requestId });
  });
}

export function updateV3Segment(
  params: TMutationParams & { segmentId: string; body: TV3PatchSegmentBody }
): Promise<Response> {
  const { authentication, segmentId, body, auditLog, requestId, instance } = params;

  return guarded(params, "segments.update", async () => {
    const before = await loadReusableSegment(segmentId);
    if (!before) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: before.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      auditLog.targetId = segmentId;
      auditLog.oldObject = before;
    }

    if (body.title !== undefined && body.title !== before.title) {
      const holder = await findSegmentIdByTitle(access.workspaceId, body.title);
      if (holder && holder !== segmentId) return problemConflict(requestId, TITLE_TAKEN, instance);
    }

    const visibleSurveyWhere = await visibleSurveysFor(authentication, access.organizationId);

    if (body.filters) {
      const invalid = await validateFilters(
        params,
        access.workspaceId,
        body.filters,
        visibleSurveyWhere,
        segmentId
      );
      if (invalid) return invalid;
    }

    const updated = await updateSegment(segmentId, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.filters !== undefined && { filters: body.filters }),
    });

    const surveys = await getSegmentSurveyRefs(segmentId, access.workspaceId, visibleSurveyWhere);
    const data = serializeV3Segment(updated, surveys);
    if (auditLog) auditLog.newObject = data;

    return successResponse(data, { requestId });
  });
}

export function deleteV3Segment(params: TMutationParams & { segmentId: string }): Promise<Response> {
  const { authentication, segmentId, auditLog, requestId, instance } = params;

  return guarded(params, "segments.delete", async () => {
    const segment = await loadReusableSegment(segmentId);
    if (!segment) return forbiddenResource(params);

    const access = await requireV3ContactsAccess({
      authentication,
      workspaceId: segment.workspaceId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (access instanceof Response) return access;

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      auditLog.targetId = segmentId;
      auditLog.oldObject = segment;
    }

    // The refusal `deleteSegment` makes too, said here so it is a 409 the caller can act on rather than
    // the unexplained 403 the shared mapper gives an `OperationNotAllowedError`. `segment.surveys` counts
    // every survey; only the ones the caller can see are named.
    if (segment.surveys.length > 0) {
      const surveys = await getSegmentSurveyRefs(
        segmentId,
        access.workspaceId,
        await visibleSurveysFor(authentication, access.organizationId)
      );
      return problemConflict(
        requestId,
        "The segment is used by one or more surveys. Detach it from them before deleting it.",
        instance,
        { details: { surveys } }
      );
    }

    await deleteSegment(segmentId);

    return successResponse({ id: segmentId }, { requestId });
  });
}
