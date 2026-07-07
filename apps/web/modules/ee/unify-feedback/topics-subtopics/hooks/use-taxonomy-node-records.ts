"use client";

import { useQuery } from "@tanstack/react-query";
import { getTaxonomyNodeRecords } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

export const NODE_RECORD_LIMIT = 100;

/** A capped sample of the feedback records under the selected node. Cached per node, so re-selecting
 * an already-viewed node is instant. */
export const useTaxonomyNodeRecords = ({
  workspaceId,
  directoryId,
  nodeId,
  limit = NODE_RECORD_LIMIT,
  enabled = true,
}: Readonly<{
  workspaceId: string;
  directoryId: string;
  nodeId: string | null;
  limit?: number;
  enabled?: boolean;
}>) =>
  useQuery({
    queryKey: taxonomyKeys.nodeRecords(workspaceId, directoryId, nodeId ?? "", limit),
    enabled: enabled && nodeId !== null,
    queryFn: ({ signal }) => {
      if (!nodeId) {
        throw new Error("nodeId is required");
      }
      return getTaxonomyNodeRecords({ workspaceId, directoryId, nodeId, limit, signal });
    },
    staleTime: 5 * 60_000,
  });
