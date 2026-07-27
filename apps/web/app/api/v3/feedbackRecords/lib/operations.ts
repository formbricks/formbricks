import "server-only";
import { randomUUID } from "node:crypto";
import { logger } from "@formbricks/logger";
import type { THubFieldType } from "@formbricks/types/feedback-source";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import {
  noContentResponse,
  problemConflict,
  problemUnprocessableContent,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import {
  createFeedbackRecord,
  deleteFeedbackRecord,
  findSimilarFeedbackRecords,
  listFeedbackRecords,
  semanticSearchFeedbackRecords,
} from "@/modules/hub/service";
import type {
  FeedbackRecordCreateParams,
  FeedbackRecordListParams,
  SimilarRecordsParams,
} from "@/modules/hub/types";
import { requireOwnedFeedbackRecord, resolveWorkspaceFeedbackTenant } from "./access";
import {
  EMBEDDING_PENDING_DETAIL,
  handleUnexpectedError,
  hubErrorToProblemResponse,
  toInvalidParams,
} from "./errors";
import {
  SIMILARITY_LIMIT_DEFAULT,
  SIMILARITY_MIN_SCORE_DEFAULT,
  type TV3FeedbackRecordCreateBody,
  ZV3FeedbackRecordCreateBody,
  ZV3FeedbackRecordSearchFilters,
  ZV3FeedbackRecordSimilarityFilters,
} from "./schemas";
import {
  serializeV3FeedbackDataset,
  serializeV3FeedbackRecord,
  serializeV3FeedbackRecordMatch,
} from "./serializers";

/**
 * Transport-independent operations for the feedback-records surface. Each one authorizes (via `./access`),
 * talks to the Hub through `modules/hub/service`, and returns a v3 `Response`. Authorization lives in
 * `./access.ts`, error mapping in `./errors.ts`, wire shapes in `./serializers.ts`.
 */

const CACHE = "private, no-store" as const;

/**
 * Build the Hub create payload. This field list *is* the allowlist — never a spread of the input — so
 * nothing the caller invents (a `tenant_id` above all) can reach the Hub. Optional fields are assigned
 * unconditionally: `undefined` ones are dropped by JSON serialization, so the wire payload only ever
 * carries what the caller actually sent.
 */
function buildHubCreateParams(
  data: TV3FeedbackRecordCreateBody,
  tenantId: string
): FeedbackRecordCreateParams {
  return {
    tenant_id: tenantId,
    // Generated when omitted so a single ad-hoc record still groups cleanly.
    submission_id: data.submission_id ?? randomUUID(),
    source_type: data.source_type,
    field_id: data.field_id,
    field_type: data.field_type,
    value_text: data.value_text,
    value_number: data.value_number,
    value_boolean: data.value_boolean,
    value_date: data.value_date,
    value_id: data.value_id,
    user_id: data.user_id,
    language: data.language,
    source_id: data.source_id,
    source_name: data.source_name,
    field_group_id: data.field_group_id,
    field_group_label: data.field_group_label,
    field_label: data.field_label,
    collected_at: data.collected_at,
    metadata: data.metadata,
  };
}

/** Pagination/threshold params shared by the two similarity searches, with our defaults applied. */
const buildSimilarityParams = (filters: {
  limit?: number;
  cursor?: string;
  minScore?: number;
}): SimilarRecordsParams => {
  const params: SimilarRecordsParams = {
    limit: filters.limit ?? SIMILARITY_LIMIT_DEFAULT,
    min_score: filters.minScore ?? SIMILARITY_MIN_SCORE_DEFAULT,
  };
  if (filters.cursor) params.cursor = filters.cursor;
  return params;
};

type TListV3FeedbackDatasetsParams = {
  workspaceId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/** List the active feedback datasets assigned to a workspace (discovery for the other tools). */
export async function listV3FeedbackDatasets({
  workspaceId,
  authentication,
  requestId,
  instance,
}: TListV3FeedbackDatasetsParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    // Not the tenant resolver: this operation *is* how a caller discovers dataset ids, so it stops at
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
      directories.map(serializeV3FeedbackDataset),
      { nextCursor: null, totalCount: directories.length },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TListV3FeedbackRecordsParams = {
  workspaceId: string;
  datasetId?: string;
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
  datasetId,
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
      datasetId,
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
          datasetId: resolution.tenantId,
        },
        "Hub listFeedbackRecords failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    return successListResponse(
      result.data.data.map(serializeV3FeedbackRecord),
      {
        limit: result.data.limit,
        nextCursor: result.data.next_cursor ?? null,
        // Echo the dataset we resolved. Without it an empty `data` is ambiguous to the caller — "this
        // dataset holds no matching records" reads identically to "I don't know what was searched" — and
        // a caller that auto-resolved the dataset would have to make a second call to find out.
        datasetId: resolution.tenantId,
        datasetName: resolution.datasetName,
      },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TGetV3FeedbackRecordParams = {
  workspaceId: string;
  feedbackRecordId: string;
  datasetId?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Get one feedback record by id. The Hub `get` is NOT tenant-scoped, so ownership is asserted by
 * `requireOwnedFeedbackRecord`, which returns an indistinguishable generic 403 for a foreign record and
 * for a missing one.
 */
export async function getV3FeedbackRecord({
  workspaceId,
  feedbackRecordId,
  datasetId,
  authentication,
  requestId,
  instance,
}: TGetV3FeedbackRecordParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      datasetId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const owned = await requireOwnedFeedbackRecord({
      feedbackRecordId,
      resolution,
      datasetId,
      log,
      requestId,
      instance,
    });
    if (!owned.ok) {
      return owned.response;
    }

    return successResponse(serializeV3FeedbackRecord(owned.record), { requestId, cache: CACHE });
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TCreateV3FeedbackRecordParams = {
  workspaceId: string;
  datasetId?: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Create a feedback record in the resolved tenant. The Hub payload is built as an explicit allowlist
 * from the validated body; `tenant_id` is injected from the resolved dataset and never accepted from
 * input. `submission_id` is generated when omitted so a single ad-hoc record still groups cleanly.
 */
export async function createV3FeedbackRecord({
  workspaceId,
  datasetId,
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
      datasetId,
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

type TDeleteV3FeedbackRecordParams = {
  workspaceId: string;
  feedbackRecordId: string;
  datasetId?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Delete one feedback record. Permanent: the Hub removes the row and its derived embedding, with no
 * soft-delete to recover from.
 *
 * The Hub's delete takes a bare record id and derives the tenant from the record, so ownership is
 * asserted *before* the delete — a foreign id must fail without touching anything. The pre-delete record
 * is captured for the audit log, which is the only remaining trace afterwards.
 */
export async function deleteV3FeedbackRecord({
  workspaceId,
  feedbackRecordId,
  datasetId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDeleteV3FeedbackRecordParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      datasetId,
      minPermission: "readWrite",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const owned = await requireOwnedFeedbackRecord({
      feedbackRecordId,
      resolution,
      datasetId,
      log,
      requestId,
      instance,
    });
    if (!owned.ok) {
      return owned.response;
    }

    const result = await deleteFeedbackRecord(feedbackRecordId);
    // A 404 here means the record was deleted between our ownership check and this call — the caller's
    // intended end state holds, so it is reported as success. Reporting the generic 502 instead would tell
    // an agent the service is down and invite a retry loop against a record that is already gone.
    if (result.error && result.error.status !== 404) {
      log.warn(
        { hubStatus: result.error.status, hubCode: result.error.code },
        "Hub deleteFeedbackRecord failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }
    if (result.error?.status === 404) {
      log.info({ datasetId: resolution.tenantId }, "Feedback record already deleted");
    }

    if (auditLog) {
      auditLog.organizationId = resolution.organizationId;
      auditLog.targetId = feedbackRecordId;
      // The deleted content, kept only in the audit trail — the record itself is gone.
      auditLog.oldObject = serializeV3FeedbackRecord(owned.record);
    }

    log.info({ datasetId: resolution.tenantId }, "Feedback record deleted");
    // 204, as the v3 delete convention has it (see `deleteV3Survey`).
    return noContentResponse({ requestId });
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TSearchV3FeedbackRecordsParams = {
  workspaceId: string;
  datasetId?: string;
  query: string;
  limit?: number;
  cursor?: string;
  minScore?: number;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Semantic search over the resolved dataset: the query is embedded and compared to record embeddings by
 * cosine similarity, so it matches meaning rather than keywords.
 *
 * `tenant_id` is injected from the resolved dataset, trimmed — the Hub uses it verbatim in the vector
 * query (no trimming of its own), so a stray space would silently match nothing instead of failing.
 */
export async function searchV3FeedbackRecords({
  workspaceId,
  datasetId,
  query,
  limit,
  cursor,
  minScore,
  authentication,
  requestId,
  instance,
}: TSearchV3FeedbackRecordsParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      datasetId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    // Bounds are ours, not the Hub's: it coerces out-of-range values to its defaults instead of failing.
    const parsed = ZV3FeedbackRecordSearchFilters.safeParse({ query, limit, cursor, minScore });
    if (!parsed.success) {
      log.warn({ statusCode: 422 }, "Invalid feedback record search parameters");
      return problemUnprocessableContent(requestId, "Invalid search parameters", {
        invalid_params: toInvalidParams(parsed.error),
        instance,
      });
    }

    const result = await semanticSearchFeedbackRecords({
      // Never from input. Trimmed because the Hub matches on the raw value.
      tenant_id: resolution.tenantId.trim(),
      query: parsed.data.query,
      ...buildSimilarityParams(parsed.data),
    });
    if (result.error || !result.data) {
      // The query itself is never logged: it is caller-authored text.
      log.warn(
        {
          hubStatus: result.error?.status,
          hubCode: result.error?.code,
          datasetId: resolution.tenantId,
        },
        "Hub semanticSearchFeedbackRecords failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    return successListResponse(
      result.data.data.map(serializeV3FeedbackRecordMatch),
      {
        limit: result.data.limit,
        nextCursor: result.data.next_cursor ?? null,
        minScore: parsed.data.minScore ?? SIMILARITY_MIN_SCORE_DEFAULT,
        datasetId: resolution.tenantId,
        datasetName: resolution.datasetName,
      },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}

type TFindSimilarV3FeedbackRecordsParams = {
  workspaceId: string;
  feedbackRecordId: string;
  datasetId?: string;
  limit?: number;
  cursor?: string;
  minScore?: number;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

/**
 * Find the records most similar to a given one, by embedding distance.
 *
 * The Hub endpoint takes a bare record id and scopes the neighbour search to whatever tenant that record
 * belongs to — so without an ownership check it would read other tenants' records. Hence the same
 * `requireOwnedFeedbackRecord` guard as get/delete, before any neighbour is fetched.
 *
 * That guard also disambiguates the Hub's 404, which on its own conflates "no such record" with "not
 * embedded": once the record is known to exist and to be ours, a 404 can only mean the latter.
 */
export async function findSimilarV3FeedbackRecords({
  workspaceId,
  feedbackRecordId,
  datasetId,
  limit,
  cursor,
  minScore,
  authentication,
  requestId,
  instance,
}: TFindSimilarV3FeedbackRecordsParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });
  try {
    const resolution = await resolveWorkspaceFeedbackTenant({
      authentication,
      workspaceId,
      datasetId,
      minPermission: "read",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    const parsed = ZV3FeedbackRecordSimilarityFilters.safeParse({ limit, cursor, minScore });
    if (!parsed.success) {
      log.warn({ statusCode: 422 }, "Invalid feedback record similarity parameters");
      return problemUnprocessableContent(requestId, "Invalid similarity parameters", {
        invalid_params: toInvalidParams(parsed.error),
        instance,
      });
    }

    const owned = await requireOwnedFeedbackRecord({
      feedbackRecordId,
      resolution,
      datasetId,
      log,
      requestId,
      instance,
    });
    if (!owned.ok) {
      return owned.response;
    }

    const result = await findSimilarFeedbackRecords(feedbackRecordId, buildSimilarityParams(parsed.data));
    if (result.error || !result.data) {
      const status = result.error?.status ?? 0;
      // Ownership is already proven, so a 404 is not an authorization signal — the record is there and
      // simply has no embedding. Reported distinctly, and as a retryable state rather than a 404.
      if (status === 404) {
        log.info({ statusCode: 409, datasetId: resolution.tenantId }, "Feedback record has no embedding");
        return problemConflict(requestId, EMBEDDING_PENDING_DETAIL, instance);
      }
      log.warn(
        {
          hubStatus: status,
          hubCode: result.error?.code,
          datasetId: resolution.tenantId,
        },
        "Hub findSimilarFeedbackRecords failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    return successListResponse(
      result.data.data.map(serializeV3FeedbackRecordMatch),
      {
        limit: result.data.limit,
        nextCursor: result.data.next_cursor ?? null,
        minScore: parsed.data.minScore ?? SIMILARITY_MIN_SCORE_DEFAULT,
        datasetId: resolution.tenantId,
        datasetName: resolution.datasetName,
      },
      { requestId, cache: CACHE }
    );
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}
