import {
  ENRICHMENT_KINDS,
  type TEnrichmentProgress,
} from "@/modules/ee/unify-feedback/enrichment-status/lib/enrichment";
import type { EnrichmentStatusResponse } from "@/modules/hub/types";

/**
 * Fold the per-directory Hub responses into one progress row per enrichment.
 *
 * The Feedback Data page merges records from every directory assigned to the workspace and offers no
 * directory selector, so the indicator above the table has to speak for the same set. Records are
 * partitioned by directory, so summing the per-directory counts gives workspace totals without
 * double-counting.
 *
 * Only directories where the enrichment is switched on contribute: a disabled directory reports zeros,
 * and folding those in would drag a shared progress bar toward a denominator that can never grow. An
 * enrichment disabled everywhere is dropped entirely.
 */
export function aggregateEnrichmentStatus(
  statuses: readonly EnrichmentStatusResponse[]
): TEnrichmentProgress[] {
  const enrichments: TEnrichmentProgress[] = [];

  for (const kind of ENRICHMENT_KINDS) {
    // Tolerate a Hub that predates a given enrichment: an absent key reads as disabled, not as NaN.
    const enabledStatuses = statuses.map((status) => status[kind]).filter((status) => status?.enabled);
    if (enabledStatuses.length === 0) continue;

    const eligible = enabledStatuses.reduce((sum, status) => sum + (status.eligible || 0), 0);
    const done = enabledStatuses.reduce((sum, status) => sum + (status.done || 0), 0);

    enrichments.push({ kind, eligible, done, pending: Math.max(0, eligible - done) });
  }

  return enrichments;
}
