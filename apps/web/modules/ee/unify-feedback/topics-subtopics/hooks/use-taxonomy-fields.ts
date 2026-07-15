"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaxonomyFields } from "../lib/api-client";
import { EMBEDDING_POLL_INTERVAL_MS, pendingEmbeddingsForFields } from "../lib/gate";
import { taxonomyKeys } from "../lib/query";

/**
 * Taxonomy fields for a directory — feeds the source/field selectors, the gate math, and the
 * embedding-progress indicator. While records are still being embedded, self-polls (stopping at 0 or
 * when the Hub reports unavailable), replacing the legacy 1s `setTimeout` loop.
 */
export const useTaxonomyFields = ({
  workspaceId,
  directoryId,
  enabled = true,
}: Readonly<{ workspaceId: string; directoryId: string; enabled?: boolean }>) =>
  useQuery({
    queryKey: taxonomyKeys.fields(workspaceId, directoryId),
    enabled: enabled && directoryId.length > 0,
    queryFn: ({ signal }) => getTaxonomyFields({ workspaceId, directoryId, signal }),
    staleTime: 30_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.unavailable) {
        return false;
      }
      return pendingEmbeddingsForFields(data.fields) > 0 ? EMBEDDING_POLL_INTERVAL_MS : false;
    },
  });
