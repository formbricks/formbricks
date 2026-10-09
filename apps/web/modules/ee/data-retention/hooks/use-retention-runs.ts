"use client";

import { keepPreviousData, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { type TRetentionRunListInput, fetchRetentionExport, listRetentionRuns } from "../lib/api-client";
import { saveBlobAsFile } from "../lib/file-download";
import { flattenRetentionRunPages, retentionRunKeys } from "../lib/query";

/** History, newest first, one keyset page at a time ("Load more"). */
export const useRetentionRuns = ({
  enabled = true,
  ...input
}: TRetentionRunListInput & { enabled?: boolean }) => {
  const queryKey = retentionRunKeys.list(input);

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) => listRetentionRuns({ ...input, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  });

  return { ...query, queryKey, runs: flattenRetentionRunPages(query.data) };
};

/**
 * Download the History CSV: fetched, then saved as a file only once the server has answered 200. The
 * whole body is held in memory until then, so leaving the page (or starting a new download) aborts
 * the request in flight.
 */
export const useDownloadRetentionExport = ({ organizationId }: { organizationId: string }) => {
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  return useMutation({
    mutationFn: async () => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      const { blob, fileName } = await fetchRetentionExport({ organizationId, signal: controller.signal });
      if (!controller.signal.aborted) saveBlobAsFile(blob, fileName);
    },
  });
};
