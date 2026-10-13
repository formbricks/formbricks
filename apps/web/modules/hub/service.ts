import "server-only";
import { createCacheKey } from "@formbricks/cache";
import * as hub from "@formbricks/hub";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { getHubClient } from "./hub-client";
import { assertSerializableHubQuery } from "./hub-query-guard";
import type {
  CreateTaxonomyRunInput,
  CreateTaxonomyRunResponse,
  EnrichmentStatusResponse,
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
  getHubErrorHint,
} from "./utils";

export type HubFeedbackRecordResult = {
  data: FeedbackRecordData | null;
  error: HubError | null;
};

/**
 * Create a single feedback record in the Hub.
 * Returns a result shape with data or error; logs failures.
 *
 * value_id is the stable id of the matched choice (ENG-1673).
 */
export const createFeedbackRecord = async (
  input: FeedbackRecordCreateParams
): Promise<HubFeedbackRecordResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }
  try {
    const { data } = await hub.createFeedbackRecord({ client, body: input, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, fieldId: input.field_id, hint: getHubErrorHint(err) },
      "Hub: createFeedbackRecord failed"
    );
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
    const { data } = await hub.getFeedbackRecord({ client, path: { id }, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id, hint: getHubErrorHint(err) }, "Hub: retrieveFeedbackRecord failed");
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
    const { data } = await hub.updateFeedbackRecord({
      client,
      path: { id },
      body: input,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, id, hint: getHubErrorHint(err) }, "Hub: updateFeedbackRecord failed");
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
    await hub.deleteFeedbackRecord({ client, path: { id }, throwOnError: true });
    return { data: { deleted: true }, error: null };
  } catch (err) {
    logger.warn({ err, id, hint: getHubErrorHint(err) }, "Hub: deleteFeedbackRecord failed");
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

/**
 * Purge ALL Hub-owned data for a tenant: feedback records, derived embeddings, the tenant's entire
 * taxonomy, its webhooks, and its settings. This is the offboarding purge — call it when the owning
 * organization is deleted so Hub-side rows don't become orphaned, not to empty a dataset that stays
 * in use (see `purgeHubFeedbackRecords` for that). Idempotent on the Hub side; the caller treats
 * failures as best-effort.
 *
 * The Hub also returns per-table taxonomy counts. They are not surfaced because the only caller is
 * the org-delete cascade, which logs nothing and acts on nothing — add them here if a caller ever
 * needs to report what was removed.
 */
export const deleteHubTenantData = async (tenantId: string): Promise<HubTenantDataDeleteResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const { data } = await hub.deleteTenantData({
      client,
      path: { tenant_id: tenantId },
      throwOnError: true,
    });
    return {
      data: {
        deletedFeedbackRecords: data.deleted_feedback_records,
        deletedEmbeddings: data.deleted_embeddings,
        deletedWebhooks: data.deleted_webhooks,
      },
      error: null,
    };
  } catch (err) {
    logger.warn({ err, tenantId, hint: getHubErrorHint(err) }, "Hub: deleteHubTenantData failed");
    // Via the shared helper so callers get the Hub's problem members (`code`, `problemDetail`)
    // rather than an opaque message — same reasoning as `deleteFeedbackRecord`.
    return createHubResultFromError(err);
  }
};

export type HubFeedbackRecordsPurgeResult = {
  data: { tenantId: string; status: string } | null;
  error: HubError | null;
};

/**
 * Purge every feedback record for a tenant, everything derived from those records (embeddings and
 * the enrichment stored on each record) and the taxonomy built on them. Unlike `deleteHubTenantData`
 * it leaves the tenant's *configuration* — its webhooks and settings — in place, so the dataset
 * stays usable and any integrator setup survives. This is the "empty this dataset" operation, not
 * offboarding.
 *
 * Asynchronous on the Hub side: this returns once the purge has been *accepted*, not once it has
 * run, so there is no deleted count to report and the records are still present when it resolves.
 * `countFeedbackRecords` is how a caller can observe completion if it needs to. Safe to call
 * repeatedly — a request while a purge is already running joins it.
 */
export const purgeHubFeedbackRecords = async (tenantId: string): Promise<HubFeedbackRecordsPurgeResult> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const { data } = await hub.purgeTenantFeedbackRecords({
      client,
      path: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data: { tenantId: data.tenant_id, status: data.status }, error: null };
  } catch (err) {
    logger.warn({ err, tenantId, hint: getHubErrorHint(err) }, "Hub: purgeHubFeedbackRecords failed");
    return createHubResultFromError(err);
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
    // Before the SDK serializes the filters: it silently drops an empty array or a null, which would widen
    // the result instead of narrowing it. Inside the try, so a refusal is the same relayed error as any other.
    assertSerializableHubQuery(params);
    const { data } = await hub.listFeedbackRecords({ client, query: params, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, hint: getHubErrorHint(err) }, "Hub: listFeedbackRecords failed");
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
    // See listFeedbackRecords: the same filters, so the same guard.
    assertSerializableHubQuery(params);
    const { data } = await hub.countFeedbackRecords({ client, query: params, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, tenantId: params.tenant_id, hint: getHubErrorHint(err) },
      "Hub: countFeedbackRecords failed"
    );
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
  // The search text travels in the body and the paging controls in the query string.
  const { query, tenant_id, ...pagination } = input;

  try {
    const { data } = await hub.semanticSearchFeedbackRecords({
      client,
      body: { query, tenant_id },
      query: pagination,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, tenantId: input.tenant_id, hint: getHubErrorHint(err) },
      "Hub: semanticSearchFeedbackRecords failed"
    );
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
    const { data } = await hub.similarFeedbackRecords({
      client,
      path: { id },
      query: params,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    // "No embedding for this record" is an expected state, not a fault: embedding is asynchronous and
    // records without text are never embedded. Logged at debug so the normal case doesn't write a stack
    // trace on every call — same treatment as a missing taxonomy tree below.
    if (getErrorStatus(err) === 404) {
      logger.debug({ id }, "Hub: no embedding for feedback record yet");
    } else {
      logger.warn({ err, id, hint: getHubErrorHint(err) }, "Hub: findSimilarFeedbackRecords failed");
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
        const { data: feedbackRecord } = await hub.getFeedbackRecord({
          client,
          path: { id: recordId },
          throwOnError: true,
        });
        return { tenantId: feedbackRecord.tenant_id };
      },
      createCacheKey.hub.feedbackRecordTenant(recordId),
      60_000
    );

    return { data, error: null };
  } catch (err) {
    logger.warn({ err, recordId, hint: getHubErrorHint(err) }, "Hub: getFeedbackRecordTenant failed");
    const status = getErrorStatus(err);
    const message = getErrorMessage(err);
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
        const { data } = await hub.createFeedbackRecord({ client, body: input, throwOnError: true });
        return { data, error: null as HubFeedbackRecordResult["error"] };
      } catch (err) {
        logger.warn(
          { err, fieldId: input.field_id, hint: getHubErrorHint(err) },
          "Hub: createFeedbackRecord failed"
        );
        return createHubResultFromError<FeedbackRecordData>(err);
      }
    })
  );
  return { results };
};

/**
 * Per-tenant enrichment progress (translation, sentiment, emotions) — ENG-1670.
 *
 * A live query on the Hub side, so there is nothing to cache here: the caller polls it while work is
 * outstanding and stops once nothing is pending.
 */
export const getEnrichmentStatus = async (tenantId: string): Promise<HubResult<EnrichmentStatusResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const { data } = await hub.getEnrichmentStatus({
      client,
      query: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId, hint: getHubErrorHint(err) }, "Hub: getEnrichmentStatus failed");
    return createHubResultFromError(err);
  }
};

export const listTaxonomyFields = async (tenantId: string): Promise<HubResult<TaxonomyFieldsResponse>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const { data } = await hub.listTaxonomyFields({
      client,
      query: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, tenantId, hint: getHubErrorHint(err) }, "Hub: listTaxonomyFields failed");
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
    const { data } = await hub.createTaxonomyRun({ client, body: input, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      {
        err,
        tenantId: input.tenant_id,
        sourceType: input.source_type,
        sourceId: input.source_id,
        fieldId: input.field_id,
        hint: getHubErrorHint(err),
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
    const { data } = await hub.listTaxonomyRuns({ client, query: params, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, tenantId: params.tenant_id, hint: getHubErrorHint(err) },
      "Hub: listTaxonomyRuns failed"
    );
    return createHubResultFromError(err);
  }
};

export const getTaxonomyRun = async (runId: string, tenantId: string): Promise<HubResult<TaxonomyRun>> => {
  const client = getHubClient();
  if (!client) {
    return { data: null, error: { ...NO_CONFIG_ERROR } };
  }

  try {
    const { data } = await hub.getTaxonomyRun({
      client,
      path: { run_id: runId },
      query: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    // A run is polled every few seconds while it generates, so a 404 (the run was deleted, or the id is
    // stale) would otherwise write a warning with a stack trace on every tick. It is a benign outcome —
    // the v3 route returns a 404 of its own — so log it at debug, same as the missing tree below.
    if (getErrorStatus(err) === 404) {
      logger.debug({ runId, tenantId }, "Hub: taxonomy run not found");
    } else {
      logger.warn({ err, runId, tenantId, hint: getHubErrorHint(err) }, "Hub: getTaxonomyRun failed");
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
    const { data } = await hub.getActiveTaxonomyTree({ client, query: scope, throwOnError: true });
    return { data, error: null };
  } catch (err) {
    if (getErrorStatus(err) === 404) {
      logger.debug({ tenantId: scope.tenant_id }, "Hub: no active taxonomy tree yet");
    } else {
      logger.warn(
        { err, tenantId: scope.tenant_id, hint: getHubErrorHint(err) },
        "Hub: getActiveTaxonomyTree failed"
      );
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
    const { data } = await hub.getTaxonomyRunTree({
      client,
      path: { run_id: runId },
      query: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn({ err, runId, tenantId, hint: getHubErrorHint(err) }, "Hub: getTaxonomyTree failed");
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
    const { data } = await hub.renameTaxonomyNode({
      client,
      path: { node_id: nodeId },
      body: input,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, nodeId, tenantId: input.tenant_id, hint: getHubErrorHint(err) },
      "Hub: renameTaxonomyNode failed"
    );
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
    const { data } = await hub.removeTaxonomyNode({
      client,
      path: { node_id: nodeId },
      query: params,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, nodeId, tenantId: params.tenant_id, hint: getHubErrorHint(err) },
      "Hub: removeTaxonomyNode failed"
    );
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
    const { data } = await hub.listTaxonomyNodeRecords({
      client,
      path: { node_id: nodeId },
      query: params,
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, nodeId, tenantId: params.tenant_id, hint: getHubErrorHint(err) },
      "Hub: listTaxonomyNodeRecords failed"
    );
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
    const { data } = await hub.countTaxonomyNodeRecords({
      client,
      path: { run_id: runId },
      query: { tenant_id: tenantId },
      throwOnError: true,
    });
    return { data, error: null };
  } catch (err) {
    logger.warn(
      { err, runId, tenantId, hint: getHubErrorHint(err) },
      "Hub: listTaxonomyNodeRecordCounts failed"
    );
    return createHubResultFromError(err);
  }
};
