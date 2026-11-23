"use client";

import { useQuery } from "@tanstack/react-query";
import { getTags } from "../lib/api-client";
import { tagKeys } from "../lib/query";

/**
 * A workspace's tags with their response counts: the tags table's only data source, and the response
 * sample modal's tag picker, which reads them only once it opens (`enabled`).
 */
export const useTags = (workspaceId: string, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: tagKeys.list(workspaceId),
    enabled,
    queryFn: ({ signal }) => getTags({ workspaceId, signal }),
  });
