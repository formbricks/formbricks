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
 * vs. how many carry it), not queue depth. `pending` is `eligible - done - failedTerminal` rather than
 * the plain difference: a record whose enrichment permanently gave up (content filter, refusal,
 * truncation — ENG-2375) would otherwise read as "still in progress" forever, since nothing about it
 * changes on its own. `failedTerminal` is reported separately so the UI can say so rather than count
 * it as work still moving.
 *
 * This still isn't the full picture — a record whose enrichment was switched on after it already
 * existed was never enqueued at all, and neither `done` nor `failedTerminal` accounts for it, so it
 * remains indistinguishable from genuinely in-flight work until ENG-2376 (auto-requeue) ships.
 */
export type TEnrichmentProgress = {
  kind: TEnrichmentKind;
  eligible: number;
  done: number;
  failedTerminal: number;
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

/**
 * Total permanently-failed records across all enrichments. Kept separate from
 * `totalPendingEnrichments` so the banner can stay up to report failures even once nothing is left
 * that could still complete — otherwise the one moment a permanent failure becomes the final answer
 * (pending hits 0) is exactly when it would disappear.
 */
export const totalFailedTerminalEnrichments = (enrichments: TEnrichmentProgress[]): number =>
  enrichments.reduce((sum, enrichment) => sum + enrichment.failedTerminal, 0);
