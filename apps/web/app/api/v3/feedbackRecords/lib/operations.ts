import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { THubFieldType } from "@formbricks/types/feedback-source";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import {
  type InvalidParam,
  problemBadGateway,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemInternalError,
  problemPayloadTooLarge,
  problemTooManyRequests,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { createFeedbackRecord, listFeedbackRecords, retrieveFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordCreateParams, FeedbackRecordListParams } from "@/modules/hub/types";
import type { HubError } from "@/modules/hub/utils";
import { type TV3FeedbackRecordCreateBody, ZV3FeedbackRecordCreateBody } from "./schemas";
import { serializeV3FeedbackDirectory, serializeV3FeedbackRecord } from "./serializers";

const CACHE = "private, no-store" as const;

// Bounds on what a Hub 4xx may contribute to our response body (see `hubErrorToProblemResponse`).
const MAX_RELAYED_INVALID_PARAMS = 20;
const MAX_RELAYED_DETAIL_LENGTH = 512;

type TResolveParams = {
  authentication: TV3Authentication;
  workspaceId: string;
  minPermission: "read" | "readWrite";
  requestId: string;
  instance: string;
  feedbackDirectoryId?: string;
};

type TResolveResult =
  | {
      ok: true;
      workspaceId: string;
      organizationId: string;
      tenantId: string;
      allowedTenantIds: string[];
    }
  | { ok: false; response: Response };

/**
 * Resolve (and authorize) the Hub tenant for a feedback-records request. This is the single tenant-
 * isolation choke point for every tool: workspace access → feedback-directories license gate →
 * directory membership → the resolved `tenant_id` (= the FeedbackDirectory id). Mirrors the Unify
 * read path (`modules/ee/unify-feedback/page.tsx`). `tenant_id` is never taken from caller input.
 */
async function resolveWorkspaceFeedbackTenant({
  authentication,
  workspaceId,
  minPermission,
  requestId,
  instance,
  feedbackDirectoryId,
}: TResolveParams): Promise<TResolveResult> {
  const authResult = await requireUnifyFeedbackWorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (authResult instanceof Response) {
    return { ok: false, response: authResult };
  }

  const { workspaceId: resolvedWorkspaceId, organizationId } = authResult;

  const directories = await getFeedbackDirectoriesByWorkspaceId(resolvedWorkspaceId);
  const allowedTenantIds = directories.map((directory) => directory.id);

  if (feedbackDirectoryId) {
    if (!allowedTenantIds.includes(feedbackDirectoryId)) {
      return {
        ok: false,
        response: problemForbidden(
          requestId,
          "You are not authorized to access this feedback directory",
          instance
        ),
      };
    }
    return {
      ok: true,
      workspaceId: resolvedWorkspaceId,
      organizationId,
      tenantId: feedbackDirectoryId,
      allowedTenantIds,
    };
  }

  if (allowedTenantIds.length === 0) {
    return {
      ok: false,
      response: problemUnprocessableContent(
        requestId,
        "No feedback directory is assigned to this workspace",
        { instance }
      ),
    };
  }
  if (allowedTenantIds.length > 1) {
    return {
      ok: false,
      response: problemBadRequest(
        requestId,
        "Multiple feedback directories are assigned to this workspace; specify feedbackDirectoryId",
        { instance }
      ),
    };
  }

  return {
    ok: true,
    workspaceId: resolvedWorkspaceId,
    organizationId,
    tenantId: allowedTenantIds[0],
    allowedTenantIds,
  };
}

/**
 * Map a Hub service error to a controlled v3 problem response.
 *
 * A Hub 400/422 describes the *caller's own* input, so its field-level detail is relayed: the Hub owns
 * the content rules we deliberately don't duplicate here (NULL bytes, its own length limits), and
 * without them an agent can't correct its request. Everything else —
 * unconfigured/unreachable Hub, our own Hub credentials being rejected, upstream 5xx — collapses to a
 * generic 502 and is only ever logged, never echoed.
 */
function hubErrorToProblemResponse(error: HubError | null, requestId: string, instance: string): Response {
  const status = error?.status ?? 0;
  if (status === 429) {
    return problemTooManyRequests(requestId, "The feedback service is rate limiting requests.");
  }

  // A duplicate (submission_id, field_id) or an in-progress tenant purge — the caller's request, not an
  // outage, and retryable in the purge case. Reported as 409 so an agent doesn't retry-loop on a 502.
  if (status === 409) {
    return problemConflict(
      requestId,
      error?.problemDetail?.slice(0, MAX_RELAYED_DETAIL_LENGTH) ??
        "The feedback service reported a conflict.",
      instance
    );
  }

  // The Hub's body cap is lower than ours, so this is reachable with a large (but locally valid) payload.
  if (status === 413) {
    return problemPayloadTooLarge(requestId, "The feedback record is too large.", instance);
  }

  if (status === 400 || status === 422) {
    // Only name/reason cross over: the Hub's `code` vocabulary is its own, not the v3 InvalidParamCode set.
    // Bounded on both axes — the Hub is a remote service, so we don't let it size our response body.
    const invalidParams: InvalidParam[] | undefined = error?.invalidParams
      ?.slice(0, MAX_RELAYED_INVALID_PARAMS)
      .map(({ name, reason }) => ({
        name: name.slice(0, MAX_RELAYED_DETAIL_LENGTH),
        reason: reason.slice(0, MAX_RELAYED_DETAIL_LENGTH),
      }));
    const detail =
      error?.problemDetail?.slice(0, MAX_RELAYED_DETAIL_LENGTH) ??
      "The feedback service rejected the request.";

    return status === 400
      ? problemBadRequest(requestId, detail, { instance, invalid_params: invalidParams })
      : problemUnprocessableContent(requestId, detail, { instance, invalid_params: invalidParams });
  }

  return problemBadGateway(requestId, "The feedback service is unavailable.", instance);
}

function handleUnexpectedError(
  err: unknown,
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string
): Response {
  if (err instanceof ResourceNotFoundError) {
    log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }
  if (err instanceof DatabaseError) {
    log.error({ error: err, statusCode: 500 }, "Database error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
  log.error({ error: err, statusCode: 500 }, "Unexpected error");
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

const toInvalidParams = (error: z.ZodError): InvalidParam[] =>
  error.issues.map((issue) => ({ name: issue.path.join("."), reason: issue.message }));

/**
 * Optional fields copied verbatim from the validated body to the Hub payload. An explicit allowlist —
 * never a spread — so nothing the caller invents (a `tenant_id` above all) can reach the Hub.
 */
const HUB_OPTIONAL_CREATE_FIELDS = [
  "value_text",
  "value_number",
  "value_boolean",
  "value_date",
  "value_id",
  "user_id",
  "language",
  "source_id",
  "source_name",
  "field_group_id",
  "field_group_label",
  "field_label",
  "collected_at",
  "metadata",
] as const satisfies readonly (keyof TV3FeedbackRecordCreateBody & keyof FeedbackRecordCreateParams)[];

/** Build the Hub create payload: required fields, the server-resolved tenant, then the allowlist. */
function buildHubCreateParams(
  data: TV3FeedbackRecordCreateBody,
  tenantId: string
): FeedbackRecordCreateParams {
  const params: FeedbackRecordCreateParams = {
    tenant_id: tenantId,
    // Generated when omitted so a single ad-hoc record still groups cleanly.
    submission_id: data.submission_id ?? randomUUID(),
    source_type: data.source_type,
    field_id: data.field_id,
    field_type: data.field_type,
  };

  const target = params as Record<string, unknown>;
  const source = data as Record<string, unknown>;
  for (const field of HUB_OPTIONAL_CREATE_FIELDS) {
    if (source[field] !== undefined) {
      target[field] = source[field];
    }
  }

  return params;
}

type TListV3FeedbackDirectoriesParams = {
  workspaceId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** List the active feedback directories assigned to a workspace (discovery for the other tools). */
export async function listV3FeedbackDirectories({
  workspaceId,
  authentication,
  requestId,
  instance,
}: TListV3FeedbackDirectoriesParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    // Not the tenant resolver: this operation *is* how a caller discovers directory ids, so it stops at
    // the shared access + entitlement gate.
    const authResult = await requireUnifyFeedbackWorkspaceAccess(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    if (authResult instanceof Response) {
      return authResult;
    }

    const directories = await getFeedbackDirectoriesByWorkspaceId(authResult.workspaceId);
    return successListResponse(
      directories.map(serializeV3FeedbackDirectory),
      { nextCursor: null, totalCount: directories.length },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TListV3FeedbackRecordsParams = {
  workspaceId: string;
  feedbackDirectoryId?: string;
  limit?: number;
  cursor?: string;
  sourceType?: string;
  fieldType?: THubFieldType;
  since?: string;
  until?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** List feedback records for the resolved tenant, with cursor pagination and optional filters. */
export async function listV3FeedbackRecords({
  workspaceId,
  feedbackDirectoryId,
  limit,
  cursor,
  sourceType,
  fieldType,
  since,
  until,
  authentication,
  requestId,
  instance,
}: TListV3FeedbackRecordsParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      feedbackDirectoryId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const listParams: FeedbackRecordListParams = {
      tenant_id: resolution.tenantId,
      limit: limit ?? 50,
    };
    if (cursor) listParams.cursor = cursor;
    if (sourceType) listParams.source_type = sourceType;
    if (fieldType) listParams.field_type = fieldType;
    if (since) listParams.since = since;
    if (until) listParams.until = until;

    const result = await listFeedbackRecords(listParams);
    if (result.error || !result.data) {
      log.warn(
        {
          hubStatus: result.error?.status,
          hubCode: result.error?.code,
          feedbackDirectoryId: resolution.tenantId,
        },
        "Hub listFeedbackRecords failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    return successListResponse(
      result.data.data.map(serializeV3FeedbackRecord),
      { limit: result.data.limit, nextCursor: result.data.next_cursor ?? null },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TGetV3FeedbackRecordParams = {
  workspaceId: string;
  feedbackRecordId: string;
  feedbackDirectoryId?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Get one feedback record by id. The Hub `get` is NOT tenant-scoped, so after retrieval the record's
 * tenant must be one the caller's workspace owns; otherwise (and on a Hub 404) we return an
 * indistinguishable generic 403 so record ids can't be probed across tenants.
 */
export async function getV3FeedbackRecord({
  workspaceId,
  feedbackRecordId,
  feedbackDirectoryId,
  authentication,
  requestId,
  instance,
}: TGetV3FeedbackRecordParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      feedbackDirectoryId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const result = await retrieveFeedbackRecord(feedbackRecordId);
    if (result.error || !result.data) {
      const status = result.error?.status ?? 0;
      // Not found (or any client-facing failure) → generic 403, no existence oracle across tenants.
      if (status === 404) {
        // Logged like the tenant-mismatch denial below, so both halves of the 403 are observable.
        log.warn({ statusCode: 403, hubStatus: 404 }, "Feedback record not found");
        return problemForbidden(requestId, "You are not authorized to access this feedback record", instance);
      }
      log.warn({ hubStatus: status, hubCode: result.error?.code }, "Hub retrieveFeedbackRecord failed");
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    // When the caller named a directory, the record must live in THAT one; otherwise any directory the
    // workspace owns is acceptable. Same 403 either way — see the doc comment above.
    const permittedTenantIds = feedbackDirectoryId ? [resolution.tenantId] : resolution.allowedTenantIds;
    if (!result.data.tenant_id || !permittedTenantIds.includes(result.data.tenant_id)) {
      log.warn({ statusCode: 403 }, "Feedback record tenant outside caller's workspace directories");
      return problemForbidden(requestId, "You are not authorized to access this feedback record", instance);
    }

    return successResponse(serializeV3FeedbackRecord(result.data), { requestId, cache: CACHE });
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TCreateV3FeedbackRecordParams = {
  workspaceId: string;
  feedbackDirectoryId?: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Create a feedback record in the resolved tenant. The Hub payload is built as an explicit allowlist
 * from the validated body; `tenant_id` is injected from the resolved directory and never accepted from
 * input. `submission_id` is generated when omitted so a single ad-hoc record still groups cleanly.
 */
export async function createV3FeedbackRecord({
  workspaceId,
  feedbackDirectoryId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TCreateV3FeedbackRecordParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      feedbackDirectoryId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const parsed = ZV3FeedbackRecordCreateBody.safeParse(body);
    if (!parsed.success) {
      log.warn({ statusCode: 422 }, "Invalid feedback record body");
      return problemUnprocessableContent(requestId, "Invalid feedback record", {
        invalid_params: toInvalidParams(parsed.error),
        instance,
      });
    }

    const result = await createFeedbackRecord(buildHubCreateParams(parsed.data, resolution.tenantId));
    if (result.error || !result.data) {
      log.warn(
        { hubStatus: result.error?.status, hubCode: result.error?.code },
        "Hub createFeedbackRecord failed"
      );
      // The caller stamps eventId/status from the response — mirrors the surveys operations.
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    const serialized = serializeV3FeedbackRecord(result.data);
    if (auditLog) {
      auditLog.organizationId = resolution.organizationId;
      auditLog.targetId = result.data.id;
      auditLog.newObject = serialized;
    }

    return successResponse(serialized, { requestId, status: 201, cache: CACHE });
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}
