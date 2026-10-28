import { z } from "zod";

/**
 * What the taxonomy and enrichment-status operations answer with, as Zod schemas, so MCP output schemas
 * derive from them instead of retyping the shape. They describe the Hub's snake_case payloads as the
 * operations pass them through (see `modules/hub/types.ts`).
 *
 * Loose on purpose: the Hub adds fields over time and the SDK validates every successful tool result
 * against its advertised schema, so a field this file has not heard of must pass through rather than turn
 * a working call into a failure. Only the keys the Hub always sends are required.
 */

const ZV3TaxonomyScopeType = z.enum(["field", "directory"]);

export const ZV3TaxonomyRun = z
  .object({
    id: z.string(),
    scope_type: ZV3TaxonomyScopeType.optional(),
    tenant_id: z.string(),
    source_type: z.string(),
    source_id: z.string(),
    field_id: z.string(),
    field_label: z.string().optional(),
    status: z.enum(["pending", "running", "succeeded", "failed", "canceled"]),
    params: z.record(z.string(), z.unknown()).optional(),
    metrics: z.record(z.string(), z.unknown()).optional(),
    record_count: z.number().int(),
    embedding_count: z.number().int(),
    cluster_count: z.number().int(),
    node_count: z.number().int(),
    error: z.string().optional(),
    error_code: z
      .enum([
        "insufficient_data",
        "service_unavailable",
        "generation_failed",
        "invalid_output",
        "internal_error",
      ])
      .optional(),
    started_at: z.string().optional(),
    finished_at: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .loose();

type TV3TaxonomyNodeShape = {
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
  children?: TV3TaxonomyNodeShape[];
};

export const ZV3TaxonomyNode: z.ZodType<TV3TaxonomyNodeShape> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      run_id: z.string(),
      parent_id: z.string().optional(),
      cluster_id: z.string().optional(),
      node_type: z.enum(["root", "branch", "leaf"]),
      label: z.string(),
      original_label: z.string().optional(),
      description: z.string().optional(),
      level: z.number().int(),
      sort_order: z.number().int(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      removed_at: z.string().optional(),
      removed_by: z.string().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      children: z.array(ZV3TaxonomyNode).optional(),
    })
    .loose()
);

/** A field topics can be generated for, with how much feedback and how many embeddings it has. */
export const ZV3TaxonomyField = z
  .object({
    tenant_id: z.string(),
    source_type: z.string(),
    source_id: z.string(),
    source_name: z.string().optional(),
    field_id: z.string(),
    field_label: z.string().optional(),
    record_count: z.number().int(),
    embedding_count: z.number().int(),
    embedding_failed_count: z.number().int().optional(),
    embedding_failed_terminal_count: z.number().int().optional(),
  })
  .loose();

export const ZV3TaxonomyFieldsResource = z
  .object({ fields: z.array(ZV3TaxonomyField), unavailable: z.boolean() })
  .loose();

export const ZV3TaxonomyStateResource = z
  .object({
    activeTree: z.object({ run: ZV3TaxonomyRun, root: ZV3TaxonomyNode.nullable() }).loose().nullable(),
    runs: z.array(ZV3TaxonomyRun),
    unavailable: z.boolean(),
  })
  .loose();

export const ZV3TaxonomyRunStartResource = z.object({ run: ZV3TaxonomyRun, inProgress: z.boolean() }).loose();

export const ZV3TaxonomyRecordCountsResource = z
  .object({ counts: z.array(z.object({ node_id: z.string(), record_count: z.number().int() }).loose()) })
  .loose();

/** The feedback record keys the Hub always sends; the rest are the same fields `get_feedback_record` returns. */
export const ZV3TaxonomyNodeRecord = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    source_type: z.string(),
    field_id: z.string(),
    field_type: z.string(),
    submission_id: z.string(),
    collected_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .loose();

/** The list's `meta` is the Hub's applied cap and nothing else: no cursor, no total. */
export const ZV3TaxonomyNodeRecordsMeta = z.object({ limit: z.number().int() }).loose();

export const ZV3EnrichmentStatusResource = z
  .object({
    enrichments: z.array(
      z
        .object({
          kind: z.enum(["translation", "sentiment", "emotions"]),
          eligible: z.number().int(),
          done: z.number().int(),
          failedTerminal: z.number().int(),
          pending: z.number().int(),
        })
        .loose()
    ),
    unavailable: z.boolean(),
  })
  .loose();
