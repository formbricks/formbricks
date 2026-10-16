import type {
  CountFeedbackRecordsData,
  CountFeedbackRecordsOutputBody,
  CreateFeedbackRecordInputBody,
  EnrichmentStatusOutputBody,
  FeedbackRecordTaxonomyOutputBody,
  EnrichmentTypeStatus as HubEnrichmentTypeStatus,
  FeedbackRecordData as HubFeedbackRecordData,
  SemanticSearchResponse as HubSemanticSearchResponse,
  SemanticSearchResultItem as HubSemanticSearchResultItem,
  ListFeedbackRecordsData,
  ListFeedbackRecordsOutputBody,
  SemanticSearchFeedbackRecordsData,
  SemanticSearchInputBody,
  SimilarFeedbackRecordsData,
  UpdateFeedbackRecordInputBody,
} from "@formbricks/hub";

export type FeedbackRecordCreateParams = CreateFeedbackRecordInputBody;
export type FeedbackRecordListParams = ListFeedbackRecordsData["query"];
export type FeedbackRecordUpdateParams = UpdateFeedbackRecordInputBody;

// The SDK's own read shape, translation, enrichment and taxonomy fields included. Hub serializes each
// enrichment field `omitempty` from a pointer (`internal/models/feedback_records.go`), so an unset one is
// absent rather than null, and `emotions` is always an array — which is exactly how the SDK types them.
// `taxonomy` (hub#136) is only on the single-record GET, and null when the lookup is unavailable.
export type FeedbackRecordData = HubFeedbackRecordData;
export type FeedbackRecordListResponse = ListFeedbackRecordsOutputBody;

// `GET /v1/feedback-records/count` — the Hub documents it as taking the same query parameters as the
// list endpoint, minus pagination, and answering with a single total.
export type FeedbackRecordCountParams = CountFeedbackRecordsData["query"];
export type FeedbackRecordCountResponse = CountFeedbackRecordsOutputBody;

// The Hub takes the search text in the body and its paging controls in the query. Callers pass one flat
// object and `semanticSearchFeedbackRecords` splits it, as the Stainless SDK used to.
export type SemanticSearchInput = SemanticSearchInputBody &
  NonNullable<SemanticSearchFeedbackRecordsData["query"]>;
export type SemanticSearchResponse = HubSemanticSearchResponse;
export type SemanticSearchResultItem = HubSemanticSearchResultItem;

// Nearest-neighbour lookup for one record. The Hub returns the same row shape as semantic search (id +
// score + field label + text), so the two are interchangeable downstream — one serializer covers both.
export type SimilarRecordsParams = NonNullable<SimilarFeedbackRecordsData["query"]>;
export type SimilarRecordsResponse = HubSemanticSearchResponse;
export type SimilarRecordsResultItem = HubSemanticSearchResultItem;

// Tenant-scoped enrichment progress (ENG-1670). Counts are data-derived from the directory's feedback
// records — how many qualify for an enrichment vs. how many carry it — not queue depth, so `done` never
// exceeds `eligible` and "in progress" is the difference. `enabled: false` means the enrichment is
// switched off for the tenant or not configured in the deployment, and its counts are zero.
//
// `failed`/`failed_terminal` (ENG-2375, hub PR formbricks/hub#125) split what used to be silently
// folded into `eligible - done`: `failed` is a transient failure River will retry; `failed_terminal`
// gave up for good (content filter, refusal, truncation) and will never complete on its own. Without
// this, a permanently-failed record read as "still in progress" forever and the poll never stopped.
// Note: `eligible - done - failed - failed_terminal` is not always 0 — a record whose enrichment was
// enabled after it already existed was never enqueued at all, and neither done nor failed accounts for
// it (ENG-2376 tracks auto-requeueing that residual; out of scope here).
//
// The SDK types both as always present, which is true of the Hub it was generated from but not of every
// Hub this app talks to: Hubs older than hub#125 (0.8.5, for example) omit them. So they are re-declared optional — via `Omit`, because intersecting an optional member with the
// SDK's required one collapses back to required and silently discards the absence.
//
// `failed` is intentionally not read by the aggregator: a transient failure is still going to be
// retried by River, so it stays folded into `pending` the same way it always did — only
// `failed_terminal` (which will never resolve on its own) is pulled out and shown separately.
export type EnrichmentTypeStatus = Omit<HubEnrichmentTypeStatus, "failed" | "failed_terminal"> & {
  failed?: number;
  failed_terminal?: number;
};
// The three per-enrichment keys are re-declared optional (the SDK types them as always-present)
// because the aggregator treats an absent key as "disabled" rather than assuming the Hub always
// answers with all three — matching the `status?.enabled` optional-chaining it already does.
// `as_of` is optional for the same older-Hub reason as the failure counters: Hubs older than hub#125
// answer without it.
export type EnrichmentStatusResponse = Omit<
  EnrichmentStatusOutputBody,
  "as_of" | "translation" | "sentiment" | "emotions"
> & {
  as_of?: string;
  translation?: EnrichmentTypeStatus;
  sentiment?: EnrichmentTypeStatus;
  emotions?: EnrichmentTypeStatus;
};

export type TaxonomyScope = {
  tenant_id: string;
  source_type: string;
  source_id: string;
  field_id: string;
};

export type TaxonomyScopeType = "field" | "directory";

/**
 * Scope used to address taxonomy reads/writes. `field` scope carries source/field; `directory` scope
 * (`scope_type: "directory"`) covers all text feedback in the tenant and omits source/field entirely
 * (the Hub rejects source/field params for directory scope).
 */
export type TaxonomyScopeInput = {
  tenant_id: string;
  scope_type?: TaxonomyScopeType;
  source_type?: string;
  source_id?: string;
  field_id?: string;
};

export type TaxonomyFieldOption = TaxonomyScope & {
  source_name?: string;
  field_label?: string;
  record_count: number;
  embedding_count: number;
};

export type TaxonomyRunStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

export type TaxonomyRunFailureCode =
  | "insufficient_data"
  | "service_unavailable"
  | "generation_failed"
  | "invalid_output"
  | "internal_error";

export type TaxonomyRun = TaxonomyScope & {
  id: string;
  scope_type?: TaxonomyScopeType;
  field_label?: string;
  status: TaxonomyRunStatus;
  params?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  record_count: number;
  embedding_count: number;
  cluster_count: number;
  node_count: number;
  error?: string;
  error_code?: TaxonomyRunFailureCode;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};

export type TaxonomyNode = {
  id: string;
  run_id: string;
  parent_id?: string;
  cluster_id?: string;
  node_type: "root" | "branch" | "leaf";
  label: string;
  original_label?: string;
  description?: string;
  level: number;
  sort_order: number;
  metadata?: Record<string, unknown>;
  removed_at?: string;
  removed_by?: string;
  created_at: string;
  updated_at: string;
  children?: TaxonomyNode[];
};

/** A record's place in its directory's active taxonomy — `FeedbackRecordData["taxonomy"]`, non-null. */
export type FeedbackRecordTaxonomy = FeedbackRecordTaxonomyOutputBody;

export type TaxonomyFieldsResponse = {
  data: TaxonomyFieldOption[];
};

export type CreateTaxonomyRunInput = TaxonomyScopeInput & {
  field_label?: string;
  actor_id?: string;
};

export type CreateTaxonomyRunResponse = {
  run: TaxonomyRun;
  in_progress: boolean;
};

export type ListTaxonomyRunsResponse = {
  data: TaxonomyRun[];
};

export type TaxonomyTreeResponse = {
  run: TaxonomyRun;
  root: TaxonomyNode | null;
};

export type RenameTaxonomyNodeInput = {
  tenant_id: string;
  actor_id: string;
  label: string;
};

export type TaxonomyNodeRecordsResponse = {
  data: FeedbackRecordData[];
  limit: number;
};

/** Distinct feedback-record count for a taxonomy node's subtree (node + its visible descendants). */
export type TaxonomyNodeRecordCount = {
  node_id: string;
  record_count: number;
};

/** Per-node record counts for a taxonomy run — one entry per visible node, subtree totals. */
export type TaxonomyRecordCountsResponse = {
  counts: TaxonomyNodeRecordCount[];
};
