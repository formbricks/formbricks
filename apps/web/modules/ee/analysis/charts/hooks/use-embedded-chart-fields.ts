"use client";

import { useQuery } from "@tanstack/react-query";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TEmbeddedChartField } from "@/modules/ee/analysis/lib/embedded-data-fields";

const NO_FIELDS: TEmbeddedChartField[] = [];

/** Client fetcher for the internal embedded-data-fields route. Forwards the TanStack `signal`. */
async function fetchEmbeddedChartFields(params: {
  workspaceId: string;
  feedbackDirectoryId: string;
  signal?: AbortSignal;
}): Promise<TEmbeddedChartField[]> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    datasetId: params.feedbackDirectoryId,
  });
  const response = await fetch(`/api/internal/embedded-data-fields?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TEmbeddedChartField[] }).data;
}

/**
 * The Embedded Data fields the chart builder offers for a dataset (ENG-2848). A failed or pending load
 * offers none, so the builder keeps working with the fixed fields.
 */
export function useEmbeddedChartFields(
  workspaceId: string,
  feedbackDirectoryId: string | null | undefined
): TEmbeddedChartField[] {
  const { data } = useQuery({
    queryKey: ["embeddedChartFields", workspaceId, feedbackDirectoryId],
    queryFn: ({ signal }) =>
      fetchEmbeddedChartFields({ workspaceId, feedbackDirectoryId: feedbackDirectoryId!, signal }),
    enabled: Boolean(workspaceId && feedbackDirectoryId),
    staleTime: 60_000,
  });
  return data ?? NO_FIELDS;
}
