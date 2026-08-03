import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { getHubClient } from "./hub-client";
import type {
  CreateTaxonomyRunInput,
  CreateTaxonomyRunResponse,
  FeedbackRecordCountParams,
  FeedbackRecordCountResponse,
  FeedbackRecordCreateParams,
  FeedbackRecordData,
  FeedbackRecordListParams,
  FeedbackRecordListResponse,
  FeedbackRecordUpdateParams,
  ListTaxonomyRunsResponse,
  RenameTaxonomyNodeInput,
  SemanticSearchInput,
  SemanticSearchResponse,
  SimilarRecordsParams,
  SimilarRecordsResponse,
  TaxonomyFieldsResponse,
  TaxonomyNode,
  TaxonomyNodeRecordsResponse,
  TaxonomyRecordCountsResponse,
  TaxonomyRun,
  TaxonomyScopeInput,
  TaxonomyTreeResponse,
} from "./types";
import {
  type HubError,
  type HubResult,
  NO_CONFIG_ERROR,
  createHubResultFromError,
  getErrorMessage,
  getErrorStatus,
} from "./utils";

export type HubFeedbackRecordResult = {
  data: FeedbackRecordData | null;
  error: HubError | null;
};

/**
 * Create a single feedback record in the Hub.
 * Returns a result shape with data or error; logs failures.
 *
 * value_id (the stable id of the matched choice, ENG-1673) is sent through as-is:
 * the deployed Hub accepts it, and the SDK forwards unknown fields untouched.
 */
export const createFeedbackRecord = async (
  input: FeedbackRecordCreateParams
): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.create(input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, fieldId: input.field_id }, "Hub: createFeedbackRecord failed");
    return createHubResultFromError(err);
  }
};

/**
 * Retrieve a single feedback record from the Hub by id.
 */
export const retrieveFeedbackRecord = async (id: string): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.feedbackRecords.retrieve(id);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id }, "Hub: retrieveFeedbackRecord failed");
    return createHubResultFromError(err);
  }
};

/**
 * Update a single feedback record in the Hub by id.
 */
export const updateFeedbackRecord = async (
  id: string,
  input: FeedbackRecordUpdateParams
): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.feedbackRecords.update(id, input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id }, "Hub: updateFeedbackRecord failed");
    return createHubResultFromError(err);
  }
};

export type HubFeedbackRecordDeleteResult = {
  data: { deleted: true } | null;
  error: HubError | null;
};

/**
 * Delete a single feedback record in the Hub by id.
 */
export const deleteFeedbackRecord = async (id: string): Promise<HubFeedbackRecordDeleteResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    await client.feedbackRecords.delete(id);
    return { data: { deleted: true }, error: null };
  } catch (err) {
    logger.warn({ err, id }, "Hub: deleteFeedbackRecord failed");
    // Via the shared helper so callers also get the Hub's problem members — an in-progress tenant purge
    // arrives as a relayable, retryable 409 instead of an opaque failure.
    return createHubResultFromError(err);
  }
};

export type HubTenantDataDeleteResult = {
  data: {
    deletedFeedbackRecords: number;
    deletedEmbeddings: number;
    deletedWebhooks: number;
  } | null;
  error: HubError | null;
};

type TenantDataDeleteResponse = {
  tenant_id: string;
  deleted_feedback_records: number;
  deleted_embeddings: number;
  deleted_webhooks: number;
  message?: string;
};

/**
 * Purge all Hub-owned data (feedback records, derived embeddings, webhooks) for a tenant.
 * Called when the owning organization is deleted so Hub-side rows don't become orphaned.
 * Idempotent on the Hub side; the caller treats failures as best-effort.
 *
 * Hits `DELETE /v1/tenants/{tenant_id}/data` directly because the SDK doesn't yet expose
 * a typed method for this endpoint.
 */
export const deleteHubTenantData = async (tenantId: string): Promise<HubTenantDataDeleteResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.delete<TenantDataDeleteResponse>(
      `/v1/tenants/${encodeURIComponent(tenantId)}/data`
    );
    return {
      data: {
        deletedFeedbackRecords: data.deleted_feedback_records,
        deletedEmbeddings: data.deleted_embeddings,
        deletedWebhooks: data.deleted_webhooks,
      },
      error: null,
    };
  } catch (err) {
    logger.warn({ err, tenantId }, "Hub: deleteHubTenantData failed");
    const status = getErrorStatus(err);
    const message = getErrorMessage(err);
    return { data: null, error: { status, message, detail: message } };
  }
};

export type ListFeedbackRecordsResult = {
  data: FeedbackRecordListResponse | null;
  error: HubError | null;
};

export type SemanticSearchFeedbackRecordsResult = {
  data: SemanticSearchResponse | null;
  error: HubError | null;
};

export type FeedbackRecordTenantResult = {
  data: { tenantId: string } | null;
  error: { status: number; message: string; detail: string } | null;
};

/**
 * List feedback records from the Hub with optional filters and pagination.
 */
export const listFeedbackRecords = async (
  params: FeedbackRecordListParams
): Promise<ListFeedbackRecordsResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.list(params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err }, "Hub: listFeedbackRecords failed");
    // Via the shared helper so callers also get the Hub's problem members (e.g. an invalid cursor or
    // malformed since/until arrives as a relayable 400 rather than an opaque failure).
    return createHubResultFromError(err);
  }
};

export type CountFeedbackRecordsResult = {
  data: FeedbackRecordCountResponse | null;
  error: HubError | null;
};

/**
 * Total number of feedback records matching a filter set. The Hub takes the same filters as the list
 * endpoint (minus pagination) and answers with just the count, so callers that only need "how many" don't
 * page through records to find out.
 */
export const countFeedbackRecords = async (
  params: FeedbackRecordCountParams
): Promise<CountFeedbackRecordsResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.count(params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId: params.tenant_id }, "Hub: countFeedbackRecords failed");
    return createHubResultFromError(err);
  }
};

/**
 * Semantic (vector) search over a tenant's feedback records. Only available when the Hub has an embedding
 * model configured — otherwise it fails with 503, which callers surface as an actionable message.
 *
 * The query text is never logged: it is caller-authored content.
 */
export const semanticSearchFeedbackRecords = async (
  input: SemanticSearchInput
): Promise<SemanticSearchFeedbackRecordsResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.search.performSemanticSearch(input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId: input.tenant_id }, "Hub: semanticSearchFeedbackRecords failed");
    // Via the shared helper so the Hub's problem members survive — most importantly the 503 that says
    // embeddings aren't configured, which would otherwise be indistinguishable from an outage.
    return createHubResultFromError(err);
  }
};

export type SimilarFeedbackRecordsResult = {
  data: SimilarRecordsResponse | null;
  error: HubError | null;
};

/**
 * Nearest neighbours of one feedback record, by embedding similarity. The Hub derives the tenant from the
 * record itself and applies no authorization, so callers MUST verify the record belongs to them first
 * (see `requireOwnedFeedbackRecord`) — otherwise this reads across tenants.
 *
 * A 404 here means "no embedding for this record", not "no such record": the row may exist but not have
 * been embedded yet (embedding is asynchronous, and records without text are never embedded).
 */
export const findSimilarFeedbackRecords = async (
  id: string,
  params: SimilarRecordsParams = {}
): Promise<SimilarFeedbackRecordsResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const data = await client.feedbackRecords.retrieveSimilar(id, params);
    return { data, error: null };
  } catch (err) {
    // "No embedding for this record" is an expected state, not a fault: embedding is asynchronous and
    // records without text are never embedded. Logged at debug so the normal case doesn't write a stack
    // trace on every call — same treatment as a missing taxonomy tree below.
    if (getErrorStatus(err) === 404) {
      logger.debug({ id }, "Hub: no embedding for feedback record yet");
    } else {
      logger.warn({ err, id }, "Hub: findSimilarFeedbackRecords failed");
    }
    return createHubResultFromError(err);
  }
};

export const getFeedbackRecordTenant = async (recordId: string): Promise<FeedbackRecordTenantResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await cache.withCache(
      async () => {
        const feedbackRecord = await client.feedbackRecords.retrieve(recordId);
        return { tenantId: feedbackRecord.tenant_id };
      },
      createCacheKey.hub.feedbackRecordTenant(recordId),
      60_000
    );

    return { data, error: null };
  } catch (err) {
    logger.warn({ err, recordId }, "Hub: getFeedbackRecordTenant failed");
    const status = getErrorStatus(err);
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: { status, message, detail: message } };
  }
};

/**
 * Create multiple feedback records in the Hub in parallel.
 * Returns an array of results (data or error) per input; logs failures.
 */
export const createFeedbackRecordsBatch = async (
  inputs: FeedbackRecordCreateParams[]
): Promise<{ results: HubFeedbackRecordResult[] }> => {
  const client = getHubClient();
  if (!client) {
    return {
      results: inputs.map(() => ({ data: null, error: { ...NO_CONFIG_ERROR } })),
    };
  }

  const results = await Promise.all(
    inputs.map(async (input) => {
      try {
        const data = await client.feedbackRecords.create(input);
        return { data, error: null as HubFeedbackRecordResult["error"] };
      } catch (err) {
        logger.warn({ err, fieldId: input.field_id }, "Hub: createFeedbackRecord failed");
        return createHubResultFromError<FeedbackRecordData>(err);
      }
    })
  );
  return { results };
};

export const listTaxonomyFields = async (tenantId: string): Promise<HubResult<TaxonomyFieldsResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.listFields({ tenant_id: tenantId });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId }, "Hub: listTaxonomyFields failed");
    return createHubResultFromError(err);
  }
};

export const createTaxonomyRun = async (
  input: CreateTaxonomyRunInput
): Promise<HubResult<CreateTaxonomyRunResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.start(input);
    return { data, error: null };
  } catch (err) {
    logger.warn(
      {
        err,
        tenantId: input.tenant_id,
        sourceType: input.source_type,
        sourceId: input.source_id,
        fieldId: input.field_id,
      },
      "Hub: createTaxonomyRun failed"
    );
    return createHubResultFromError(err);
  }
};

export const listTaxonomyRuns = async (
  params: TaxonomyScopeInput & { limit?: number }
): Promise<HubResult<ListTaxonomyRunsResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.list(params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId: params.tenant_id }, "Hub: listTaxonomyRuns failed");
    return createHubResultFromError(err);
  }
};

export const getTaxonomyRun = async (runId: string, tenantId: string): Promise<HubResult<TaxonomyRun>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.retrieve(runId, { tenant_id: tenantId });
    return { data, error: null };
  } catch (err) {
    // A run is polled every few seconds while it generates, so a 404 (the run was deleted, or the id is
    // stale) would otherwise write a warning with a stack trace on every tick. It is a benign outcome —
    // the v3 route returns a 404 of its own — so log it at debug, same as the missing tree below.
    if (getErrorStatus(err) === 404) {
      logger.debug({ runId, tenantId }, "Hub: taxonomy run not found");
    } else {
      logger.warn({ err, runId, tenantId }, "Hub: getTaxonomyRun failed");
    }
    return createHubResultFromError(err);
  }
};

export const getActiveTaxonomyTree = async (
  scope: TaxonomyScopeInput
): Promise<HubResult<TaxonomyTreeResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.active.getTree(scope);
    return { data, error: null };
  } catch (err) {
    if (getErrorStatus(err) === 404) {
      logger.debug({ tenantId: scope.tenant_id }, "Hub: no active taxonomy tree yet");
    } else {
      logger.warn({ err, tenantId: scope.tenant_id }, "Hub: getActiveTaxonomyTree failed");
    }
    return createHubResultFromError(err);
  }
};

export const getTaxonomyTree = async (
  runId: string,
  tenantId: string
): Promise<HubResult<TaxonomyTreeResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.getTree(runId, { tenant_id: tenantId });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, runId, tenantId }, "Hub: getTaxonomyTree failed");
    return createHubResultFromError(err);
  }
};

export const renameTaxonomyNode = async (
  nodeId: string,
  input: RenameTaxonomyNodeInput
): Promise<HubResult<TaxonomyNode>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.nodes.rename(nodeId, input);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, nodeId, tenantId: input.tenant_id }, "Hub: renameTaxonomyNode failed");
    return createHubResultFromError(err);
  }
};

export const removeTaxonomyNode = async (
  nodeId: string,
  params: { tenant_id: string; actor_id: string }
): Promise<HubResult<TaxonomyNode>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.nodes.softRemove(nodeId, params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, nodeId, tenantId: params.tenant_id }, "Hub: removeTaxonomyNode failed");
    return createHubResultFromError(err);
  }
};

export const listTaxonomyNodeRecords = async (
  nodeId: string,
  params: { tenant_id: string; limit?: number }
): Promise<HubResult<TaxonomyNodeRecordsResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.nodes.listRecords(nodeId, params);
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, nodeId, tenantId: params.tenant_id }, "Hub: listTaxonomyNodeRecords failed");
    return createHubResultFromError(err);
  }
};

/**
 * Per-node distinct feedback-record counts (subtree totals) for a taxonomy run — one entry per visible
 * node. Feeds the tree/records count badges.
 */
export const listTaxonomyNodeRecordCounts = async (
  runId: string,
  tenantId: string
): Promise<HubResult<TaxonomyRecordCountsResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const data = await client.taxonomy.runs.retrieveRecordCounts(runId, { tenant_id: tenantId });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, runId, tenantId }, "Hub: listTaxonomyNodeRecordCounts failed");
    return createHubResultFromError(err);
  }
};
