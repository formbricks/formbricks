"use client";

import { useQuery } from "@tanstack/react-query";
import { isAuthFailure } from "@/modules/api/lib/v3-client";
import { getEnrichmentStatus } from "../lib/api-client";
import { ENRICHMENT_POLL_INTERVAL_MS, totalPendingEnrichments } from "../lib/enrichment";
import { enrichmentStatusKeys } from "../lib/query";

/**
 * Enrichment progress for a workspace's feedback directories — feeds the indicator above the records
 * table. The route is a live query on the Hub, so there is no staleness to work around; it self-polls
 * only while work is outstanding and stops at zero (or when the Hub is unavailable), the same way the
 * taxonomy fields query polls while embeddings catch up.
 */
export const useEnrichmentStatus = ({
  workspaceId,
  enabled = true,
}: Readonly<{ workspaceId: string; enabled?: boolean }>) =>
  useQuery({
    queryKey: enrichmentStatusKeys.status(workspaceId),
    enabled: enabled && workspaceId.length > 0,
    queryFn: ({ signal }) => getEnrichmentStatus({ workspaceId, signal }),
    refetchInterval: (query) => {
      // The last good answer may still show work pending, but a lost session or access won't come back by
      // asking again (ENG-2254). A remount, or the CSV import's invalidation, resumes the poll once it does
      // (this page's client does not refetch on focus).
      if (isAuthFailure(query.state.error)) {
        return false;
      }
      const data = query.state.data;
      if (!data || data.unavailable) {
        return false;
      }
      return totalPendingEnrichments(data.enrichments) > 0 ? ENRICHMENT_POLL_INTERVAL_MS : false;
    },
  });
