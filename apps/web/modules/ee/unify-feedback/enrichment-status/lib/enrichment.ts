/**
 * Shape and pure helpers for the Unify Feedback enrichment-status indicator (ENG-1670 / ENG-2128).
 *
 * Imported by both the v3 route that builds the payload and the client that renders it, so it stays
 * free of server-only and React imports.
 */

export const ENRICHMENT_KINDS = ["translation", "sentiment", "emotions"] as const;

export type TEnrichmentKind = (typeof ENRICHMENT_KINDS)[number];

/**
 * One enrichment's progress, already aggregated across the workspace's feedback directories.
 *
 * `eligible`/`done` are data-derived counts of feedback records (how many qualify for the enrichment
 * vs. how many carry it), not queue depth — so `done` never exceeds `eligible` and `pending` is simply
 * the difference. Because `eligible` covers the whole historical corpus, this reads as an "N pending"
 * count in steady state and as a real 0→100% bar during a (re)enablement backfill.
 */
export type TEnrichmentProgress = {
  kind: TEnrichmentKind;
  eligible: number;
  done: number;
  pending: number;
};

export type TEnrichmentStatusResponse = {
  /**
   * Only the enrichments enabled for at least one of the workspace's directories. A disabled
   * enrichment is omitted rather than reported as 0/0 — it will never progress, so a bar for it would
   * be permanently stuck at zero.
   */
  enrichments: TEnrichmentProgress[];
  /** The Hub could not be reached. Render nothing and stop polling rather than showing a false zero. */
  unavailable: boolean;
};

/** Poll cadence while enrichment work is still outstanding. */
export const ENRICHMENT_POLL_INTERVAL_MS = 5000;

export const totalPendingEnrichments = (enrichments: TEnrichmentProgress[]): number =>
  enrichments.reduce((sum, enrichment) => sum + enrichment.pending, 0);
