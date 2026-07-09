import type FormbricksHub from "@formbricks/hub";

export type FeedbackRecordCreateParams = FormbricksHub.FeedbackRecordCreateParams;
export type FeedbackRecordListParams = FormbricksHub.FeedbackRecordListParams;
export type FeedbackRecordUpdateParams = FormbricksHub.FeedbackRecordUpdateParams;

// Hub-derived, read-only translation fields (ENG-1255). The published SDK predates them, so bridge
// them as optional reads; drop once the SDK ships them. May be null when translation is off/pending.
// `emotions` is a read-only enrichment field that also predates the SDK type (the DB column is a
// Postgres text[]); absent until a record is enriched. Typed to accept either the serialized array
// or a comma-joined string, since the serialization is owned by the external hub service.
export type FeedbackRecordData = FormbricksHub.FeedbackRecordData & {
  value_text_translated?: string | null;
  translation_lang_key?: string | null;
  emotions?: string[] | string | null;
};

export type FeedbackRecordListResponse = Omit<FormbricksHub.FeedbackRecordListResponse, "data"> & {
  data: FeedbackRecordData[];
};

export type SemanticSearchInput = FormbricksHub.FeedbackRecords.SearchPerformSemanticSearchParams;
export type SemanticSearchResponse = FormbricksHub.FeedbackRecords.SearchPerformSemanticSearchResponse;
export type SemanticSearchResultItem = FormbricksHub.FeedbackRecords.SearchPerformSemanticSearchResponse.Data;

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
