import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { logger } from "@formbricks/logger";
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
  countFeedbackRecords,
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  deleteFeedbackRecord,
  findSimilarFeedbackRecords,
  listFeedbackRecords,
  semanticSearchFeedbackRecords,
} from "@/modules/hub/service";
import type {
  FeedbackRecordCountParams,
  FeedbackRecordCreateParams,
  FeedbackRecordListParams,
  SemanticSearchResultItem,
  SimilarRecordsParams,
  SimilarRecordsResultItem,
} from "@/modules/hub/types";
import {
  type TResolvedFeedbackTenant,
  requireOwnedFeedbackRecord,
  resolveWorkspaceFeedbackTenant,
} from "./access";
import {
  EMBEDDING_PENDING_DETAIL,
  handleUnexpectedError,
  hubErrorToProblemResponse,
  relayableHubDetail,
  toInvalidParams,
} from "./errors";
import {
  SIMILARITY_LIMIT_DEFAULT,
  SIMILARITY_MIN_SCORE_DEFAULT,
  type TV3FeedbackRecordBatchCreateBody,
  type TV3FeedbackRecordCreateBody,
  type TV3FeedbackRecordFilters,
  ZV3FeedbackRecordBatchCreateBody,
  ZV3FeedbackRecordCreateBody,
  ZV3FeedbackRecordSearchFilters,
  ZV3FeedbackRecordSimilarityFilters,
} from "./schemas";
import {
  type TV3FeedbackRecord,
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

/** The Hub's own default is 100; we page smaller by default and let callers raise it. */
const DEFAULT_LIST_LIMIT = 50;

/**
 * Map our camelCase filters onto the Hub's query parameters, with the resolved tenant injected.
 *
 * Shared by list and count: the Hub documents `/count` as accepting the same parameters as the list
 * endpoint, so the two must agree about what a filter means — otherwise a count could describe a
 * different set of records than the list it is supposed to be counting. `tenant_id` is always ours, never
 * the caller's. Absent filters are left off entirely rather than sent as undefined.
 */
function buildHubFilterParams(
  tenantId: string,
  filters: TV3FeedbackRecordFilters
): FeedbackRecordCountParams {
  const params: FeedbackRecordCountParams = { tenant_id: tenantId };
  if (filters.sourceType) params.source_type = filters.sourceType;
  if (filters.sourceId) params.source_id = filters.sourceId;
  if (filters.fieldType) params.field_type = filters.fieldType;
  if (filters.fieldId) params.field_id = filters.fieldId;
  if (filters.fieldGroupId) params.field_group_id = filters.fieldGroupId;
  if (filters.submissionId) params.submission_id = filters.submissionId;
  if (filters.userId) params.user_id = filters.userId;
  if (filters.valueId) params.value_id = filters.valueId;
  if (filters.since) params.since = filters.since;
  if (filters.until) params.until = filters.until;
  return params;
}

/**
 * The two similarity searches — by query text and by example record — differ only in what they send to
 * the Hub. Everything around that is shared: the same locally-enforced bounds, the same scored-match rows,
 * and the same `meta`. These three helpers hold that common part so each operation states just its own
 * difference.
 */

/** Pagination/threshold params, with our defaults applied. */
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

/**
 * Validate similarity input against our own bounds. The Hub coerces out-of-range `limit`/`min_score` to its
 * defaults instead of rejecting them, so without this a caller would silently get something other than
 * what it asked for.
 */
function parseSimilarityFilters<T>(
  schema: z.ZodType<T>,
  input: unknown,
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  log.warn({ statusCode: 422 }, "Invalid feedback record similarity parameters");
  return {
    ok: false,
    response: problemUnprocessableContent(requestId, "Invalid similarity parameters", {
      invalid_params: toInvalidParams(parsed.error),
      instance,
    }),
  };
}

/** Envelope for a page of scored matches: the rows, the page cursor, the threshold, and the dataset. */
const similarityMatchesResponse = (
  page: {
    data: (SemanticSearchResultItem | SimilarRecordsResultItem)[];
    limit: number;
    next_cursor?: string;
  },
  resolution: TResolvedFeedbackTenant,
  minScore: number | undefined,
  requestId: string
): Response =>
  successListResponse(
    page.data.map(serializeV3FeedbackRecordMatch),
    {
      limit: page.limit,
      nextCursor: page.next_cursor ?? null,
      minScore: minScore ?? SIMILARITY_MIN_SCORE_DEFAULT,
      // Echoed for the same reason as on list: an empty result must say which dataset was searched.
      datasetId: resolution.tenantId,
      datasetName: resolution.datasetName,
    },
    { requestId, cache: CACHE }
  );

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

/** Workspace/dataset selection plus the shared filter set — the common input of list and count. */
type TFeedbackRecordQueryParams = TV3FeedbackRecordFilters & {
  workspaceId: string;
  datasetId?: string;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
};

type TListV3FeedbackRecordsParams = TFeedbackRecordQueryParams & {
  limit?: number;
  cursor?: string;
};

/** List feedback records for the resolved tenant, with cursor pagination and optional filters. */
export async function listV3FeedbackRecords({
  workspaceId,
  datasetId,
  limit,
  cursor,
  authentication,
  requestId,
  instance,
  ...filters
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
      ...buildHubFilterParams(resolution.tenantId, filters),
      limit: limit ?? DEFAULT_LIST_LIMIT,
    };
    if (cursor) listParams.cursor = cursor;

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

/**
 * Count the feedback records matching a filter set, without returning any of them.
 *
 * Answers "how many" in one upstream call instead of paging, and deliberately returns only the total: a
 * caller asking for a count never has record content — end-user text, ids, metadata — pulled into its
 * context to get it.
 */
export async function countV3FeedbackRecords({
  workspaceId,
  datasetId,
  authentication,
  requestId,
  instance,
  ...filters
}: TFeedbackRecordQueryParams): Promise<Response> {
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

    const result = await countFeedbackRecords(buildHubFilterParams(resolution.tenantId, filters));
    if (result.error || !result.data) {
      log.warn(
        {
          hubStatus: result.error?.status,
          hubCode: result.error?.code,
          datasetId: resolution.tenantId,
        },
        "Hub countFeedbackRecords failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    return successResponse(
      {
        count: result.data.count,
        // Named for the same reason as on list: a zero count must say which dataset produced it.
        dataset_id: resolution.tenantId,
        dataset_name: resolution.datasetName,
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

type TCreateV3FeedbackRecordsParams = {
  workspaceId: string;
  datasetId?: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  /**
   * One audit log per input record, **indexed by record position** — pass a sparse array rather than a
   * compacted one, or entries will be attributed to the wrong records. Entries for records that were
   * actually created come back with `targetId` set; the caller queues those as successes. Empty or all-holes
   * when auditing is off.
   */
  auditLogs?: (TV3AuditLog | undefined)[];
};

/**
 * Create several feedback records in one request.
 *
 * The Hub has no bulk-create endpoint, so this fans out to one create per record, in parallel. That makes
 * two things deliberate:
 *
 * - **Validation is all-or-nothing.** Every record is checked before any is written, so a malformed batch
 *   fails without leaving half of it stored. Only *upstream* failures can produce a partial result.
 * - **Partial success is reported, not hidden.** A batch where some records were rejected by the Hub (a
 *   duplicate submission, say) returns the ones that were created plus a per-index account of the rest, so
 *   a caller can retry precisely. If nothing was created at all, the upstream failure is returned as the
 *   response instead — an empty success would read as "there was nothing to do".
 *
 * A batch is not a submission: each record without a `submission_id` gets its own generated one, exactly as
 * in the single-record case. Callers that mean "these answers were given together" must set a shared
 * `submission_id` themselves — otherwise the records are stored as unrelated submissions, which nothing
 * downstream can tell apart from the intended shape.
 */
export async function createV3FeedbackRecords({
  workspaceId,
  datasetId,
  body,
  authentication,
  requestId,
  instance,
  auditLogs,
}: TCreateV3FeedbackRecordsParams): Promise<Response> {
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

    const parsed = ZV3FeedbackRecordBatchCreateBody.safeParse(body);
    if (!parsed.success) {
      log.warn({ statusCode: 422 }, "Invalid feedback record batch");
      // Zod paths carry the offending index, so `invalid_params` names e.g. `records.3.value_text`.
      return problemUnprocessableContent(requestId, "Invalid feedback records", {
        invalid_params: toInvalidParams(parsed.error),
        instance,
      });
    }

    const { records } = parsed.data satisfies TV3FeedbackRecordBatchCreateBody;
    const { results } = await createFeedbackRecordsBatch(
      records.map((record) => buildHubCreateParams(record, resolution.tenantId))
    );

    const created: TV3FeedbackRecord[] = [];
    const failures: { index: number; detail: string }[] = [];
    results.forEach((result, index) => {
      if (result.data) {
        const serialized = serializeV3FeedbackRecord(result.data);
        created.push(serialized);
        const auditLog = auditLogs?.[index];
        if (auditLog) {
          auditLog.organizationId = resolution.organizationId;
          auditLog.targetId = result.data.id;
          auditLog.newObject = serialized;
        }
        return;
      }
      failures.push({
        index,
        // Same relay rules as a single-record failure: a 4xx explains itself, anything else does not.
        detail: relayableHubDetail(result.error, "The feedback service rejected this record."),
      });
    });

    if (created.length === 0) {
      log.warn(
        { hubStatus: results[0]?.error?.status, hubCode: results[0]?.error?.code, requested: records.length },
        "Hub createFeedbackRecordsBatch created nothing"
      );
      return hubErrorToProblemResponse(results[0]?.error ?? null, requestId, instance);
    }

    if (failures.length > 0) {
      log.warn(
        { requested: records.length, created: created.length, failed: failures.length },
        "Hub createFeedbackRecordsBatch partially failed"
      );
    }

    return successListResponse(
      created,
      {
        requested: records.length,
        created: created.length,
        failed: failures.length,
        failures,
        datasetId: resolution.tenantId,
        datasetName: resolution.datasetName,
      },
      { requestId, cache: CACHE }
    );
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
 * `tenant_id` is injected from the resolved dataset — never from input — and is normalised by the resolver,
 * because the Hub uses it verbatim in the vector query.
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

    const filters = parseSimilarityFilters(
      ZV3FeedbackRecordSearchFilters,
      { query, limit, cursor, minScore },
      log,
      requestId,
      instance
    );
    if (!filters.ok) {
      return filters.response;
    }

    const result = await semanticSearchFeedbackRecords({
      // Never from input. Already normalised by the resolver, which every operation shares.
      tenant_id: resolution.tenantId,
      query: filters.data.query,
      ...buildSimilarityParams(filters.data),
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

    return similarityMatchesResponse(result.data, resolution, filters.data.minScore, requestId);
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

    const filters = parseSimilarityFilters(
      ZV3FeedbackRecordSimilarityFilters,
      { limit, cursor, minScore },
      log,
      requestId,
      instance
    );
    if (!filters.ok) {
      return filters.response;
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

    const result = await findSimilarFeedbackRecords(feedbackRecordId, buildSimilarityParams(filters.data));
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

    return similarityMatchesResponse(result.data, resolution, filters.data.minScore, requestId);
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}
