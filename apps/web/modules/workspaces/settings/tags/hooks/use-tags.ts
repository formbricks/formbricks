"use client";

import { useQuery } from "@tanstack/react-query";
import { getTags } from "../lib/api-client";
import { tagKeys } from "../lib/query";

/** A workspace's tags with their response counts — the table's only data source. */
export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: tagKeys.list(workspaceId),
    queryFn: ({ signal }) => getTags({ workspaceId, signal }),
  });
