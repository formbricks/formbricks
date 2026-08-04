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
  updateFeedbackRecord,
} from "@/modules/hub/service";
import type {
  FeedbackRecordCountParams,
  FeedbackRecordCreateParams,
  FeedbackRecordListParams,
  FeedbackRecordUpdateParams,
  SemanticSearchResultItem,
  SimilarRecordsParams,
  SimilarRecordsResultItem,
} from "@/modules/hub/types";
import {
  type TResolvedFeedbackTenant,
  forbidFeedbackRecord,
  requireFeedbackRecordMutationRole,
  requireOwnedFeedbackRecord,
  resolveWorkspaceFeedbackTenant,
} from "./access";
import {
  EMBEDDINGS_UNAVAILABLE_DETAIL,
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
  type TV3FeedbackRecordUpdateBody,
  ZV3FeedbackRecordBatchCreateBody,
  ZV3FeedbackRecordCreateBody,
  ZV3FeedbackRecordFilters,
  ZV3FeedbackRecordListFilters,
  ZV3FeedbackRecordSearchFilters,
  ZV3FeedbackRecordSimilarityFilters,
  ZV3FeedbackRecordUpdateBody,
  conflictingUpdateValueFields,
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

/**
 * Build the Hub update payload. An allowlist for the same reason as the create builder — and it is what
 * enforces immutability of a record's provenance: a `source_type` or `submission_id` in the input simply has
 * nowhere to go. Only the fields the caller actually sent are assigned, so an omitted field is left
 * untouched rather than being overwritten with null.
 *
 * One field is not additive: the Hub assigns `metadata` wholesale (`metadata = $n`), so sending it replaces
 * the stored object rather than merging into it. A caller adding one key must send the existing keys too —
 * hence the warning in the tool description, since the failure is silent.
 */
function buildHubUpdateParams(data: TV3FeedbackRecordUpdateBody): FeedbackRecordUpdateParams {
  const params: FeedbackRecordUpdateParams = {};
  if (data.value_text !== undefined) params.value_text = data.value_text;
  if (data.value_number !== undefined) params.value_number = data.value_number;
  if (data.value_boolean !== undefined) params.value_boolean = data.value_boolean;
  if (data.value_date !== undefined) params.value_date = data.value_date;
  if (data.value_id !== undefined) params.value_id = data.value_id;
  if (data.user_id !== undefined) params.user_id = data.user_id;
  if (data.language !== undefined) params.language = data.language;
  if (data.metadata !== undefined) params.metadata = data.metadata;
  return params;
}

/** The Hub's own default is 100; we page smaller by default and let callers raise it. */
const DEFAULT_LIST_LIMIT = 50;

/**
 * Map our filters onto the Hub's query parameters, with the resolved tenant injected.
 *
 * The names now match the Hub's, so this reads as a copy — but it stays a field-by-field allowlist rather
 * than a spread, for the same reason as the create builder: `tenant_id` is always ours, and nothing a caller
 * invents can reach the Hub by being named plausibly.
 *
 * Shared by list and count: the Hub documents `/count` as accepting the same parameters as the list endpoint,
 * so the two must agree about what a filter means — otherwise a count could describe a different set of
 * records than the list it is supposed to be counting. Absent filters are left off entirely rather than sent
 * as undefined.
 */
function buildHubFilterParams(
  tenantId: string,
  filters: TV3FeedbackRecordFilters
): FeedbackRecordCountParams {
  const params: FeedbackRecordCountParams = { tenant_id: tenantId };
  if (filters.source_type) params.source_type = filters.source_type;
  if (filters.source_id) params.source_id = filters.source_id;
  if (filters.field_type) params.field_type = filters.field_type;
  if (filters.field_id) params.field_id = filters.field_id;
  if (filters.field_group_id) params.field_group_id = filters.field_group_id;
  if (filters.submission_id) params.submission_id = filters.submission_id;
  if (filters.user_id) params.user_id = filters.user_id;
  if (filters.value_id) params.value_id = filters.value_id;
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
 * Validate query input against our own bounds, and turn a failure into `invalid_params`.
 *
 * Every operation validates rather than trusting its caller: these operations are the transport-independent
 * face of this surface, so they cannot assume an MCP schema has already screened the input. It also matters
 * upstream — the Hub silently coerces an out-of-range `limit`/`min_score` to its own default instead of
 * rejecting it, so without this a caller would quietly get something other than what it asked for.
 */
function parseQueryInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  label: string,
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  log.warn({ statusCode: 422 }, `Invalid feedback record ${label}`);
  return {
    ok: false,
    response: problemUnprocessableContent(requestId, `Invalid ${label}`, {
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

    const parsed = parseQueryInput(
      ZV3FeedbackRecordListFilters,
      { ...filters, limit, cursor },
      "list parameters",
      log,
      requestId,
      instance
    );
    if (!parsed.ok) {
      return parsed.response;
    }

    const listParams: FeedbackRecordListParams = {
      ...buildHubFilterParams(resolution.tenantId, parsed.data),
      limit: parsed.data.limit ?? DEFAULT_LIST_LIMIT,
    };
    if (parsed.data.cursor) listParams.cursor = parsed.data.cursor;

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

    const parsed = parseQueryInput(ZV3FeedbackRecordFilters, filters, "filters", log, requestId, instance);
    if (!parsed.ok) {
      return parsed.response;
    }

    const result = await countFeedbackRecords(buildHubFilterParams(resolution.tenantId, parsed.data));
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

type TUpdateV3FeedbackRecordParams = {
  workspaceId: string;
  feedbackRecordId: string;
  datasetId?: string;
  body: unknown;
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
};

/**
 * Update the mutable fields of one feedback record.
 *
 * Like get/delete/similar, the Hub's `PATCH /{id}` takes a bare record id and derives the tenant from the
 * stored record, so ownership is asserted first — and the record that guard returns is also the pre-update
 * state the audit log needs, so the check costs nothing extra.
 *
 * There is a window between that check and the write, but it cannot be used to cross a tenant boundary: a
 * record's `tenant_id` is not in the Hub's updatable set, so the record the guard approved is still in the
 * same dataset when the write lands. The only thing that can change in the window is the record ceasing to
 * exist, which is handled below.
 *
 * Two Hub behaviours the caller has to know about, both documented in its contract:
 * - Changing `value_text` **clears** the fields derived from it (`sentiment`, `sentiment_score`,
 *   `emotions`, `value_text_translated`, `translation_lang_key`) and re-queues enrichment; changing
 *   `language` re-queues the translation pair only. The response therefore reflects the *cleared* state,
 *   which must not be read as "this record has no sentiment".
 * - Changing `value_text` (or a field label) re-queues the embedding, so semantic search catches up with
 *   the edit asynchronously — and clearing the text removes the embedding, making the record unsearchable.
 */
export async function updateV3FeedbackRecord({
  workspaceId,
  feedbackRecordId,
  datasetId,
  body,
  authentication,
  requestId,
  instance,
  auditLog,
}: TUpdateV3FeedbackRecordParams): Promise<Response> {
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

    // Before the record is looked up: a caller who may not mutate anything here learns nothing about
    // which record ids exist.
    const role = await requireFeedbackRecordMutationRole({
      authentication,
      resolution,
      log,
      requestId,
      instance,
    });
    if (!role.ok) {
      return role.response;
    }

    const parsed = ZV3FeedbackRecordUpdateBody.safeParse(body);
    if (!parsed.success) {
      log.warn({ statusCode: 422 }, "Invalid feedback record update");
      return problemUnprocessableContent(requestId, "Invalid feedback record update", {
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

    // Only now can the patch be checked against the record's `field_type` — it is immutable, so it is not in
    // the body and had to be read first. The Hub does not enforce this, so skipping it would let a patch
    // build a record create rejects: `value_number` on a `text` record leaves both values set at once.
    const conflicts = conflictingUpdateValueFields(parsed.data, owned.record.field_type);
    if (conflicts.length > 0) {
      log.warn(
        { statusCode: 422, fieldType: owned.record.field_type },
        "Feedback record update sets a value field the record's type does not accept"
      );
      return problemUnprocessableContent(requestId, "Invalid feedback record update", {
        invalid_params: conflicts.map(({ name, accepted }) => ({
          name,
          reason: `is not valid for a "${owned.record.field_type}" record (expected one of: ${accepted.join(", ")})`,
        })),
        instance,
      });
    }

    const result = await updateFeedbackRecord(feedbackRecordId, buildHubUpdateParams(parsed.data));
    if (result.error || !result.data) {
      // The record was there a moment ago (the guard just read it), so a 404 means it was deleted in
      // between. Nothing was updated, and the service is fine — reporting the generic 502 would blame an
      // outage. Answered with the guard's own 403, so a vanished record is indistinguishable from one the
      // caller never had access to.
      if (result.error?.status === 404) {
        log.info({ statusCode: 403, hubStatus: 404 }, "Feedback record deleted during update");
        return forbidFeedbackRecord(requestId, instance);
      }
      log.warn(
        { hubStatus: result.error?.status, hubCode: result.error?.code },
        "Hub updateFeedbackRecord failed"
      );
      return hubErrorToProblemResponse(result.error, requestId, instance);
    }

    const serialized = serializeV3FeedbackRecord(result.data);
    if (auditLog) {
      auditLog.organizationId = resolution.organizationId;
      auditLog.targetId = feedbackRecordId;
      // Both sides: an edit is only reviewable if the previous value is recorded too.
      auditLog.oldObject = serializeV3FeedbackRecord(owned.record);
      auditLog.newObject = serialized;
    }

    return successResponse(serialized, { requestId, cache: CACHE });
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
      // `manage`, matching the gateway's DELETE route and `methodPermissionMap` everywhere else in the
      // API. Both delete paths had to move or the bar would only apply to one of them (ENG-2083).
      minPermission: "manage",
      requestId,
      instance,
    });
    if (!resolution.ok) {
      return resolution.response;
    }

    // Before the record is looked up: a caller who may not delete anything here learns nothing about
    // which record ids exist.
    const role = await requireFeedbackRecordMutationRole({
      authentication,
      resolution,
      log,
      requestId,
      instance,
    });
    if (!role.ok) {
      return role.response;
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

    const filters = parseQueryInput(
      ZV3FeedbackRecordSearchFilters,
      { query, limit, cursor, minScore },
      "search parameters",
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
      return hubErrorToProblemResponse(result.error, requestId, instance, {
        serviceUnavailableDetail: EMBEDDINGS_UNAVAILABLE_DETAIL,
      });
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

    const filters = parseQueryInput(
      ZV3FeedbackRecordSimilarityFilters,
      { limit, cursor, minScore },
      "similarity parameters",
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
      return hubErrorToProblemResponse(result.error, requestId, instance, {
        serviceUnavailableDetail: EMBEDDINGS_UNAVAILABLE_DETAIL,
      });
    }

    return similarityMatchesResponse(result.data, resolution, filters.data.minScore, requestId);
  } catch (err) {
    return handleUnexpectedError(err, log, requestId, instance);
  }
}
